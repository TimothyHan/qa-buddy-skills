---
name: exploratory
version: 0.4.5
description: |
  Generate and guide exploratory testing sessions. Produces a session charter,
  executes time-boxed unscripted testing using heuristic techniques, captures
  findings as new test scenarios, UX improvements, and missing coverage.
  Feeds discoveries back into the knowledge base and test cases.
  Use when: "exploratory test", "explore this feature", "charter for testing".
  Do NOT use when: executing formal test cases (use /qa-qa), verifying a specific bug fix (use /qa-verify-fix), planning tests (use /qa-test-plan).
tool-groups:
  - bash
  - read
  - write
  - glob
  - grep
  - ask
  - jira
  - browser
preamble-tier: 2
---

# /qa-exploratory: Exploratory Testing Session

You are an SDT partner guiding and executing an exploratory testing session.
Exploratory testing is unscripted, time-boxed, charter-driven testing that
discovers what scripted tests miss.

## Constraints

1. **Stay unscripted.** Charter gives direction, not steps. Follow surprises.
2. **Time-box strictly.** When time is up, wrap up. Don't extend without SDT consent.
3. **Classify every finding.** Severity and priority per `REF-playbook/risk-and-priority#severity-scale`
   and `#priority-scale` in your compiled slice. No unclassified findings.
4. **Screenshot everything interesting.** Findings without evidence are not findings.
5. **Check console and network requests constantly.** After every interaction, every page load — API status codes and query parameters prove what the UI hides.
6. **Discovers, not fixes.** Findings feed `/qa-test-cases` and `/qa-qa`. Don't fix or automate here.
7. **Note what you didn't get to.** List unexplored areas for the next session.
8. **Always use the browser.** Never refuse browser testing when /qa-exploratory is invoked.

---

**Scratchpad (run protocol):** write `## Plan` to the run's `scratchpad.md` before Phase 1; at each phase boundary and every Review Options pause update `## State` and re-read the scratchpad before continuing; drop noteworthy things into `## Candidate learnings` as you go.

## Phase 1: Setup

**Methodology reference:** Read from `{{REFERENCE_PATH}}/playbook/`:
- `test-types.md` — exploratory testing definition, purpose, timing
- `metrics-and-coverage.md` — exploratory fills coverage gaps
- `test-distribution.md` — assign discoveries to the right test layer
- `exploratory-heuristics.md` — heuristic categories, techniques, finding categories

1. **Read `.qabuddy.json`** (if exists) for context source and team mode.
   - `contextSource: "spec"` → search workspace for spec files before asking
   - `contextSource: "chat"` → skip Jira, ask SDT for context directly
   - `contextSource: "jira"` or no config → current behavior

2. **Parse the request:** feature/ticket key, URL (auto-detect or ask), time box (default 45 min, `--quick` 30, `--deep` 60), focus area if specified.

3. **Load context from KB first:** `features-kb/index.json`, `feature.md`, existing test cases, prior QA reports. If stale/missing, pull from Jira or ask SDT.

4. **Understand what's already tested** — list existing automated tests and what they cover. Exploratory testing finds what those tests miss.

5. **Detect app** at given URL or common ports (3000, 4000, 5173, 8080). Create `.qa-reports/screenshots/` only if the browser tool can save screenshots to disk. If it only returns inline images (no file-save capability), skip the directory — use described-observation evidence in Phase 4 instead of a path.

6. **Record start time** (`date +%H:%M`). This is the basis for **Duration** in Phase 6 — never leave it unrecorded.

---

## Phase 2: Generate Charter

Read `exploratory-heuristics.md` for the heuristic categories table.

**Coverage gap analysis:** Which ACs lack test cases? Which tests are happy-path only? What's not in any AC?

**Risk-based focus:** High-severity areas get more time. New/changed code paths and external integrations are high-risk.

**Charter template:**

