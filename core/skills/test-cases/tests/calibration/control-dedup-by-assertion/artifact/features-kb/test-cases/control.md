# Test Cases: Projects management (update)

TC-01 and TC-02 unchanged (AC1, AC2).

### AC3 — already covered
Covered by `playwright/tests/projects.spec.ts › TC-03: duplicate project name rejected`. No new case needed.

### AC4 — already covered
Covered by `playwright/tests/projects.spec.ts › TC-04: delete a project`.

## Traceability
{ "mappings": [ { "requirement": "AC3", "e2e_tests": ["projects.spec.ts › TC-03"], "coverage": "full" }, { "requirement": "AC4", "e2e_tests": ["projects.spec.ts › TC-04"], "coverage": "full" } ], "unmapped_requirements": ["AC5", "AC6"], "test_gaps": [] }

**Status:** DONE_WITH_CONCERNS
**Summary:** AC3/AC4 credited to existing specs; AC5/AC6 unmapped
**Next steps:** add cases for AC5, AC6
