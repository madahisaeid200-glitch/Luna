# LUNA Issue & Learning Register

> This register tracks reproducible defects, architectural gaps, root-cause investigations, and prevention rules. An issue is not closed merely because a workaround exists.

## Issue status rules
- **OPEN** — confirmed issue; remediation not complete.
- **INVESTIGATING** — evidence gathering or root-cause analysis is active.
- **FIX IN REVIEW** — proposed change exists but is not merged/verified.
- **VERIFIED** — fix passed its defined regression and recovery tests.
- **DEFERRED** — consciously postponed with reason and owner.
- **CLOSED** — verified or formally accepted as no longer applicable.

## Required issue fields
ID, date found, component/version, severity, user impact, reproduction/evidence, expected vs actual, root cause (or UNKNOWN), remediation, regression test, prevention rule, status, and next action.

## Open issues

### LUNA-001 — Studio data is browser-local rather than centrally synchronized

- **Date found:** 2026-11-24 (confirmed in ledger review on 2026-11-25)
- **Component:** LUNA Producer / dashboard persistence
- **Severity:** HIGH — data durability and continuity risk
- **Status:** OPEN
- **Observed behavior / evidence:**
  - Producer stores the editable character profile under browser `localStorage` key `lunaCharacterProfile`.
  - Dashboard episode state is also documented as browser-local.
  - The current setup does not establish a shared database or verified cross-device synchronization.
  - See `PROJECT_LEDGER.md`, section “Persistence and synchronization audit”.
- **Expected behavior:** Project-critical character profiles, approved assets, episode records, and decisions should have a durable authoritative store and recoverable versions, independent of one browser's local storage.
- **Actual behavior:** Some working data is tied to the browser/device and may not be present on another device or after local browser data is cleared.
- **Root cause:** The current Studio persistence design uses browser-local storage for these records; a central persistence and synchronization layer has not been implemented. This is an architectural gap, not a confirmed runtime bug in a particular browser.
- **User impact:** Risk of lost or divergent project state, repeated setup, and inconsistent episode/character continuity.
- **Immediate containment:** Treat repository-backed ledger, decision register, and asset registry as authoritative. Do not treat browser-local data as the only canonical record.
- **Remediation plan:**
  1. Map all localStorage keys and data schemas.
  2. Design export/import backup and verify restore before changing persistence.
  3. Define stable record IDs, schema versions, timestamps, and conflict rules.
  4. Review Worker authentication and access control; never expose private tokens in public source.
  5. Implement central persistence behind authenticated APIs.
  6. Test create/update/retrieve from two separate browsers/devices.
  7. Test restore and conflict handling before closing the issue.
- **Regression / acceptance tests required:**
  - Export a profile and episode set; import into a clean browser; verify exact record counts and content.
  - Create a record on device A; retrieve it on device B.
  - Update the same record from two clients; confirm conflict handling prevents silent overwrite.
  - Confirm unauthorized requests cannot read or mutate private project records.
  - Confirm a failed sync does not erase the local draft.
- **Prevention rule:** Every project must declare the authoritative data store and backup/restore strategy before relying on persistent user data. Local-only storage must be visibly labelled and must not be mistaken for cloud sync.
- **Next action:** Verify the new full-backup export in a real browser with populated profile/episodes/IndexedDB images; inspect the downloaded JSON and recompute SHA-256. Then implement validation/preview and restore in separate stages.
- **Not done:** Export code is in review but not yet merged or tested with the user's real browser data. No verified restore, central database, cross-device sync, or full regression pass has been completed.

## Issue template

### PROJECT-XXX — Short, specific title
- **Date found:**
- **Component/version:**
- **Severity:**
- **Status:**
- **Observed behavior / evidence:**
- **Expected behavior:**
- **Actual behavior:**
- **Root cause:** UNKNOWN until established
- **User impact:**
- **Remediation plan:**
- **Regression test:**
- **Prevention rule:**
- **Next action:**
- **Not done / limitations:**

## Learning promotion process