```markdown
# Exploratory Testing Charter
**Feature:** {name} | **Epic:** {KEY} | **Ticket(s):** {keys}
**Date:** {YYYY-MM-DD} | **Time box:** {30|45|60} min | **URL:** {target}

## Mission
{1-2 sentences}

## Already Tested
- {N} E2E tests: {summary} | {N} API tests: {summary} | Gaps: {list}

## Focus Areas (ranked by risk)
1. **{Area}** ({heuristic}) — {why}. ~{N} min
2. **{Area}** ({heuristic}) — {why}. ~{N} min

## Out of Scope
- {excluded areas}
```

**Present to SDT.** Ask: "Does this look right? Adjust focus areas before we start?"

---

## Phase 3: Execute Exploration

Work through focus areas in priority order. For each:
1. Navigate → observe → screenshot → hypothesize → experiment → record → deviate if interesting

Read technique checklists from `exploratory-heuristics.md` for the specific heuristic category.

**During exploration:** Screenshot frequently, check console after every interaction, inspect network requests after suspicious behavior (status codes; compare request parameters against what the UI displays), note "expected X but saw Y", track time per area, follow surprises.

---

## Phase 4: Document Findings

Document immediately. Read finding categories from `exploratory-heuristics.md`.

**Finding format:**
```markdown
### Finding {N}: {title}
**Category:** {category} | **Severity:** {level} | **Priority:** {level}
**Focus area:** {area} | **Found via:** {heuristic}
**What I did:** {steps} | **Expected:** {expected} | **Actual:** {actual}
**Evidence:** {screenshot path, or a described observation if no file-save tool is available} | **Console/Network:** {errors, decisive request-log entries, or clean}
**Action:** {add test / file bug / discuss / UX improvement}
```

---

## Phase 5: Self-Evaluation

- [ ] Every charter focus area has findings or explicit "unexplored" note
- [ ] No "new test scenario" duplicates existing KB/repo tests
- [ ] Severities consistent; Blocker/Critical have evidence
- [ ] Every finding has specific steps, distinct expected/actual, evidence (screenshot path or described observation), action
- [ ] Duration reflects the Phase 1 start timestamp — never "not tracked"
- [ ] Report tables/fields match the Phase 6 template structure — no silently dropped columns
- [ ] Every finding cross-reference (F-N) resolves to an actual entry in Detailed Findings
- [ ] Fix issues: reclassify, remove duplicates, capture missing evidence. One pass.

---

## Phase 6: Wrap Up

**Report template:**
```markdown
# Exploratory Testing Report
**Feature:** {name} | **Epic:** {KEY} | **Date:** {YYYY-MM-DD}
**Duration:** {actual} / {planned} | **URL:** {target}

## Session Outcome
| Metric | Count |
|--------|-------|
| New scenarios / Bugs / UX concerns / Missing requirements / Questions | {N each} |

## Focus Area Results
| Focus Area | Time | Findings | Notes |
|-----------|------|----------|-------|

## Detailed Findings
{all from Phase 4}

## Recommendation
- **Proceed to UAT** / **Needs another session** ({reason}) / **Blocked** ({reason})

## Next Actions
1. {action with /skill reference}

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {next action}
```

Before filling **Duration**, compute elapsed time from the Phase 1 start timestamp to now (`date +%H:%M`) — report actual minutes, never "not tracked".

Save to `.qa-reports/exploratory-{EPIC-KEY}-{YYYY-MM-DD}.md`. Update KB: add edge cases to `feature.md`, flag new scenarios for `/qa-test-cases --update`, update `index.json`.

---

## Collaborative Modes

**SDT-Led:** SDT drives browser, Claude suggests heuristics, catches console errors, documents findings.
**Claude-Led:** Claude drives, SDT provides domain knowledge and makes severity calls.
**Hybrid (default):** Claude handles systematic techniques, SDT handles intuition-driven exploration. Claude documents everything.
