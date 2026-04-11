# QABuddy — Behavioral Test Plan

Manual test scenarios for verifying skills produce correct output.
Run these after structural tests pass (`node test.js`).

**How to use:** Run each scenario, check the expected results. Mark PASS/FAIL.
After making skill changes, re-run affected scenarios as regression tests.

---

## Setup & Config

### BT-001: First-run setup wizard
**Skill:** `/qa-setup`
**Preconditions:** No `.qabuddy.json` in project root

1. Run `/qa-setup`
2. Select context source: Chat
3. Select team mode: Solo
4. Approve the config

**Expected:**
- [ ] Wizard asks context source with (A)/(B)/(C)/(D) options
- [ ] Wizard asks team mode with (A)/(B) options
- [ ] `.qabuddy.json` created at project root with correct values
- [ ] For non-Jira mode: explains KB naming with slugs
- [ ] Suggests `/qa-start` as next step
- [ ] Ends with completion status block (DONE)

### BT-002: Reconfigure existing setup
**Skill:** `/qa-setup`
**Preconditions:** `.qabuddy.json` exists

1. Run `/qa-setup`
2. Observe it shows current config
3. Choose to reconfigure

**Expected:**
- [ ] Shows current config before asking to reconfigure
- [ ] Offers (A) Reconfigure / (B) Keep options
- [ ] After reconfigure: `.qabuddy.json` updated, not duplicated

### BT-003: Config injection via preamble
**Preconditions:** `.qabuddy.json` exists with `contextSource: "spec"`

1. Run any skill (e.g., `/qa-review-ticket`)
2. Provide a feature slug instead of a Jira key

**Expected:**
- [ ] Skill reads `.qabuddy.json` at start
- [ ] Does NOT attempt Jira MCP queries
- [ ] Asks for context via files or paste (spec mode)

---

## Guided Workflow

### BT-010: Full orchestrated flow (chat mode)
**Skill:** `/qa-start`
**Preconditions:** `.qabuddy.json` with `contextSource: "chat"`, no existing KB

1. Run `/qa-start auth-system`
2. When asked for context, paste a feature description with 3 stories and ACs

**Expected:**
- [ ] Phase 1: reads config, no Jira attempt
- [ ] Phase 1: pauses and asks to proceed
- [ ] Phase 2: drafts test plan from pasted context
- [ ] Phase 2: creates `features-kb/features/auth-system/feature.md`
- [ ] Phase 2: creates `features-kb/features/auth-system/test-plan.md`
- [ ] Phase 2: pauses for review with (A)/(B)/(C) options
- [ ] Phase 3: skipped (not Jira mode), SDT informed
- [ ] Phase 4: generates test cases for each story
- [ ] Phase 4: pauses for review
- [ ] Phase 5: shows summary with coverage stats
- [ ] Workflow state saved to `features-kb/index.json`

### BT-011: Workflow resume after interruption
**Skill:** `/qa-start`
**Preconditions:** BT-010 completed Phase 2 but interrupted before Phase 4

1. Run `/qa-start auth-system` again

**Expected:**
- [ ] Detects prior workflow state from `features-kb/index.json`
- [ ] Offers: (A) Resume from where we left off, (B) Start fresh
- [ ] If resume: skips completed phases, starts from next incomplete phase

### BT-012: Tool feedback at pause point
**Skill:** `/qa-start`
**Preconditions:** During any phase's pause point

1. At a pause, select (C) Tool feedback
2. Describe an issue: "The test plan included inferred test status"

**Expected:**
- [ ] AI asks what went wrong and what was expected
- [ ] AI reads the skill source from `core/skills/`
- [ ] AI reads CONTRIBUTING.md
- [ ] AI proposes a fix with specific changes
- [ ] After approval: edits the skill, runs `node build.js all`
- [ ] Resumes workflow from the same pause point

---

## Individual Skills

### BT-020: Test plan with resolved tickets
**Skill:** `/qa-test-plan`
**Preconditions:** Epic with mix of open and resolved stories

1. Run `/qa-test-plan EPIC-KEY`

**Expected:**
- [ ] Pulls epic and all linked stories
- [ ] For resolved stories: inspects codebase via git log/diff for test evidence
- [ ] Unit Test Checklist uses only: Confirmed (with path), Unverified, Pending, Blocked
- [ ] No "Done (in PR)" or inferred status
- [ ] Gap Analysis "Current Coverage" only claims verified coverage
- [ ] `feature.md` created BEFORE test plan is drafted (Phase 1, not Phase 5)
- [ ] `feature.md` has capabilities grouped by story with consolidated ACs
- [ ] Self-evaluation runs and catches any violations

### BT-021: Review ticket — READY verdict
**Skill:** `/qa-review-ticket`
**Preconditions:** Ticket with clear, complete ACs

1. Run `/qa-review-ticket TICKET-KEY`

**Expected:**
- [ ] Pulls ticket context
- [ ] Testability audit covers: AC completeness, missing scenarios, testability, blockers
- [ ] Verdict is READY (no must-have gaps, no blockers)
- [ ] Self-evaluation verifies verdict matches findings
- [ ] Suggests `/qa-test-cases` as next step
- [ ] Saves to `features-kb/features/{EPIC}/reviews/{TICKET}-review.md`

### BT-022: Review ticket — NEEDS WORK verdict
**Skill:** `/qa-review-ticket`
**Preconditions:** Ticket with vague or missing ACs

