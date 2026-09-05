# Test Maintenance and CI/CD Gates
<!-- qab: scope=test-plan,test-cases,qa -->

## Test Ownership
<!-- qab: id=test-ownership scope=test-plan -->

**SDTs own test maintenance** for E2E and API test suites. Developers own unit test
maintenance.

## Test Retirement
<!-- qab: id=test-retirement scope=test-plan -->

Tests are retired when:
- **Feature is removed.** Delete all tests for that feature.
- **Feature changed significantly.** Tests become obsolete. Rewrite, don't patch.
- **Test is permanently flaky** and cannot be fixed. Remove after exhausting the flaky process.

## Flaky Test Process
<!-- qab: id=flaky-test-process scope=test-cases,qa -->

- **Fix ASAP, root cause first.**
- **If the fix is complex:** quarantine (skip the test temporarily), register it in
  the flaky test tracker (Datadog), schedule the fix within the current or next sprint.
- **If it cannot be fixed after reasonable effort:** retire the test, document why in
  the test file or tracker, and consider whether the scenario needs a different
  test approach.

## Execution Time Budget
<!-- qab: id=execution-time-budget scope=test-plan -->

- **Target:** Full test suite completes in under **15 minutes**.
- If suite exceeds 15 minutes, investigate:
  - Parallelization opportunities
  - Slow tests that can be optimized
  - Tests that can be moved to a lower layer
  - Tests that can run on a separate schedule (nightly)

---

## CI/CD Pipeline
<!-- qab: id=ci-cd-pipeline scope=test-plan -->

**Team-specific:** See `features-kb/team-practices/ci-cd-pipeline.md` if defined. Covers: pipeline stages, which tests run at each stage, failure policy, browser matrix, flaky test tracking tools.

**General principles** (apply regardless of pipeline setup):
- Any test failure should block the pipeline — no silent failures
- If a test fails at least once, investigate even if a re-run passes
- Browser-specific test restrictions should be documented in the test file
