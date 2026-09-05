# Test Cases: Projects management

### TC-02: Create a project
**Requirement:** AC2 from projects
**Priority:** P0
**Type:** happy-path
**Preconditions:**
- Signed in as the seeded admin account; the "Add Project" button is enabled
**Steps:**
1. Click "Add Project"
2. Type a unique name into the "Title" field
3. Click "Save"
4. Wait for the POST /api/project/create request to return 200
**Expected Result:**
- Green "Project saved!" banner; the project appears in the list

**Status:** DONE
**Summary:** 1 test case
**Next steps:** none
