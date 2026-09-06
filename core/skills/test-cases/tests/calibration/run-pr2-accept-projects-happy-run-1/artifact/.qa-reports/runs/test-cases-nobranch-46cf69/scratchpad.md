# test-cases-nobranch-46cf69

## Plan
- Target: features-kb/features/projects (contextSource: spec, single spec doc docs/specs/projects.md, no Jira).
- Headless run (--headless) → skip live-app probe (step 1.8); no `(unverified)` labels needed for control names since the only claim we make (new-project-button testid) is sourced from the existing Playwright smoke test, not the live app.
- No epic test-plan.md, no team-practices files, no existing test-cases/projects.md → fresh generation, not update.
- Design E2E test cases for AC1-AC6 (happy path + negative + boundary per AC where applicable), unit test checklist, requirement mapping.
- Save to features-kb/features/projects/test-cases/projects.md + projects-mapping.json.

## State
- Phase 1 (context gather) complete: read .qabuddy.json, docs/specs/projects.md, feature.md, smoke.spec.ts, compiled learnings slice (0 active learnings, 15 playbook refs).
- Phase 2-5 complete: 10 E2E test cases (P0 3 / P1 5 / P2 2) + 14-item unit checklist written to
  features-kb/features/projects/test-cases/projects.md, mapping saved to projects-mapping.json
  (coverage full on all 6 ACs, 0 unmapped, 3 test_gaps flagged). features-kb/index.json updated
  (testCaseCount 10, acCovered 6). Self-verification (step 4) passed: no AC without a test case,
  no code blocks in the doc, P0 at 30% (under the 50% cap) with a P0 on the core happy path,
  no duplication against smoke.spec.ts (only existing test; its testid was reused as a cited
  observation, not treated as covering any AC).
- Run complete. Auto-decisions taken at every review pause (headless, unattended) — logged in the
  doc's Next steps: accepted own output as-is; flagged unverified UI details for /qa-e2e-pom.

## Findings
- Observed (from repo, not live app): playwright/tests/smoke.spec.ts asserts `page.getByTestId('new-project-button')` is visible on /projects — this is the only concretely observed control name.
- No other control labels/testids available since app was not probed (headless mode).

## Candidate learnings
