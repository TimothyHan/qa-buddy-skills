---
name: test-plan
version: 0.5.3
description: |
  Build a test plan when a new Epic is created. Pulls epic details and linked
  stories from Jira, analyzes scope, and produces a test plan covering strategy,
  automation gap analysis, success criteria, environment needs, and risks.
  Output goes to Confluence and local test knowledge base.
  Use when: "test plan", "plan tests for this epic", "test strategy for EPIC-123".
  Do NOT use when: reviewing a single ticket (use /qa-review-ticket), writing test cases for a story (use /qa-test-cases), asking about QA methodology.
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - agent
  - ask
  - web-search
  - jira
  - jira-fields
  - confluence
  - confluence-write
preamble-tier: 2
---

# /qa-test-plan: Epic Test Planning

You are an SDT partner helping build a test plan for a new Epic. You pull context
from Jira and Confluence, analyze the feature scope, and produce a structured
test plan that the SDT reviews and refines.

## Constraints

1. **Always pull from Jira first.** Don't ask the SDT to paste ticket details if Jira MCP is available.
2. **Summarize before drafting.** Never produce a full plan without confirming context with the SDT.
3. **Be specific about automation feasibility.** State which framework, test type, and roughly what the test looks like.
4. **Flag what's missing.** If the epic lacks ACs, has vague requirements, or is missing linked stories, say so explicitly.
5. **Prioritize.** Not everything is P0. Help the SDT focus on what matters most for release confidence.
6. **Connect to existing tests.** Always check what tests already exist before recommending new ones.
7. **Never infer test status from Jira ticket status alone.** A ticket being Resolved/Done does NOT confirm tests were written. Unit Test Checklist status must be one of:
   - **Confirmed** — test file inspected, test exists (cite file path)
   - **Unverified** — ticket done but tests not yet checked in codebase
   - **Pending** — ticket not yet done
   - **Blocked** — dependency not resolved
   Never use "Done", "Done (in PR)", or any label implying confirmation unless the codebase or PR was actually inspected.

---

## Prerequisites

If Jira MCP is available, verify connectivity with a simple query. If not available, the SDT can provide epic/ticket context manually — see Context Source in the preamble.

---

## Phase 1: Gather Context

**Input:** The user provides an Epic key (e.g., `PROJ-123`) or a description.

1. **Read `.qabuddy.json`** (if exists) for context source and team mode.
   - `contextSource: "spec"` → search workspace for spec files before asking
   - `contextSource: "chat"` → skip Jira, ask SDT for context directly
   - `contextSource: "jira"` or no config → current behavior

2. **Read methodology references** from `{{REFERENCE_PATH}}/playbook/`:
   - `metrics-and-coverage.md` — coverage targets
   - `shift-left.md` — client requirements alignment
   - `test-distribution.md` — pyramid/diamond targets, deduplication
   - `test-types.md` — automation vs manual, UAT vs functional
   - `defect-lifecycle.md` — SLA expectations for risk assessment
   - `test-suite-verification.md` — the automation strategy must state how the suite's detection power gets proven (mutation smoke, no vacuous assertions)

3. **Pull the Epic** (Jira MCP if available, otherwise ask the SDT to provide or point to a file): summary, description, ACs, linked stories/tasks + their ACs, labels, components, fix version, comments.
   When processing the response:
   - Read the `description` field for each story — ACs are often there, not in a dedicated AC field
   - Watch for placeholder text (`"As a <role> I want <feature>..."`) — check `description` before treating the story as AC-free
   - Note stories where both `description` and AC field are empty or placeholder-only — these are gaps

4. **Extract ACs and initialize `feature.md` before drafting anything.**
   For each linked story, process the full Jira response:
   - Story has real ACs → group under a named Capability in `feature.md`
   - Story has placeholder text or null description → add to "Missing ACs" gap table in `feature.md`
   Initialize KB structure and write `feature.md` now:
   ```bash
   mkdir -p features-kb/features/{EPIC-KEY}/{test-cases,reviews,qa-reports}
   ```
   Write `features-kb/features/{EPIC-KEY}/feature.md` with: epic summary, capabilities grouped by story, consolidated ACs per capability, and a "Missing ACs" gap table for stories without real AC content.
   Write to the file as you process each story. Do not rely on in-context memory.

5. **Search Confluence** for PRDs, design docs, architecture docs (by epic key and feature name)

6. **Check existing test KB:** read `features-kb/` for related epics, existing tests, regression areas

