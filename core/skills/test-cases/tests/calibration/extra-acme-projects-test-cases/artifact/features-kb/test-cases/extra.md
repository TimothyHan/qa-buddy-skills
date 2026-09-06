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
