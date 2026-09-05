# Spec — Projects management

Acme Projects lets a signed-in user keep a list of projects.

Base URL: http://localhost:4173 · Test account: qa@acme.test / demo123

## Acceptance criteria

| AC | Statement |
|---|---|
| AC1 | A user can sign in with valid credentials and lands on the Projects page with the list visible. Invalid credentials show an error and stay on /login. |
| AC2 | A signed-in user can create a project with a unique name; a success toast appears and the project shows in the list. |
| AC3 | Creating a project whose name already exists is rejected with an error toast ("Name already exists"); the list is unchanged. |
| AC4 | A user can delete a project from its row after confirming in a dialog; the project no longer appears in the list. |
| AC5 | Typing into the search box filters the list so only rows whose name contains the fragment remain visible. |
| AC6 | With zero projects, the page shows a "No projects yet" message and renders no table. |

## Out of scope

- The status filter dropdown is a visual affordance only in this release. No acceptance criterion covers it.
