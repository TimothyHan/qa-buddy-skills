<!-- rubric-control: criterion=traceability case=projects-happy expect=below-floor -->
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects

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
- Signed in; name unused (Observed: "New project" button, "Create" in modal)
**Steps:**
1. New project
2. Enter a unique name
3. Create
**Expected Result:**
- Toast shown; project in the list

### TC-03: Delete a project
**Requirement:** AC4 from projects
**Priority:** P0
**Type:** happy-path
**Preconditions:**
- Signed in; target exists
**Steps:**
1. Click Delete on the row
2. Confirm "Delete" in the dialog (Observed)
**Expected Result:**
- Row gone

## Traceability
{ "mappings": [ { "requirement": "AC1", "e2e_tests": ["TC-01"], "coverage": "partial" }, { "requirement": "AC2", "e2e_tests": ["TC-02"], "coverage": "partial" }, { "requirement": "AC4", "e2e_tests": ["TC-03"], "coverage": "partial" } ], "unmapped_requirements": [], "test_gaps": [] }

**Status:** DONE
**Summary:** 3 test cases for projects
**Next steps:** none
