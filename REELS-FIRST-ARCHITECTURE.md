# LUNA Reels-First Architecture

Status: planning baseline only. This document does not claim Instagram publishing is implemented.

## Product decision

- Primary channel: Instagram Reels.
- Primary language: English.
- Recommended Instagram account type: Creator (professional account), because LUNA is being launched as a virtual influencer/content creator rather than a shop or local service business. Business remains a valid later switch if the project becomes primarily a commercial company profile.
- Account setup sequence: create a normal Instagram account with a dedicated LUNA email, then switch it to a public Creator professional account; choose the closest available creator/digital-creator category. Do not share login credentials with the app; connect later through Meta's official OAuth flow.
- Brand/story world: LUNA + LEO, luxury European couple, romantic comedy and light misunderstandings.
- Initial validation: a controlled 15-Reel pilot, with short 9:16 videos (target 15–30 seconds; actual duration chosen per story).
- Cost rule: free-first. No paid API, rendering, storage, or AI plan is enabled without a measured quality/cost test and explicit approval.
- Publishing rule: official Meta APIs only. No browser-password automation, scraping, purchased followers, mass-follow/unfollow, or automated engagement.

## Existing repository facts (as inspected 2026-11-10)

- The current deployed app is Producer 1.0.21.
- The current Producer is episode-oriented and offers a 30–60 second Short/Reel option, but its production flow is still built around the older episode/shot pipeline.
- The Worker currently exposes health/ping, AI text, image, vision, voice and video-related modes. No Instagram OAuth, Instagram publishing, token persistence, publishing scheduler, or Instagram Insights integration was found in the inspected source.
- The current browser media smoke test can assemble a WebM. The lightweight browser renderer can produce MP4 motion-graphics cards, not photorealistic LUNA/LEO footage. These are not interchangeable.
- The latest deployed Pages and browser/Worker connection smoke runs on 2026-11-08 succeeded. The browser smoke deliberately does not consume AI generation quota. It does not prove end-to-end video production or Instagram publishing.

## Proposed technical architecture

### 1. Reels-native production workflow

Create a dedicated Reels workflow rather than merely relabeling the old 3–5 minute episode pipeline.

Each Reel should have:
- A strong visual/verbal hook in the first 1–2 seconds.
- One simple setup, one clear comic/romantic beat, and one payoff.
- A compact English script, shot plan, captions/subtitles, cover frame, caption text and hashtags.
- Character continuity checks for LUNA and LEO.
- A final human-readable QA/approval screen before the account is switched to unattended publishing.

The pilot should test three repeatable creative lanes: romantic-comedy couple moments, luxury lifestyle moments, and funny misunderstandings. The exact mix should be measured, not assumed.

### 2. Official Instagram connection

Preferred integration: Instagram API with Instagram Login (Business Login for Instagram). It supports professional Creator and Business accounts and does not require a linked Facebook Page for the publishing/insights use case planned here. Use the current permission names from Meta's live docs; do not copy deprecated scope names from older tutorials.

Expected permissions to request only as needed:
- instagram_business_basic
- instagram_business_content_publish
- instagram_business_manage_insights (only for the analytics stage)

Requirements:
- The destination account must be an Instagram Professional account (Creator or Business); personal accounts cannot use the publishing API.
- Create/configure a Meta developer app and the Instagram product, configure the Business Login redirect URI, and request the required permissions.
- Keep the OAuth client secret and access tokens server-side only. Never place them in public HTML, browser localStorage, GitHub source, or client-side JavaScript.
- Implement OAuth state validation, callback validation, least-privilege scopes, token expiry tracking and refresh/reconnection handling.
- Store encrypted token material and account identifiers in a server-side store (evaluate Cloudflare D1/KV with the current Worker deployment). Do not add a storage binding until the free-tier limits, retention and security model are checked.
- Start with the user's own account and Standard Access/test roles. Do not assume Advanced Access or App Review is required for the initial own-account test; verify current Meta requirements before expanding to other users.

### 3. Secure media handoff and publishing

Meta must be able to fetch the finished video from a publicly reachable HTTPS URL. The existing WebM assembly is not a sufficient publishing artifact.

Before connecting publishing:
- Produce a standards-compliant MP4/MOV file; target H.264 video + AAC audio, 9:16, 23–60 fps, and conservative size limits compatible with the current Meta documentation.
- Verify duration, dimensions, audio presence, codec, file size and playback before upload.
- Evaluate a short-lived public media URL backed by Cloudflare R2 or another approved storage option. Remove temporary media after the publishing/retention window. Check current free quotas and possible charges first.
- Never expose the media bucket's write credentials or Meta token to the browser.

Publishing sequence:
1. Create the Reel media container using the approved Instagram API.
2. Poll the container status until it is ready (FINISHED) or a clear error/timeout occurs.
3. Publish only after the ready status is confirmed.
4. Save the returned media ID, timestamp, caption, source video reference and status.
5. On timeouts, inspect the container status before retrying so a successful post is not duplicated.
6. Enforce Meta's current publishing quota and the app's own conservative schedule limit.

### 4. Scheduling and safe automation

- Use a durable server-side publishing queue and scheduled Worker execution (e.g. Cron Trigger plus D1 job records, after validating quotas and binding availability).
- The user selects the publishing window and can pause/disable automatic posting.
- Initially require approval for each generated Reel. After a successful pilot, allow an explicit setting for auto-approval/automatic publishing.
- Record all state transitions and errors; never report a post as published until Meta returns a successful publish result.
- Keep a manual download/export route as a fallback; do not pretend it is automatic posting.

