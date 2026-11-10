# LUNA Instagram Automation — Phase B Technical Plan

Status: design only. No Instagram account, Meta app, OAuth credentials, publishing permission, or production connection is assumed to exist.

## Goal

Add a secure, opt-in Instagram publishing and analytics integration to LUNA after the Reels export pipeline has passed real-device media validation. The integration must never publish without an explicit user approval for the individual post (at least during the first release).

## Recommended API path

Use **Instagram API with Instagram Login / Business Login for Instagram** for the first single-account integration. It supports Instagram professional accounts (Creator and Business) without requiring a Facebook Page connection. A personal Instagram account is not eligible for API publishing.

Minimum scopes for the planned workflow:
- `instagram_business_basic` — identify the connected professional account and access its media.
- `instagram_business_content_publish` — create and publish Reels.
- `instagram_business_manage_insights` — needed for account/media Insights according to the Insights endpoint references. Important documentation nuance: Meta's Business Login overview's scope list does not consistently show this scope alongside the basic/publish scopes. Treat Insights as a separately gated capability: verify the exact scope and access level in the selected app's current Meta App Dashboard and the current Insights endpoint docs before requesting it; do not block basic publishing on Insights approval.

Do not use deprecated scope names such as `business_content_publish`. Instagram Login does not provide hashtag search; do not promise competitor hashtag discovery or hashtag search through this connection.

Official references to re-check at implementation time (pin the Graph API version explicitly in code; do not silently follow a changing default):
- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview/
- Business Login for Instagram: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
- Content publishing: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/
- Insights: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights/

## Implemented token cryptography and isolated D1 repository (not connected to OAuth)

The branch contains an isolated Web Crypto helper at `src/instagram-token-crypto.mjs`:
- AES-256-GCM with a 256-bit key, 96-bit cryptographically random IV, and 128-bit authentication tag.
- Authenticated additional data binds ciphertext to the Instagram account ID and encryption-key version, preventing a ciphertext from being silently moved between account rows or key versions.
- Returns ciphertext and IV as byte arrays suitable for D1 BLOB parameters; it never logs or persists plaintext.
- Decryption rejects modified ciphertext, wrong keys, wrong account IDs, and mismatched key versions.

The branch also contains `src/instagram-token-d1.mjs`, a server-side repository adapter:
- `putEncryptedInstagramConnection` encrypts the token before preparing the D1 INSERT/UPSERT statement; it stores only ciphertext, IV, key version, account type, scopes, and expiry metadata.
- `getDecryptedInstagramConnection` reads the row and decrypts only for trusted server-side callers.
- `deleteInstagramConnection` removes the stored connection for disconnect.
- The adapter validates account type, identifiers, timestamps, scopes, and D1 binding presence. It does not create HTTP routes or expose token values to browser code.

Regression coverage is in `tests/instagram-token-crypto.test.mjs` and `tests/instagram-token-d1.test.mjs`. The repository tests use an in-memory D1-compatible mock and fixed test-only keys; they do not contact Cloudflare or use real credentials. The secret decoder validates canonical standard Base64 containing exactly 32 bytes. Generate the secret outside the repository and install it only with Cloudflare Worker secret management. Never paste the key into chat, source files, Pages, or logs.

## Implemented OAuth state lifecycle (not yet wired to Worker routes)

The branch contains `src/instagram-oauth-state.mjs`:
- `createInstagramOAuthState` generates 32 cryptographically random bytes, encodes them as a 43-character base64url state, and persists only its SHA-256 digest with purpose, creation time, and a 10-minute expiry.
- `consumeInstagramOAuthState` uses a single `DELETE ... WHERE state_hash = ? AND expires_at > ? RETURNING ...` statement so the state is consumed as part of the callback validation and cannot be replayed.
- `deleteExpiredInstagramOAuthStates` provides opportunistic cleanup without requiring a scheduled trigger.
- Malformed state, invalid timestamps, absent D1 binding, expired values, and replay attempts are rejected or return no match.

The five tests in `tests/instagram-oauth-state.test.mjs` run against an in-memory D1-compatible mock. The concurrency test verifies the adapter's intended single-use contract in the mock; it does not replace a concurrency test against real Cloudflare D1.

Important boundary: the token repository and OAuth state helper are implemented and mock-tested, but the Worker does not yet read secrets, call these modules, or expose OAuth routes. No D1 resource has been provisioned and no migration has been applied to Cloudflare. Real D1 compatibility, atomic RETURNING behavior, and binding isolation remain release blockers; these tests are not proof of a live D1 round trip.

## OAuth and credential security

