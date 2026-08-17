---
name: improve
version: 0.7.0
description: |
  Meta-skill that improves other skills based on real usage failures. When an SDT
  reports a skill produced incorrect or unexpected output, this skill analyzes the
  root cause, generates a structured improvement proposal, applies the fix following
  CONTRIBUTING.md guidelines, and offers to create a PR or apply locally.
  Also maintains the project learnings layer (distill mode): dedupe, retire
  falsified entries, promote proven learnings into references/upstream.
  Use when: "improve", "this didn't work", "fix this skill", "the output was wrong",
  "skill improvement", "qa-improve", "distill learnings", "clean up learnings".
  Do NOT use when: giving content feedback on output (use option B at pause point), asking about QA methodology, running normal QA workflow.
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
preamble-tier: 1
---

# /qa-improve: Skill Self-Improvement

You are a meta-skill with two modes:

- **Fix mode** (default, Phases 1–6): an SDT reports a skill produced incorrect,
  misleading, or incomplete output — analyze root cause, propose targeted fixes,
  apply, verify.
- **Distill mode** ("distill learnings", a skill flagged a falsified entry, or the
  learnings file exceeds ~30 active entries): maintain the project learnings layer —
  see the Distill Mode section at the end. `--dry-run` (or "propose only") writes
  the sweep as a proposal file and edits nothing.

## Constraints

1. **Never guess the failure.** Ask the SDT what happened and what they expected. Don't infer from vague descriptions.
2. **Read the skill before proposing changes.** Every fix must reference the specific line, phase, or section it changes.
3. **Follow CONTRIBUTING.md.** Read it before making changes. Respect the 300-line skill budget, Sonnet context limits, and structural conventions.
4. **One root cause at a time.** If the SDT reports multiple issues, address them sequentially. Don't batch unrelated fixes.
5. **Preserve workflow-specific knowledge.** Never remove phase logic, KB paths, severity scales, or SDT approval gates as part of a trim.
6. **Test the fix conceptually.** Before applying, explain how the fix prevents the original failure from recurring.
7. **Bump the version.** Every skill change gets a patch or minor version bump.

---

## Phase 1: Understand the Failure

Ask the SDT these questions (skip any the SDT already answered):

1. **Which skill?** — Which skill produced the bad output? (e.g., `/qa-test-plan`, `/qa-qa`)
   If unclear, check the recent session for skill invocations.
2. **What happened?** — What did the skill output? Be specific: quote the bad text, show the wrong table, describe the missing section.
3. **What was expected?** — What should the output have been? What would correct behavior look like?
4. **How was it caught?** — Did the SDT notice during review? Did another skill fail because of it? Did a team member flag it?
5. **Is this repeatable?** — Would the same inputs produce the same bad output every time, or was it a one-off?

Once you have answers, summarize back: "So the issue is: [skill] did [X] but should have done [Y], because [root cause hypothesis]. Is that right?"

---

## Phase 2: Analyze Root Cause

1. **Read the skill file:** `core/skills/<skill>/SKILL.md`
2. **Read CONTRIBUTING.md** for guidelines and constraints
3. **Identify the failure point:** which phase, constraint, or instruction led to the bad behavior

Classify the root cause:

| Category | Description | Example |
|----------|------------|---------|
| **Missing constraint** | No rule prevents the bad behavior | Agent inferred test status from Jira — no constraint said "don't do that" |
| **Wrong phase order** | Information needed in Phase N is created in Phase N+2 | feature.md created after test plan drafted |
| **Instruction gap** | Phase instructions don't cover this scenario | No guidance on reading Jira `description` field for ACs |
| **Self-eval gap** | Self-evaluation doesn't check for this failure | No check for unverified test statuses |
| **Template issue** | Output template allows/encourages bad format | Status column accepts "Done (in PR)" without evidence |
| **Over-reliance on context** | Skill relies on in-memory data instead of writing to file | ACs held in context, lost for large epics |
| **Scope drift** | Skill does something outside its intended role | Test plan skill making claims about code it didn't inspect |

Present the analysis to the SDT: "Root cause: [category] — [explanation]. Here's the specific instruction that led to it: [quote from skill]."

---

## Phase 3: Generate Improvement Proposal

Write a structured proposal:

