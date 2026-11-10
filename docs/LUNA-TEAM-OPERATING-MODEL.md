# LUNA Team Operating Model

**Owner / delivery manager:** LUNA PMO (ChatGPT acting as the single project manager)  
**Repository:** `madahisaeid200-glitch/Luna`  
**Production rule:** `main` is production. No merge, deploy, real Meta connection, credential change, or quota-consuming live test without explicit user approval.

## 1. Virtual specialist teams

These are accountable workstreams and review roles, not claims that separate human employees or autonomous agents have been hired. The PMO coordinates their work and records evidence.

| Team | Lead / codename | Accountability | Required hand-off |
|---|---|---|---|
| Project Management Office | **PMO / ORCHESTRA** | Roadmap, dependencies, priorities, risk register, acceptance and user reporting | One integrated plan and release decision |
| Architecture & Platform | **ATLAS** | Worker, Pages, D1/R2, API contracts, reliability, cost and data flow | Architecture decision record and migration/rollback plan |
| Application Security | **AEGIS** | OAuth, Access, secrets, token lifecycle, threat model and least privilege | Threat review, negative tests and security sign-off |
| Media Production | **CINEMA** | Script-to-shot pipeline, image generation/edit, TTS, Wan clips, stitching and export | Reproducible media artifact and known limitations |
| Quality Engineering | **SENTINEL** | Unit, contract, browser, regression, media integrity, Android/device and failure-path testing | Machine-readable test report and release-blocking defects |
| AI & Continuity | **ORACLE** | Provider routing, prompt quality, LUNA/LEO identity, screenplay/voice continuity and quota controls | Quality rubric, fixtures and provider/cost evidence |
| Social Publishing | **PULSE** | Instagram professional account, Meta app, OAuth, upload/publish lifecycle, scheduling and Insights | Permission matrix, sandbox proof and manual-approval gates |
| Product & UX | **ATELIER** | Producer/Reels UX, dashboard, accessibility, mobile usability and language | User journeys, screenshots and acceptance criteria |
| Release & Operations | **RELEASE** | CI/CD, Preview isolation, versioning, deployment checks, rollback and observability | Deployment evidence and rollback readiness |

## 2. Rules of teamwork

1. **One backlog, one priority order.** PMO owns the integrated backlog; teams do not start disconnected implementations.
2. **Parallel analysis, serialized integration.** Teams may audit independently, but shared-file edits and merges are sequenced by PMO.
3. **Definition of Ready.** Every task has an owner, user value, scope, dependencies, risk/cost class, test plan and acceptance criteria before implementation.
4. **Definition of Done.** Code review, automated tests, negative-path tests, regression evidence, docs and known limitations are complete. A green syntax check alone is not Done.
5. **Independent QA.** The authoring team cannot self-certify its own release. SENTINEL verifies the result independently.
6. **No false green.** Distinguish static test, mocked integration, live provider test, browser test, Android device test and production verification.
7. **Quota safety.** Default CI must be deterministic and quota-free. Live image, voice, video and provider tests require an explicit opt-in, exact request budget, timeout and artifact retention.
8. **Production safety.** Work on feature branches and Preview first. No production merge/deploy or external account connection without the user's explicit approval.
9. **Evidence-led reporting.** Every status is labelled Verified, Partially verified, Blocked or Not tested, with commit/run/artifact evidence.
10. **No silent scope loss.** Existing Producer, Reels, image QA, voice sync, Wan generation, stitching and download capabilities are regression contracts.

## 3. Verified repository inventory (reviewed 2026-11-10)

| Area | Evidence found | Current confidence / gap |
|---|---|---|
| Producer and episode dashboard | `producer.html`, `index.html`; production-pack export/parser | Present; full current mobile journey still needs browser verification |
| Image generation and image QA | PR #7 merged; quality-gate workflow contains parser/continuity checks; one-image manual smoke workflow | Static safeguards exist; live provider output is quota-gated and not equivalent to six-image live verification |
| Six-shot continuity | PR #7 merged; workflow assertions require six distinct approved images and six Wan clips | Static safeguards exist; a full live six-shot run is expensive and must be opt-in |
| Voice synchronization and TTS | PR #7 merged; static checks inspect LUNA/LEO speaker extraction; media smoke workflow tests TTS | Static checks exist; live TTS status must be separately evidenced |
| Wan video | PR #5 merged; `luna-wan-video-proof.yml`; browser media smoke workflow | Real generation path exists; live output and device compatibility need controlled verification |
| Clip stitching | PR #6 merged; browser media smoke checks final WebM artifact | WebM output is checked for existence/size; independent container/track decode validation is still required |
| MP4 browser renderer | `browser-renderer/` and Remotion `renderer/`; Pages build workflow | Text-card prototype only; not equivalent to character-footage pipeline |
| Instagram Reels workspace | PR #11 open, draft, not merged | Separate quota-free UI/data-model work; local browser storage only |
| Instagram security | PR #13 open, draft, not merged; latest recorded CI run #254 succeeded | Code-level tests pass; Preview/runtime/real D1/Access not yet proven |
| Instagram publishing | No Instagram account or Meta app yet, per PR #13 blockers | Not implemented end-to-end; requires account/app, permissions and verified media hand-off |

