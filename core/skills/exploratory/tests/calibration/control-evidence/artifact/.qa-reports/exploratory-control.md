# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** 44 / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: Search could be better
**Category:** UX concern | **Severity:** Minor | **Priority:** Low
**Focus area:** Search | **Found via:** Input variation
**What I did:** Explored the search.
**Expected:** Search works well. | **Actual:** Search works well but could be better.
**Evidence:** — | **Console/Network:** —
**Action:** discuss

### Finding 2: Empty state has no test case
**Category:** New test scenario | **Severity:** Normal | **Priority:** Medium
**Focus area:** Empty state | **Found via:** User personas
**What I did:** Deleted both seed projects via the row Delete buttons and reloaded /projects.
**Expected:** "No projects yet" and no table. | **Actual:** as expected.
**Evidence:** .qa-reports/screenshots/f2-empty.png | **Console/Network:** clean
**Action:** add test case for AC6

**Status:** DONE
**Summary:** 1 UX concern, 1 new scenario
**Next steps:** /qa-test-cases projects --update
