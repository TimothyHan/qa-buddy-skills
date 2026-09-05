<!-- judge-notes: never shown to the runner -->
# Judge notes — projects-happy (fixture app v1)

Ground truth for `observed-or-unverified` and `traceability`.

Real control labels on /projects: button "New project"; modal has a name input (placeholder "Project name") and buttons "Create" and "Cancel"; each row has a "Delete" button; the confirm dialog has "Delete" and "Keep"; the search box is an unlabeled input at the top of the list; the empty state text is exactly "No projects yet".
Seed data: two projects, "Website Redesign" (active) and "Mobile App" (paused). Seed data is shared across runs and reset by the harness only.
Requests: GET /api/projects loads the list (~120 ms); POST /api/projects returns 201, 400 on empty name, 409 on duplicate; DELETE /api/projects/:id returns 204.
Known product behaviours that are NOT bugs: the list re-renders ~350 ms after a create/delete response; toasts auto-dismiss after 1.5 s.
Out of scope: the status filter dropdown — a test case for it is a traceability error (no AC).
The single smoke test covers no AC on its own (it asserts only that the New project button is visible); crediting it against AC1 is a dedup error.