### 5. Performance feedback loop

Use only metrics exposed for the connected account/media by Meta's official Insights API. Track, where available:
- views/reach
- average watch time and total watch time
- likes, comments, saves and shares
- profile visits and follows attributable to content, where exposed

Calculate useful normalized measures such as follows per 1,000 reached accounts, shares per 1,000 reached accounts, saves per 1,000 reached accounts, and average watch time relative to Reel duration.

The recommendation engine should compare the pilot's creative lanes, hooks, lengths, story structures and posting windows. It may suggest the next experiment; it must not claim to know or control Instagram's private ranking algorithm, and it must not guarantee follower growth.

### 6. AI transparency and account safety

- Include the appropriate AI disclosure/labeling required by Meta's current policies for realistic AI-generated content.
- Avoid fake engagement, follower purchasing, mass-follow/unfollow, comment spam, or scraping.
- Do not use copyrighted music without rights. Prefer original/licensed audio.
- Keep an audit log of generated assets, approvals and publishing events.

## Delivery phases and acceptance gates

### Phase A — Reels-first product foundation
- Add a dedicated Reels workspace and data model.
- Default generation language to English.
- Add hook, payoff, duration, 9:16 output target, caption, cover and QA fields.
- Keep the old episode producer intact until the Reels flow passes tests.
- Acceptance: UI works on Android-sized viewport; saved draft survives reload; no generation quota is consumed by UI smoke tests.

### Phase B — Output compatibility

**Current implementation finding (2026-11-10 source audit):** the Worker returns the individual Wan result as an MP4 download, but the existing six-clip browser assembly uses `MediaRecorder` with VP9/VP8 WebM. The separate voiced-canvas path also records WebM. Therefore, the existence of individual MP4 scene clips does not mean the assembled final file is an Instagram-ready MP4.

**Preferred experiment before choosing a renderer:** evaluate Mediabunny with the browser WebCodecs API for joining/processing the existing scene clips and writing an MP4 container. Mediabunny is an open-source TypeScript media toolkit (MPL-2.0) with MP4/WebM read-write support, streaming I/O, and WebCodecs-backed hardware-accelerated media processing. This is a candidate, not an approved production dependency yet.

- Probe actual device support at runtime for the exact H.264/AVC video and AAC audio encoder configurations; WebCodecs codec support varies by browser and device. Do not assume Android Chrome supports every requested profile.
- Prefer a no-reencode/remux path only when all source tracks are already compatible with the target MP4 profile and timestamps/audio are verified. Otherwise benchmark a short transcode on the actual target phone.
- Do not make FFmpeg.wasm the default mobile path. Its published desktop benchmark reports a much slower WebAssembly conversion than native FFmpeg; that is a warning signal, not an Android performance prediction.
- Keep the first test quota-free: use locally bundled or user-provided synthetic/sample clips, not Wan generation. Do not consume image/video model quotas just to validate container conversion.
- If the phone lacks compatible WebCodecs encoders or memory, fail clearly and retain the source clips for manual export; never label WebM as MP4 or claim Instagram readiness.

**Phase B acceptance matrix (must pass on the target Android phone before integration):**
- Generate/export 15 s, 20 s and 30 s test timelines without calling AI services.
- Final file is MP4 with H.264 video and AAC audio; 9:16 dimensions are exactly 1080×1920 (or a documented lower-resolution test profile that is not mistaken for release quality).
- Verify actual codec, container, dimensions, frame rate, duration, audio track, audio/video sync, orientation, first/last frame and playback in Android Chrome and the device gallery.
- Measure wall-clock export time, peak memory/thermal behavior, file size and failure rate; repeat after reload and with low available storage.
- Run an explicit compatibility probe before enabling export. Unsupported devices must receive a clear explanation and a non-destructive fallback.
- Do not advance to Instagram publishing until a real finished MP4 has passed this matrix.

- Produce a real MP4/H.264/AAC artifact from the chosen footage pipeline.
- Verify codec, dimensions, duration, audio and file size automatically.
- Acceptance: test file passes a media probe and plays on a phone; no AI quota used by format-only tests.

### Phase C — Instagram account connection
- Configure Meta app and Business Login.
- Implement OAuth callback, encrypted token storage, token refresh and account status.
- Acceptance: connect and disconnect own professional account safely; no publishing occurs in this phase.

### Phase D — One approved Reel publish
- Upload one explicitly approved test Reel through the official API.
- Verify container status, final media ID, live post and no duplicate.
- Acceptance: one end-to-end successful post with logs and no exposed secrets.

### Phase E — Scheduler and analytics
- Add scheduled publishing, pause/resume, retries and status dashboard.
- Add Insights retrieval and post-performance reports.
- Acceptance: scheduled test posts publish once; metrics are sourced from the API and visibly distinguish unavailable metrics.

### Phase F — Controlled 15-Reel pilot
- Publish 15 English Reels across the selected creative lanes.
- Compare real production cost and performance; do not scale unless cost and quality meet the agreed threshold.

## Official reference starting points

- Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview
- Business Login for Instagram: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- Instagram content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing
- Meta's Instagram API Postman collection: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## Non-goals for the first release

- Multi-customer SaaS / public user onboarding.
- Automated DMs or comment replies.
- Hashtag scraping or competitor scraping.
- Automatic engagement actions.
- YouTube long-form episode production.
- Paid AI/video services without explicit approval and a cost/quality comparison.
