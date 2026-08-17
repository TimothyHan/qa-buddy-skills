## Context Recovery

On session start or after compaction, recover context before doing anything else:

1. **Check the current git branch** — branch names often contain the ticket key (e.g., `feature/PROJ-456`).
2. **Read project config** — `cat .qabuddy.json 2>/dev/null`. If it exists, note the context source, team mode, and project key. These preferences apply to all skills.
3. **Scan recent KB artifacts:**
   - `features-kb/index.json` — read for tracked features, their status, and workflow state.
   - `features-kb/` — look for recently modified files (test plans, test cases, reviews, qa reports).
   - `.qa-reports/` — check for recent QA reports with open issues.
4. **Check workflow state** — if `features-kb/index.json` has a `workflow` field for any epic, report where the guided workflow left off (e.g., "Test plan complete, ticket reviews in progress for EPIC-123").
5. **Check team practices** — read `features-kb/team-practices/` for documented processes (bug triage, hotfix testing, test data, release workflow, accessibility). If a practice file exists, follow it when relevant. If not, ask the SDT case-by-case.
6. **Read git log** — last 5-10 commits for recent fix activity.
7. **Check for in-progress state** — draft artifacts or interrupted reports indicate a previous session was cut short.

**If prior context is found:** Summarize "here's where we left off" and confirm with the SDT before continuing.
**If no context is found:** Proceed normally.

**If the SDT reports a skill produced incorrect output**, suggest: "Run `/qa-improve` to analyze the issue and apply a fix."

---

## Context Source

Read `.qabuddy.json` for the configured context source. If no config exists, detect automatically.

| Config value | Behavior |
|---|---|
| `"jira"` | Use Jira MCP to query tickets, ACs, bugs. File bugs directly in Jira. |
| `"spec"` | Search workspace for spec files (`docs/`, `specs/`, `features-kb/`). Ask SDT to point to the right file if unclear. |
| `"chat"` | Ask the SDT to paste or link context at the start of each skill. |
| `"custom"` | Read `customContextMethod` from config for instructions. |
| No config | Try Jira MCP first. If not available, ask the SDT to provide context. |

**Bug filing:** If Jira MCP is available, file in Jira. Otherwise write to `features-kb/features/{EPIC-KEY}/bugs/{BUG-NNN}.md`.

**Team mode:** If `.qabuddy.json` has `"teamMode": "team"`, use `gh` CLI to create branches and PRs for KB changes. If `"solo"` or no config, commit directly.

**Never refuse to run a skill because a context source isn't available.** Always fall back to asking the SDT.

---

## Project Learnings (every skill run)

This project maintains a learnings layer — project-specific rules captured from real runs, and a log of what happened to them. Protocol: `{{REFERENCE_PATH}}/self-improve.md`. Helper: `QAB={{REFERENCE_PATH}}/bin/qab.js` (assign unquoted so `~` expands). Three obligations on **every** skill run:

1. **Read at start:** run `node $QAB run-id --skill <this-skill> [--ticket <KEY>]`, then after references read the learnings file (`learningsPath` in `.qabuddy.json`, default `features-kb/LEARNINGS.md`; skip silently if absent). Apply `active` entries scoped to this skill — **on conflict with a reference, the learning wins.** Ignore `retired`/`promoted`.
2. **Cite and log:** when a learning shapes output, cite its ID (`LRN-…`) and run `node $QAB log applied LRN-…`. If live observation contradicts an active learning, do not apply it — run `node $QAB log contradicted LRN-… --note "<what you saw>"` and flag it in the report.
3. **Close:** before the completion status, check the three capture triggers (documented rule failed against reality / undocumented decision made / SDT corrected output with project knowledge). If one fired, append an evidence-backed entry per the protocol, mention it, and run `node $QAB log captured LRN-…`; **if none fired, write nothing and say nothing.** Then run `node $QAB log outcome --status <DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT>`. If the trigger traces to QABuddy's own instructions (not a project quirk), it is not a learning — add "run `/qa-improve`" with the evidence to **Next steps**; if a falsified learning was flagged or active entries exceed ~30, suggest `/qa-improve` distill. Detection is automatic; launching `/qa-improve` is always the SDT's call.

---

## Review Options

At every pause point where the SDT reviews output, offer three options:

- **(A) Approve** — continue to next phase
- **(B) Content feedback** — iterate on the current output (wrong data, missing items, formatting)
- **(C) Tool feedback** — the skill itself behaved incorrectly (wrong approach, hallucinated data, skipped steps, structural issue)

**If (C) tool feedback:**
1. Ask: "What did the tool do wrong? What was expected?"
2. Run the **`/qa-improve` skill (fix mode)** with that context — it owns root-cause
   analysis, the proposal/approval gate, apply + version bump + rebuild, eval
   regression, and delivery (PR / local / upstream per config). Do not
   re-implement its flow inline; its Phase 1 skips questions already answered.
3. When it finishes, resume the current workflow from the same pause point.

The fix takes effect on the next skill invocation (symlinks auto-resolve to rebuilt dist/).

---

## Completion Status

End every skill run with a clear status:

| Status | When to use |
|--------|------------|
| **DONE** | Completed successfully, all outputs delivered |
| **DONE_WITH_CONCERNS** | Completed, but something needs attention |
| **BLOCKED** | Cannot proceed — missing input, environment issue, or tool failure |
| **NEEDS_CONTEXT** | Need more information from the SDT |

Write the status to the KB artifact. Format:
```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {what the SDT should do next, or "none"}
```
