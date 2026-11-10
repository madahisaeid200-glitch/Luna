import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFile(path.join(root, relative), "utf8");
const dataModule = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");

async function loadWorker() {
  const authUrl = dataModule(await read("src/instagram-access-auth.mjs"));
  const gateSource = (await read("src/instagram-worker-gate.mjs"))
    .replace('"./instagram-access-auth.mjs"', JSON.stringify(authUrl));
  const gateUrl = dataModule(gateSource);
  const originalWorker = await read("worker.js");
  const workerSource = originalWorker.replace(
    'import { handleInstagramAdminRoute } from "./src/instagram-worker-gate.mjs";',
    'import { handleInstagramAdminRoute } from ' + JSON.stringify(gateUrl) + ';'
  );
  assert.notEqual(workerSource, originalWorker, "Worker must import the Instagram route gate");
  return (await import(dataModule(workerSource))).default;
}

const worker = await loadWorker();
const env = {
  INSTAGRAM_ADMIN_EMAILS: "owner@example.com",
  INSTAGRAM_IDENTITY_HMAC_KEY: "test-only-secret-key-with-32-bytes-minimum"
};
const ctx = email => ({ access: { getIdentity: async () => ({ email }) } });

test("Instagram namespace fails closed without verified Cloudflare Access identity", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/instagram/status"), env, {});
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Instagram administration is not authorized.");
  assert.equal(JSON.stringify(body).includes("owner@example.com"), false);
});

test("Instagram namespace rejects a non-allowlisted identity", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/instagram/connect"), env, ctx("attacker@example.net"));
  assert.equal(response.status, 403);
});

test("allowlisted identity reaches only the disabled configuration gate", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/instagram/status"), env, ctx(" OWNER@EXAMPLE.COM "));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "INSTAGRAM_NOT_CONFIGURED");
});

test("allowlisted identity is still denied when the HMAC secret is absent", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/instagram/status"),
    { INSTAGRAM_ADMIN_EMAILS: "owner@example.com" },
    ctx("owner@example.com")
  );
  assert.equal(response.status, 403);
});

test("public LUNA health endpoint remains HTTP 200 without Access or Instagram bindings", async () => {
  const response = await worker.fetch(new Request("https://worker.example/"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "LUNA AI Worker");
});

test("public LUNA ping endpoint remains HTTP 200 and does not require Access", async () => {
  const response = await worker.fetch(new Request("https://worker.example/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "ping" })
  }), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
});

test("unsupported methods on the Instagram namespace are rejected", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/instagram/status", { method: "DELETE" }), env, ctx("owner@example.com"));
  assert.equal(response.status, 405);
});
