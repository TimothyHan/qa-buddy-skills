# Test Execution Sequence

For a feature moving through the sprint, testing follows this order:

```
Developer starts coding
  |
  |-- Unit tests written alongside code (developer)
  |-- API tests written (developer + SDT)
  |
PR Created
  |
  |-- CI runs unit + API + E2E tests automatically (all tests, any failure blocks merge)
  |-- Dev runs manual test cases locally
  |
Feature ready (merged to develop or feature branch)
  |
  |-- SDT runs /qa (executes test cases, verifies ACs, files bugs)
  |-- SDT conducts /exploratory (charter-driven discovery)
  |-- SDT creates UAT scenarios
  |
Bugs fixed by devs
  |
  |-- SDT runs /verify-fix (re-tests each bug fix, checks regression)
  |
Pre-release
  |
  |-- UAT execution (final check)
  |-- Regression suite (automated, High + Medium priority)
  |
Merge to main
  |
  |-- CI runs full test suite (same test set as PR and develop)
  |-- Feature can be in main without being released to customers
```

## Team-Specific Processes

**Release workflow:** See `features-kb/team-practices/release-workflow.md` if defined. Covers: release freeze rules, cutoff times, rollback process, canary strategy.
