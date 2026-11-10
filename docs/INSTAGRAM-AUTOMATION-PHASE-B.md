# LUNA Instagram Automation — Phase B Technical Plan

Status: design only. No Instagram account, Meta app, OAuth credentials, publishing permission, or production connection is assumed to exist.

## Goal

Add a secure, opt-in Instagram publishing and analytics integration to LUNA after the Reels export pipeline has passed real-device media validation. The integration must never publish without an explicit user approval for the individual post (at least during the first release).

## Recommended API path

Use **Instagram API with Instagram Login / Business Login for Instagram** for the first single-account integration. It supports Instagram professional accounts (Creator and Business) without requiring a Facebook Page connection. A personal Instagram account is not eligible for API publishing.

Minimum scopes for the planned workflow:
- `instagram_business_basic` — identify the connected professional account and access its media.
- `instagram_business_content_publish` — create and publish Reels.
- `instagram_business_manage_insights` — request account and media insights, after verifying this permission in the Meta App Dashboard for the selected app/API version.

Do not use deprecated scope names such as `business_content_publish`. Instagram Login does not provide hashtag search; do not promise competitor hashtag discovery or hashtag search through this connection.

Official references to re-check at implementation time:
- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview/
- Business Login for Instagram: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
- Content publishing: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/
- Insights: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights/

## OAuth and credential security

1. Create a Meta developer app and configure Instagram Business Login redirect URI(s).
2. Start OAuth only from a user click. Generate a cryptographically random, single-use `state`, store its hash and short expiry server-side, and validate it on callback to prevent CSRF.
3. Exchange the one-time authorization code on the Worker server, never in browser JavaScript.
4. Exchange the short-lived token for a long-lived token and track its expiry. Refresh before expiry according to Meta's current documented rules.
5. Store access tokens encrypted at rest using AES-GCM with a dedicated Cloudflare Worker secret (for example `IG_TOKEN_ENCRYPTION_KEY`). Store ciphertext, IV, account ID, granted scopes, token expiry, and connection status in a private D1 database. Never store tokens in localStorage, browser bundles, Git, logs, analytics, or error messages.
6. Store Meta App Secret and encryption key only as Worker secrets. Do not expose either to Pages, browser JS, or public API responses.
7. Provide explicit Disconnect, revoke/delete stored credentials, and reconnect flows. Redact OAuth codes and tokens from all logs.
8. Use least-privilege scopes. Do not request messaging or comment permissions until those features are separately approved.

## Reels publishing workflow

1. Accept only a finalized, user-approved MP4. Validate container, H.264/AVC video, AAC-LC audio, 9:16 dimensions, duration, frame rate, audio sample rate/channels, file size, and actual decodability. Do not treat a capability probe or synthetic 360x640 test as production approval.
2. Upload the approved file to a private temporary object in Cloudflare R2. Use an unguessable, short-lived public fetch URL/Worker media route because Meta must fetch the media from a publicly reachable URL during container creation. Do not expose the permanent private object key.
3. Create a Reel media container using the current Instagram Login publishing endpoint and required parameters.
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
- D1 for encrypted connection records and one-time OAuth state.
- R2 for temporary approved media.
- Worker secrets for Meta App ID/Secret as applicable and the token-encryption key.

Use separate preview and production credentials/bindings. Preview must not be able to publish to the real account. Production publishing must remain disabled until a real account has connected and a full end-to-end test passes.

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
