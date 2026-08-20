# SDT Playbook — Index

Shared methodology for all QABuddy skills. Each skill references only the files
it needs — do not load all files at once.

**Version:** 0.4.0

## Files


| File                         | What it covers                                                                           | Used by                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `terminology.md`             | Normalized terms (AC, SDT, DoR, DoD, etc.)                                               | All skills                                                               |
| `risk-and-priority.md`       | Severity scale (6 levels), priority scale (3 levels), effort allocation, decision matrix | exploratory, qa, review-ticket, start, test-cases, test-plan, verify-fix |
| `metrics-and-coverage.md`    | Code coverage (~80% target), requirements coverage, future metric placeholders           | exploratory, qa, start, test-plan                                        |
| `shift-left.md`              | Challenge requirements early, verify alignment, dev helper principles                    | review-ticket, start, test-plan                                          |
| `test-distribution.md`       | Test pyramid (60/30/10), diamond variant (20/70/10), deduplication rules                 | exploratory, review-ticket, start, test-cases, test-plan                 |
| `test-types.md`              | Manual vs automation, UAT vs functional, exploratory testing definition                  | exploratory, start, test-cases, test-plan                                |
| `execution-sequence.md`      | Testing order through the sprint (dev → PR → QA → verify-fix → UAT → release)            | start, test-plan                                                         |
| `defect-lifecycle.md`        | Bug types, Jira states, SLA expectations, regression test requirements                   | exploratory, qa, review-ticket, start, test-cases, test-plan, verify-fix |
| `maintenance-and-ci.md`      | Test ownership, flaky process, 15-min time budget, CI gates, browser matrix              | qa, test-cases, test-plan                                                |
| `exploratory-heuristics.md`  | 10 heuristic categories, technique checklists per heuristic, finding categories          | exploratory                                                              |
| `test-suite-verification.md` | Detection power, mutation smoke, vacuous assertions, self-derived expectations           | e2e-write, test-cases, test-plan                                         |

## Team Practices (project-specific)

Some processes vary by team and are not part of the shared playbook. These are stored in `features-kb/team-practices/` and configured via `/qa-setup`:

| File                  | Covers                                                           | Referenced by                                |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `bug-triage.md`       | Intake process, initial assessment, triage cadence               | `defect-lifecycle.md`, qa                    |
| `hotfix-testing.md`   | Abbreviated test process, what to skip, branch strategy          | `defect-lifecycle.md`, qa, verify-fix        |
| `test-data.md`        | Seeding, cleanup, fixtures, isolation                            | `test-types.md`, qa, test-cases, exploratory |
| `release-workflow.md` | Freeze rules, cutoff, rollback, canary                           | `execution-sequence.md`, start, test-plan    |
| `accessibility.md`    | WCAG level, tools, which features need a11y testing              | `test-types.md`, qa, test-cases, exploratory |
| `ci-cd-pipeline.md`   | Pipeline stages, tests per stage, failure policy, browser matrix | `maintenance-and-ci.md`, qa, test-plan       |