```markdown
# Skill Improvement Proposal: `<skill-name>`

**Version:** current → proposed
**Root cause:** [category from Phase 2]
**Reported by:** [SDT name or "session"]

## Problem
[1-2 sentences: what went wrong and why]

## Root Cause
[Which phase/instruction/gap caused it. Quote the specific text.]

## Proposed Changes
| # | Location | Change | Description |
|---|----------|--------|-------------|
| 1 | Constraints | Add | [new constraint text] |
| 2 | Phase N | Amend | [what changes and why] |
| 3 | Self-eval | Add | [new checklist item] |

## Expected Outcome
[How this fix prevents the failure from recurring]

## Budget Check
- Current skill lines: [N]
- After changes: [estimated N]
- Within 300-line budget: Yes/No
```

Present to the SDT: "Here's my proposed fix. Should I apply it?"

Wait for approval. If the SDT wants changes to the proposal, iterate before applying.

---

## Phase 4: Apply Changes

Once the SDT approves:

1. **Edit the skill file** in `core/skills/<skill>/SKILL.md`
   - Apply each change from the proposal
   - Bump the version (patch for fixes, minor for new phases/constraints)

2. **Build and verify:**
   ```bash
   node build.js all
   ```
   - Confirm all 3 platforms build successfully
   - Check the skill stays within 300 lines: `wc -l core/skills/<skill>/SKILL.md`

3. **Run eval fixtures** against the changed skill:
   - Read `core/skills/<skill>/tests/fixtures.json`
   - For each fixture: simulate the skill with the fixture input, check all assertions
   - Report pass/fail. If any fixture fails, the fix may have introduced a regression — review before continuing.

4. **If the skill has a Korean locale**, note that `locales/ko/skills/<skill>/SKILL.md` also needs updating. Flag this to the SDT rather than auto-translating.

---

## Phase 5: Self-Evaluation

Before delivering, verify:

1. **Change matches proposal** — every change in the proposal was applied, nothing extra
2. **Budget check** — skill is under 300 lines, total context under 530 lines
3. **CONTRIBUTING.md compliance** — constraints at top, self-eval has format check, completion status at end
4. **Build passes** — all 3 platforms built successfully
5. **Eval fixtures pass** — all fixtures for the changed skill pass after the fix. If any regressed, fix before delivering.
6. **No collateral damage** — other skills that read this skill's output (e.g., sprint-status reading qa reports) still work with the new format

---

## Phase 6: Deliver

Ask the SDT:

**(A) Create a PR** (recommended for shared repos)
- Create a branch: `improve/<skill>-<short-description>`
- Commit with structured message:
  ```
  fix(<skill>): <short description>

  Problem: <what went wrong>
  Root cause: <category>
  Fix: <what changed>

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- Push and create PR with the improvement proposal as the description

**(B) Apply locally** (for personal testing)
- Commit to current branch with the same structured message
- Respect `teamMode` from `.qabuddy.json` — if 'team', default to option (A).

**(C) Don't commit** (just review the changes)
- Leave the edits in the working tree for the SDT to review manually

### Upstream Contribution (automatic after A or B)

If `.qabuddy.json` has `contributeUpstream: true`, automatically contribute after applying locally or creating a project PR:

1. Fork the upstream repo if not already forked: `gh repo fork {upstreamRepo} --clone=false`
2. Create branch: `improve/<skill>-<short-description>`
3. Commit only `core/` changes (not dist/, not team-practices/, not .qabuddy.json)
4. Push to fork and create PR to upstream:
   ```bash
   gh pr create --repo {upstreamRepo} --title "fix(<skill>): <description>" --body "$(cat <<EOF
   ## Improvement Proposal
   {proposal from Phase 3}

   ## Eval Results
   {pass rate from Phase 4 eval run}
   EOF
   )"
   ```

Skip upstream contribution if:
- Option (C) was chosen (nothing committed yet)
- The change is team-specific (modifies team-practices/, .qabuddy.json, or project-specific content)

---

## Distill Mode: Learnings Layer Maintenance

Read the protocol first: `{{REFERENCE_PATH}}/self-improve.md`. Then read the
learnings file (`learningsPath` from `.qabuddy.json`, default `features-kb/LEARNINGS.md`)
and run `node {{REFERENCE_PATH}}/bin/qab.js stats` — the log's per-source counts
(LRN and REF rows), the fingerprint recurrence table, and citation compliance;
report the compliance line as-is. Numbers come from the log, not from
`Evidence:` prose; if the log is absent or a source has no rows, say so and
fall back to prose for that entry only.

Sweep every `active` entry and classify. Show the computed columns
(`in_slice · applied · contradicted · runs · last_applied`) next to each entry:

| Finding | Computed from | Action proposed |
|---|---|---|
| **Duplicate** — two entries state the same fact | LLM check | Merge evidence into the older ID; mark the newer `retired` with reason "duplicate of LRN-…" |
| **Duplicate (fingerprint)** — same failure class, same scope | same `Fingerprint:` ∧ same `Scope:` (`stats` names the older id) | Same as above — the older ID stays |
| **Falsified (contradiction)** — contradicted by reality | `contradicted ≥ 2` and no `applied` after the last contradiction; or a skill's live drift flag | Mark `retired` with the contradicting log line / evidence as reason |
| **Falsified (fingerprint)** — the failure it claimed to prevent recurred | any `fingerprints.jsonl` line with the entry in `active` (`stats` shows ffp × count) | Mark `retired` with the fingerprint line as reason — or, if the rule is right but incomplete, propose the amended statement as a new entry |
| **Never applied** — compiled, never used | `in_slice ≥ 10` ∧ `applied = 0` | Propose `retired` ("never applied in N slices") unless the SDT names a reason to keep it; REF rows: report as never-selected, no action |
| **Promotion candidate** — proven and general | `applied ≥ 3` across `≥ 3` distinct runs AND `contradicted = 0` AND (if `Fingerprint:`) its ffp silent since the entry's date — then the LLM judgment: generalizable beyond this project? | Propose adding it to the matching reference (e.g., `playwright-patterns.md`); mark `promoted` with a pointer to where it landed |
| **Copy** — restates a reference | LLM check vs reference text | Retire (rule 4) |
| **Healthy** | — | Leave untouched |

An entry with prose evidence from "3+ runs" but `applied < 3` in the log is
**not** a promotion candidate — the log is the record; say what the log shows.
Include the **recurrence table** from `stats` (ffp · kind · key · count · runs ·
active) in the sweep: a class recurring across runs with no learning in `active`
is the strongest capture candidate this project has — say so, don't write the
entry yourself.

Rules:

1. **Status changes only — never delete an entry.** IDs and history are permanent;
   `retired` entries keep a one-line reason.
2. **Approval gate.** Present the full sweep plan (per-entry: finding → proposed
   action → evidence) and ask "Apply?" before editing the file. Same as Fix mode
   Phase 3 — no silent edits.
3. **Promotion is a reference edit**, so it follows the Fix-mode machinery: apply
   to `core/references/`, note the Korean twin needs syncing, run
   `node build.js all` so installed dists pick up the change (learnings need no
   rebuild — they're read from the project repo at runtime; references do), and
   if `contributeUpstream: true`, offer the upstream PR path from Phase 6. Only
   promote what holds beyond this project — project-specific facts stay learnings
   forever, no matter how well-proven.
4. **Eval gate on every promotion.** Before editing the reference, run the eval
   fixtures (Phase 4 step 3) for **every skill in the promoted section's scope**
   and record pass counts. Apply the edit, rebuild, run them again. Merge only if
   `pass_after ≥ pass_before` for every skill. Otherwise revert the reference
   edit, leave the LRN `active`, and append to `features-kb/LEARNINGS.rejected.md`:
   `date · LRN-id · target reference/section · failing fixture ids · one-line why`.
   A promotion that regresses a fixture is rejected by name, never merged quietly.
5. **Deltas-only check while sweeping:** an entry that merely restates reference
   content is a copy, not a learning — propose retiring it.
6. **`--dry-run` = the critic.** Do the full sweep with computed columns and
   proposed actions, but write **only** `features-kb/distill-proposal-<YYYY-MM-DD>.md`
   (the sweep table + evidence + the promotion candidates' target sections) and
   touch nothing else — no `LEARNINGS.md` edits, no reference edits, no status
   changes. The SDT reads the proposal and runs distill for real when ready.
   Trigger it yourself when a run suggests it (`active > 30`, a falsified flag);
   applying is always the SDT's call.

Report: entries swept / merged / retired / promoted / rejected-by-eval / left
active, the resulting active count, the log summary line from `qab.js stats`
(events, runs with outcome, manual-writer count, fingerprint lines), and — for
dry-run — the proposal file path and "0 edits". After any applied change run
`node {{REFERENCE_PATH}}/bin/qab.js scoreboard` so the cache reflects the new state.

---

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {what was changed and why}
**Next steps:** {upstream PR link if contributed, project PR link, or "test the fix"}
