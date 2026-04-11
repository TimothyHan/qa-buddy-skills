# SDT Playbook — Index

Shared methodology for all QABuddy skills. Each skill references only the files
it needs — do not load all files at once.

**Version:** 0.3.0

## Files


| File                      | What it covers                                                                           | Used by                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `terminology.md`          | Normalized terms (AC, SDT, DoR, DoD, etc.)                                               | All skills                                                   |
| `risk-and-priority.md`    | Severity scale (6 levels), priority scale (3 levels), effort allocation, decision matrix | qa, test-plan, test-cases, review-ticket, exploratory        |
| `metrics-and-coverage.md` | Code coverage (~80% target), requirements coverage, future metric placeholders           | qa, test-plan, sprint-status, exploratory                    |
| `shift-left.md`           | Challenge requirements early, verify alignment, dev helper principles                    | test-plan, review-ticket                                     |
| `test-distribution.md`    | Test pyramid (60/30/10), diamond variant (20/70/10), deduplication rules                 | test-plan, test-cases, review-ticket, exploratory            |
| `test-types.md`           | Manual vs automation, UAT vs functional, exploratory testing definition                  | test-plan, test-cases, exploratory                           |
| `execution-sequence.md`   | Testing order through the sprint (dev → PR → QA → verify-fix → UAT → release)            | sprint-status                                                |
| `defect-lifecycle.md`     | Bug types, Jira states, SLA expectations, regression test requirements                   | qa, test-plan, review-ticket, verify-fix                     |
| `maintenance-and-ci.md`   | Test ownership, flaky process, 15-min time budget, CI gates, browser matrix              | test-cases, sprint-status, qa                                |
| `exploratory-heuristics.md` | 10 heuristic categories, technique checklists per heuristic, finding categories         | exploratory                                                  |

## Team Practices (project-specific)

Some processes vary by team and are not part of the shared playbook. These are stored in `features-kb/team-practices/` and configured via `/qa-setup`:

| File | Covers | Referenced by |
|------|--------|---------------|
| `bug-triage.md` | Intake process, initial assessment, triage cadence | `defect-lifecycle.md`, qa, sprint-status |
| `hotfix-testing.md` | Abbreviated test process, what to skip, branch strategy | `defect-lifecycle.md`, qa, verify-fix |
| `test-data.md` | Seeding, cleanup, fixtures, isolation | `test-types.md`, qa, test-cases, exploratory |
| `release-workflow.md` | Freeze rules, cutoff, rollback, canary | `execution-sequence.md`, sprint-status |
| `accessibility.md` | WCAG level, tools, which features need a11y testing | `test-types.md`, qa, test-cases, exploratory |
| `ci-cd-pipeline.md` | Pipeline stages, tests per stage, failure policy, browser matrix | `maintenance-and-ci.md`, sprint-status, qa, test-plan |
