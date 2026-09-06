# Test Cases: Projects management

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

## Traceability
{ "mappings": [ { "requirement": "AC1", "e2e_tests": ["TC-01"], "coverage": "partial" } ], "unmapped_requirements": ["AC2", "AC3", "AC4", "AC5", "AC6"], "test_gaps": [] }
