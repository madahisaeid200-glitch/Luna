# Project System Playbook — Pilot Draft

> Status: **PILOT / NOT YET PROVEN**. This playbook is being derived from the LUNA project. Do not call it a validated standard until it has been used successfully across multiple real project cycles and its failure rate has been reviewed.

## 1. Purpose

Create one repeatable operating system for projects so work does not fragment across chats, files, branches, devices, and undocumented assumptions. The system must reduce repeated work, prevent avoidable errors, preserve decisions, and make the next action obvious.

## 2. The five mandatory records

Every project must have these records, even if they are initially small:

1. **Project Ledger** — current goal, scope, constraints, status, blockers, exact checkpoint, and next action. This is the single source of truth for current state.
2. **Decision Register** — dated decisions, rationale, evidence, affected artifacts, and superseded decisions. Never erase history.
3. **Asset / Data Registry** — stable IDs, exact location, version, provenance, permissions, status, approval evidence, and intended use.
4. **Issue & Learning Register** — reproducible bugs, severity, impact, root cause, fix, regression test, and preventive rule.
5. **Session Log** — starting checkpoint, work performed, evidence, tests, cost, decisions, changed files, blockers, and next action.

The records may live in one repository, but their roles must remain distinct and linked.

## 3. Status vocabulary

Use controlled labels rather than ambiguous words such as “done” or “probably fixed”.

- **APPROVED** — exact artifact/version explicitly accepted by the authorized owner.
- **REJECTED** — explicitly declined; retain the record to prevent reuse.
- **EXPERIMENTAL** — under test; not suitable for production reliance.
- **UNVERIFIED** — evidence is insufficient.
- **BLOCKED** — cannot proceed until a named dependency is resolved.
- **IN_PROGRESS** — active work with a named owner and next action.
- **VERIFIED** — a defined test passed and evidence is attached.
- **SUPERSEDED** — replaced by a newer decision/version; preserve the history.

A status must always refer to a specific item/version, not a vague project-wide impression.

## 4. Project lifecycle and gates

### Gate 0 — Intake
- Define the user/customer problem and measurable outcome.
- Identify owner, users, budget ceiling, deadline, platform, legal/privacy constraints, and non-goals.
- Record assumptions separately from facts.
- Do not start implementation while the goal or hard constraints are unclear.

### Gate 1 — Design
- Write a short solution outline and architecture.
- Identify dependencies, risks, data flows, secrets, and rollback strategy.
- Define acceptance criteria before implementation.
- Identify what evidence would prove the solution works.

### Gate 2 — Build
- Work on a focused branch, not directly on the protected/default branch.
- Keep changes small and reviewable.
- One logical change per pull request where practical.
- Do not combine unrelated refactors with bug fixes.
- Never put credentials, private tokens, or personal data in public source or logs.

### Gate 3 — Verify
- Test the actual user-visible outcome, not just the API response or a green workflow.
- Record environment, version, steps, expected result, actual result, and evidence.
- Distinguish unit, integration, end-to-end, visual, security, and usability checks.
- A failed or timed-out test is not a pass.
- A prototype is not production-ready merely because it renders.

### Gate 4 — Release
- Review diff and acceptance criteria.
- Confirm tests and known limitations.
- Merge through a reviewable pull request.
- Verify the default branch and deployed result after merge.
- Record release/version, deployment evidence, and rollback path.

### Gate 5 — Learn
- For each significant failure, record root cause, not only symptom.
- Add a regression test or explicit manual verification step.
- Add a preventive rule only when evidence supports it.
- Review whether the rule prevents recurrence without adding excessive process.

## 5. Bug and learning record

Each issue should contain:

- ID and date
- Component / version / environment
- Severity and user impact
- Reproduction steps
- Expected vs actual behavior
- Evidence (logs, screenshot, test output, commit)
- Root cause (or **UNKNOWN** until established)
- Fix and changed files
- Regression test and result
- Prevention rule
- Status and exact next action

Do not label a symptom as root cause. If the cause is unknown, say so and plan the next diagnostic test.

## 6. Evidence and approval policy

- Every important claim must point to a file, commit, test output, asset ID, or explicit approval statement.
- Separate observed fact, inference, assumption, and proposal.
- Never promote a draft or generated asset to approved status based on assistant preference.
- Approval must name the exact version or asset ID.
- Preserve rejected and superseded versions with reasons.
- A successful HTTP response proves connectivity only; it does not prove the product workflow works end to end.

## 7. Data durability and recovery

- Identify the authoritative store for each data type.
- Browser-local or device-local data must be labelled as such.
- Before migrations, create and verify export/restore backups.
- Use stable IDs, version history, timestamps, and conflict handling.
- Never claim synchronization until a second device/browser has successfully retrieved and updated the same record.
- Define recovery steps for accidental deletion, failed deploy, and corrupted local state.

## 8. Cost and external dependency control

- Set a project budget ceiling and default cost policy at intake.
- Record per-run credits, quotas, queue limits, rate limits, and hidden usage constraints.
- No paid subscription, upgrade, or credit purchase without explicit authorization.
- Prefer a small feasibility test before committing to a large workflow.
- Record vendor lock-in, availability, licensing, and data handling risks.

## 9. Session operating protocol

At the beginning:
1. Read the Project Ledger and latest session record.
2. Confirm current branch and default-branch state.
3. Identify the single next action.
4. List completed work that must not be repeated.
5. Check constraints and blockers.

At the end:
1. Record what actually changed and link evidence.
2. Update decision, asset, issue, and session records as needed.
3. Record test results honestly, including failures and timeouts.
4. Set one precise next action.
5. Verify the repository contains the updated checkpoint.

No session ends with “continue later” as the only checkpoint.

## 10. Project starter checklist

- [ ] Create repository and protect the default branch
- [ ] Create Project Ledger
- [ ] Create Decision Register
- [ ] Create Asset / Data Registry
- [ ] Create Issue & Learning Register
- [ ] Create Session Template
- [ ] Define goal, non-goals, constraints, budget, and acceptance criteria
- [ ] Define evidence and approval rules
- [ ] Define test strategy and release/rollback process
- [ ] Identify local-only data and backup requirements
- [ ] Record the first checkpoint before implementation

## 11. How this playbook becomes a standard

This is a pilot, not a finished methodology. For each LUNA milestone:
1. Apply the playbook.
2. Record friction, missed risks, repeated errors, and unnecessary overhead.
3. Propose a change with concrete evidence.
4. Test the change in a later LUNA session.
5. Promote it to **STANDARD** only after repeatable success.
6. Reuse the standard in the next project, then revise based on cross-project evidence.

Success metrics:
- Fewer repeated investigations and duplicate changes
- No lost approved decisions or canonical assets
- Every session resumes from the correct checkpoint
- Bugs have reproducible evidence and regression checks
- Actual end-to-end outcomes are verified before release
- Cost and secret-handling constraints are respected
- New projects can be initialized consistently with less setup effort

## 12. Current pilot boundary

LUNA is the first pilot. The current system has a repository-backed ledger, decision register, asset registry, and session template. It does **not** yet have a fully implemented issue/learning register, automated session enforcement, centralized Studio database, or validated multi-project reuse. These are open gaps, not completed features.
