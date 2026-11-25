# LUNA Project Ledger — Single Source of Truth

> Purpose: prevent lost decisions, repeated work, accidental use of rejected assets, and restarting from the wrong checkpoint.
> Status: initialized on 2026-11-25. This ledger is the project control document. It is not a claim that every historical asset or decision has already been recovered.

## 1. Operating rules (mandatory)
1. Read this file before every LUNA work session. Continue from the latest dated checkpoint below; do not restart an older audit or repeat completed checks.
2. Write every material decision here during the same work session. A decision is not durable until recorded in this repository.
3. Never silently promote a draft, experiment, generated image, or old archive asset to an approved reference.
4. Use explicit status labels only: APPROVED, REJECTED, EXPERIMENTAL, UNVERIFIED, SUPERSEDED.
5. A character reference is approved only when the user explicitly approves that exact image/version. Similarity, assistant preference, or a positive comment about an intermediate revision is not approval.
6. Rejected/superseded assets must remain recorded so they are not accidentally reused.
7. No production run may begin until the required character references, input assets, motion source, and cost/rights constraints are checked against this ledger.
8. Do not ask the user to repeat information already present here or in linked source artifacts. If evidence is missing, mark it UNVERIFIED and investigate.
9. Do not make changes directly on main for project work. Use a focused branch and a reviewable pull request.
10. Never report a test as passed unless the actual output was generated and inspected.

## 2. Project goals and constraints
- Project: LUNA & LEO, a realistic virtual couple with a cinematic, luxury European visual world.
- Current distribution focus: Instagram Reels; do not silently revert to the earlier YouTube-first plan.
- Cost constraint: ZERO-COST production path. No paid subscription, credit purchase, or service upgrade without the user's explicit approval.
- Quality requirement: highly photorealistic, natural human appearance and movement; stable identity across shots; believable faces, anatomy, hands, lighting, clothing, and environments. The user has described the target as comparable to the realism of Rostam Luti and expects an exceptionally difficult-to-detect AI result. This is a target, not a verified achieved score.
- If a free path cannot meet the quality requirement, report the limitation honestly. Do not lower the quality bar or incur costs to conceal the gap.
- Automation should minimize user effort, especially because the user often works from an Android phone.
- Do not expand secondary Studio features until the free, realistic video-production path has been demonstrated with inspected output.

## 3. Character identity registry

### LUNA
- Canonical visual reference: UNVERIFIED — not yet recovered and confirmed in this ledger.
- Historical text description found in a Producer draft: 27-year-old elegant European woman, long glossy chestnut-brown hair, hazel eyes, refined natural facial features, realistic skin texture, graceful natural proportions, understated luxury styling.
- This text is not proof of the final approved design.
- Several old café portraits in the Library show a hand resting against the cheek. They were considered unsuitable for an initial motion test because the hand is too close to the face. They are NOT approved canonical references.
- Do not use old café portraits, unrelated web images, or assistant-selected archive images as LUNA's canonical identity.
- Next action: recover the original design decisions and exact candidate image(s), compare revisions chronologically, then record the exact asset name/ID and approval evidence.

### LEO
- Canonical visual reference: UNVERIFIED — not yet recovered and confirmed in this ledger.
- Historical text description found in a Producer draft: 29-year-old elegant European man, neatly styled dark-brown hair, warm brown eyes, subtle natural stubble, realistic skin texture, athletic but natural proportions, tailored quiet-luxury clothing.
- This text is not proof of the final approved design.
- User rejected an earlier unattractive/non-natural-looking version and requested a more natural, handsome appearance. A later revision was considered improved but still needed more naturalism; that does not establish final approval.
- Do not substitute an old archive portrait or an unrelated couple image.
- Next action: recover the exact initial design and all subsequent revisions, then identify the latest explicitly approved version.

### Approval record
No final LUNA or LEO image is marked approved by this initial ledger. This is deliberate: uncertainty must remain visible rather than being replaced with guesses.

