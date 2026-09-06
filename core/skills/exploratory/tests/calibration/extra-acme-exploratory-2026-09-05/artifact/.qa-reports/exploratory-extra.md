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
