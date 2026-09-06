<!-- rubric-control: criterion=duration-recorded case=v1-clean expect=below-floor -->
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** not tracked / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: Empty state has no test case
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Empty state | **Found via:** User personas
**What I did:** Deleted both seed projects and reloaded /projects.
**Expected:** "No projects yet" and no table. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f1-empty.png | **Console/Network:** clean
**Action:** add test case for AC6

**Status:** DONE
**Summary:** 1 new scenario
**Next steps:** /qa-test-cases projects --update
