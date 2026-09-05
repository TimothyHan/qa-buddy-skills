# Scoring sheet — exploratory · extra-acme-exploratory-2026-09-05

Source: external · case v3-planted · from /private/tmp/claude-501/-Users-timothyhan-QABuddy/417cd115-97b2-4acf-9d7d-7c47ac82715f/scratchpad/acme-exploratory-2026-09-05.md

Read the context below (what the skill was given, and the ground truth only the judge and you see), then the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.



## Context — what the skill was given (case input)

```
--- .qabuddy.json ---
{ "version": "1.0", "contextSource": "spec", "teamMode": "solo", "learningsPath": "features-kb/LEARNINGS.md", "runsDir": ".qa-reports/runs", "appUrl": "http://localhost:4173" }


--- features-kb/features/projects/feature.md ---
# Feature: Projects management (projects)

**Key:** `projects` (contextSource: spec)

## Capabilities

### C1. Authentication
- AC1: sign in with valid credentials → Projects page with the list; invalid → error on /login.

### C2. Project list management
- AC2: create a project with a unique name → success toast, project in list.
- AC3: duplicate name → error toast "Name already exists", list unchanged.
- AC4: delete from the row after confirming in a dialog → project gone from list.

### C3. Finding projects
- AC5: search box filters rows by name fragment.
- AC6: zero projects → "No projects yet", no table.

## Out of scope
- Status filter dropdown — no AC.


--- features-kb/features/projects/test-cases/projects.md ---
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects
AC1–AC4 covered. AC5 and AC6 have no test cases yet.

### TC-01: Sign in with valid credentials — AC1, P0, happy-path
Open /login → enter qa@acme.test / demo123 → submit. Expected: Projects page, list visible.

### TC-02: Create a project — AC2, P0, happy-path
New project → unique name → Create. Expected: success toast; project in the list.

### TC-03: Duplicate project name rejected — AC3, P1, negative
New project → existing name → Create. Expected: error toast "Name already exists"; list unchanged.

### TC-04: Delete a project — AC4, P0, happy-path
Delete on the target row → confirm. Expected: project no longer in the list.

**Status:** DONE_WITH_CONCERNS
**Summary:** 4 cases; AC5/AC6 unmapped
**Next steps:** /qa-test-cases projects --update


--- features-kb/index.json ---
{ "projects": { "title": "Projects management", "status": "active", "stories": ["projects"], "testCaseCount": 4, "acCovered": 4, "notes": "AC5/AC6 have no test cases yet" } }

```

## Context — ground truth (judge notes; the skill never saw this)

# Judge notes — v3-planted (fixture app v3)

One planted defect: `DELETE /api/projects/:id` returns 204 but does not remove the project. After confirming Delete, the row stays in the list (also after reload). This violates AC4 and is Blocker or Critical (core CRUD broken, no workaround).

A consequence the same defect produces, and which is a valid second finding rather than an invented one: creating a project with the name of a "deleted" project is rejected with 409 "Name already exists", because the project still exists server-side (AC2/AC3 interplay). Reporting both is correct; reporting only the delete is acceptable; reporting the 409 without the delete is a partial find.

Everything else works as in v1. The non-bug behaviours from v1-clean (350 ms re-render, toast auto-dismiss, shared Delete name, unlabeled search, bare empty state, inert status filter) still apply.
Existing KB test cases: TC-01 sign in, TC-02 create, TC-03 duplicate rejected, TC-04 delete.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. Filing any of these as a question or missing requirement is correct; filing one as a defect is a real observation in the wrong category (see the `finding-correctness` anchors).

## Artifact — what you score (the same files the judge grades)

### .qa-reports/exploratory-extra.md

````
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** `projects` | **Date:** 2026-09-05

**Duration:** ~5 min / 30 min planned (--quick, headless) | **URL:** http://localhost:4173
**Trigger:** PR #2 explore phase. Diff under review: `server.js` DELETE handler changed from
hard `splice` to soft delete (`projects[idx].deletedAt = ...`), dropping the `DELETE_IS_BROKEN`
variant gate. KB (`index.json`, `test-cases/projects.md` TC-04) had already flagged a regression
watch on this diff: neither `GET /api/projects` nor the client `render()` filter on `deletedAt`.
This session's mission was to confirm that risk live in the browser and sanity-check the
untouched ACs around it.

## Session Outcome
| Metric | Count |
|--------|-------|
| New scenarios | 0 |
| Bugs | 1 |
| UX concerns | 0 |
| Missing requirements | 0 |
| Questions | 1 |

