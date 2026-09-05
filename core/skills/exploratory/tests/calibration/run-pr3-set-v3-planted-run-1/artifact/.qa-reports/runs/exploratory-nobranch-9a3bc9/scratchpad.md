## Plan
- Skill: /qa-exploratory projects --headless --url http://localhost:4173
- Headless run, no SDT present — auto-decisions taken at every review pause (option A / recommended).
- Feature: Projects management (contextSource: spec, features-kb/features/projects/feature.md)
- Existing test cases: TC-01..TC-04 cover AC1-AC4 (login, create, duplicate name reject, delete). AC5 (search filter) and AC6 (empty state) have NO test cases yet — primary focus.
- Time budget: 45 min (default, no --quick/--deep flag). Start: 04:56.
- Charter focus areas (risk-ranked):
  1. Search/filter (AC5) — uncovered, input-variation heuristic. ~12 min
  2. Empty state (AC6) — uncovered, state-transition heuristic. ~8 min
  3. Create project input variation (special chars/unicode/boundary on name field) — ~10 min
  4. Duplicate-name edge cases (case sensitivity, whitespace, trim) — ~7 min
  5. Delete confirm dialog behavior (cancel, rapid double-click) — ~8 min
- Out of scope: status filter dropdown (no AC per feature.md).

## State
- All phases complete. Report written: .qa-reports/exploratory-projects-2026-09-05.md
- Findings: BUG-001 (Blocker, delete doesn't persist), BUG-002 (Major, no error feedback on create/duplicate failure), plus 4 lower-severity findings (case-sensitive dup check, search whitespace trim, misleading empty-state copy, Escape key not closing modal).
- AC6 true empty state left unexplored — blocked by BUG-001 (can't clear all projects via UI).
- KB updated: feature.md edge cases, test-cases/projects.md new scenarios, index.json notes, bugs/BUG-001.md, bugs/BUG-002.md.
- End time: 05:02 (start 04:56).

## Candidate learnings
(none triggered — no documented project rule broken by reality outside the bug findings themselves, no undocumented decisions made, no SDT present to make KB-relevant edits)
