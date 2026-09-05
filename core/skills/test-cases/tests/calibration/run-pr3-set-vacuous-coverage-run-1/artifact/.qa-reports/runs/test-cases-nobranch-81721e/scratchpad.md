# test-cases-nobranch-81721e

## Plan

- ticket: "projects" (contextSource: spec, solo mode, headless — skip live-app probe)
- spec: docs/specs/projects.md (AC1-AC6); existing doc: features-kb/features/projects/test-cases/projects.md has TC-01/TC-02 for AC1/AC2 only
- read existing playwright/tests/projects.spec.ts (TC-03 duplicate, TC-04 delete) against vacuous-assertion checklist before crediting AC3/AC4 as covered
- design new/updated test cases for AC3-AC6 + AC1 negative half, write mapping.json, update feature.md status, self-verify, save

## State
- Complete. Wrote features-kb/features/projects/test-cases/projects.md (9 TCs, AC1-AC6
  all mapped) + projects-mapping.json + updated feature.md + index.json. Captured
  LRN-20260905-01 (broken/vacuous existing playwright spec). Outcome: DONE_WITH_CONCERNS.

## Findings
- Observed: docs/specs/projects.md AC1 has two halves (valid creds happy path + invalid creds negative); existing TC-01 only covers the happy half — negative half unmapped.
- Observed: playwright/tests/projects.spec.ts TC-03 asserts only `expect(page).toHaveURL(/\/projects/)` after submitting a duplicate name. "New project" is opened as an in-page action (no route change implied anywhere in spec), so this assertion is true whether the duplicate is correctly rejected or wrongly accepted — vacuous per REF-playbook/test-suite-verification#vacuous-assertion-checklist. Does NOT count as AC3 coverage.
- Observed: playwright/tests/projects.spec.ts imports `../pom/projects.page` and `../api/projects`, but `find playwright -type f` shows only `playwright/tests/projects.spec.ts` exists — no pom/ or api/ dir, no playwright.config, no package.json anywhere in the repo. The spec file cannot compile/run as-is. Neither TC-03 nor TC-04 can be trusted as working coverage regardless of assertion quality. Flagging both AC3 and AC4 as gaps needing new test-case-doc entries; noting the broken automation file as a concern for SDT (out of scope for this skill to fix — /qa-e2e-setup / /qa-e2e-write own the automation layer).
- Observed: AC6's "No projects yet" message is specified only for zero *total* projects, not zero *search results* — not assuming it also fires for an empty filtered list.

## Candidate learnings
<!-- candidate learnings: anything noteworthy, no evidence bar; capture triggers are applied to these at close -->
- Candidate: this fixture repo ships a playwright spec file with imports to nonexistent pom/api modules (no playwright.config, no package.json) — a documented-but-unbuilt automation scaffold. If seen again in this repo, treat any file under playwright/tests/ as unverified until its imports resolve, not just its assertions.
