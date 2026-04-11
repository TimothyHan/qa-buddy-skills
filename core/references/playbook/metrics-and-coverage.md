# Test Metrics

## Code Coverage

- **Target:** ~80% code coverage.
- **Not a hard rule.** Below 80% does not block PR merge.
- **Accountability:** PR owner must explain why 80% was not achievable or realistic.
- **Purpose:** Encourages discipline, not perfection. Coverage alone does not guarantee quality.

## Test Coverage (Requirements Coverage)

Test coverage = (requirements and ACs covered by test cases) / (all requirements and ACs).

**Rules:**

- Each requirement/AC can be covered by multiple test cases.
- Each requirement/AC should be covered by **at least one** test case.
- **100% test coverage does not mean safe.** It means 100% of known requirements have at least one test.
- **Focus test coverage analysis on identifying missing scenarios.** This is often achieved through exploratory testing.

## Defect Metrics

### Must-have

| Metric | Formula | Target | How to collect |
|--------|---------|--------|----------------|
| **Defect escape rate** | production bugs / total bugs found | <10% | Jira label (`production-bug` vs `pre-release-bug`) or KB bug files. Count per sprint. |
| **Severity distribution** | breakdown of bugs by severity per sprint | Mostly Normal/Minor. Few Blocker/Critical. | Jira or KB `bugs/` files per sprint. |
| **MTTR (mean time to resolve)** | avg time from bug filed → bug verified fixed | Blocker: same day. Critical: same sprint. | Jira: `bug created` to `/verify-fix VERIFIED` date. |

### Nice-to-have

| Metric | Formula | When to add |
|--------|---------|-------------|
| **DRE (defect removal efficiency)** | bugs found before release / (before + after) | When escape rate is already tracked. Target: >90%. |
| **MTTD (mean time to detect)** | avg time from code merged → bug discovered | When shift-left maturity is a focus area. |
| **Bug reopen rate** | % of bugs transitioned Fixed → Open again | When volume is sufficient (~20+ bugs/sprint). |
| **Defect density** | bugs per epic or per story point | When consistent epic-to-bug linking is established. |

## Test Health Metrics

### Must-have

| Metric | Formula | Target | How to collect |
|--------|---------|--------|----------------|
| **Test pass rate** | % of tests passing per CI stage | >95% per stage (PR/develop/main) | CI pipeline results. Playwright/Jest output. |
| **Flaky test rate** | % of tests that pass/fail inconsistently | <2% | Datadog flaky tracker, or count re-run passes in CI. |
| **Requirements coverage trend** | % of ACs with at least one test case, per sprint | Increasing or stable. Never declining. | KB traceability mappings. Sprint-status computes this. |

### Nice-to-have

| Metric | Formula | When to add |
|--------|---------|-------------|
| **Test execution time** | total suite runtime, trend over time | When suite approaches the 15-min budget. |
| **Automation rate** | automated test cases / total test cases | For roadmap planning, not daily decisions. |
| **Test case growth vs feature growth** | new test cases / new stories per sprint | If requirements coverage trend isn't enough. |
| **Test maintenance cost** | commits fixing tests / commits adding tests | When team feels maintenance pain. Hard to measure precisely. |

