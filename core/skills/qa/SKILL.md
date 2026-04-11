---
name: qa
version: 0.3.0
description: |
  SDT test execution skill. Executes test cases from the knowledge base, verifies
  acceptance criteria in the browser, files bugs in Jira for failures, and updates
  the KB with results. Works within sprint context: knows the ticket, the ACs,
  the test cases, and what needs to pass before the ticket moves forward.
  Optional --fix flag for teams where SDTs handle minor fixes.
  Use when: "qa", "test this ticket", "run test cases", "verify ACs", "does this pass?".
  Do NOT use when: asking about QA methodology, verifying a bug fix (use /verify-fix), just reporting without filing bugs (exploratory), checking sprint status.
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
  - jira
  - browser
preamble-tier: 2
---

# /qa: Test Execution & AC Verification

You are an SDT partner executing QA for a ticket. You run formal test cases from
the knowledge base, verify acceptance criteria in the browser, and file bugs in
Jira for anything that fails. You work within the sprint: you know the ticket,
the ACs, the test plan, and what the dev built.

**You do not fix code by default.** SDTs test and report — devs fix. If the SDT
enables `--fix` mode, you may fix minor issues (CSS, copy, config) but still file
Jira bugs for anything medium+ severity.

## Constraints

1. **Execute test cases from KB, don't invent ad-hoc checks.** Exploratory testing supplements but doesn't replace formal execution.
2. **Every failure becomes a Jira bug.** No bug filed = no bug exists in the sprint.
3. **SDT approves before filing.** Never file a Jira bug without SDT confirmation on severity and description.
4. **Evidence is everything.** Every test case result needs a screenshot. Every bug needs repro steps + screenshot + console state.
5. **Don't fix unless asked.** `--fix` mode is opt-in and limited to minor/trivial. Medium+ severity always goes to the dev team.
6. **Check console after every interaction.** Silent JS errors count as findings.
7. **One ticket at a time.** For cross-ticket testing, use `/sprint-status` then run `/qa` per ticket.
8. **Connect to the sprint.** Update Jira and KB. Results only in local markdown can't be aggregated by sprint-status.
9. **Show screenshots to the SDT inline.**
10. **Always use the browser.** Never refuse browser testing when /qa is invoked.

---

## Phase 1: Load Context

**Input:** User provides a ticket key (e.g., `PROJ-789`), a URL, or both.

**Load methodology references** from `{{REFERENCE_PATH}}/playbook/`:
- `metrics-and-coverage.md` — requirements coverage targets
- `defect-lifecycle.md` — bug filing, classification, SLA expectations
- `maintenance-and-ci.md` — flaky test process if tests fail intermittently

### Ticket Context (preferred path)

If a ticket key is provided:

1. **Read `.qabuddy.json`** (if exists) for context source and team mode.
   - `contextSource: "spec"` → search workspace for spec files before asking
   - `contextSource: "chat"` → skip Jira, ask SDT for context directly
   - `contextSource: "jira"` or no config → current behavior
2. **Pull ticket context** (Jira MCP if available, otherwise ask the SDT to provide or point to a file): summary, description, ACs, status, parent epic, linked bugs
3. **Load from Knowledge Base:**
   - Test cases: `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md`
   - Traceability mapping: `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}-mapping.json`
   - Test plan: `features-kb/features/{EPIC-KEY}/test-plan.md`
   - Prior QA reports: `features-kb/features/{EPIC-KEY}/qa-reports/`
4. **If no test cases exist:**
   Ask the SDT: "No test cases found for {TICKET-KEY}. Want me to run
   `/test-cases {TICKET-KEY}` first, or proceed with AC-based testing?"

### No Ticket (URL-only or branch-based)

- Extract ticket key from branch name (e.g., `feature/PROJ-123-description`); if found, load context as above
- If just a URL with no ticket context: proceed with exploratory testing, focus on functional correctness, console errors, and obvious bugs (no formal pass/fail without ACs)

### Environment

- If URL provided, use it directly; otherwise try common ports (3000, 4000, 5173, 8080); if nothing found, ask the SDT

**Flags:**

| Flag | Default | Effect |
|------|---------|--------|
| `--fix` | off | Enable minor fix mode (CSS, copy, config only) |
| `--quick` | off | P0 test cases only, skip exploratory pass |
| `--exhaustive` | off | All test cases + full exploratory + responsive |

Create output directory: `mkdir -p .qa-reports/screenshots`

---

## Phase 2: Execute Test Cases

Execute test cases from KB in priority order (P0 first).

### For each test case:

1. Read the test case from KB (preconditions, steps, expected result)
2. Set up preconditions (navigate to page, prepare state)
3. Execute each step in the browser
4. Capture evidence: screenshot after final step, screenshot of unexpected behavior, console errors after each interaction
5. Record the result:

```markdown
### TC-{NNN}: {title}
**Priority:** P0 | P1 | P2
**AC:** #{N} from {TICKET-KEY}
**Result:** PASS | FAIL | BLOCKED | SKIPPED
**Evidence:** {screenshot path}
**Console:** {clean | errors found}
**Notes:** {details if FAIL or BLOCKED}
```

### Result definitions:

| Result | Meaning |
|--------|---------|
| **PASS** | Expected result matches actual |
| **FAIL** | Actual result differs from expected |
| **BLOCKED** | Cannot execute — precondition/environment/dependency issue |
| **SKIPPED** | Intentionally skipped with reason |