| Character | Exact asset/version | Status | Approval evidence |
|---|---|---|---|
| LUNA | Not yet recovered | UNVERIFIED | Not established |
| LEO | Not yet recovered | UNVERIFIED | Not established |

## 4. Production pipeline status
| Stage | Status | Evidence / next action |
|---|---|---|
| Original character concept recovery | IN PROGRESS | Search prior project conversations and Library chronologically |
| Final LUNA reference approval | BLOCKED | Exact approved asset not yet established |
| Final LEO reference approval | BLOCKED | Exact approved asset not yet established |
| Free driving-motion source | UNVERIFIED | Establish provenance, license, framing, and suitability |
| Wan-Animate-2 technical route | EXPERIMENTAL | Official Space/code reviewed; no LUNA/LEO output generated or inspected |
| End-to-end photorealistic Reel | NOT DEMONSTRATED | No qualifying finished output inspected |
| Automated publishing | NOT IN SCOPE YET | Do not build before production quality is proven |

### Wan-Animate-2 caution
- Reviewed Hugging Face Space: https://huggingface.co/spaces/hugging-apps/wan2-2-animate-2-14b
- The reviewed demo accepts a character image and a driving video and returns MP4.
- Free ZeroGPU capacity, queue time, and runtime are limited/variable. Do not assume daily capacity or a successful run.
- The model is not yet validated on the canonical LUNA/LEO references.
- A single-character run does not by itself solve scenes with both characters.
- No actual LUNA/LEO video generation has been verified as of this ledger's initialization.

## 5. Technical project anchors
- Repository: madahisaeid200-glitch/Luna
- Main website: https://madahisaeid200-glitch.github.io/Luna/
- Producer page: https://madahisaeid200-glitch.github.io/Luna/producer.html
- Cloudflare Worker endpoint historically used: https://orange-firefly-6434.madahisaeid200.workers.dev
- Main branch README describes the browser-first Studio, Worker, production-pack export, and prototype renderers. Those renderer prototypes are motion-graphics/text-card paths, not proof of photorealistic AI footage.
- Current documentation branch: docs/luna-single-source-of-truth
- Main branch was not modified when this ledger was initialized.

## 6. Session checkpoint
### 2026-11-25 — Ledger initialized
Problem addressed: project knowledge, decisions, assets, and checkpoints were scattered across chats, Library files, and repository history. Work repeatedly resumed from stale or incorrect material.

Confirmed facts:
- The Producer draft contains textual descriptions for LUNA and LEO, but those descriptions do not establish final visual approval.
- Previously inspected old LUNA café portraits commonly show a hand against the cheek and are poor first motion-test references.
- An old LEO portrait exists, but it is not established as the final approved LEO.
- No actual Wan-Animate-2 output featuring the canonical LUNA has been generated and inspected.
- The user explicitly objects to reusing old designs instead of the original/current approved designs.

Current task — do this next, in order:
1. Recover the original LUNA and LEO concept/design from prior conversations and Library assets, preserving dates and exact asset identifiers.
2. Build a chronological revision history for each character: original → revisions → rejected versions → explicitly approved version.
3. Record the exact approved reference image(s) here. If explicit approval cannot be found, keep status UNVERIFIED; do not invent a final design.
4. Only after character identity is locked, resume motion-source and Wan-Animate-2 feasibility testing.
5. Update this checkpoint with what was actually inspected, what passed/failed, and the next single action.

Do not do: restart old Worker/token diagnosis, modify Producer UI, create new character portraits, or run video generation before completing character-reference recovery, unless a new verified blocker makes that necessary.

## 7. Decision log
Append newest entries at the top. Each entry must state the date, decision/change, evidence, and affected files/assets.

| Date | Type | Decision / finding | Evidence |
|---|---|---|---|
| 2026-11-25 | Process | Establish this repository ledger as the mandatory project checkpoint and decision register. | Created on docs/luna-single-source-of-truth. |
| 2026-11-25 | Quality gate | Old archive portraits and unapproved drafts must not be treated as canonical character references. | User correction; exact final references still being recovered. |

