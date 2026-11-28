# LUNA + LEO — Character Realism & Video QA Protocol

> Status: protocol draft. No character face, body reference, provider, or generated clip is approved by this document. The user's explicit approval is required before any candidate becomes canonical.

## 1. Non-negotiable production goal

LUNA and LEO must look and behave like the same real adult performers across shots and episodes. The target is believable live-action footage, not merely attractive AI imagery. Do not trade identity stability, anatomy, or natural motion for visual glamour.

Rejected or unapproved historical images are not canonical references. Never silently promote an archived candidate into the character bible.

## 2. Character identity lock

Before video production, create a user-approved reference pack for each character:

- Neutral front portrait, three-quarter portrait, and side profile.
- Full-body front and three-quarter views with natural proportions.
- Neutral expression plus a small set of natural expressions.
- Consistent hairline, eye shape/color, nose, jaw, skin texture, age presentation, and distinguishing details.
- Matching wardrobe and lighting references for the first controlled video test.

Record a version ID for every approved image. Store the exact approved reference files and a short textual identity description. Any change to the face or body reference requires a new version and explicit approval; do not overwrite the previous canonical version.

For two-character scenes, maintain separate identity references for LUNA and LEO and verify that the model does not blend facial features or transfer clothing/attributes between them.

## 3. Controlled test-shot suite

Run the same short test suite for each candidate model using the same approved references, prompt intent, aspect ratio, and target resolution:

1. **Portrait stability (4–6 s):** close-up, natural blink, subtle head turn, slight smile; no speech.
2. **Dialogue close-up (4–6 s):** one character speaks a short line, with natural mouth motion and no exaggerated facial movement.
3. **Two-person interaction (5–8 s):** both characters in one frame, brief eye contact and a small natural gesture; preserve each identity.
4. **Full-body movement (4–6 s):** a few walking steps and a turn; inspect hands, shoulders, hips, knees, feet, clothing, and body proportions.
5. **Lighting/camera continuity (4–6 s):** slow camera movement with a modest change in angle or light; skin tone and facial geometry must remain stable.

Start with one low-cost generation per test. Do not generate a full episode to evaluate a model. Re-run only a failed test after changing one variable at a time.

## 4. Quality scorecard

Score every dimension from 0 to 5 and attach timecodes plus frame captures for any defect.

| Dimension | What to inspect |
|---|---|
| Identity consistency | Face shape, eyes, nose, mouth, jaw, hairline, age presentation, and identity across frames |
| Anatomy | Hands/fingers, limbs, joints, neck-to-face transition, shoulders, teeth, ears, and body proportions |
| Motion | Weight, balance, foot contact, gestures, blinking, head turns, and absence of jitter or morphing |
| Skin and materials | Natural skin texture, pores, hair strands, fabric behavior, reflections, and no wax/plastic appearance |
| Lighting and environment | Consistent shadows, reflections, exposure, skin tone, object contact, and scene geometry |
| Camera and continuity | Stable perspective, plausible depth, no warping, flicker, sudden background changes, or jump-cut artifacts |
| Performance and audio | Natural expression, gaze, lip synchronization, voice continuity, and believable pauses |
| Overall live-action impression | Whether the clip reads as ordinary filmed footage rather than an AI-generated sequence |

### Release gate

- **Hard fail:** identity drift; face/neck mismatch; malformed hands or limbs; impossible body movement; face blending; strong flicker/warping; visibly synthetic skin; or broken lip-sync in a speaking shot.
- **Candidate pass:** no hard fail and at least 4/5 in identity, anatomy, motion, and overall live-action impression.
- **Production pass:** all dimensions at least 4/5 across the complete test suite, with no unresolved hard failures.
- A high average never overrides a hard fail.

## 5. Provider comparison and cost firewall

For each model/provider, record:

- Provider and exact model/version; API or UI route.
- Date, resolution, aspect ratio, duration, prompt version, reference IDs, seed if available, and all generation settings.
- Estimated and actual cost per attempt; retries; generation latency.
- Scorecard, defects, timecodes, and whether the output passed the release gate.

Rules:

1. Prefer free or trial access for controlled evaluation, but never treat a free result as production-ready without the same QA.
2. Estimate cost before every paid request. Require an explicit budget ceiling in the project configuration.
3. Default to one attempt per test shot; at most two retries after a documented prompt or setting change.
4. Never auto-retry a failed generation indefinitely. Stop on budget limit, repeated hard failure, or provider quota exhaustion.
5. Use provider failover only when the next provider has been approved for the same test and its estimated cost is within the budget ceiling.
6. Preserve outputs and metadata so the same test can be compared later.

## 6. Continuity checks for every episode

Before assembling an episode, compare selected frames from each scene against the approved identity pack and the adjacent scene:

- Same face, hair, eye color, age presentation, skin tone, and body proportions.
- No wardrobe changes unless the script explicitly calls for them.
- Consistent screen direction, geography, props, lighting, and time of day.
- No extra people or accidental character substitutions.
- No facial or body changes hidden by a camera cut.
- Audio/voice identity remains stable for each character.

Reject and regenerate only the affected shot where possible; do not regenerate an entire episode when a single shot fails.

## 7. Current decision and next gate

- No historical LUNA or LEO image is designated canonical yet.
- Do not create final episode footage until the user approves both character reference packs.
- Next: prepare a small set of clearly labeled face candidates for review; after approval, run the controlled five-shot comparison and select a provider based on measured identity stability, motion realism, and cost.
- Mobile backup/export work remains a separate reliability track and must not be confused with character/video QA.
