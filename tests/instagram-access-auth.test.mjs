import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { authorizeInstagramAdmin } from "../src/instagram-access-auth.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const env = {
  INSTAGRAM_ADMIN_EMAILS: "owner@example.com,second@example.org",
  INSTAGRAM_IDENTITY_HMAC_KEY: "test-only-secret-key-with-32-bytes-minimum"
};
const contextFor = identity => ({
  access: { getIdentity: async () => identity }
});

test("fails closed when Access context or identity API is absent", async () => {
  assert.deepEqual(await authorizeInstagramAdmin(null, env), {
    ok: false, reason: "access_identity_unavailable"
  });
  assert.deepEqual(await authorizeInstagramAdmin({}, env), {
    ok: false, reason: "access_identity_unavailable"
  });
});

test("fails closed for missing, malformed, or duplicate administrator allowlist", async () => {
  const ctx = contextFor({ email: "owner@example.com" });
  for (const value of [undefined, "", "not-an-email", "owner@example.com,", "owner@example.com, OWNER@example.com"]) {
    assert.equal((await authorizeInstagramAdmin(ctx, { ...env, INSTAGRAM_ADMIN_EMAILS: value })).ok, false);
  }
});

test("rejects absent, malformed, and non-allowlisted Access identities", async () => {
  for (const identity of [null, {}, { email: "" }, { email: "attacker@example.net" }, { email: "owner@example.com\\nattacker" }]) {
    assert.equal((await authorizeInstagramAdmin(contextFor(identity), env)).ok, false);
  }
});

test("fails closed when the dedicated HMAC secret is missing or too short", async () => {
  for (const secret of [undefined, "", "short"]) {
    const result = await authorizeInstagramAdmin(contextFor({ email: "owner@example.com" }), {
      ...env, INSTAGRAM_IDENTITY_HMAC_KEY: secret
    });
    assert.equal(result.ok, false);
  }
});

test("accepts a normalized allowlisted Access email and returns only a keyed digest", async () => {
  const result = await authorizeInstagramAdmin(contextFor({ email: " Owner@Example.COM " }), env);
  assert.equal(result.ok, true);
  assert.match(result.identityDigest, /^[0-9a-f]{64}$/);
  assert.equal("email" in result, false);
  assert.notEqual(result.identityDigest, "owner@example.com");
});

test("same normalized identity has stable digest; different identity or key has different digest", async () => {
  const first = await authorizeInstagramAdmin(contextFor({ email: "owner@example.com" }), env);
  const normalized = await authorizeInstagramAdmin(contextFor({ email: " OWNER@EXAMPLE.COM " }), env);
  const second = await authorizeInstagramAdmin(contextFor({ email: "second@example.org" }), env);
  const otherKey = await authorizeInstagramAdmin(contextFor({ email: "owner@example.com" }), {
    ...env, INSTAGRAM_IDENTITY_HMAC_KEY: "another-test-only-secret-with-32-bytes"
  });
  assert.equal(first.identityDigest, normalized.identityDigest);
  assert.notEqual(first.identityDigest, second.identityDigest);
  assert.notEqual(first.identityDigest, otherKey.identityDigest);
});

test("fails closed when Cloudflare Access identity lookup throws", async () => {
  const ctx = { access: { getIdentity: async () => { throw new Error("internal detail"); } } };
  assert.deepEqual(await authorizeInstagramAdmin(ctx, env), {
    ok: false, reason: "access_identity_unavailable"
  });
});
