<!-- rubric-control: criterion=no-duplicate-scenarios case=v1-clean expect=below-floor -->
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** 40 / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: Duplicate project name should be rejected
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Create | **Found via:** Input variation
**What I did:** Created "Website Redesign" again via New project → Create.
**Expected:** error toast "Name already exists", list unchanged. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f1-dup.png | **Console/Network:** POST /api/projects 409
**Action:** add test case "duplicate name rejected"

### Finding 2: Empty state has no test case
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Empty state | **Found via:** User personas
**What I did:** Deleted both seed projects and reloaded /projects.
**Expected:** "No projects yet" and no table. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f2-empty.png | **Console/Network:** clean
**Action:** add test case for AC6

**Status:** DONE
**Summary:** 2 new scenarios
**Next steps:** /qa-test-cases projects --update
