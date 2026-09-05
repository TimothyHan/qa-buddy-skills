## Plan
- Feature: Projects management (projects), contextSource=spec, solo mode, headless run, no SDT present (auto-decide at every pause per top-level override).
- Start time: 05:07 (local)
- Time limit: 45 min (default; no --quick/--deep flag)
- URL: http://localhost:4173 (redirects to /login unauthenticated — confirmed via curl, 302)
- Existing coverage: TC-01..TC-04 (AC1-AC4: login, create, duplicate name, delete). AC5 (search) and AC6 (empty state) have NO test cases yet — explicit gap per feature.md and test-cases/projects.md.
- Focus areas ranked by risk/gap:
  1. AC5/AC6 uncovered gap: search filter + empty state (highest priority — zero coverage)
  2. Input variation on create-project name field (boundary, special chars, unicode, whitespace)
  3. State transitions: duplicate name error recovery, delete confirm dialog cancel path, back/refresh mid-flow
  4. Cross-cutting: "Out of scope" status filter dropdown exists in DOM but no AC — check if it silently does something or is dead UI
  5. Console/network check throughout
- Auto-decision policy: since headless/no SDT, take option (A) at every review pause; log as Auto-decision in final report.

## State
- Phase 1 done. Logged in as qa@acme.test, landed on /projects. Seed data: 2 rows (Website Redesign/active/2026-07-01, Mobile App/paused/2026-07-15). Toolbar has: search textbox, "All" status dropdown (out of scope per AC), "New project" button.
- Charter auto-approved (option A, no SDT) — proceeding to Phase 3.
- Phase 3 starting: search (AC5) first.

## Findings so far (05:07-05:11)
1. Search with no matching rows reuses "No projects yet" empty-state copy (same as true zero-projects state) — misleading when user HAS projects but filter matched none. (AC5/AC6 boundary gap)
2. Status dropdown (All/Active/Paused) is fully wired and functional client-side filter, despite being explicitly "out of scope" in feature.md (no AC). New test scenario finding, not a defect.
3. Create with empty/whitespace-only name: no client-side validation: request goes to POST /api/projects, server returns 400, THEN "Name is required" shown. Console shows 400 error. Minor UX/efficiency issue (extra round trip, noisy console).
4. Duplicate-name check (AC3) is case-sensitive: "website redesign" (lowercase) accepted as new project alongside existing "Website Redesign" — creates near-identical duplicate. Gap in AC3.
5. **CRITICAL: Delete does not persist.** Confirmed twice, two different rows (id=3 "website redesign", id=2 "Mobile App"): DELETE /api/projects/{id} returns 204 No Content, but the immediately-following GET /api/projects (and a full page reload) still includes the deleted row. UI shows the row again after refetch. No error toast shown to user — appears to succeed. Breaks AC4/TC-04 (P0) universally, not row-specific. This is the headline finding.
- Current DB state (side effect of testing): id=3 "website redesign" duplicate exists (attempted delete twice, still present). id=1/2 original seed rows untouched functionally (still present despite delete attempts).
- Next: brief input-variation pass (XSS/special chars, long name, unicode) on create, then wrap up (state transitions/cross-func already substantially covered via delete bug discovery).

## Candidate learnings
- Delete confirming with a 204 response is NOT reliable proof of persistence in this app — always re-GET (or reload) after a delete/mutation before trusting the UI's optimistic removal. This app's DELETE returns 204 but silently no-ops server-side. Worth a project-level learning: "verify mutations via a fresh GET, not just the response status."
- feature.md's "Out of scope — no AC" annotation doesn't mean the UI element is inert; the status dropdown was fully wired. Don't skip cross-functional exploration of "out of scope" UI just because there's no AC.

## State (final)
- Session complete at 05:18 (11 min elapsed of 45 min budget). Ended early because a Blocker-severity, twice-reproduced defect (BUG-001: delete doesn't persist) was found and dominates the risk picture; further exploration deprioritized per REF-playbook/risk-and-priority#effort-allocation.
- Report written: .qa-reports/exploratory-projects-2026-09-05.md
- Bug filed: features-kb/features/projects/bugs/BUG-001.md (no Jira MCP available — contextSource is "spec", filed to KB per instructions)
- KB updated: feature.md (edge cases section), index.json (notes field)
- Status: DONE_WITH_CONCERNS
