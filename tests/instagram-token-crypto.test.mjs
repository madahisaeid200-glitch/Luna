import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { decryptInstagramToken, encryptInstagramToken } from "../src/instagram-token-crypto.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const key = new Uint8Array(32).fill(0x5a);

test("AES-256-GCM round-trips an access token and returns a 12-byte IV", async () => {
  const token = "IGQVJ-demo-token-never-log-this";
  const record = await encryptInstagramToken(token, key, "17840000000000000", 1);

  assert.equal(record.iv.byteLength, 12);
  assert.equal(record.keyVersion, 1);
  assert.ok(record.ciphertext instanceof Uint8Array);
  assert.notEqual(new TextDecoder().decode(record.ciphertext), token);
  assert.equal(await decryptInstagramToken(record, key, "17840000000000000"), token);
});

test("each encryption generates a fresh IV", async () => {
  const first = await encryptInstagramToken("token-a", key, "account-1", 1);
  const second = await encryptInstagramToken("token-a", key, "account-1", 1);
  assert.notDeepEqual(first.iv, second.iv);
});

test("authentication binds ciphertext to the account and key version", async () => {
  const record = await encryptInstagramToken("token-b", key, "account-1", 3);
  await assert.rejects(() => decryptInstagramToken(record, key, "account-2"));
  await assert.rejects(() => decryptInstagramToken({ ...record, keyVersion: 4 }, key, "account-1"));
});

test("tampered ciphertext and wrong keys are rejected", async () => {
  const record = await encryptInstagramToken("token-c", key, "account-1", 1);
  const tampered = new Uint8Array(record.ciphertext);
  tampered[0] ^= 0x01;
  await assert.rejects(() => decryptInstagramToken({ ...record, ciphertext: tampered }, key, "account-1"));
  await assert.rejects(() => decryptInstagramToken(record, new Uint8Array(32).fill(0x11), "account-1"));
});

test("invalid keys, IVs, contexts, and empty tokens are rejected", async () => {
  await assert.rejects(() => encryptInstagramToken("token", new Uint8Array(16), "account-1", 1), /32 bytes/);
  await assert.rejects(() => encryptInstagramToken("", key, "account-1", 1), /non-empty/);
  await assert.rejects(() => encryptInstagramToken("token", key, "", 1), /accountId/);
  await assert.rejects(() => encryptInstagramToken("token", key, "account-1", 0), /keyVersion/);
  await assert.rejects(() => decryptInstagramToken({ ciphertext: new Uint8Array(32), iv: new Uint8Array(8), keyVersion: 1 }, key, "account-1"), /12 bytes/);
});
