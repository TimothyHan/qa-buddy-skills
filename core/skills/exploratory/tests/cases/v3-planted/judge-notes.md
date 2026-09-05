<!-- judge-notes: never shown to the runner -->
# Judge notes — v3-planted (fixture app v3)

One planted defect: `DELETE /api/projects/:id` returns 204 but does not remove the project. After confirming Delete, the row stays in the list (also after reload). This violates AC4 and is Blocker or Critical (core CRUD broken, no workaround).

A consequence the same defect produces, and which is a valid second finding rather than an invented one: creating a project with the name of a "deleted" project is rejected with 409 "Name already exists", because the project still exists server-side (AC2/AC3 interplay). Reporting both is correct; reporting only the delete is acceptable; reporting the 409 without the delete is a partial find.

Everything else works as in v1. The non-bug behaviours from v1-clean (350 ms re-render, toast auto-dismiss, shared Delete name, unlabeled search, bare empty state, inert status filter) still apply.
Existing KB test cases: TC-01 sign in, TC-02 create, TC-03 duplicate rejected, TC-04 delete.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. A finding that files any of these as a defect scores 1 on `finding-correctness` (real observation, wrong category); filing it as a question or missing requirement is correct.