1. Run `/qa-review-ticket TICKET-KEY`

**Expected:**
- [ ] Identifies specific AC gaps
- [ ] Missing scenarios in Given/When/Then format (not vague)
- [ ] Verdict is NEEDS WORK
- [ ] Self-evaluation checks: not over-flagging, verdict consistent with findings

### BT-023: Test cases with traceability
**Skill:** `/qa-test-cases`
**Preconditions:** Ticket with ACs, existing test plan in KB

1. Run `/qa-test-cases TICKET-KEY`

**Expected:**
- [ ] Reads existing Playwright tests for style matching
- [ ] Generates E2E test cases with Playwright sketches
- [ ] Generates unit test checklist
- [ ] Creates traceability mapping (AC → test cases)
- [ ] No duplicate tests against existing coverage
- [ ] P0/P1/P2 distribution reasonable (not everything P0)
- [ ] Self-evaluation verifies traceability integrity
- [ ] Saves to `features-kb/features/{EPIC}/test-cases/{TICKET}.md` + mapping JSON

### BT-024: QA execution with bug filing
**Skill:** `/qa-qa`
**Preconditions:** Test cases exist in KB, app running

1. Run `/qa-qa TICKET-KEY`

**Expected:**
- [ ] Reads test cases from KB (not ad-hoc)
- [ ] Executes test cases in priority order (P0 first)
- [ ] Each test case gets: PASS/FAIL/BLOCKED/SKIPPED with evidence
- [ ] AC verification table maps results to ACs
- [ ] For each FAIL: drafts Jira bug (or KB bug file if no Jira)
- [ ] Presents bugs to SDT for approval before filing
- [ ] Report saved to both `.qa-reports/` and `features-kb/`

### BT-025: Verify fix — VERIFIED
**Skill:** `/qa-verify-fix`
**Preconditions:** Bug exists, fix deployed

1. Run `/qa-verify-fix BUG-KEY`

**Expected:**
- [ ] Pulls original bug repro steps
- [ ] Re-executes exact repro steps
- [ ] Captures before/after screenshots
- [ ] Regression check on related functionality
- [ ] Verdict: VERIFIED
- [ ] Flags missing regression test if none found
- [ ] Updates bug status (Jira or KB file)

### BT-026: Verify fix — FAILED
**Skill:** `/qa-verify-fix`
**Preconditions:** Bug exists, fix supposedly deployed but still reproduces

1. Run `/qa-verify-fix BUG-KEY`

**Expected:**
- [ ] Bug still reproduces
- [ ] Captures new evidence
- [ ] Verdict: FAILED
- [ ] Reopens bug with new evidence
- [ ] Does NOT attempt to fix the code

### BT-027: Sprint status with metrics
**Skill:** `/qa-sprint-status`
**Preconditions:** Multiple tickets with varying test status, some bugs filed

1. Run `/qa-sprint-status`

**Expected:**
- [ ] Pulls all sprint tickets
- [ ] Per-ticket status table with correct test status
- [ ] Bug tracker table with verify-fix verdicts
- [ ] Sprint Quality Metrics section with all 6 metrics (or N/A with reason)
- [ ] Confidence score matches the data
- [ ] Recommendations reference specific `/skill` commands

### BT-029: Exploratory testing session
**Skill:** `/qa-exploratory`
**Preconditions:** Feature ready, app running

1. Run `/qa-exploratory EPIC-KEY`

**Expected:**
- [ ] Generates charter with heuristic-based focus areas
- [ ] Presents charter for SDT approval before starting
- [ ] Explores systematically per focus area
- [ ] Documents findings with category, severity, evidence
- [ ] Self-evaluation: charter coverage, dedup against KB, classification consistency
- [ ] Report with recommendation (proceed/another session/blocked)

---

## Self-Improvement

### BT-030: Standalone /improve
**Skill:** `/qa-improve`
**Preconditions:** A skill that produced incorrect output in a previous run

1. Run `/qa-improve`
2. Describe what went wrong

**Expected:**
- [ ] Asks which skill, what happened, what was expected
- [ ] Reads the skill source from `core/skills/`
- [ ] Classifies root cause (missing constraint, wrong phase order, etc.)
- [ ] Generates structured improvement proposal
- [ ] Applies fix after approval
- [ ] Bumps version
- [ ] Runs `node build.js all`
- [ ] Offers: (A) PR, (B) Local, (C) Review only

### BT-031: Team practices integration
**Skill:** Any skill after team practices configured
**Preconditions:** `features-kb/team-practices/bug-triage.md` exists

1. Run `/qa-qa` and find a bug

**Expected:**
- [ ] Bug filing follows the team's triage process from `bug-triage.md`
- [ ] If no practice file exists: asks SDT case-by-case instead

---

## Backward Compatibility

### BT-040: Skills work without config
**Preconditions:** Delete `.qabuddy.json`, no hooks configured

1. Run `/qa-review-ticket` with a Jira ticket key

**Expected:**
- [ ] Skill works normally (tries Jira MCP, falls back to asking)
- [ ] No errors about missing config
- [ ] Full output produced with all sections

### BT-041: Skills work without KB
**Preconditions:** No `features-kb/` directory

1. Run `/qa-test-plan EPIC-KEY`

**Expected:**
- [ ] Creates `features-kb/` structure automatically
- [ ] Test plan produced and saved
- [ ] No errors about missing KB
