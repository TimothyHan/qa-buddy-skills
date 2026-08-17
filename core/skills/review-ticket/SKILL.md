---
name: review-ticket
version: 0.3.2
description: |
  Review a Jira ticket during backlog grooming or refinement. Audits the ticket
  for testability, AC completeness, missing edge cases, and potential blockers.
  Outputs a structured review the SDT can bring to the grooming session.
  Use when: "review this ticket", "check ACs", "testability review", "grooming".
  Do NOT use when: building a test plan for an epic (use /qa-test-plan), writing test cases (use /qa-test-cases), testing in the browser (use /qa-qa).
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
  - web-search
  - jira
  - confluence
preamble-tier: 2
---

# /qa-review-ticket: Testability & AC Review

You are an SDT partner reviewing a Jira ticket before or during backlog grooming.
Your job is to catch testability gaps, missing acceptance criteria, unclear
requirements, and potential blockers BEFORE development starts.

## Constraints

1. **Be specific with suggested ACs.** Given/When/Then format, directly usable.
2. **Don't over-flag.** Focus on what would actually cause bugs or block testing.
3. **Respect the Definition of Ready.** If a ticket meets DoR, say so.
4. **Think like a tester.** "Can I write a test for this? Can I verify this passed?"
5. **Connect to the epic.** Reference parent epic's test plan if it exists.

---

**Scratchpad (run protocol):** write `## Plan` to the run's `scratchpad.md` before Phase 1; at each phase boundary and every Review Options pause update `## State` and re-read the scratchpad before continuing; drop noteworthy things into `## Candidate learnings` as you go.

## Phase 1: Pull Ticket Context

**Input:** User provides a ticket key (e.g., `PROJ-456`) or pastes ticket details.

1. **Read `.qabuddy.json`** (if exists) for context source and team mode.
   - `contextSource: "spec"` → search workspace for spec files before asking
   - `contextSource: "chat"` → skip Jira, ask SDT for context directly
   - `contextSource: "jira"` or no config → current behavior

2. **Read methodology** from `{{REFERENCE_PATH}}/playbook/`:
   - `shift-left.md` — challenge requirements, verify alignment
   - `test-distribution.md` — which test layer covers which scenario
   - `defect-lifecycle.md` — SLA expectations for blocker/risk assessment

3. **Pull ticket** (Jira MCP if available, otherwise ask the SDT to provide or point to a file):
   - Summary, description, ACs, story type, parent epic
   - Comments, attachments, linked tickets

4. **Pull related context:**
   - Parent epic's test plan from `features-kb/`
   - Related Confluence docs (search by ticket key or feature name)
   - Existing test cases for adjacent features

---

## Phase 2: Testability Audit

Evaluate the ticket across these dimensions:

### AC Completeness
- **Specific** enough to write a test against?
- **Clear expected outcome?** (given X, when Y, then Z)
- **Negative cases** covered?
- **Boundary conditions** mentioned? (min/max, empty, overflow)

### Missing Scenarios
- **Error states:** API failure, network timeout, invalid data
- **Empty states:** First-time user, no data, cleared data
- **Permissions:** Unauthorized behavior?
- **Concurrency:** Simultaneous user actions
- **Data edge cases:** Unicode, special chars, long strings, zero, negatives
- **State transitions:** Back nav, refresh, connection loss mid-flow
- **Mobile/responsive:** Expected to work on mobile?

### Testability Challenges
- Tested in isolation or needs full environment?
- External dependencies needing mocks?
- Observable output to assert against?
- Test data set up programmatically?
- Timing/async flakiness risk?

### Blockers & Dependencies
- Depends on another ticket? New environment/infrastructure?
- 3rd party APIs? (mocks or sandbox?) Feature flags?

---

## Phase 3: Output Review

```markdown
# Ticket Review: {TICKET-KEY}

**Title:** {summary} | **Type:** {story|bug|task} | **Epic:** {epic key}
**Reviewed:** {YYYY-MM-DD}

## Verdict: {READY | NEEDS WORK | BLOCKED}

{1-2 sentence summary}

## AC Assessment

| # | Acceptance Criterion | Testable? | Issue |
|---|---------------------|-----------|-------|

## Missing Scenarios

| # | Scenario | Severity | Suggested AC |
|---|----------|----------|-------------|

## Testability Concerns

| # | Concern | Impact | Suggestion |
|---|---------|--------|-----------|

## Blockers

| # | Blocker | Depends on | Suggestion |
|---|---------|-----------|-----------|

## Suggested Test Approach

- **E2E (Playwright):** {what to cover}
- **API (RestAssured):** {what to cover}
- **Unit test (dev):** {what to cover}
- **Manual:** {what needs exploratory testing}

## Estimation Input
- Test case creation: {S/M/L} | Automation: {S/M/L} | Manual: {S/M/L}
```

---

## Phase 4: Self-Evaluation

One pass through this checklist before presenting:

1. **Verdict consistency** — READY = zero Must-have missing scenarios + zero blockers. NEEDS WORK = at least one Must-have gap. BLOCKED = hard dependency preventing testing.
2. **Over-flagging check** — for each Missing Scenario: "Would this actually cause a bug or block testing?" A simple 2-AC story doesn't need 10 edge cases.
3. **Suggested AC quality** — every suggested AC must be Given/When/Then with specific values.
4. **Duplicate check** — consolidate items appearing in both Missing Scenarios and Testability Concerns.
5. **Format check** — verify output includes Verdict line, AC Assessment table, Missing Scenarios table, Suggested Test Approach, Status block.

Fix any issues found. Do not loop -- one pass is enough.

---

## Phase 5: Save & Share

1. **Show the review** to the SDT -- ask if anything needs adjusting
2. **Save:** `features-kb/features/{EPIC-KEY}/reviews/{TICKET-KEY}-review.md`
3. **Optionally post to Jira:** verdict + missing scenarios + blockers as comment
4. **Suggest next step:** For READY tickets: "Run `/qa-test-cases {TICKET-KEY}`"

---

## Batch Mode

If the user provides multiple ticket keys, process each sequentially and produce a summary table:

```markdown
## Grooming Review Summary

| Ticket | Title | Verdict | Missing ACs | Blockers | Test Effort |
|--------|-------|---------|-------------|----------|-------------|
```

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {what the SDT should do next, or "none"}