## 8. Recovered historical design timeline (partial)

This section records evidence recovered from prior conversations. It deliberately distinguishes saved profile text and generation prompts from explicit approval of an exact image.

### 2026-10-28 — Original saved profile and first generation record
- LUNA profile: adult 27-year-old elegant European woman; long glossy chestnut-brown hair; hazel eyes.
- LEO profile: adult 29-year-old elegant European man; dark-brown hair; warm brown eyes; subtle stubble.
- Shared style: photorealistic luxury European fashion editorial; vertical 9:16; no logos or text.
- A FLUX generation was reported as successful and stored in the private browser library. The prompt described LUNA looking at the camera with a confident expression and cinematic lighting.
- Approval status: **UNVERIFIED**. The conversation record does not establish that the user approved that exact output. The exact Library asset ID still needs to be matched.

### 2026-10-31 — Hotel-suite and window looks
- One generation prompt described LUNA standing elegantly in a luxurious hotel suite.
- A later prompt described LUNA beside a large window with a city view, wearing a white evening gown, silver necklace, and earrings.
- The window-look generation timed out after 90 seconds; it must not be treated as a completed output.
- Approval status: **UNVERIFIED**. No explicit approval/rejection of the exact successful hotel-suite output was found in the retrieved record.

### 2026-11-01 — Profile reaffirmed; motion test distinction
- The same LUNA/LEO profile and shared photorealistic 9:16 editorial style were reaffirmed.
- A prior assistant reported a Wan 2.2 test using a test image, but explicitly noted that no dedicated LUNA-and-LEO video had been produced.
- Approval status: **UNVERIFIED** for character references; a generic test image is not a canonical character asset.

### 2026-11-24 — Studio profile check
- The saved Studio profile had editable LUNA/LEO “fixed appearance” fields and a shared visual style, but the retrieved record did not expose the actual appearance text or a reference-image approval.
- No redesign or final approval evidence was recovered from that check.

### Recovery conclusion
- The earliest retrievable concept is the October 28 profile above. It is the original **textual character concept**, not proof of the final visual image.
- The exact image generated on October 28, its Library ID, and any subsequent image approvals remain to be recovered from Library assets and full conversation records.
- Do not call a later image “the original design” solely because its prompt resembles this profile.
- Keep both canonical visual references **UNVERIFIED** until exact image identity and explicit user approval are connected.


## 9. Persistence and synchronization audit

### Confirmed architecture gap — 2026-11-24 source review
- The Producer source uses browser `localStorage` for the editable character profile (`lunaCharacterProfile`) and the dashboard/episode state is described as saved in the same browser.
- This means the Studio's working profile and some episode state are browser/device-local, not a reliable shared project database. They can be absent in another browser/device or after local browser data is cleared.
- The repository README also describes the dashboard episode list as browser-local storage.
- Therefore the project currently has two separate kinds of records:
  1. Repository-backed source and documentation (durable, versioned, reviewable).
  2. Browser-local Studio working data (not centrally synchronized).
- Do not assume a saved profile in one browser is available to another. Do not use browser-local data as the only canonical record for character identity, approved assets, decisions, or episode continuity.

### Required future remediation
1. Keep the repository ledger, decision register, and asset registry as the authoritative project record.
2. Create export/import backups for browser-local episodes and settings before any migration.
3. Design a central persistence layer for Studio records only after checking the existing Worker/API and security model. Never expose a private access token in public source or commit it to the repository.
4. Define stable IDs and version history for characters, approved reference assets, episodes, and production runs.
5. Add explicit sync status and conflict handling so a local draft cannot silently overwrite a newer approved record.
6. Verify recovery from a second browser/device before calling synchronization complete.

Status: **GAP CONFIRMED; CENTRAL SYNC NOT IMPLEMENTED.** No migration or code change has been made in this audit.


## 10. Session checkpoint — 2026-11-25 continuation

