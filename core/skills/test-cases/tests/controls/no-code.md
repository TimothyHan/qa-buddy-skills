<!-- rubric-control: criterion=no-code case=projects-happy expect=below-floor -->
# Test Cases: Projects management

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

Sketch:
```typescript
await projectsPage.deleteByName(page, name);
await expect(projectsPage.locators.rowByName(page, name)).toHaveCount(0);
```

**Status:** DONE
**Summary:** 1 test case
**Next steps:** none
