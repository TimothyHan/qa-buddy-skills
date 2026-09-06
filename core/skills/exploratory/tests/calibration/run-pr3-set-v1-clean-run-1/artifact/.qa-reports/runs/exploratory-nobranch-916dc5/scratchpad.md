## Plan
- Headless run, no SDT present. Auto-decide option (A) at every review pause; log as Auto-decision in final report.
- Feature: Projects management (projects). TC-01..04 cover AC1-AC4 (auth, create, duplicate reject, delete).
- Coverage gap: AC5 (search filter) and AC6 (empty state "No projects yet") have NO test cases yet — top focus areas.
- Also noted: "Status filter dropdown — no AC" listed as out of scope in feature.md — check if it actually exists in UI (undocumented feature = risk).
- Time budget: 45 min (default, no --quick/--deep flag given). Start 04:46 local.
- Will use mcp__playwright browser tools headlessly against http://localhost:4173. Login as qa@acme.test / demo123.
- Focus areas planned (risk order):
  1. Search/filter (AC5, no coverage) - input variation heuristic
  2. Empty state (AC6, no coverage) - persona/state heuristic
  3. Create/duplicate/delete edge cases beyond happy path (input variation, error recovery)
  4. Undocumented status filter dropdown - cross-feature/exploratory
  5. Auth edge cases - state transition, security surface

## State
DONE_WITH_CONCERNS. All 5 charter focus areas covered. 6 findings logged (1 confirmed
defect BUG-001 case-insensitive duplicate names; 3 UX; 1 missing-requirement re: status
filter dropdown; 1 positive security confirmation for XSS-escaping + unauth 401). Fixture
data restored to original 2 seed projects. Report written to
.qa-reports/exploratory-projects-2026-09-05.md. KB updated: feature.md edge cases,
index.json, bugs/BUG-001.md.

## Candidate learnings
- Captured as LRN-20260905-01: avoid deleting the last fixture seed projects to test
  AC6 true-empty-state (no /api/reset available) — use search-to-zero-results as an
  indirect equivalent instead. Logged via akela.
