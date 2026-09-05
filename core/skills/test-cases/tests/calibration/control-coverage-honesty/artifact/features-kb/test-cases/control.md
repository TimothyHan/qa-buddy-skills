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
- Signed in; name unused (Observed: "New project", "Create")
**Steps:**
1. New project → enter a unique name → Create
**Expected Result:**
- Toast shown; project in the list

### TC-03: Duplicate name rejected
**Requirement:** AC3 from projects
**Priority:** P1
**Type:** happy-path
**Preconditions:**
- Signed in; a project named "Website Redesign" exists (Observed: seed data)
**Steps:**
1. New project → enter "Website Redesign" → Create
**Expected Result:**
- Error toast "Name already exists"; list unchanged

### TC-04: Delete a project
**Requirement:** AC4 from projects
**Priority:** P0
**Type:** happy-path
**Preconditions:**
- Signed in; target exists (Observed: row "Delete", dialog "Delete"/"Keep")
**Steps:**
1. Click Delete on the row
2. Confirm in the dialog
**Expected Result:**
- Row gone

### TC-05: Search filters the list
**Requirement:** AC5 from projects
**Priority:** P1
**Type:** happy-path
**Preconditions:**
- Signed in; seed projects "Website Redesign" and "Mobile App" present (Observed)
**Steps:**
1. Type "Mobile" into the search box (Observed: unlabeled input above the list)
**Expected Result:**
- Only "Mobile App" remains visible

### TC-06: Empty state
**Requirement:** AC6 from projects
**Priority:** P2
**Type:** happy-path
**Preconditions:**
- Signed in; zero projects (delete both seeds first)
**Steps:**
1. Open /projects
**Expected Result:**
- "No projects yet" shown (Observed: exact text); no table rendered

## Traceability
{ "mappings": [ { "requirement": "AC1", "e2e_tests": ["TC-01"], "coverage": "full" }, { "requirement": "AC2", "e2e_tests": ["TC-02"], "coverage": "full" }, { "requirement": "AC3", "e2e_tests": ["TC-03"], "coverage": "full" }, { "requirement": "AC4", "e2e_tests": ["TC-04"], "coverage": "full" }, { "requirement": "AC5", "e2e_tests": ["TC-05"], "coverage": "full" }, { "requirement": "AC6", "e2e_tests": ["TC-06"], "coverage": "full" } ], "unmapped_requirements": [], "test_gaps": [] }

**Status:** DONE
**Summary:** 6 test cases, all ACs fully covered
**Next steps:** none