### Existing test workflows and safety observations

- `luna-pr-quality-gates.yml`: static Worker/Producer checks and QA/parser safeguards run on pull requests.
- `luna-browser-media-smoke.yml`: manual, main-only and explicitly quota-confirmed; exercises script, production pack, image, vision QA, six images, voice, six Wan clips, WebM assembly and voiced animatic.
- `luna-one-image-smoke.yml`: manual, main-only and explicitly image-quota-confirmed; sends exactly one image request.
- `luna-wan-video-proof.yml`: calls the live Worker video route and currently has a manual trigger without an explicit quota-confirmation input. **P0 safety review required before anyone runs it.**
- `check-worker.yml`: despite its diagnostic name, includes real FLUX image generation and reference-image editing; manual/push trigger lacks an explicit quota-confirmation input. **P0 safety review required before anyone runs it.**
- Current browser media smoke stores a final WebM and voiced animatic, but does not prove with an independent media probe that every final file has valid dimensions, duration, decodable video and decodable audio tracks.

## 4. Release gates

A release cannot pass until all applicable gates are green:

- **G0 — Scope and architecture:** contracts, dependencies, data flow, cost and rollback understood.
- **G1 — Static and unit:** parsing, schemas, validators, state machines and failure cases pass.
- **G2 — Integration:** Worker routes, auth, storage adapters and provider adapters tested with controlled fixtures/mocks.
- **G3 — Media integrity:** inspect file signatures/container, dimensions, duration, codecs, track presence, full decode and audio/video synchronization. Keep MP4 and WebM expectations distinct.
- **G4 — Browser and device:** Playwright regression plus real Android Chrome check for memory, download, playback and cleanup.
- **G5 — Security:** unauthenticated/unauthorized/expired/replayed/CSRF/CORS/path-normalization cases fail safely.
- **G6 — Preview:** matching commit SHA deployed with isolated bindings and runtime smoke proof.
- **G7 — Production:** explicit user approval, backup/rollback plan, controlled deployment and post-deploy verification.

## 5. Priority-ordered delivery plan

### P0 — Protect the project and establish trustworthy evidence
- AEGIS + RELEASE: audit all workflow triggers for accidental live quota consumption; add explicit confirmation and request budgets to live image/video diagnostics before execution.
- SENTINEL: inventory every existing static, mocked, live and browser test; identify what is not covered.
- ATLAS: map main, PR #11 and PR #13 ancestry/dependencies; no blind merge/rebase because PR #13 is diverged from main.
- PMO: maintain one status board with owner, dependency, blocker, evidence and next action.

### P1 — Restore a dependable media quality system
- CINEMA + SENTINEL: add quota-free fixture tests for image signatures/dimensions, corrupt/empty payloads, shot ordering, stale-asset invalidation, and export handling.
- SENTINEL: add independent MP4/WebM probe and full decode checks for video and audio tracks, duration/dimensions/codecs and A/V sync.
- ATELIER + SENTINEL: add Playwright regression for Producer/Reels save, reopen, edit, image approval locks, video export and mobile layout.
- ORACLE: create deterministic fixtures for visual QA pass/fail, identity continuity, speaker attribution and provider fallback labels.
- Keep expensive live generation as a separate manually approved acceptance test.

### P2 — Secure Instagram foundation
- AEGIS + ATLAS: finish PR #13 review, reconcile branch ancestry safely, provision isolated Preview D1/Access only after the configuration plan is approved.
- PULSE: document Meta prerequisites and permission review; no real OAuth until the account/app exists.
- SENTINEL: prove protected-route behavior and public LUNA route regression in Preview.

### P3 — Reels workflow and publishing
- ATELIER + CINEMA: review PR #11 against current Producer and media contracts.
- PULSE + ATLAS: implement approved media hand-off, idempotent upload/publish state machine, retry/cleanup and Insights only after security and media gates pass.
- Human approval remains required before publishing until the user explicitly changes that policy.

### P4 — Controlled release
- RELEASE: produce a release candidate from a reconciled branch, verify all gates and rollback.
- PMO: present exact change list, evidence, costs, residual risks and ask for explicit production approval.

## 6. Reporting format

Every PMO update uses this structure:

- **Overall status:** Green / Amber / Red, with reason.
- **Completed:** only work with verifiable evidence.
- **In progress:** team, task and next hand-off.
- **Blocked / risks:** exact missing prerequisite or failure.
- **Cost exposure:** quota, paid service, external account or production impact.
- **Next decision:** the single highest-value action.

**Current management decision:** keep production untouched; do not run live quota-consuming workflows; first complete the P0 workflow-safety audit and P1 quota-free media-integrity test plan. PR #11 and PR #13 remain separate draft workstreams until dependency and regression review is complete.
