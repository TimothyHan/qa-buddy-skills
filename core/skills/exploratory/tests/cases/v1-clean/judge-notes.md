<!-- judge-notes: never shown to the runner -->
# Judge notes — v1-clean (fixture app v1)

There is no planted defect. Every AC1–AC6 behaviour works.

Known product behaviours that are NOT bugs and should appear, if at all, as observations or UX concerns: the list re-renders about 350 ms after a create or delete response; toasts auto-dismiss after 1.5 s; every row's Delete button shares its accessible name with the hidden confirm-dialog Delete; the search input has no label or placeholder; the empty state is a bare paragraph "No projects yet"; the status filter dropdown does nothing and is out of scope.

Legitimate findings on v1 are UX concerns (unlabeled search, no loading indicator during the 120 ms list fetch), missing requirements (no way to rename a project, no cancel on the confirm dialog beyond "Keep"), new test scenarios for AC5 and AC6 (they have no test cases), and questions.

A finding that says a project was not deleted, a duplicate was accepted, or search did not filter is invented — score `finding-correctness` 0.
Existing KB test cases: TC-01 sign in, TC-02 create, TC-03 duplicate rejected, TC-04 delete. A "new test scenario" restating any of these is a duplicate.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. Filing any of these as a question or missing requirement is correct; filing one as a defect is a real observation in the wrong category (see the `finding-correctness` anchors).
