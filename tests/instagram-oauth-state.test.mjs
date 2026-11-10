import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createInstagramOAuthState,
  consumeInstagramOAuthState,
  deleteExpiredInstagramOAuthStates
} from "../src/instagram-oauth-state.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

class MockD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    return {
      bind: (...values) => ({
        run: async () => {
          if (sql.includes("INSERT INTO instagram_oauth_states")) {
            const [hash, purpose, createdAt, expiresAt] = [values[0], "instagram_login", values[1], values[2]];
            if (this.rows.has(hash)) throw new Error("UNIQUE constraint failed");
            this.rows.set(hash, { state_hash: hash, purpose, created_at: createdAt, expires_at: expiresAt });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes("DELETE FROM instagram_oauth_states WHERE expires_at <= ?")) {
            let deleted = 0;
            for (const [hash, row] of this.rows) {
              if (row.expires_at <= values[0]) { this.rows.delete(hash); deleted++; }
            }
            return { success: true, meta: { changes: deleted } };
          }
          throw new Error("Unexpected mock D1 run statement");
        },
        first: async () => {
          if (!sql.includes("DELETE FROM instagram_oauth_states") || !sql.includes("RETURNING")) {
            throw new Error("Unexpected mock D1 first statement");
          }
          const [hash, now] = values;
          const row = this.rows.get(hash);
          if (!row || row.expires_at <= now) return null;
          this.rows.delete(hash);
          return { purpose: row.purpose, created_at: row.created_at, expires_at: row.expires_at };
        }
      })
    };
  }
}

test("creates a 256-bit base64url state and stores only its SHA-256 hash", async () => {
  const db = new MockD1();
  const result = await createInstagramOAuthState(db, 1_800_000_000);
  assert.match(result.state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.expiresAt, 1_800_000_600);
  assert.equal(db.rows.size, 1);
  const [hash, row] = [...db.rows.entries()][0];
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, result.state);
  assert.equal(row.state_hash, hash);
  assert.equal(row.purpose, "instagram_login");
  assert.equal(row.created_at, 1_800_000_000);
});

test("valid state is consumed once; replay and unknown state return null", async () => {
  const db = new MockD1();
  const created = await createInstagramOAuthState(db, 1_800_000_000);
  const consumed = await consumeInstagramOAuthState(db, created.state, 1_800_000_001);
  assert.deepEqual(consumed, {
    purpose: "instagram_login",
    createdAt: 1_800_000_000,
    expiresAt: 1_800_000_600
  });
  assert.equal(await consumeInstagramOAuthState(db, created.state, 1_800_000_002), null);
  assert.equal(await consumeInstagramOAuthState(db, "A".repeat(43), 1_800_000_002), null);
});

test("expired state cannot be consumed and can be cleaned up", async () => {
  const db = new MockD1();
  const created = await createInstagramOAuthState(db, 1_800_000_000);
  assert.equal(await consumeInstagramOAuthState(db, created.state, created.expiresAt), null);
  assert.equal(db.rows.size, 1);
  assert.deepEqual(await deleteExpiredInstagramOAuthStates(db, created.expiresAt), { deleted: 1 });
  assert.equal(db.rows.size, 0);
});

test("two concurrent callbacks cannot both consume the same state", async () => {
  const db = new MockD1();
  const created = await createInstagramOAuthState(db, 1_800_000_000);
  const results = await Promise.all([
    consumeInstagramOAuthState(db, created.state, 1_800_000_010),
    consumeInstagramOAuthState(db, created.state, 1_800_000_010)
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});

test("rejects malformed state, invalid timestamps, and missing D1 binding", async () => {
  const db = new MockD1();
  await assert.rejects(() => createInstagramOAuthState(null, 1), /D1 database binding/);
  await assert.rejects(() => createInstagramOAuthState(db, -1), /non-negative safe integer/);
  await assert.rejects(() => consumeInstagramOAuthState(db, "not-a-state", 1), /43-character base64url/);
  await assert.rejects(() => consumeInstagramOAuthState(db, "A".repeat(43) + "!", 1), /43-character base64url/);
  await assert.rejects(() => deleteExpiredInstagramOAuthStates(db, 1.5), /non-negative safe integer/);
  assert.equal(db.rows.size, 0);
});
