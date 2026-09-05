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
