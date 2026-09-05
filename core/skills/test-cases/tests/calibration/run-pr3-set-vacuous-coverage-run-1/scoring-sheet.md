# Scoring sheet — test-cases · run-pr3-set-vacuous-coverage-run-1

Source: eval-run · case vacuous-coverage · from .qa-reports/evals/test-cases/pr3-set/vacuous-coverage/run-1/workspace

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


--- features-kb/features/projects/test-cases/projects.md ---
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects | **Created:** 2026-09-04
Seeded for AC1–AC2 only. AC3–AC6 have no test cases yet.

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

**Status:** DONE_WITH_CONCERNS
**Summary:** 2 test cases for AC1–AC2; AC3–AC6 unmapped
**Next steps:** run /qa-test-cases projects --update


--- features-kb/index.json ---
{ "projects": { "title": "Projects management", "status": "active", "stories": ["projects"], "testCaseCount": 0, "acCovered": 0 } }


--- playwright/tests/projects.spec.ts ---
import { test, expect } from '@playwright/test';
import { projectsPage } from '../pom/projects.page';
import { createProject } from '../api/projects';

test.describe('Projects', () => {
  test('TC-03: duplicate project name rejected', async ({ page, request, disposalContext }) => {
    const name = `dup-${Date.now()}-w${test.info().parallelIndex}`;
    await createProject(request, name, disposalContext);
    await projectsPage.goto(page);
    await projectsPage.openNewProject(page);
    await projectsPage.locators.nameInput(page).fill(name);
    await projectsPage.locators.createSubmit(page).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('TC-04: delete a project', async ({ page, request, disposalContext }) => {
    const name = `del-${Date.now()}-w${test.info().parallelIndex}`;
    await createProject(request, name, disposalContext);
    await projectsPage.goto(page);
    await projectsPage.deleteByName(page, name);
    await expect(projectsPage.locators.rowByName(page, name)).toHaveCount(0);
  });
});

```

## Context — ground truth (judge notes; the skill never saw this)

# Judge notes — vacuous-coverage (fixture app v1)

`playwright/tests/projects.spec.ts` contains two tests:

- **TC-03 (AC3) is vacuous.** Its only assertion is `expect(page).toHaveURL(/\/projects/)`, which holds whether or not the duplicate was rejected — the page never leaves /projects. It must not be credited as covering AC3; AC3 is a gap (or gets a new case that asserts the error toast and the unchanged list).
- **TC-04 (AC4) is valid.** `expect(rowByName(name)).toHaveCount(0)` fails if the row survives the delete. Crediting AC4 to it is correct only if the credit names the file and that assertion.

The existing KB document covers AC1 and AC2 only; this is an `--update` run, so TC-01 and TC-02 should be kept, not duplicated.
Real labels and seed data are as in projects-happy: "New project", "Create", "Cancel", "Delete", "Keep", "No projects yet", seeds "Website Redesign" and "Mobile App".

## Artifact — what you score (the same files the judge grades)

### features-kb/features/projects/test-cases/projects.md

````
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects | **Created:** 2026-09-04 | **Updated:** 2026-09-05
Full pass over AC1–AC6. AC1 gains a negative case; AC3/AC4 replace the existing
`playwright/tests/projects.spec.ts` cases, which don't count as coverage (see
**Automation note** at the end). AC5/AC6 are new.

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

### TC-01B: Sign in with invalid credentials is rejected

**Requirement:** AC1 from projects
**Priority:** P1
**Type:** negative

**Preconditions:**
- Signed out

**Steps:**
1. Open /login
2. Enter a wrong password for qa@acme.test (or an unknown email)
3. Submit

**Expected Result:**
- An error is shown; the page stays on /login (no navigation to the Projects page)

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

### TC-03: Duplicate project name is rejected

**Requirement:** AC3 from projects
**Priority:** P1
**Type:** negative

**Preconditions:**
- Signed in; at least one existing project with a known name

**Steps:**
1. Projects page → New project
2. Enter the name of the existing project exactly
3. Create

**Expected Result:**
- Error toast reading "Name already exists" is shown
- The project list is unchanged (no new row, existing row count unchanged)

### TC-04: Delete a project after confirming

**Requirement:** AC4 from projects
**Priority:** P0
**Type:** happy-path

**Preconditions:**
- Signed in; a project exists that is safe to delete (created by the test, not shared fixture data)

**Steps:**
1. On the project's row, trigger delete
2. In the confirmation dialog, confirm

**Expected Result:**
- The project no longer appears in the list

### TC-04B: Canceling the delete dialog keeps the project

**Requirement:** AC4 from projects
**Priority:** P1
**Type:** negative

**Preconditions:**
- Signed in; a project exists that is safe to delete

**Steps:**
1. On the project's row, trigger delete
2. In the confirmation dialog, cancel/dismiss instead of confirming

**Expected Result:**
- The project still appears in the list

### TC-05: Search filters the list by name fragment

**Requirement:** AC5 from projects
**Priority:** P1
**Type:** happy-path

**Preconditions:**
- Signed in; at least two projects exist with distinguishable names (e.g. one matching a fragment, one not)

**Steps:**
1. On the Projects page, type a fragment that matches only one project's name into the search box

**Expected Result:**
- Only rows whose name contains the fragment remain visible; non-matching rows are hidden

### TC-05B: Clearing the search restores the full list

**Requirement:** AC5 from projects
**Priority:** P2
**Type:** boundary

**Preconditions:**
- Same as TC-05, with the search box already filtered to a subset

**Steps:**
1. Clear the search box

**Expected Result:**
- All projects reappear in the list

### TC-06: Zero projects shows the empty state

**Requirement:** AC6 from projects
**Priority:** P1
**Type:** edge-case

**Preconditions:**
- Signed in; the account has zero projects (isolated/dedicated test account or fixture reset via API — do not delete another test's shared data)

**Steps:**
1. Open the Projects page

**Expected Result:**
- "No projects yet" message is shown
- No table is rendered

---

## Unit Test Checklist (developer-facing)

### Project creation / naming
- [ ] Uniqueness check: rejects a name matching an existing project (case-sensitivity behavior should be confirmed with the team — spec doesn't state it)
- [ ] Uniqueness check: accepts a name that doesn't match any existing project
- [ ] Duplicate rejection returns/produces the "Name already exists" error rather than a generic failure

### Deletion
- [ ] Delete removes the project record only after explicit confirmation
- [ ] Canceling confirmation is a no-op (record untouched)

### Search / filtering
- [ ] Filter matches a name containing the fragment (substring, not just prefix)
- [ ] Filter is case-insensitive vs. case-sensitive — confirm with the team; add a test to pin the chosen behavior
- [ ] Empty fragment (cleared search) returns the unfiltered list
- [ ] Zero matches renders an empty list without erroring

### Empty state
- [ ] Zero-projects state renders the "No projects yet" message and suppresses the table, distinct from a zero-*results* filtered state

- [ ] Detection power: run the project's mutation tool (Stryker/PIT/mutmut) against changed modules once the above exist — none configured in this repo yet, flagging as a gap rather than assuming coverage

---

## Automation note (for SDT)

`playwright/tests/projects.spec.ts` currently contains `TC-03` (duplicate name) and
`TC-04` (delete project), but:
- `TC-03`'s only assertion is `expect(page).toHaveURL(/\/projects/)`. "New project" is
  an in-page action per the spec (no route change), so this assertion is true whether
  the duplicate is correctly rejected or incorrectly accepted — it's a vacuous
  assertion and doesn't verify AC3.
- Both tests import `../pom/projects.page` and `../api/projects`, but neither file
  exists in the repo, and there's no `playwright.config` or `package.json` either —
  the spec file can't currently compile or run, so `TC-04`'s otherwise-valid
  `toHaveCount(0)` assertion isn't running either.

Renumbered `TC-03`/`TC-04` above replace these in the test-case doc; the automation
itself (POM, API client, and a real "Name already exists" + unchanged-list assertion
for TC-03) is `/qa-e2e-setup` + `/qa-e2e-pom` + `/qa-e2e-write` territory, not this
skill's.

**Status:** DONE_WITH_CONCERNS
**Summary:** 9 test cases now map AC1–AC6 (was 2 mapping AC1–AC2); AC3/AC4's existing automation doesn't count as coverage (vacuous assertion + missing modules/config) and needs to be rebuilt, not just re-pointed.
**Next steps:** run `/qa-e2e-setup` to scaffold `playwright.config`/POM/API-client (currently missing entirely), then `/qa-e2e-pom` + `/qa-e2e-write` to implement all 9 cases above, replacing the two broken tests in `projects.spec.ts`. (Auto-decision: proceeded without pausing for SDT review per headless run — see review options below.)
````

### features-kb/features/projects/test-cases/projects-mapping.json

````
{
  "ticket": "projects",
  "epic": "projects",
  "mappings": [
    {
      "requirement": "AC1: sign in with valid credentials → Projects page with the list; invalid → error on /login.",
      "e2e_tests": ["TC-01", "TC-01B"],
      "unit_tests": [],
      "coverage": "full"
    },
    {
      "requirement": "AC2: create a project with a unique name → success toast, project in list.",
      "e2e_tests": ["TC-02"],
      "unit_tests": ["project creation / naming: uniqueness check accepts a non-matching name"],
      "coverage": "partial",
      "note": "Happy path only in this AC; the negative (duplicate) path is AC3."
    },
    {
      "requirement": "AC3: duplicate name → error toast, list unchanged.",
      "e2e_tests": ["TC-03"],
      "unit_tests": ["project creation / naming: uniqueness check rejects a matching name", "project creation / naming: duplicate rejection returns the specific error"],
      "coverage": "partial",
      "note": "No boundary case (e.g. case-sensitivity of the uniqueness check) — spec doesn't define one; flagged in the unit checklist for the team to confirm."
    },
    {
      "requirement": "AC4: delete from the row after confirming → project gone from list.",
      "e2e_tests": ["TC-04", "TC-04B"],
      "unit_tests": ["deletion: removes only after confirmation", "deletion: cancel is a no-op"],
      "coverage": "full"
    },
    {
      "requirement": "AC5: search box filters rows by name fragment.",
      "e2e_tests": ["TC-05", "TC-05B"],
      "unit_tests": ["search / filtering: substring match", "search / filtering: empty fragment returns unfiltered list", "search / filtering: zero matches renders empty without erroring"],
      "coverage": "partial",
      "note": "Boundary case (case-sensitivity of the filter) undefined by spec; flagged in the unit checklist."
    },
    {
      "requirement": "AC6: zero projects → \"No projects yet\", no table.",
      "e2e_tests": ["TC-06"],
      "unit_tests": ["empty state: zero-projects message + no table"],
      "coverage": "full"
    }
  ],
  "unmapped_requirements": [],
  "test_gaps": [
    "AC2/AC3: no defined case-sensitivity rule for name uniqueness — needs a product decision before a boundary test can be written.",
    "AC5: no defined case-sensitivity rule for search matching, and no spec'd behavior for zero search *results* (as opposed to zero total projects) — needs a product decision.",
    "playwright/tests/projects.spec.ts is currently non-functional: TC-03's assertion is vacuous and both TC-03/TC-04 import pom/api modules that don't exist in the repo, with no playwright.config or package.json present either. Automation for all 9 test cases needs to be built via /qa-e2e-setup + /qa-e2e-pom + /qa-e2e-write."
  ]
}
````

## Criteria

## traceability (weight 3, floor 2)

Every real AC in the case input has at least one test case, and every test case names an AC that exists. Listing an AC under unmapped_requirements is honest bookkeeping, not coverage: it counts as covered only when the judge notes say the AC could not be covered (placeholder AC, no app to observe).

- **0** — At least one real AC has no test case — listed as a gap or not — and the judge notes give no reason it could not be covered.
- **1** — Every real AC has a case or a supported gap, but at least one test case names no AC or names an AC that does not exist.
- **2** — Every real AC has a case or a supported gap and every case names its AC; one inconsistency between the cases document and the mapping (e.g. a TC in the mapping that is not in the document).
- **3** — Every real AC has a case or a supported gap, every case names its AC, the document and the mapping agree exactly, and any supported gap is listed with its reason.

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
