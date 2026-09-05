<!-- judge-notes: never shown to the runner -->
# Judge notes — vacuous-coverage (fixture app v1)

`playwright/tests/projects.spec.ts` contains two tests:

- **TC-03 (AC3) is vacuous.** Its only assertion is `expect(page).toHaveURL(/\/projects/)`, which holds whether or not the duplicate was rejected — the page never leaves /projects. It must not be credited as covering AC3; AC3 is a gap (or gets a new case that asserts the error toast and the unchanged list).
- **TC-04 (AC4) is valid.** `expect(rowByName(name)).toHaveCount(0)` fails if the row survives the delete. Crediting AC4 to it is correct only if the credit names the file and that assertion.

The existing KB document covers AC1 and AC2 only; this is an `--update` run, so TC-01 and TC-02 should be kept, not duplicated.
Real labels and seed data are as in projects-happy: "New project", "Create", "Cancel", "Delete", "Keep", "No projects yet", seeds "Website Redesign" and "Mobile App".