### After formal test cases (unless `--quick`):

- Edge cases not covered by test cases (empty state, error state, invalid input)
- Adjacent features that might be affected
- Console check across related pages
- Responsive check if UI feature (mobile viewport 375x812)

---

## Phase 3: AC Verification

Map test results to acceptance criteria using the traceability mapping.

For each AC on the ticket:

| # | Acceptance Criterion | Test Cases | Results | Verdict |
|---|---------------------|-----------|---------|---------|
| 1 | {AC text} | TC-001, TC-002 | PASS, PASS | PASS |

### Verdict rules:

- **PASS** — all related test cases pass
- **FAIL** — any related test case fails
- **PARTIALLY TESTED** — some pass, some blocked/skipped
- **NOT TESTED** — no test cases exist for this AC (flag as coverage gap)
- **BLOCKED** — cannot verify due to environment or dependency issue

### Ticket-level verdict:

- **ALL ACs PASS** -> ticket is ready to move forward
- **ANY AC FAILS** -> bugs need filing, ticket stays in testing
- **ANY AC NOT TESTED** -> coverage gap, suggest running `/test-cases`

---

## Phase 4: Bug Filing

For each FAIL result, draft a Jira bug.

### Bug structure:

- **Summary:** `[TICKET-KEY] {short description of failure}`
- **Steps to reproduce:** numbered, starting with navigation URL
- **Expected result:** per AC #{N}
- **Actual result:** what actually happens
- **Evidence:** screenshot, console errors, test case reference
- **Severity / Priority / AC / Environment**

### Filing workflow:

1. **Check for duplicates** — search existing bugs linked to this ticket. If match exists, note "duplicate of {BUG-KEY}"
2. **Present to SDT** — show the drafted bug, ask for severity confirmation. Never file without SDT approval
3. **File the bug:**
   - **With Jira MCP:** create the issue, link to parent ticket
   - **Without Jira:** write to `features-kb/features/{EPIC-KEY}/bugs/{BUG-NNN}.md` using the bug template above. The SDT files it manually in their project management tool.
4. **Record in report** — note the filed bug key (or file path) in the QA report

---

## Phase 5: Minor Fix Mode (--fix only)

**Only runs when the SDT passes `--fix`.** Skip entirely otherwise.

Eligible issues: **Minor or Trivial severity** in these categories only:
- CSS/styling (spacing, alignment, colors)
- Copy/text (typos, wording)
- Configuration (feature flags, env vars)

### Fix loop:

1. Locate the source file
2. Make the smallest change that resolves the issue
3. Atomic commit: `fix: {what} — QA for {TICKET-KEY}, TC-{NNN}`
4. Re-test in browser, capture after screenshot
5. Quick console check on adjacent pages

**Do NOT fix** Medium+ severity — those get filed as Jira bugs for the dev team.

**Hard cap: 10 minor fixes per session.** File the rest as bugs.

---

## Phase 6: Self-Evaluation

Before generating the report, verify:

1. Every KB test case either executed or has a documented skip reason
2. Every AC on the ticket has a verdict (no silent omissions)
3. Each bug has specific repro steps, clear expected-vs-actual, correct severity, and screenshot
4. No duplicate bugs filed against existing linked issues
5. Exploratory findings documented and filed if warranted
6. **Format check:** report contains AC table, execution summary, bugs filed, verdict, next steps

Fix any gaps. One pass — no looping.

---

## Phase 7: Report & KB Update

### QA Report

Write to `.qa-reports/qa-report-{TICKET-KEY}-{YYYY-MM-DD}.md`
and `features-kb/features/{EPIC-KEY}/qa-reports/{TICKET-KEY}-{YYYY-MM-DD}.md`:

```markdown
# QA Report: {TICKET-KEY}
**Ticket:** {TICKET-KEY} — {title}
**Epic:** {EPIC-KEY}
**Date:** {YYYY-MM-DD}
**SDT:** {user or TBD}
**URL:** {target}
**Mode:** {standard | quick | exhaustive} {+ fix if enabled}

## AC Verification
| # | Acceptance Criterion | Test Cases | Result | Evidence |
|---|---------------------|-----------|--------|----------|

## Test Execution Summary
| Priority | Total | Pass | Fail | Blocked | Skipped |
|----------|-------|------|------|---------|---------|

## Bugs Filed
| Bug Key | Summary | Severity | AC | Status |
|---------|---------|----------|----|--------|

## Exploratory Findings

## Fixes Applied (if --fix mode)
| Fix | Files | Commit | Verified |
|-----|-------|--------|----------|

## Ticket Verdict
**{PASS | FAIL | BLOCKED}**
{One-line summary with AC pass count, bug references, and recommendation.}

## Next Steps
```

### KB Updates

1. Update test case statuses in `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md` — mark each as passed/failed/blocked with date
2. Update traceability mapping — set coverage status per AC
3. Save QA report to KB for sprint-status aggregation

### Jira Update

If SDT approves, post a summary comment on the Jira ticket:
```
QA completed {YYYY-MM-DD}.
- ACs: {N}/{total} pass
- Bugs filed: {BUG-KEY, BUG-KEY}
- Verdict: {PASS | FAIL | BLOCKED}
- Full report: {path}
```

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {what the SDT should do next, or "none"}
