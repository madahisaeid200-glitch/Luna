# LUNA Decision Register

This is the chronological record of durable project decisions. The current state and next task live in `../PROJECT_LEDGER.md`.

## Rules
- Add an entry when a decision changes scope, quality gates, budget, character identity, workflow, or architecture.
- Record the date, decision, reason/evidence, affected assets/files, and whether it supersedes an earlier decision.
- Do not erase rejected decisions; mark them superseded and link the replacement.
- User approval must be explicit and tied to an exact version or asset. Assistant assumptions are not approval.

## Entries

### 2026-11-25 — Central project record
- Decision: establish `PROJECT_LEDGER.md` as the mandatory session-start and session-end checkpoint.
- Reason: prevent repeated starts, lost decisions, and accidental reuse of stale or rejected work.
- Status: proposed in PR #29; main branch unchanged.

### 2026-11-25 — Canonical character references
- Decision: no historical portrait or draft is canonical unless the user explicitly approved that exact asset.
- Status: active quality gate.

### 2026-11-25 — Production priority
- Decision: prove a zero-cost, photorealistic Instagram Reels workflow before expanding secondary Studio features.
- Status: active.

### 2026-11-25 — Browser-local persistence gap
- Finding: Producer character profile is stored in browser localStorage; the dashboard episode list is also documented as browser-local. These are not a shared, centrally synchronized project database.
- Decision: repository ledger/registers remain authoritative until a secure central persistence layer with export, stable IDs, version history, and conflict handling is implemented and verified.
- Status: gap confirmed; migration not implemented. No secrets may be committed to public source.