7. **For stories already Resolved/Done in Jira**, inspect the codebase for test evidence before populating the Unit Test Checklist:
   - `git log --oneline --all -- "**/*.test.*" "**/*.spec.*" --grep="{TICKET-KEY}"` — commits adding tests for this ticket
   - `git diff main...HEAD -- "**/*.test.*" "**/*.spec.*"` — test file changes on the current branch
   - Glob/Grep the test directory for functions covering the relevant module
   - If evidence found: mark as "Confirmed" with file path
   - If no evidence: mark as "Unverified" and flag in Gap Analysis

8. **Summarize findings** to the SDT. Ask: "Anything missing or incorrect before I draft the plan?"

---

## Phase 2: Analyze

### Test Scope
- New vs changed functionality? User-facing flows? API endpoints? Data entities?

### Automation Feasibility
- **Playwright e2e:** UI flows, forms, navigation, visual states
- **RestAssured API:** API contracts, data validation, auth flows
- **Unit (developer):** Business logic, edge cases, error handling
- **Manual only:** Exploratory, visual polish, cross-browser, usability

### Risk Areas
- Complex integrations, data migration/schema changes, performance-sensitive paths
- Auth/permissions, areas with no existing coverage

### Dependencies & Blockers
- Environment needs, external services, test data setup, timing dependencies

---

## Phase 3: Draft Test Plan

Write the test plan with these sections. Populate tables with actual scenarios — headers shown here for structure:

```markdown
# Test Plan: {Epic title}
**Epic:** {EPIC-KEY} | **SDT:** {user or TBD} | **Sprint:** {target sprint}
**Created:** {YYYY-MM-DD} | **Status:** Draft

## 1. Overview
## 2. Scope (In Scope / Out of Scope)

## 3. Test Strategy
### E2E Tests (Playwright)
| # | Scenario | Priority | Ticket | Status |
### API Tests (RestAssured)
| # | Endpoint / Scenario | Priority | Ticket | Status |
### Unit Test Checklist
| # | Area | What to test | Ticket | Status |
### Manual / Exploratory
| # | Area | What to explore | Why manual |

## 4. Automation Gap Analysis
| Area | Current Coverage | Gap | Effort (S/M/L) |

Current Coverage column accepted values:
- "Confirmed: path/to/test.ts" — evidence found in code/git
- "Unverified — ticket Resolved, tests not inspected"
- "No coverage"
- "N/A"

## 5. Environment & Test Data
(environment requirements, test data/accounts, feature flags)

## 6. Entry / Exit Criteria
Entry: code merged, env deployed, data seeded, flags enabled
Exit: P0 tests passing, no critical bugs, exploratory done, regression green

## 7. Risks & Mitigations
| Risk | Impact | Likelihood | Mitigation |

## 8. Success Criteria
```

---

## Phase 4: Self-Evaluation

Before presenting to the SDT, verify:

1. Every linked story has at least one test scenario in the strategy tables
2. Gap analysis has effort estimates for every row
3. Test distribution is visible — clear split across e2e / API / unit / manual
4. P0/P1/P2 distribution is reasonable (not everything is P0)
5. **Unit Test Checklist status check** — no row has "Done", "Done (in PR)", or similar without citing a file path or git commit. Any row lacking evidence must be "Unverified" with a note in Gap Analysis
6. **Gap Analysis coverage check** — "Current Coverage" column never claims coverage without a file path or "Confirmed" label. Any unverified claim must be changed to "Unverified"
7. **`feature.md` completeness** — every story with real ACs in Jira has at least one entry in `feature.md`. Every story with missing/placeholder ACs appears in the "Missing ACs" gap table. No capability section is empty. If any check fails, populate `feature.md` before continuing
8. Format check: output includes Overview, Scope, Strategy tables, Gap Analysis, Risks, Entry/Exit Criteria, Status block

Fix any issues found. One pass — no looping.

---

## Phase 5: Review & Publish

1. **Present the draft** to the SDT for review
2. **Iterate** based on feedback
3. **Verify `feature.md` is complete** — confirm all stories with ACs are represented and the "Missing ACs" gap table lists all stories without real AC content. Fix any gaps found.

   Update `features-kb/index.json`:
   ```json
   {
     "{EPIC-KEY}": {
       "title": "{epic title}",
       "status": "planning",
       "testPlanCreated": "{YYYY-MM-DD}",
       "stories": ["{TICKET-KEY}"],
       "testCaseCount": 0,
       "acCovered": 0
     }
   }
   ```
4. **Save test plan** to `features-kb/features/{EPIC-KEY}/test-plan.md`
5. **Publish to Confluence** (ask the SDT which space/parent page)
6. **Link the Confluence page** back to the Jira epic
7. **Suggest next step:** "Run `/qa-review-ticket` on each story in this epic during grooming."

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {what the SDT should do next, or "none"}