## Focus Area Results
| Focus Area | ACs | Time | Findings | Result |
|-----------|-----|------|----------|--------|
| Delete / soft-delete regression | AC4 | ~2 min | F1 | finding |
| Create & duplicate-name sanity | AC2, AC3 | ~1 min | none | clean |
| Search filtering (incl. interaction with F1) | AC5 | ~1 min | F1 (symptom) | finding |
| Empty state | AC6 | ~1 min | F2 | unexplored (blocked by F1) |
| Input variation on project name (ad-hoc, no AC) | — | <1 min | none | clean |

## Detailed Findings

### Finding 1: Deleting a project never removes it — soft delete has no filter anywhere in the read path
**Category:** Bug | **Severity:** Blocker | **Priority:** High
**Focus area:** Delete / soft-delete regression | **Found via:** Cross-feature / data-integrity heuristic (REF-playbook/exploratory-heuristics#heuristic-categories), diff-driven per KB regression watch

**What I did:**
1. Signed in, confirmed seed list (`Website Redesign`, `Mobile App`).
2. Clicked Delete on `Website Redesign`, confirmed in the dialog.
3. Observed network: `DELETE /api/projects/1` → 204, followed by `GET /api/projects` → 200.
4. Evaluated `fetch('/api/projects')` directly in-page to inspect the raw payload.
5. Re-searched for "Redesign" via the search box after the delete.

**Expected:** Per AC4, after confirming delete the project no longer appears in the list.
**Actual:** The row for `Website Redesign` remains in the table after the delete completes and
after a full reload of the list. The raw API response confirms why:
```json
{ "id": 1, "name": "Website Redesign", "status": "active", "createdAt": "2026-07-01",
  "deletedAt": "2026-09-05T07:44:18.969Z" }
```
`deletedAt` is set (the write succeeded) but `GET /api/projects` returns the record anyway, and
the client's `render()` has no filter either — so the "deleted" project is not just visible on
next load, it's fully live: searchable (typing "Redesign" still matches it), and its Delete
button still works (re-clicking it only re-stamps `deletedAt`, 204 again, still visible). From
the user's perspective, Delete is completely non-functional — there is no way to remove a
project from the list. This is a core CRUD operation (AC4) failing with no workaround, so it
rates Blocker per REF-playbook/risk-and-priority#severity-scale ("cannot CRUD core features");
it reproduces 100% of the time for the only account in the system, so Priority is High per
REF-playbook/risk-and-priority#priority-scale ("Blocker ... with immediate user impact").
**Evidence:** `.qa-reports/screenshots/projects-initial-list.png` (before),
`.qa-reports/screenshots/projects-delete-regression.png` (after confirm — row still present).
**Console/Network:** No console errors. Network: `DELETE /api/projects/1` → 204, subsequent
`GET /api/projects` → 200 with the deleted record still in the array (deletedAt set).
**Action:** File bug / block merge. This matches the regression watch already recorded in
`features-kb/features/projects/test-cases/projects.md` TC-04 — the Playwright sketch there
(asserting `row` count 0 after delete) is expected to catch this red once `/qa-e2e-write` runs
it. Fix needs both a `GET /api/projects` filter (`deletedAt == null`) and a client-side check if
the client is meant to defend in depth.

### Finding 2: Soft-delete adds an audit field but no way to see or restore deleted projects
**Category:** Question | **Severity:** Trivial | **Priority:** Low
**Focus area:** Empty state (AC6, blocked) | **Found via:** Cross-feature heuristic

**What I did:** Tried to reach the true zero-projects state for AC6 by deleting all seeded
projects through the UI (needed to sanity-check the empty-state message independent of F1).
**Expected:** N/A — this is a design question surfaced while investigating F1, not a repro.
**Actual:** Because F1 makes Delete a no-op from the user's perspective, AC6 (true empty state)
is unreachable via the UI in this build — I could not verify AC6 itself this session. Separately,
now that `deletedAt` is tracked server-side, there's no admin/audit view exposing it and no
restore path — once F1 is fixed and delete actually removes rows from the list, the soft-delete
data becomes write-only. Worth asking the team whether that's intended before considering it done.
**Evidence:** Described observation (see F1 evidence — same session, same data).
**Console/Network:** N/A.
**Action:** Discuss with the team; not a blocker for this PR. AC6 itself should be re-verified
by `/qa-qa` once F1 is fixed and a real zero-projects state is reachable (or seed via API
precondition per TC-07, which does not depend on the UI delete flow).

## Unexplored
- **AC6 empty state** (true zero-projects via UI) — blocked by F1, not exercised this session.
  TC-07's API-seeded precondition sidesteps this and should still be verified independently by
  `/qa-e2e-write` / `/qa-qa`.
- Concurrency (two tabs deleting the same project), accessibility (keyboard-only flow), and
  environment variation (mobile viewport) were out of scope for this quick/headless pass.

## Recommendation
- **Blocked** — F1 is a Blocker-severity regression on AC4 introduced by this PR's diff. Do not
  proceed to UAT for the delete flow until fixed. Other explored ACs (AC2, AC3, AC5 sanity) are
  clean.

## Next Actions
1. File/escalate F1 as a bug against this PR (soft-delete filter missing on `GET /api/projects`).
2. Run `/qa-e2e-write` for TC-04 once F1 is fixed — the sketch already documents the expected
   red→green signal.
3. Re-run `/qa-qa` on AC6 once F1 is fixed, using TC-07's API-seeded precondition.
4. Raise F2 (restore/audit path) with the team as a design question — no action required this PR.

## Auto-decisions
- Charter approved as drafted (headless, no SDT review) — diff-driven focus order: delete
  regression first, then untouched ACs (create/duplicate, search), then empty state.
- Skipped the out-of-scope status filter dropdown per `feature.md` ("Out of scope").
- Classified F1 as Blocker/High from the severity/priority scales without SDT confirmation
  (headless default: take the stated recommendation).
- Did not attempt to reach a true zero-projects state via repeated UI deletes (would only
  re-stamp `deletedAt` on the same rows, not produce new evidence) — recorded as unexplored
  instead of spending remaining time-box on a known-negative repro.

**Status:** DONE_WITH_CONCERNS
**Summary:** Confirmed the KB's predicted AC4 regression live — delete is fully non-functional (Blocker); AC2/AC3/AC5 sanity-checked clean; AC6 unverifiable via UI until F1 is fixed.
**Next steps:** File F1 as a bug and block merge; re-verify AC6 once fixed.
````

## Criteria

## finding-correctness (weight 3, floor 2)

Findings match the app's known state (judge notes say which defects exist): every planted defect the charter's focus areas touch is found, and no finding claims a defect the app does not have.

- **0** — A finding claims a defect the app does not have (the judge notes list what exists), or a planted defect in a focus area that was explored is reported as working.
- **1** — No invented defects, but either a planted defect in an explored focus area was missed and the area is not marked unexplored, or a real observation the spec does not decide (judge notes list these) is filed as a defect instead of a question or missing requirement.
- **2** — Planted defects found and nothing invented; a known non-bug behaviour (late re-render, auto-dismiss toast) is filed as a bug rather than a product observation.
- **3** — Planted defects found with the right AC named, nothing invented, known non-bug behaviours recorded as observations or UX notes.

## classification (weight 2, floor 1)

Every finding carries a severity and a priority from the playbook scales, and the values are consistent with the finding's impact.

- **0** — At least one finding has no severity or no priority.
- **1** — All findings are classified but at least one value is not from the scale, or a Blocker/Critical has no evidence.
- **2** — All findings classified from the scale; one classification is inconsistent with the described impact.
- **3** — All findings classified from the scale and consistent with impact; a deleted row that stays listed is Blocker or Critical, a cosmetic note is Minor or Trivial.

## evidence (weight 2, floor 1)

Every finding has concrete steps, a distinct expected and actual, evidence (screenshot path or described observation), and an action.

- **0** — A finding lacks steps, or expected and actual are the same sentence, or there is no evidence field.
- **1** — All fields present but at least one finding's steps cannot be followed (no starting page, no data named).
- **2** — All findings reproducible from their steps; one evidence entry is generic ("see screenshot") without a path or observation.
- **3** — Every finding reproducible, expected/actual distinct, evidence specific, action names the next skill or owner.

## charter-quality (weight 1, floor 0)

The charter names a mission, lists what is already tested, and ranks focus areas by risk with a heuristic and a time estimate each — direction, not scripted steps.

- **0** — No charter, or focus areas are scripted step lists rather than areas.
- **1** — Charter present but focus areas have no heuristic or no risk rationale.
- **2** — Focus areas ranked with heuristics and rationale; the "Already Tested" section ignores the KB test cases that exist.
- **3** — Ranked focus areas with heuristic, rationale and time; "Already Tested" reflects the KB and repo tests; out-of-scope named.

## no-duplicate-scenarios (weight 1, floor 1)

No finding categorized as a new test scenario duplicates a test case already in the KB or a test in the repo (judge notes list them).

- **0** — A "new test scenario" restates an existing KB test case.
- **1** — No duplicates, but a new scenario overlaps an existing case without saying how it differs.
- **2** — New scenarios are distinct; one could have referenced the existing case it extends.
- **3** — New scenarios are distinct and each says which existing case it extends or why none applies.

## unexplored-noted (weight 1, floor 0)

Every charter focus area either has findings or an explicit unexplored note, and the report lists what the next session should cover.

- **0** — A focus area has neither findings nor an unexplored note.
- **1** — All areas accounted for, but the next-session list is missing.
- **2** — All areas accounted for with a next-session list; one item is vague ("more testing").
- **3** — All areas accounted for; next-session items are specific enough to become a charter.
