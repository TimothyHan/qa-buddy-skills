# Scoring sheet — exploratory · control-no-duplicate-scenarios

Source: control · case v1-clean · from tests/controls/no-duplicate-scenarios.md

Read the context below (what the skill was given, and the ground truth only the judge and you see), then the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.

This entry is a **control**: an artifact with one criterion deliberately broken. Score every criterion on what you see; the other criteria are incidental and may be fine or not.

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

# Judge notes — v1-clean (fixture app v1)

There is no planted defect. Every AC1–AC6 behaviour works.

Known product behaviours that are NOT bugs and should appear, if at all, as observations or UX concerns: the list re-renders about 350 ms after a create or delete response; toasts auto-dismiss after 1.5 s; every row's Delete button shares its accessible name with the hidden confirm-dialog Delete; the search input has no label or placeholder; the empty state is a bare paragraph "No projects yet"; the status filter dropdown does nothing and is out of scope.

Legitimate findings on v1 are UX concerns (unlabeled search, no loading indicator during the 120 ms list fetch), missing requirements (no way to rename a project, no cancel on the confirm dialog beyond "Keep"), new test scenarios for AC5 and AC6 (they have no test cases), and questions.

A finding that says a project was not deleted, a duplicate was accepted, or search did not filter is invented — score `finding-correctness` 0.
Existing KB test cases: TC-01 sign in, TC-02 create, TC-03 duplicate rejected, TC-04 delete. A "new test scenario" restating any of these is a duplicate.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. Filing any of these as a question or missing requirement is correct; filing one as a defect is a real observation in the wrong category (see the `finding-correctness` anchors).

## Artifact — what you score (the same files the judge grades)

### .qa-reports/exploratory-control.md

````
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** 40 / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: Duplicate project name should be rejected
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Create | **Found via:** Input variation
**What I did:** Created "Website Redesign" again via New project → Create.
**Expected:** error toast "Name already exists", list unchanged. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f1-dup.png | **Console/Network:** POST /api/projects 409
**Action:** add test case "duplicate name rejected"

### Finding 2: Empty state has no test case
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Empty state | **Found via:** User personas
**What I did:** Deleted both seed projects and reloaded /projects.
**Expected:** "No projects yet" and no table. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f2-empty.png | **Console/Network:** clean
**Action:** add test case for AC6

**Status:** DONE
**Summary:** 2 new scenarios
**Next steps:** /qa-test-cases projects --update
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