1. Create a Meta developer app and configure Instagram Business Login redirect URI(s).
2. Start OAuth only from a user click. Generate a cryptographically random, single-use `state`, store its SHA-256 hash and a 10-minute expiry server-side, and validate/atomically consume it on callback to prevent CSRF and replay. Never store the raw state.
3. Exchange the one-time authorization code on the Worker server, never in browser JavaScript. Keep the Instagram Login flow on its documented Instagram host (`graph.instagram.com`) and do not mix its token type, endpoints, or scopes with Facebook Login (`graph.facebook.com`).
4. Exchange the short-lived token for a long-lived token and track its expiry. Refresh before expiry according to Meta's current documented rules.
5. Store access tokens encrypted at rest using AES-GCM with a dedicated Cloudflare Worker secret (for example `IG_TOKEN_ENCRYPTION_KEY`). Store ciphertext, IV, account ID, granted scopes, token expiry, and connection status in a private D1 database. Never store tokens in localStorage, browser bundles, Git, logs, analytics, or error messages.
6. Store Meta App Secret and encryption key only as Worker secrets. Do not expose either to Pages, browser JS, or public API responses.
7. Provide explicit Disconnect, revoke/delete stored credentials, and reconnect flows. Redact OAuth codes and tokens from all logs.
8. Use least-privilege scopes. Do not request messaging or comment permissions until those features are separately approved.

## Reels publishing workflow

1. Accept only a finalized, user-approved MP4. Validate container, H.264/AVC video, AAC-LC audio, 9:16 dimensions, duration, frame rate, audio sample rate/channels, file size, and actual decodability. Do not treat a capability probe or synthetic 360x640 test as production approval.
2. Upload the approved file to a private temporary object in Cloudflare R2. Use an unguessable, short-lived public fetch URL/Worker media route because Meta must fetch the media from a publicly reachable URL during container creation. Do not expose the permanent private object key.
3. Create a Reel media container using the current Instagram Login publishing endpoint and required parameters. For this login path, use the documented public `video_url` fetch flow unless the current Meta docs explicitly add another supported upload mode; do not copy the Facebook Login-only `upload_type=resumable` flow into Instagram Login.
4. Poll container status conservatively until FINISHED, ERROR, or timeout. Never publish while status is IN_PROGRESS or ERROR.
5. Publish only after a second explicit confirmation in LUNA. Record container ID, published media ID, timestamp, caption, and result without retaining the raw token.
6. Delete the temporary public media object after a verified terminal outcome or expiry. Make cleanup retryable.
7. Implement idempotency so network retries cannot create duplicate posts. Never auto-retry the final publish call without checking status first.
8. Add a visible kill switch that disables all publishing immediately.

## Insights and scheduling

- Fetch account-level and media-level Insights only with the separately granted insights permission.
- Store metric name, value, period, media ID, retrieval time, and API version. Treat missing metrics as unavailable, not zero.
- Respect Meta's current API version, permission, rate-limit, and metric-retention rules; verify these against the live official docs during implementation.
- Begin with manual scheduling and a visible approval queue. Only add scheduled publishing after OAuth refresh, retry, idempotency, observability, and failure recovery are tested.
- Do not claim to know or control Instagram's recommendation algorithm. Use observed account/post metrics to run measured experiments on hooks, duration, retention, saves, shares, and posting cadence.

## Cloudflare bindings and deployment

The current `wrangler.toml` on `main` has an AI binding only; it has no D1, KV, or R2 binding. Before OAuth implementation, provision and bind:
- D1 for encrypted connection records and one-time OAuth state. A draft schema is in `migrations/0001_instagram_oauth.sql`; it stores only a state hash, and stores the token as AES-GCM ciphertext plus a 12-byte IV and key version. The migration is not applied to any environment.
- R2 for temporary approved media.
- Worker secrets for Meta App ID/Secret as applicable and the token-encryption key.

Use separate preview and production credentials/bindings. Preview must not be able to publish to the real account. Production publishing must remain disabled until a real account has connected and a full end-to-end test passes.

## D1 schema and migration safety

- The draft migration creates only `instagram_oauth_states` and `instagram_connections`; it does not create publishing queues or media metadata tables yet.
- Consume OAuth state with a conditional `DELETE ... RETURNING` so a state can succeed only once and only before expiry. Reject callbacks if the state is missing, expired, or already consumed.
- Encrypt access tokens in the Worker before writing to D1. The database must never receive plaintext tokens. Use a unique AES-GCM IV for every encryption under a given key and retain a key version for planned rotation.
- Disconnect deletes the stored connection row. Refresh failures set a bounded, sanitized error code; never persist raw provider responses, authorization codes, or tokens.
- Apply the migration only after reviewing the schema against the actual Worker bindings and testing it in an isolated preview D1 database. Do not run it against production during this design phase.

