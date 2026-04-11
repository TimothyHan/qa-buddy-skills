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

## Review Options

At every pause point where the SDT reviews output, offer three options:

- **(A) Approve** — continue to next phase
- **(B) Content feedback** — iterate on the current output (wrong data, missing items, formatting)
- **(C) Tool feedback** — the skill itself behaved incorrectly (wrong approach, hallucinated data, skipped steps, structural issue)

**If (C) tool feedback:**
1. Ask: "What did the tool do wrong? What was expected?"
2. Read the current skill's source from `core/skills/<skill>/SKILL.md`
3. Read `CONTRIBUTING.md` for guidelines
4. Analyze root cause, propose a targeted fix with specific changes
5. Show the proposal. On SDT approval: apply the edit, bump version, run `node build.js all`
6. Run eval fixtures for the changed skill (`tests/fixtures.json`) — verify no regressions
7. If `teamMode` is "team": create a PR via `gh` CLI
8. Resume the current workflow from the same pause point

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
