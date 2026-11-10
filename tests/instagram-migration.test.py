#!/usr/bin/env python3
"""Regression tests for the draft Instagram OAuth D1 migration.

Uses Python's standard-library SQLite binding; no network, credentials, or
Cloudflare resources are touched.
"""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0001_instagram_oauth.sql"


class InstagramOAuthMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = sqlite3.connect(":memory:")
        cls.db.row_factory = sqlite3.Row
        if sqlite3.sqlite_version_info < (3, 35, 0):
            raise RuntimeError("SQLite >= 3.35 is required for DELETE ... RETURNING")
        cls.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def test_expected_tables_and_indexes_exist(self):
        names = {r["name"] for r in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table', 'index')"
        )}
        self.assertTrue({"instagram_oauth_states", "instagram_connections",
                         "idx_instagram_oauth_states_expiry",
                         "idx_instagram_connections_status_expiry"} <= names)

    def test_oauth_state_constraints_and_single_use_consumption(self):
        good = "a" * 64
        self.db.execute(
            "INSERT INTO instagram_oauth_states(state_hash, identity_digest, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (good, "b" * 64, 100, 700),
        )
        consume = """
          DELETE FROM instagram_oauth_states
          WHERE state_hash = ? AND identity_digest = ? AND expires_at > ?
          RETURNING purpose, created_at, expires_at
        """
        first = self.db.execute(consume, (good, "b" * 64, 200)).fetchone()
        second = self.db.execute(consume, (good, 200)).fetchone()
        self.assertIsNotNone(first)
        self.assertEqual(first["purpose"], "instagram_login")
        self.assertIsNone(second)

        self.db.execute(
            "INSERT INTO instagram_oauth_states(state_hash, identity_digest, created_at, expires_at) VALUES (?, ?, ?, ?)",
            ("b" * 64, "c" * 64, 100, 150),
        )
        self.assertIsNone(self.db.execute(consume, ("b" * 64, "c" * 64, 150)).fetchone())

        invalid_rows = [
            ("short", "d" * 64, 100, 200),
            ("G" * 64, "d" * 64, 100, 200),
            ("c" * 64, "d" * 64, 200, 100),
            ("e" * 64, "not-a-digest", 100, 200),
        ]
        for row in invalid_rows:
            with self.subTest(row=row):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(
                        "INSERT INTO instagram_oauth_states(state_hash, identity_digest, created_at, expires_at) VALUES (?, ?, ?, ?)",
                        row,
                    )

    def test_connection_constraints_accept_encrypted_record_shape(self):
        self.db.execute(
            """INSERT INTO instagram_connections (
                instagram_user_id, account_type, token_ciphertext, token_iv,
                encryption_key_version, granted_scopes_json, token_expires_at,
                connected_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("ig-test-1", "CREATOR", b"ciphertext-not-a-real-token",
             b"123456789012", 1,
             '["instagram_business_basic","instagram_business_content_publish"]',
             900, 100, 100),
        )
        row = self.db.execute(
            "SELECT status, length(token_iv) AS iv_length, json_type(granted_scopes_json) AS scopes_type "
            "FROM instagram_connections WHERE instagram_user_id = ?",
            ("ig-test-1",),
        ).fetchone()
        self.assertEqual(row["status"], "active")
        self.assertEqual(row["iv_length"], 12)
        self.assertEqual(row["scopes_type"], "array")

    def test_connection_rejects_invalid_account_iv_scopes_and_status(self):
        base = (
            "ig-invalid", "PERSONAL", b"cipher", b"123456789012", 1,
            '["instagram_business_basic"]', 900, "active", 100, 100,
        )
        sql = """INSERT INTO instagram_connections (
            instagram_user_id, account_type, token_ciphertext, token_iv,
            encryption_key_version, granted_scopes_json, token_expires_at,
            status, connected_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        for label, row in [
            ("personal account", base),
            ("short IV", ("ig-invalid", "CREATOR", b"cipher", b"short", 1,
                          '["instagram_business_basic"]', 900, "active", 100, 100)),
            ("non-array scopes", ("ig-invalid", "CREATOR", b"cipher", b"123456789012", 1,
                                  '{"scope":"wrong"}', 900, "active", 100, 100)),
            ("invalid status", ("ig-invalid", "CREATOR", b"cipher", b"123456789012", 1,
                                '["instagram_business_basic"]', 900, "publishing", 100, 100)),
            ("zero key version", ("ig-invalid", "CREATOR", b"cipher", b"123456789012", 0,
                                  '["instagram_business_basic"]', 900, "active", 100, 100)),
        ]:
            with self.subTest(case=label):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.db.execute(sql, row)


if __name__ == "__main__":
    unittest.main(verbosity=2)
