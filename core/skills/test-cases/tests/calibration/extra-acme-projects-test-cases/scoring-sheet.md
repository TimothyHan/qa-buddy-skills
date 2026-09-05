# Scoring sheet — test-cases · extra-acme-projects-test-cases

Source: external · case projects-happy · from /private/tmp/claude-501/-Users-timothyhan-QABuddy/417cd115-97b2-4acf-9d7d-7c47ac82715f/scratchpad/acme-projects-test-cases.md

Read the context below (what the skill was given, and the ground truth only the judge and you see), then the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.



## Context — what the skill was given (case input)

```
--- .qabuddy.json ---
{ "version": "1.0", "contextSource": "spec", "teamMode": "solo", "learningsPath": "features-kb/LEARNINGS.md", "runsDir": ".qa-reports/runs", "appUrl": "http://localhost:4173" }


--- docs/specs/projects.md ---
# Spec — Projects management

Acme Projects lets a signed-in user keep a list of projects.

Base URL: http://localhost:4173 · Test account: qa@acme.test / demo123

## Acceptance criteria

| AC | Statement |
|---|---|
| AC1 | A user can sign in with valid credentials and lands on the Projects page with the list visible. Invalid credentials show an error and stay on /login. |
| AC2 | A signed-in user can create a project with a unique name; a success toast appears and the project shows in the list. |
| AC3 | Creating a project whose name already exists is rejected with an error toast ("Name already exists"); the list is unchanged. |
| AC4 | A user can delete a project from its row after confirming in a dialog; the project no longer appears in the list. |
| AC5 | Typing into the search box filters the list so only rows whose name contains the fragment remain visible. |
| AC6 | With zero projects, the page shows a "No projects yet" message and renders no table. |

## Out of scope

- The status filter dropdown is a visual affordance only in this release. No acceptance criterion covers it.


--- features-kb/features/projects/feature.md ---
# Feature: Projects management (projects)

**Key:** `projects` (contextSource: spec) · **Spec:** docs/specs/projects.md

## Capabilities

### C1. Authentication
- AC1: sign in with valid credentials → Projects page with the list; invalid → error on /login.

### C2. Project list management
- AC2: create a project with a unique name → success toast, project in list.
- AC3: duplicate name → error toast, list unchanged.
- AC4: delete from the row after confirming → project gone from list.

### C3. Finding projects
- AC5: search box filters rows by name fragment.
- AC6: zero projects → "No projects yet", no table.

## Out of scope
- Status filter dropdown — no AC.


--- features-kb/index.json ---
{ "projects": { "title": "Projects management", "status": "active", "stories": ["projects"], "testCaseCount": 0, "acCovered": 0 } }


--- playwright/tests/smoke.spec.ts ---
import { test, expect } from '@playwright/test';

test('smoke: signed-in user sees the projects page', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.getByTestId('new-project-button')).toBeVisible();
});

```

## Context — ground truth (judge notes; the skill never saw this)

# Judge notes — projects-happy (fixture app v1)

Ground truth for `observed-or-unverified` and `traceability`.

Real control labels on /projects: button "New project"; modal has a name input (placeholder "Project name") and buttons "Create" and "Cancel"; each row has a "Delete" button; the confirm dialog has "Delete" and "Keep"; the search box is an unlabeled input at the top of the list; the empty state text is exactly "No projects yet".
Seed data: two projects, "Website Redesign" (active) and "Mobile App" (paused). Seed data is shared across runs and reset by the harness only.
Requests: GET /api/projects loads the list (~120 ms); POST /api/projects returns 201, 400 on empty name, 409 on duplicate; DELETE /api/projects/:id returns 204.
Known product behaviours that are NOT bugs: the list re-renders ~350 ms after a create/delete response; toasts auto-dismiss after 1.5 s.
Out of scope: the status filter dropdown — a test case for it is a traceability error (no AC).
The single smoke test covers no AC on its own (it asserts only that the New project button is visible); crediting it against AC1 is a dedup error.

## Artifact — what you score (the same files the judge grades)

### features-kb/test-cases/extra.md

````
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects | **Created:** 2026-09-04
Seeded from the spec for AC1–AC4. AC5 and AC6 have no test cases yet.

---

### TC-01: Sign in with valid credentials

