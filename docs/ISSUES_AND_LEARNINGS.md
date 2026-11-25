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
- **Next action:** Inspect the current Producer source and enumerate all localStorage keys, schemas, and read/write paths before proposing any migration.
- **Not done:** No export/import implementation, central database, cross-device sync, or regression pass has been completed.

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
