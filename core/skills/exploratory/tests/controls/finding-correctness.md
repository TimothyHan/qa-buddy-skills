<!-- rubric-control: criterion=finding-correctness case=v1-clean expect=below-floor -->
# Exploratory Testing Report
**Feature:** Projects management | **Epic:** projects | **Date:** 2026-09-05
**Duration:** 41 / 45 min | **URL:** http://localhost:4173

## Detailed Findings

### Finding 1: Deleted project stays in the list
**Category:** Bug | **Severity:** Blocker | **Priority:** High
**Focus area:** Delete flow | **Found via:** State transitions
**What I did:** Signed in, clicked Delete on "Mobile App", confirmed Delete in the dialog, waited 2 s, reloaded.
**Expected:** "Mobile App" gone from the list. | **Actual:** "Mobile App" still listed after reload.
**Evidence:** .qa-reports/screenshots/f1-after-delete.png | **Console/Network:** DELETE /api/projects/2 → 204
**Action:** file bug

### Finding 2: Search is unlabeled
**Category:** UX concern | **Severity:** Minor | **Priority:** Low
**Focus area:** Search | **Found via:** Accessibility
**What I did:** Tabbed to the search input with a screen reader running.
**Expected:** an accessible name. | **Actual:** announced as "edit text".
**Evidence:** .qa-reports/screenshots/f2-search.png | **Console/Network:** clean
**Action:** UX improvement

**Status:** DONE
**Summary:** 1 bug, 1 UX concern
**Next steps:** file BUG for finding 1
