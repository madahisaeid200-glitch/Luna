# LUNA Instagram Preview — Safe Provisioning Runbook

Status: instructions only. Nothing in this document has been provisioned or applied to a Cloudflare account.

## Non-negotiable isolation rules

- Work only on `docs/instagram-automation-phase-b` and its Preview.
- Never run `wrangler deploy`, `wrangler d1 migrations apply ... --remote`, or any production-targeting command as part of this runbook.
- Do not reuse production D1, R2, Meta credentials, OAuth tokens, or Access applications.
- Do not test OAuth against a Preview URL until Cloudflare Access protects that exact hostname and both `/api/instagram` and `/api/instagram/*`.
- Do not use commit-specific Preview URLs for OAuth unless each hostname is separately protected.
- Never paste secrets, tokens, API keys, or Cloudflare credentials into GitHub, this repository, or ChatGPT.

## Verified repository baseline

- `wrangler.toml` currently declares Worker `orange-firefly-6434`, entry point `worker.js`, compatibility date `2026-10-26`, Workers AI binding `AI`, and an empty `[previews]` block.
- The root repository has no `package.json` and therefore no project-pinned Wrangler dependency.
- The current Preview configuration intentionally omits the production AI binding. That is acceptable for the current Instagram-authentication scaffold; it is not evidence that the Instagram runtime is ready.
- The current branch's PR checks pass, but the latest Cloudflare Preview comment still identifies commit `7bc8755`, not the latest authentication hardening commit. Do not treat that Preview as a live test of the latest source.
- The Instagram Worker namespace currently fails closed. OAuth routes are not implemented.

## 1. Pin the Preview tooling before relying on it

Cloudflare's current Worker Previews workflow requires Wrangler 4.135.0 or later. Since the root project does not pin Wrangler, use an explicit version when running a manual Preview command:

```sh
npx --yes wrangler@4.135.0 --version
npx --yes wrangler@4.135.0 preview
```

Run these only from a clean checkout of the intended feature branch after confirming the current directory and branch. The second command creates or updates the branch Preview; it does not deploy production. Do not run it until the Preview bindings and Access protections below have been prepared.

The Git-connected Cloudflare Preview build may use a dashboard-configured command/toolchain. Verify that configuration in Cloudflare Workers Builds rather than assuming the PR bot's success proves which Wrangler version was used.

## 2. Create isolated Preview resources

Create a dedicated D1 database for Preview only. For an EU-restricted database, Cloudflare documents the `eu` jurisdiction option:

```sh
npx --yes wrangler@4.135.0 d1 create luna-instagram-preview --jurisdiction eu
```

Record the returned database ID privately in the Cloudflare configuration workflow. The database name and ID are not secrets, but they must be copied exactly. Never substitute a guessed ID.

Create a dedicated R2 bucket named `luna-instagram-preview-media` using the Cloudflare dashboard or the documented Wrangler R2 bucket command. Confirm its jurisdiction and access policy before storing any media. Do not reuse a production bucket.

After both resources exist, add their exact values to the `[previews]` configuration in `wrangler.toml`:
- D1 binding name: `INSTAGRAM_DB`, pointed at the newly created Preview database ID.
- R2 binding name: `INSTAGRAM_MEDIA`, pointed at the Preview-only bucket.
- Add no production resource IDs or bucket names to the Preview block.

Do not add placeholder IDs or bucket names. The config change must wait until Cloudflare returns the real resource identifiers. The top-level production configuration must remain unchanged.

## 3. Apply the migration to Preview only

First inspect the SQL migration and confirm that the configured Preview D1 binding points to the isolated database. Then use the Preview migration target:

```sh
npx --yes wrangler@4.135.0 d1 migrations apply luna-instagram-preview --preview
```

Use the exact database name created above. Confirm the command output identifies the Preview database. If Wrangler reports an unexpected binding, missing Preview database, or production target, stop; do not retry with `--remote`.

Verify the schema with a read-only query against the Preview database before enabling any OAuth route. The migration must not be applied to production in this phase.

## 4. Configure secrets only in Cloudflare

Set secrets in the Preview's secret store, not in Wrangler files or Git. The current code expects these authentication values when the Instagram admin gate is exercised:
- `INSTAGRAM_ADMIN_EMAILS`: exact administrator email allowlist.
- `INSTAGRAM_IDENTITY_HMAC_KEY`: a randomly generated secret of at least 32 characters.

When token persistence and OAuth handlers are implemented, the Preview will additionally need a dedicated Preview-only token-encryption key and test Meta app credentials. Do not reuse production keys or app secrets.

Generate keys locally with a cryptographically secure random generator and send them directly to Cloudflare's secret prompt. Never copy them into chat or commit them. Cloudflare's current Preview secret commands are documented as:

```sh
npx --yes wrangler@4.135.0 preview secret put INSTAGRAM_ADMIN_EMAILS --name docs-instagram-automation-phase-b
npx --yes wrangler@4.135.0 preview secret put INSTAGRAM_IDENTITY_HMAC_KEY --name docs-instagram-automation-phase-b
```

Use the actual Preview name reported by Wrangler if it differs. Do not set a token-encryption key until the corresponding Preview D1/token flow is ready to test.

## 5. Protect Preview with Cloudflare Access before OAuth

The branch Preview hostname is currently public by default unless an Access policy has been configured. Protect the stable branch Preview hostname with two path entries using the same administrator-only policy:
- exact path: `/api/instagram`
- wildcard path: `/api/instagram/*`

The wildcard does not cover the parent path. Protecting only the wildcard leaves the exact base path outside the Access boundary. Do not enable Access across the whole shared Worker hostname, because that would block public LUNA routes.

Protect each commit-specific hostname separately if it will be used. The current branch Preview alias is:

`https://docs-instagram-automation-phase-b-orange-firefly-6434.madahisaeid200.workers.dev`

Do not assume it is protected. Verify Access in a private browser session before any OAuth test. Keep the administrator allowlist in the Worker secret aligned with the Access policy.

## 6. Preview acceptance checks

Before implementing or enabling OAuth handlers, verify all of the following:

1. Preview deployment commit equals the latest intended feature-branch commit.
2. The Preview hostname requires Cloudflare Access for both Instagram path patterns.
3. Public LUNA health and generation routes still work without Access.
4. Instagram route returns 403 without a verified Access identity.
5. Instagram route returns a configuration error when required secrets/bindings are missing; it never falls through to a public handler.
6. Preview D1 is separate from production and contains only the Preview migration.
7. Preview R2 is separate from production.
8. Preview has no production Meta credentials and cannot publish to the real Instagram account.
9. Worker logs and HTTP responses do not reveal emails, OAuth codes, access tokens, or encryption keys.

Only after these checks pass should the OAuth start/callback handlers be wired to the existing state, HMAC identity, token encryption, and D1 repository modules.

## Official Cloudflare references

- Worker Previews overview and Wrangler minimum version: https://developers.cloudflare.com/workers/previews/
- Preview configuration, secrets, bindings, and isolation: https://developers.cloudflare.com/workers/previews/configuration/
- Preview setup: https://developers.cloudflare.com/workers/previews/get-started/
- D1 Wrangler commands and Preview migration target: https://developers.cloudflare.com/workers/wrangler/commands/d1/
- D1 migration workflow: https://developers.cloudflare.com/d1/reference/migrations/

