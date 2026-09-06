<!-- rubric-control: criterion=coverage-honesty case=projects-happy expect=below-floor -->
# Test Cases: Projects management

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

## Traceability
{ "mappings": [ { "requirement": "AC2", "e2e_tests": ["TC-02"], "coverage": "full" } ], "unmapped_requirements": ["AC1", "AC3", "AC4", "AC5", "AC6"], "test_gaps": [] }

**Status:** DONE_WITH_CONCERNS
**Summary:** 1 test case; AC1, AC3–AC6 unmapped
**Next steps:** add cases for the unmapped ACs
