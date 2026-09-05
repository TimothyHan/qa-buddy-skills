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
