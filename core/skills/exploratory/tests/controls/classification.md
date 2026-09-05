<!-- rubric-control: criterion=classification case=v1-clean expect=below-floor -->
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** 38 / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: No loading indicator while the list loads
**Category:** UX concern
**Focus area:** List | **Found via:** Performance feel
**What I did:** Signed in and watched the Projects page load.
**Expected:** a loading state during the fetch. | **Actual:** blank area for ~120 ms, then rows appear.
**Evidence:** described observation (no file-save tool) | **Console/Network:** GET /api/projects 200 in 120 ms
**Action:** UX improvement

### Finding 2: No test case for the empty state
**Category:** New test scenario | **Severity:** important | **Priority:** soon
**Focus area:** Empty state | **Found via:** User personas
**What I did:** Deleted both seed projects and reloaded.
**Expected:** "No projects yet" and no table. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f2-empty.png | **Console/Network:** clean
**Action:** add test case for AC6

**Status:** DONE
**Summary:** 1 UX concern, 1 new scenario
**Next steps:** /qa-test-cases projects --update
