# Scratchpad — exploratory-nobranch-6da163

## Plan
- Target: Projects management feature (`projects`), spec-sourced (features-kb/features/projects/feature.md)
- Time box: 30 min (--quick), headless, base URL http://localhost:4173
- Existing coverage: TC-01..04 cover AC1 (auth), AC2 (create), AC3 (dup name), AC4 (delete). AC5 (search filter) and AC6 (empty state) have NO test cases yet — primary focus.
- Focus areas ranked:
  1. AC5 search box (input variation heuristic) — untested
  2. AC6 empty state (state transition / data integrity) — untested
  3. AC2/AC3 create+duplicate edge cases (input variation: empty name, max length, special chars, whitespace-only, unicode) — happy path only tested so far
  4. AC4 delete edge cases (state transition: delete then re-add same name, cancel dialog)
  5. Cross-cutting: console/network errors throughout
- Login: qa@acme.test / demo123
- Never call POST /api/reset

## State
- Phase 1-6 complete. Report written to .qa-reports/exploratory-projects-2026-09-05.md. KB updated (feature.md edge cases, index.json). Elapsed ~7 min of 30 min quick timebox.
- Findings: F1 search-zero-results reuses AC6 empty message (Minor/Low); F2 duplicate-name check case-sensitive bug (Normal/Medium); F3 12.5s login delay, single observation, flagged as question (Minor/Low); F4 search box + status filter missing accessible name/role (Minor/Low, UX).
- Confirmed-good: empty/whitespace name rejected, case-insensitive search substring match, delete cancel dialog, XSS-safe name rendering, status filter logic.
- Deliberately NOT tested: true zero-projects (AC6) — would require deleting both seed rows from shared fixture account qa@acme.test; deferred rather than performed destructively.

## Candidate learnings
- qa@acme.test (this project's shared/public fixture account) always has 2 seed projects ("Website Redesign", "Mobile App"). Testing a true empty-list state (AC6) requires an isolated test account or a way to seed a fresh one — deleting the shared seed rows to observe AC6 is a destructive shortcut that should be avoided in future sessions too, since other test runs may depend on that seed data being present.
- Any project created during exploratory testing on this fixture account should be deleted before ending the session (done this run for "website redesign" dup-test and the XSS-payload-name test) to keep the shared account in its original seeded state for the next session.
