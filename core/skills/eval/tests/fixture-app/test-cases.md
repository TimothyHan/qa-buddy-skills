# Fixture test cases — eval input for /e2e-pom and /e2e-write

These play the role of the feature KB's e2e test cases (the output `/test-cases`
would normally produce). Eval fixtures hand this file to the skills as the
"feature context" assumed by the e2e workflow.

Feature: **Projects management** — Acme Projects (fixture app)
Base URL: http://localhost:4173
Test account: qa@acme.test / demo123

---

## TC-01 (P0) — Sign in with valid credentials
- **Precondition:** signed out
- **Steps:** open /login → enter valid email + password → submit
- **Expected:** lands on Projects page; project list visible

## TC-02 (P0) — Create a project
- **Precondition:** signed in; project name unused
- **Steps:** Projects page → New project → enter unique name → Create
- **Expected:** success toast shown; new project appears in the list

## TC-03 (P1) — Duplicate project name rejected
- **Precondition:** signed in; a project with the target name already exists
- **Steps:** New project → enter existing name → Create
- **Expected:** error toast "Name already exists"; list unchanged

## TC-04 (P0) — Delete a project
- **Precondition:** signed in; target project exists
- **Steps:** click Delete on the target row → confirm in dialog
- **Expected:** project no longer in the list

## TC-05 (P1) — Search filters the list
- **Precondition:** signed in; ≥2 projects with distinct names
- **Steps:** type a fragment matching exactly one project into the search box
- **Expected:** only the matching project's row remains visible

## TC-06 (P2) — Empty state
- **Precondition:** signed in; zero projects exist
- **Steps:** open Projects page
- **Expected:** "No projects yet" message shown; no table rendered

---

Out of scope (deliberately — see ANSWER-KEY.md over-scraping check): the
status filter dropdown has no test case. It must not enter the element
inventory.