## Release gates

A release is not complete until all of these pass:
- OAuth state mismatch, replay, expiry, denied consent, and callback error tests.
- Token exchange, encrypted persistence, refresh, disconnect, and secret-redaction tests.
- Permission-denied and expired-token recovery.
- Real MP4 encode/decode and Android Chrome + Gallery playback validation.
- Temporary public media URL expiry and cleanup tests.
- Container polling, publish idempotency, timeout and duplicate-prevention tests.
- Manual approval gate and kill-switch tests.
- Insights permission and missing-metric tests.
- Preview environment cannot publish to production.
- Final production test on the user's own Creator/Business account, with explicit approval.

## Current blockers / required inputs later

- User has not created the Instagram account yet.
- The Instagram account must be Creator or Business before connecting.
- A Meta developer account/app and exact callback URL registration are required.
- Meta App ID/Secret must be configured privately as Worker secrets; never send them in chat or commit them.
- D1/R2 resources and production/preview bindings must be provisioned.
- The Reels MP4 pipeline has not yet been validated on the user's Android device.

## Cost and privacy principles

- Keep the initial connection and manual approval workflow on Cloudflare's free/low-cost services where practical, but verify current quotas before provisioning.
- Never send personal messages, account credentials, or unrelated user data to third-party AI providers.
- Send only the minimum approved media and metadata to Meta.
- Do not spend Cloudflare AI quota for Instagram OAuth, publishing, or Insights; these are direct API operations.


## Authentication boundary decision — Cloudflare Access (design approved, not configured)

The existing Worker also serves public LUNA generation and health endpoints. Protecting the entire Worker behind an interactive login would break those public application paths, while adding a password or bearer token to the GitHub Pages JavaScript would expose a reusable credential. Therefore, do not implement a home-grown browser password flow and do not put an admin secret in the Pages bundle.

Use Cloudflare Access as the identity boundary for Instagram administration:

1. Create a **hostname-and-path scoped** Access self-hosted application for the production Worker hostname and `/api/instagram/*` only. Do not enable Worker-wide Access on the shared Worker: that would also gate unrelated public LUNA endpoints. The Access policy must allow only the explicitly verified administrator email address, not an entire email domain.
2. Keep the public LUNA endpoints public as they are today. Every Instagram route must additionally fail closed unless the Worker invocation has a valid `ctx.access` identity and the identity email matches the server-side administrator allowlist. Do not trust an email, role, or identity field supplied in JSON, query parameters, or browser storage.
3. The LUNA UI must start the connection with a top-level browser navigation to the protected `/api/instagram/connect` endpoint. Do not depend on third-party cookies being sent by cross-origin JavaScript `fetch()` from GitHub Pages to `workers.dev`. The Meta callback is also a top-level browser navigation to the protected callback URL; validate this flow in Android Chrome before release.
4. Bind each OAuth state to the initiating Access identity. Extend the D1 state record with an identity digest (SHA-256 of a normalized, verified Access identity value such as the administrator email) and compare it with the callback's authenticated identity before exchanging the authorization code. Do not persist the raw email in the OAuth-state table. Update the migration, state helper, and tests together before wiring routes.
5. Require Access on connect, callback, status, disconnect, and every future administrative publishing route. The callback must still consume state atomically, reject replay/expiry/mismatch, and exchange the authorization code only on the server.
6. Configure a separate Access application/policy for each preview hostname used in testing. Preview must use an isolated D1 database and test Meta credentials; it must never share production tokens or publishing capability.
7. If Access is unavailable, misconfigured, or identity cannot be verified, return a generic 403 and perform no OAuth, database, or publishing operation.

Cloudflare documents support Access protection for a Worker, a specific `workers.dev` hostname, or a hostname/path; it also exposes the authenticated identity to a directly invoked Worker through `ctx.access`. This is the selected architecture, not a claim that Access has already been enabled in the Cloudflare account.

### Consequences and implementation gates

- Change the Worker handler signature to accept `ctx` and dispatch the Instagram path routes before the existing body-mode dispatcher. Preserve the current public routes and their behavior.
- Keep the OAuth callback URL fixed and register that exact URL in the Meta app; do not accept caller-supplied redirect URLs or open redirects.
- Add route tests for absent Access identity, wrong administrator, correct administrator, path/method mismatch, callback state identity mismatch, replay, expired state, and redaction of authorization codes/tokens.
- Add a real-device test for the Access login → Instagram authorization → protected callback round trip. A mocked `ctx.access` test alone does not prove browser cookie behavior.
- No Access application, D1 database, secret, Meta app, or live route has been configured or provisioned as part of this documentation decision.
