# LUNA Persistent Checkpoint and Continuation Protocol

**Purpose:** prevent lost progress, repeated audits, stale instructions, and unsupported progress claims when work continues across separate chats or sessions.

**Authority:** this protocol supplements the LUNA Team Operating Model (PR #14). It does not authorize merging, production deployment, credential changes, external account connections, paid usage, or quota-consuming tests.

## 1. One source of truth

- This file defines the continuation rules.
- The live project state must be recorded in `docs/PROJECT_CHECKPOINT.md` (the single current checkpoint).
- GitHub is the evidence source for repository state: branches, PRs, commits, workflow runs, artifacts and deployment comments.
- Chat history and model memory are hints only. They never override a newer verified GitHub checkpoint.
- Never create competing "latest status" notes. Update the canonical checkpoint instead.

## 2. Mandatory start-of-session gate

Before doing any LUNA work after a new chat, a pause, or an ambiguous "continue":

1. Read this protocol and `docs/PROJECT_CHECKPOINT.md`.
2. Verify the checkpoint's referenced PR/branch/commit against GitHub. Check whether it is still open, merged, closed, superseded, or changed.
3. Verify the latest relevant CI run and preview/deployment evidence. Do not infer a deployment from a green CI run.
4. Compare the live repository state with the checkpoint. If they differ, reconcile the checkpoint before taking action.
5. Identify the single next actionable task and its prerequisites.
6. If evidence is missing, say exactly what cannot be verified. Do not restart an earlier phase or ask the user to repeat project history.

**Hard stop:** no implementation begins until steps 1–5 are complete. If a required source is unavailable, report the specific verification gap and stop rather than guessing.

## 3. Mandatory end-of-work checkpoint

At the end of every meaningful work session, before replying that work is paused or complete:

1. Update `docs/PROJECT_CHECKPOINT.md` with the new state.
2. Record exact branch, PR, commit SHA, changed paths, test/workflow run IDs and results.
3. Separate verified, partially verified, blocked and not-tested items.
4. Record the exact next action as one executable step, including its owner/workstream and prerequisite.
5. Record any user action required, with the exact UI label/path where known.
6. Commit the checkpoint update on the active feature branch. Do not merge it to `main` without explicit approval.
7. Confirm the checkpoint commit exists before telling the user it was saved.

A task is not "done" merely because code was written or a syntax check passed. State the evidence and remaining gaps.

## 4. Task ledger and anti-repeat rule

Every active task must have:
- stable task ID;
- owner/workstream;
- status: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `VERIFIED`, or `SUPERSEDED`;
- exact scope and acceptance criteria;
- dependency/blocker;
- evidence links/IDs;
- next action.

Before starting a task, search the ledger and GitHub for existing work. If an equivalent task is already verified, do not repeat it. If it is partially complete, resume from the first unverified acceptance criterion. If superseded, link to its replacement.

Do not reopen a completed audit merely because a new chat started. Recheck only if its evidence is stale, the relevant commit changed, a regression occurred, or the user explicitly asks.

## 5. "Continue" command semantics

When the user says "ادامه بده" / "continue":
- Do not ask what project, phase, or task they mean if the canonical checkpoint identifies it.
- Execute the next safe, unblocked atomic action; do not reply with another roadmap.
- If the next action requires the user's account access or a secret, do all preparatory verification possible and then request only the one necessary user action.
- Never ask the user to paste passwords, API keys, access tokens, recovery codes, or private credentials into chat.
- Do not ask for screenshots if GitHub, repository files, logs, or connected tools can establish the same fact.

## 6. Parallel work without conflicting edits

- PMO/ORCHESTRA owns one integrated priority order and checkpoint.
- Specialist workstreams may inspect independent areas in parallel.
- Shared-file edits, branch integration, merges and releases are serialized.
- Before editing a shared file, check active branches/PRs for overlapping changes.
- Each hand-off must include the exact artifact/commit, result, limitation and next owner.
- Workstream names represent coordinated responsibilities, not a claim that separate human employees or autonomous agents exist.

## 7. Safety and approval gates

Never do any of the following without explicit user approval:
- merge a PR or push to production branch;
- deploy production Pages/Worker;
- change production secrets, credentials, bindings or account settings;
- connect Meta/Instagram or publish externally;
- run live image, voice, video or other quota-consuming AI generation;
- incur paid service usage or enable billing;
- perform destructive data changes.

For any quota-consuming test, state the provider, exact request count/budget, expected cost/quota exposure, timeout and artifact plan before requesting approval. Default tests must be deterministic and quota-free.

## 8. Evidence and reporting contract

Every user-facing status must distinguish:
- **Verified:** directly supported by current GitHub/runtime evidence.
- **Partially verified:** some gates passed, but named gates remain.
- **Blocked:** exact missing prerequisite and who can resolve it.
- **Not tested:** no evidence; never describe as working.

A green CI run proves only the checks that actually ran. A Preview deployment is not production. A mock test is not a live integration. A generated fixture is not real generated footage. Never use "complete", "fixed", "deployed", or "working" beyond the evidence.

Every update is concise and contains:
1. current checkpoint/task ID;
2. what changed since the last checkpoint;
3. evidence;
4. blockers/cost or safety exposure;
5. the single next action.

## 9. Recovery if checkpoint is missing or inconsistent

- Search the latest checkpoint commit, open PRs, recent commits and workflow runs.
- Reconstruct only from verifiable artifacts, in descending order of authority: current GitHub state, workflow/deployment evidence, checkpoint history, then conversation context.
- Mark reconstructed facts with their evidence and confidence.
- Never silently replace a known user-confirmed checkpoint with an older or guessed phase.
- Once reconciled, write the corrected checkpoint before further implementation.

---

## Initial recovery record

This protocol was introduced because continuation repeatedly restarted from stale phases. The immediately preceding user-confirmed stopping point was the LUNA Worker authentication setup associated with PR #19:

- PR #19: `Secure LUNA Worker access with session-only Producer token`.
- Branch: `fix/worker-auth-cost-firewall`.
- PR state at last verified inspection: open and draft; not merged.
- Last recorded head commit: `9f406d3569fafeabc812a1345e958964f3ea2a99`.
- CI run #348 (GitHub run ID `44895491241`) passed its static/QA job.
- The PR requires a Cloudflare Worker secret named `LUNA_ACCESS_TOKEN`; the token must never be shared in chat or committed to Git.
- Important boundary: PR #19's code and preview are not production. Do not assume the production Worker or production Producer supports this flow.
- Last known next task: verify the exact current PR #19 preview and matching Producer preview, then guide the user through setting the secret in the correct isolated environment. Do not direct the user to enter a token into the production Producer until endpoint/branch alignment is proven.

**This initial record is a recovery anchor, not a claim that PR #19 is still at the same state today.** The next session must verify its live status before proceeding.
