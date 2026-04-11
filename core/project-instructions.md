{{PLATFORM_HEADER}}# QABuddy

An AI partner for Software Developers in Test (SDTs) working in Scrum teams.
Covers the full SDT workflow: from epic test planning through sprint execution
to release verification. Built for teams using Playwright and 2-week sprints.
Works with Jira + Confluence (via Atlassian MCP) or without — context can be
provided via files, chat, or any project management tool.

## Skills

| Skill | Command | Sprint Phase | What it does |
|-------|---------|-------------|--------------|
| Test Plan | `/test-plan` | Epic created | Build test plan from epic: strategy, automation gaps, success criteria, risks |
| Review Ticket | `/review-ticket` | Grooming / Refinement | Audit ticket for testability, AC gaps, missing edge cases, blockers |
| Test Cases | `/test-cases` | Sprint execution | Generate e2e test cases + unit test checklist from ticket ACs |
| QA | `/qa` | Feature ready | Execute test cases, verify ACs in browser, file bugs |
| Verify Fix | `/verify-fix` | Bug fixed | Re-test a bug fix, check regressions, update bug status |
| Sprint Status | `/sprint-status` | Mid-sprint | Cross-feature dashboard: tested, blocked, coverage gaps |
| Exploratory | `/exploratory` | Feature ready | Guided exploratory testing session with charter and findings |
| Improve | `/improve` | After any skill | Analyze skill failure, propose and apply fix, create PR |
| Eval | `/eval` | After /improve | Run eval fixtures against a skill to verify correctness |
| Setup | `/setup` | First run | Configure context source, team mode, project preferences |
| Start | `/start` | Epic created | Guided workflow: setup → test plan → reviews → test cases |

## Routing

Invoke skills based on what the user says:

- "test plan", "plan tests for this epic", "test strategy" -> `/test-plan`
- "review this ticket", "check ACs", "testability review", "grooming" -> `/review-ticket`
- "write test cases", "generate tests", "e2e tests for this" -> `/test-cases`
- "qa", "test this ticket", "run test cases", "verify ACs", "does this pass?" -> `/qa`
- "verify fix", "retest", "is this fixed?", "check BUG-123" -> `/verify-fix`
- "sprint status", "what's tested", "coverage check" -> `/sprint-status`
- "exploratory test", "explore this feature", "charter for testing" -> `/exploratory`
- "this didn't work", "improve this skill", "fix the skill", "output was wrong" -> `/improve`
- "eval", "run evals", "test skill", "check fixtures", "regression test" -> `/eval`
- "setup", "configure", "first time", "change settings" -> `/setup`
- "start", "begin", "guided qa", "qa workflow", "new epic" -> `/start`

## Process Context

**Methodology:** Agile Scrum, 2-week sprints
**Task management:** Jira via Atlassian MCP (preferred), or manual context (files, chat)
**Documentation:** Confluence (via Atlassian MCP)
**E2E tests:** Playwright (lives in app repo)
**API tests:** RestAssured (lives in app repo)
**Unit tests:** Developer-owned (lives in app repo)
**CI triggers:** Tests run on PR, merge to develop, merge to main
**Release model:** Features can merge to main without releasing to customers

## Tool Priority

{{TOOL_PRIORITY}}

## Output Locations

### QA Reports
```
.qa-reports/
  qa-report-{TICKET-KEY}-{YYYY-MM-DD}.md
  screenshots/
```

### Test Knowledge Base (feature knowledge base)

Full specification: `{{REFERENCE_PATH}}/feature-knowledge-base-spec.md`

```
features-kb/
  config.json                          # KB configuration
  index.json                           # Feature index for fast lookup
  features/{EPIC-KEY}/
    feature.md                         # Consolidated feature context
    test-plan.md                       # Test plan
    tickets/{TICKET-KEY}.md            # Per-ticket context
    test-cases/{TICKET-KEY}.md         # Test cases
    test-cases/{TICKET-KEY}-mapping.json  # Requirements traceability
    reviews/{TICKET-KEY}-review.md     # Ticket reviews
    qa-reports/{TICKET-KEY}-{DATE}.md  # QA reports
  relations/
    feature-map.json                   # Feature dependency graph
    regression-map.json                # Regression test mapping
```

**Read/Write protocol:** Skills check KB first, query Jira (if available) only for missing
or stale data (>24 hours). Skills that create artifacts write back to KB.
See spec §6 for details.

**Storage location:** Configurable. Defaults to `features-kb/` in repo root.

## SDT Playbook

Shared methodology reference split into focused files at `{{REFERENCE_PATH}}/playbook/`:

| File | Covers |
|------|--------|
| `terminology.md` | Normalized terms across all output |
| `risk-and-priority.md` | Severity/priority scales, effort allocation, decision matrix |
| `metrics-and-coverage.md` | Code coverage targets, requirements coverage |
| `shift-left.md` | Challenge requirements early, verify alignment |
| `test-distribution.md` | Test pyramid/diamond, deduplication rules |
| `test-types.md` | Manual vs automation, UAT vs functional, exploratory |
| `execution-sequence.md` | Testing order through the sprint |
| `defect-lifecycle.md` | Bug states, SLA expectations, regression test requirements |
| `maintenance-and-ci.md` | Flaky tests, time budget, CI gates, browser matrix |

Each skill references only the files it needs — see the skill's methodology reference line.

## Testing Conventions

- Execute test cases from KB before ad-hoc testing
- File bugs (Jira if available, otherwise structured markdown in KB)
- Verify fixes via `/verify-fix` before closing bugs
- Flag missing regression tests during fix verification
- Generate unit test checklists for developers alongside e2e test cases
