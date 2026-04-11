# Test Maintenance and CI/CD Gates

## Test Ownership

**SDTs own test maintenance** for E2E and API test suites. Developers own unit test
maintenance.

## Test Retirement

Tests are retired when:
- **Feature is removed.** Delete all tests for that feature.
- **Feature changed significantly.** Tests become obsolete. Rewrite, don't patch.
- **Test is permanently flaky** and cannot be fixed. Remove after exhausting the flaky process.

## Flaky Test Process

```
Test fails intermittently
  |
  |-- Fix ASAP (first priority: fix the root cause)
  |
  |-- If fix is complex:
  |     |-- Quarantine: skip the test temporarily (@skip or equivalent)
  |     |-- Track in flaky test tracker (Datadog)
  |     |-- Schedule fix within current or next sprint
  |
  |-- If fix is not possible after reasonable effort:
        |-- Retire the test
        |-- Document why in the test file or tracker
        |-- Consider if the scenario needs a different test approach
```

## Execution Time Budget

- **Target:** Full test suite completes in under **15 minutes**.
- If suite exceeds 15 minutes, investigate:
  - Parallelization opportunities
  - Slow tests that can be optimized
  - Tests that can be moved to a lower layer
  - Tests that can run on a separate schedule (nightly)

---

## CI/CD Pipeline

**Team-specific:** See `features-kb/team-practices/ci-cd-pipeline.md` if defined. Covers: pipeline stages, which tests run at each stage, failure policy, browser matrix, flaky test tracking tools.

**General principles** (apply regardless of pipeline setup):
- Any test failure should block the pipeline — no silent failures
- If a test fails at least once, investigate even if a re-run passes
- Browser-specific test restrictions should be documented in the test file
