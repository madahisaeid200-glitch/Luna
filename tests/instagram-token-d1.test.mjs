import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { getDecryptedInstagramConnection, putEncryptedInstagramConnection, deleteInstagramConnection } from "../src/instagram-token-d1.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const key = new Uint8Array(32).fill(0x37);

class MockD1 {
  constructor() { this.rows = new Map(); }
  prepare(sql) {
    return {
      bind: (...values) => ({
        run: async () => {
          if (sql.includes("INSERT INTO instagram_connections")) {
            const [id, type, ciphertext, iv, version, scopes, expiry, now, updated, refreshed] = values;
            const prior = this.rows.get(id);
            this.rows.set(id, {
              instagram_user_id: id, account_type: type,
              token_ciphertext: new Uint8Array(ciphertext), token_iv: new Uint8Array(iv),
              encryption_key_version: version, granted_scopes_json: scopes,
              token_expires_at: expiry, status: "active",
              connected_at: prior?.connected_at ?? now, updated_at: updated,
              last_refresh_at: refreshed, last_error_code: null
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes("DELETE FROM instagram_connections")) {
            const changed = this.rows.delete(values[0]);
            return { success: true, meta: { changes: changed ? 1 : 0 } };
          }
          throw new Error("Unexpected mock D1 run statement");
        },
        first: async () => {
          if (!sql.includes("SELECT instagram_user_id")) throw new Error("Unexpected mock D1 first statement");
          return this.rows.get(values[0]) ?? null;
        }
      })
    };
  }
}

const connection = (overrides = {}) => ({
  instagramUserId: "17840000000000000",
  accountType: "CREATOR",
  accessToken: "mock-access-token-do-not-log",
  grantedScopes: ["instagram_business_basic", "instagram_business_content_publish"],
  tokenExpiresAt: 2_000_000_000,
  now: 1_800_000_000,
  ...overrides
});

test("stores ciphertext in D1 and retrieves the original token only after authenticated decryption", async () => {
  const db = new MockD1();
  const saved = await putEncryptedInstagramConnection(db, connection(), key, 2);
  assert.equal(saved.status, "active");
  const row = db.rows.get("17840000000000000");
  assert.ok(row.token_ciphertext instanceof Uint8Array);
  assert.notEqual(new TextDecoder().decode(row.token_ciphertext), "mock-access-token-do-not-log");
  assert.equal(row.token_iv.byteLength, 12);

  const loaded = await getDecryptedInstagramConnection(db, "17840000000000000", key);
  assert.equal(loaded.accessToken, "mock-access-token-do-not-log");
  assert.deepEqual(loaded.grantedScopes, connection().grantedScopes);
  assert.equal(loaded.encryptionKeyVersion, undefined);
  assert.equal(loaded.accountType, "CREATOR");
});

test("upsert rotates ciphertext without resetting original connected_at", async () => {
  const db = new MockD1();
  await putEncryptedInstagramConnection(db, connection(), key, 1);
  const originalIv = db.rows.get("17840000000000000").token_iv;
  await putEncryptedInstagramConnection(db, connection({ accessToken: "refreshed-token", now: 1_800_000_100 }), key, 1);
  const row = db.rows.get("17840000000000000");
  assert.equal(row.connected_at, 1_800_000_000);
  assert.notDeepEqual(row.token_iv, originalIv);
  assert.equal((await getDecryptedInstagramConnection(db, "17840000000000000", key)).accessToken, "refreshed-token");
});

test("missing rows return null and disconnect deletes credentials", async () => {
  const db = new MockD1();
  assert.equal(await getDecryptedInstagramConnection(db, "missing", key), null);
  await putEncryptedInstagramConnection(db, connection(), key);
  assert.deepEqual(await deleteInstagramConnection(db, "17840000000000000"), { deleted: true });
  assert.deepEqual(await deleteInstagramConnection(db, "17840000000000000"), { deleted: false });
  assert.equal(await getDecryptedInstagramConnection(db, "17840000000000000", key), null);
});

test("rejects invalid inputs and absent D1 binding without writing", async () => {
  const db = new MockD1();
  await assert.rejects(() => putEncryptedInstagramConnection(null, connection(), key), /D1 database binding/);
  await assert.rejects(() => putEncryptedInstagramConnection(db, connection({ accountType: "PERSONAL" }), key), /BUSINESS or CREATOR/);
  await assert.rejects(() => putEncryptedInstagramConnection(db, connection({ grantedScopes: "scope" }), key), /array/);
  await assert.rejects(() => putEncryptedInstagramConnection(db, connection({ tokenExpiresAt: -1 }), key), /tokenExpiresAt/);
  assert.equal(db.rows.size, 0);
});

test("decryption rejects a different key and malformed stored ciphertext", async () => {
  const db = new MockD1();
  await putEncryptedInstagramConnection(db, connection(), key);
  await assert.rejects(() => getDecryptedInstagramConnection(db, "17840000000000000", new Uint8Array(32).fill(0x19)));
  db.rows.get("17840000000000000").token_ciphertext = new Uint8Array([1, 2, 3]);
  await assert.rejects(() => getDecryptedInstagramConnection(db, "17840000000000000", key));
});