**Requirement:** AC1 from projects
**Priority:** P0
**Type:** happy-path

**Preconditions:**
- Signed out

**Steps:**
1. Open /login
2. Enter qa@acme.test / demo123
3. Submit

**Expected Result:**
- Lands on the Projects page; the project list is visible

### TC-02: Create a project

**Requirement:** AC2 from projects
**Priority:** P0
**Type:** happy-path

**Preconditions:**
- Signed in; the project name is unused

**Steps:**
1. Projects page → New project
2. Enter a unique name
3. Create

**Expected Result:**
- Success toast shown; the new project appears in the list

### TC-03: Duplicate project name rejected

**Requirement:** AC3 from projects
**Priority:** P1
**Type:** negative

**Preconditions:**
- Signed in; a project with the target name already exists

**Steps:**
1. New project
2. Enter the existing name
3. Create

**Expected Result:**
- Error toast "Name already exists"; the list is unchanged

### TC-04: Delete a project

**Requirement:** AC4 from projects
**Priority:** P0
**Type:** happy-path

**Preconditions:**
- Signed in; the target project exists

**Steps:**
1. Click Delete on the target row
2. Confirm in the dialog

**Expected Result:**
- The project is no longer in the list

---

## Unit Test Checklist

### server.js — POST /api/projects
- [ ] rejects an empty name with 400
- [ ] rejects a duplicate name with 409
````

## Criteria

## traceability (weight 3, floor 2)

Every AC has at least one test case, every test case names its AC, and any AC without a case is listed as a gap (unmapped_requirements or test_gaps).

- **0** — At least one AC has no test case and is not listed as a gap anywhere.
- **1** — Every AC is either covered or listed as a gap, but at least one test case names no AC or names an AC that does not exist.
- **2** — Complete and every case names its AC; one inconsistency between the cases document and the mapping (e.g. a TC in the mapping that is not in the document).
- **3** — Complete, every case names its AC, the mapping and the document agree exactly, and gaps are listed by AC.

## coverage-honesty (weight 2, floor 2)

coverage is "full" only where a happy path, a negative case and (where applicable) a boundary case exist for that AC; otherwise it is "partial" with the gap named, or "none".

- **0** — "full" is claimed for an AC that has only a happy-path case, or "none" is used where cases exist.
- **1** — Coverage values are mostly right but at least one "partial" has no gap named in test_gaps.
- **2** — Every coverage value is justified by the cases; one AC could be argued either way and the choice is not explained.
- **3** — Every coverage value is justified by the listed cases and every "partial" names its gap.

## dedup-by-assertion (weight 2, floor 1)

An existing automated test is credited as covering an AC only with the file and the assertion that would fail if that AC broke; a test whose assertion cannot fail for the AC is not credited (judge notes name any such test).

- **0** — A test the judge notes identify as vacuous is credited as coverage.
- **1** — No vacuous test is credited, but a credit names only a file or a test title, not the failing assertion.
- **2** — Every credit names file and assertion; one credited assertion is arguably weaker than the AC requires.
- **3** — Every credit names file and the assertion that would fail, and every vacuous test in the judge notes is listed as a gap instead — or no existing test covers any AC and none is credited.

## prioritization (weight 1, floor 0)

P0 cases are at most half of all cases and at least one P0 covers the core happy path; case count is proportional to the ACs (no padding).

- **0** — More than half the cases are P0, or the core happy path has no P0.
- **1** — Distribution is within bounds but several cases are padding (restate another case with a trivial variation).
- **2** — Distribution is within bounds and cases are distinct; one priority is debatable.
- **3** — Distribution is within bounds, cases are distinct, and priorities follow the P0/P1/P2 rules in Phase 2 exactly.

## observed-or-unverified (weight 2, floor 1)

Every precondition or step that names a control label, a seeded record, a displayed value or a request is backed by an Observed: line in the scratchpad or carries (unverified).

- **0** — A step names a label or record that does not exist in the app (judge notes list the real ones) and carries no (unverified).
- **1** — Named details are real but none is backed by an Observed: line and none is marked (unverified).
- **2** — Named details are backed by Observed: lines or marked (unverified), with at most one omission.
- **3** — Every named detail is either observed or marked (unverified), and unreachable-app runs mark every dependent step.
