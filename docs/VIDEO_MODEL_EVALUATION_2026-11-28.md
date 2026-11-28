# LUNA + LEO — Video Model Evaluation Notes
Date: 2026-11-28
Status: research shortlist only; no provider selected and no generation authorized.

## Decision summary

Do not commit LUNA or LEO to a production provider yet. The first controlled comparison should shortlist:

1. **Kling 4.0 Omni** — first candidate to evaluate for multi-reference character continuity and multi-asset direction.
2. **Veo 3.1 Generate** — independent comparison candidate for image/reference-driven shots, video extension, and native audio.
3. **Kling 4.0 Flash** — optional low-cost/low-resolution screening candidate, not a substitute for a final-quality test.

This is a capability-based shortlist, not a claim that any model has passed LUNA's realism scorecard. Published feature lists do not prove stable identity, natural hands, convincing motion, or live-action believability in our specific scenes.

## Verified capability notes

### Kling 4.0 / Omni

The official Kling API update log (2026-10-28 through 2026-11-19) documents:
- Text-to-video, image-to-video, and Omni reference-to-video.
- Up to 30 seconds of native output in one run.
- Up to 10 keyframe inputs.
- Up to 10 reference images and up to 5 reference videos; Omni accepts up to 15 combined inputs.
- Direct voice references in the Omni endpoint.
- 4K output added on 2026-11-19; HDR is supported at 1080p and 4K with an additional per-second fee.
- Kling 4.0 Flash supports 3–20 second output at 720p and reference-based Omni generation.

Official source: https://kling.ai/document-api/updates/api

Cost caution: Kling bills video generation by total duration and input-video duration can affect the bill. HDR adds a further per-second fee. Obtain the exact current quote for the selected endpoint, resolution, references, and duration before any paid test. Do not infer a USD cost from unit counts without the current account's package conversion.

### Google Veo 3.1

The official Google Cloud model page documents:
- Text-to-video and image-to-video, including first/last-frame conditioning.
- Video extension and reference-image support.
- Native sound generation.
- 4, 6, or 8 second outputs; reference-image-to-video is documented as 8 seconds.
- 9:16 and 16:9 aspect ratios; 720p/1080p input and up to 4K output for the standard model.
- The documented Cloud model availability lists the US region (us-central1); confirm actual account and regional access before designing the integration.

Official source: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate

Google's Gemini API pricing page currently lists no free tier for Veo 3.1 video generation. It lists standard video with audio at $0.40/sec for 720p/1080p and $0.60/sec for 4K; Fast at $0.10/sec (720p), $0.12/sec (1080p), and $0.30/sec (4K); Lite at $0.05/sec (720p) and $0.08/sec (1080p). Pricing and availability are product-route-specific; do not assume Cloud Model Garden and Gemini API share identical access, quotas, or billing.

Official source: https://ai.google.dev/gemini-api/docs/pricing

## Controlled comparison plan

Do not generate full episodes. Once the user approves canonical LUNA and LEO reference packs:

1. Freeze reference pack versions and record their hashes.
2. Use identical shot intent, aspect ratio, duration target, and output quality tier for each provider wherever the APIs allow.
3. Start with one portrait-stability shot and one two-person interaction shot; these expose identity drift and face blending before expensive full-body/audio tests.
4. Only proceed to dialogue, full-body motion, and camera/lighting continuity if the first two pass.
5. Capture output metadata, exact model/version, settings, provider route, duration, quoted/actual cost, latency, and the QA scorecard.
6. Apply the hard-fail rules in `CHARACTER_REALISM_QA_PROTOCOL.md`. Any face/neck mismatch, identity drift, malformed hands/limbs, visible morphing, or major flicker rejects that candidate regardless of average score.
7. Limit each test to one attempt by default. A retry requires a documented change and must stay under a user-approved budget cap.

## Integration recommendation

Keep model-provider integration behind a provider adapter rather than coupling Producer directly to one vendor. The adapter should expose:
- capability discovery (reference count/types, duration, aspect ratio, resolution, audio, extension);
- preflight estimate and hard budget check;
- explicit user-approved generation request;
- asynchronous task state and cancellation where supported;
- normalized output metadata and error categories;
- immutable test record linking outputs to reference-pack and prompt versions.

Do not implement automatic paid failover yet. Provider failover can silently multiply costs and produce incomparable outputs unless the destination model is approved for the same test and passes the same preflight budget gate.

## Current blockers

- No approved canonical face/body reference packs for either character.
- No user-approved per-test or per-episode budget ceiling.
- Account-specific provider access, regional availability, payment route, and actual final quote are not verified.
- No controlled model outputs have been scored against the realism protocol.

## Next gate

Approve canonical reference packs first. Then run the smallest two-shot comparison, beginning with the lowest-cost eligible route. No full episode generation, production provider selection, or automatic paid retry is authorized by this research note.