### Work completed in this session
- Recursively listed the Library image assets and found a set of 2026-11-21 character candidates that were not present in the earlier asset register.
- Visually inspected five exact image files and recorded their Library IDs, timestamps, and pose observations in `docs/ASSET_REGISTRY.md`.
- Opened PR #32 and merged it into main. Merge commit: `88a31ca0588f40771d4d28e662432ae71cccdd31`.
- No candidate was promoted to APPROVED. LUNA's canonical visual reference remains UNVERIFIED; LEO's canonical visual reference remains UNVERIFIED.
- Added a pilot-draft project playbook at `docs/PROJECT_SYSTEM_PLAYBOOK.md` on branch `docs/project-system-playbook-v0`. It is not yet merged or validated as a standard.

### Important new evidence
- Five additional 2026-11-21 images are visually grouped as LEO candidates.
- The black-suit portrait is the clearest neutral-pose candidate among those five inspected, but this is only a pose-suitability observation, not approval.
- Several newer LEO café/lounge portraits still have a hand close to the face.
- The LUNA image lineage is not yet recovered; do not infer her canonical image from these LEO files.

### Next actions
1. Review and merge the project playbook only after checking the complete diff and confirming it does not overstate current capabilities.
2. Continue Library inventory for remaining 2026-11-21 LEO candidates and 2026-11-19/earlier LUNA candidates; visually inspect before recording.
3. Recover the exact conversation prompts and user approval statements that connect candidate images to the design revision sequence.
4. Add an Issue & Learning Register to LUNA and record the already confirmed persistence gap as a tracked issue.
5. Keep production/video tests blocked until the exact character references are recovered and approved.

### Explicitly not completed
- No final LUNA/LEO image approval.
- No photorealistic LUNA/LEO video generation or visual quality pass.
- No central database, cross-device sync, or browser-data migration.
- No automated project-management enforcement.
- No validated multi-project standard yet.


## 11. Issue tracking established — 2026-11-25
- Created `docs/ISSUES_AND_LEARNINGS.md` in a review branch.
- First tracked issue: **LUNA-001 — Studio data is browser-local rather than centrally synchronized**.
- Severity is marked HIGH because of data durability and continuity risk; status remains OPEN.
- The record distinguishes the confirmed architecture gap from a runtime bug, documents containment, and defines regression tests required before closure.
- No persistence code was changed. The next technical action is to map all Producer localStorage keys and read/write paths before proposing a migration.


## 12. Producer storage inventory — 2026-11-25
Reviewed current `producer.html` and `index.html` source on main. Confirmed:
- localStorage keys: `lunaCharacterProfile`, `lunaEpisodes`, `lunaAiEndpoint`, `lunaDiagnostics`, `lunaVoiceDiagnostics`.
- sessionStorage key: `lunaAccessToken` (private credential; explicitly excluded from backups).
- IndexedDB database: `luna-image-library`, object store `images`, storing generated image data URLs, metadata, timestamps, and auto-increment IDs.
- Dashboard and Producer both use `lunaEpisodes`; dashboard reset removes that key.
- Existing diagnostic export is not a full backup: it does not export the full episode collection and IndexedDB image payloads.
- Diagnostic histories are bounded (30 general events / 20 voice events in observed write paths); they are not a complete audit trail.

Updated `docs/ISSUES_AND_LEARNINGS.md` with exact source evidence and refined backup requirements. No runtime code changed. The next step is to specify and review a non-destructive backup/restore design before implementation.


## 13. Backup/restore design — 2026-11-25
- Added `docs/BACKUP_RESTORE_SPEC.md` on branch `docs/backup-restore-design`.
- The design covers character profile, episode records, IndexedDB images, optional bounded diagnostics, optional Worker endpoint, and strict exclusion of access tokens.
- Restore is two-phase: validate/preview first, then create and verify a pre-restore snapshot before writing. Silent overwrite is prohibited.
- README now links all project-control records so future sessions and collaborators can find the source of truth.
- This is design documentation only. No export/restore UI or runtime code has been implemented or tested.