A prevention rule may be promoted into `docs/PROJECT_SYSTEM_PLAYBOOK.md` only after:
1. The underlying cause is supported by evidence.
2. The fix or containment is verified.
3. A regression check exists.
4. The rule is reviewed for applicability beyond this single incident.

Do not convert guesses or one-off workarounds into universal standards.


## LUNA-001 evidence update — Producer storage inventory (2026-11-25)

Source reviewed: `producer.html` and `index.html` on `main` (Producer blob `996439af315a8873fe4eabf818b9715c1cad721c`; dashboard blob `866367a1d19a9dabf686df305f956bc8394495c4`).

### Confirmed browser storage map

| Storage | Key / database | Observed content / behavior | Durability scope |
|---|---|---|---|
| localStorage | `lunaCharacterProfile` | JSON profile: LUNA/LEO names, appearance, personality, shared style | Same browser origin/profile |
| localStorage | `lunaEpisodes` | Episode records with numeric ID, Persian/English titles and story arrays; Producer and dashboard both read/write this key | Same browser origin/profile |
| localStorage | `lunaAiEndpoint` | Worker endpoint URL; not an access token | Same browser origin/profile |
| localStorage | `lunaDiagnostics` | Diagnostic events; several paths cap stored history to 30 entries | Same browser origin/profile; bounded history |
| localStorage | `lunaVoiceDiagnostics` | TTS diagnostic events; history capped to 20 entries | Same browser origin/profile; bounded history |
| sessionStorage | `lunaAccessToken` | Private access token restored into the current tab session | Session/tab-scoped; not part of a normal project backup |
| IndexedDB | `luna-image-library`, store `images` | Generated image data URLs, metadata, creation timestamp; auto-increment numeric ID | Same browser origin/profile; binary/base64 image payloads |

### Additional findings
- Dashboard `index.html` initializes episode data from `localStorage.getItem('lunaEpisodes')` or falls back to embedded seed episodes. Its reset action removes the stored episode key and returns to seeds. This is a destructive operation for locally saved episode records unless they have been backed up.
- Producer character reset removes `lunaCharacterProfile` and restores defaults in the form.
- Producer image storage uses IndexedDB, not localStorage. The image library is separate from the Library feature of ChatGPT and is local to the LUNA website's browser origin.
- Diagnostic records are intentionally bounded, so they are not a complete audit trail.
- The access token is held in sessionStorage and an in-memory variable. It must not be exported with project data or written to GitHub.
- The Producer currently offers a diagnostic-report export, but the inspected export includes diagnostics/status/profile metadata and does not constitute a full backup of episodes plus IndexedDB image payloads.

### Backup design requirements refined
A safe backup/restore feature must:
1. Export/import `lunaCharacterProfile` and `lunaEpisodes` with schema version and integrity checks.
2. Offer optional diagnostic export, clearly labelled as bounded diagnostic history rather than a complete log.
3. Export/import every record in IndexedDB `luna-image-library.images`, including dataUrl, meta, createdAt, and id where safe to preserve.
4. Explicitly exclude `lunaAccessToken` and never include secrets in the backup.
5. Treat `lunaAiEndpoint` as configuration, not a credential; allow user choice to include it.
6. Validate imported data before writing; create a pre-restore snapshot; never silently overwrite current records.
7. Verify record counts and image readability after restore.
8. Test backup on browser A and restore on a clean browser B before claiming portability.

### Revised next action
Design a non-destructive backup/export specification and tests first. Do not modify Producer UI or storage code until the complete restore path and failure behavior have been reviewed.


## LUNA-001 implementation update — 2026-11-25

- Added a dedicated full-backup export control to the Producer on branch `feat/producer-full-backup-export`.
- The exporter reads the saved character profile, complete episode list, and all IndexedDB image records. It validates record shapes and stops on malformed data rather than silently creating a partial archive.
- The output is versioned JSON with SHA-256 integrity metadata; the digest uses recursively sorted object keys.
- The access token is never read. Diagnostics and Worker endpoint are excluded by default.
- **Status remains OPEN.** Code review and static/runtime checks are still pending; no claim of successful real-data backup is made.
