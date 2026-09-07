---
name: setup
version: 0.5.2
description: |
  First-run configuration wizard for QABuddy. Sets up context source (Jira, spec
  docs, chat, custom), team mode (solo vs PR-based), and project preferences.
  Writes .qabuddy.json to the project root. Optionally wires QABuddy to run on
  pull requests (the reusable PR-coverage workflow). Re-run to reconfigure.
  Use when: "setup", "configure", "first time setup", "change settings".
  Do NOT use when: asking about QABuddy features, asking how to use a skill, mid-workflow.
tool-groups:
  - bash
  - read
  - write
  - ask
  - grep
  - glob
preamble-tier: 1
---

# /qa-setup: QABuddy Configuration

Configure QABuddy for this project. Creates `.qabuddy.json` at the project root
with your preferences. All other skills read this config to adjust their behavior.

## Constraints

1. **Never overwrite without asking.** If `.qabuddy.json` exists, show current config first.
2. **Verify before saving.** Show the full config and confirm before writing the file.
3. **One question at a time.** Don't batch questions.

---

## Phase 1: Check Existing Config

```bash
cat .qabuddy.json 2>/dev/null
```

- **If config exists:** Show it and ask: "Want to reconfigure or keep current settings?"
  - (A) Reconfigure — proceed to Phase 2
  - (B) Keep — show summary and exit
  - (C) Keep, and set up PR automation — jump to Phase 5b (offer this only when the
    repository has no `.github/workflows/qabuddy.yml` yet)
- **`/qa-setup --pr`:** skip straight to Phase 5b, whether or not a config exists
  (if none exists, run Phases 2–4 first — the workflow needs `.qabuddy.json`).
- **If no config:** Proceed to Phase 2

---

## Phase 2: Context Source

Ask the SDT:

"How does your team provide feature context (epic details, acceptance criteria, specs)?"

- **(A) Jira** (recommended if using Atlassian) — I'll query tickets via Atlassian MCP
- **(B) Specification documents** — feature specs live as files in this repo (e.g., `docs/`, `specs/`)
- **(C) Chat** — you'll paste or link context when needed
- **(D) Custom** — describe your method

**If Jira:** Ask for the project key (e.g., "PROJ"). Verify Jira MCP connectivity:
```bash
# Check if atlassian MCP is configured
grep -r "atlassian" ~/.claude/settings.json .claude/settings.json .claude/settings.local.json 2>/dev/null
```
If MCP not found, warn but don't block — SDT can set it up later.
Features and stories use Jira keys as KB identifiers (e.g., `PROJ-123`, `PROJ-456`).

**If Spec, Chat, or Custom:** Explain naming:
"Since you're not using Jira, you'll name features and stories yourself when running skills.
Use short, descriptive slugs (e.g., `auth-system`, `login-page`, `pdf-export`).
These become directory names in the knowledge base:
`features-kb/features/auth-system/test-cases/login-page.md`"

**If Custom:** Also ask for a brief description of the method (stored in config).

---

## Phase 3: Team Mode

"Will QABuddy be used by multiple team members on this project, or just you?"

- **(A) Just me (solo)** — changes apply locally, no PRs
- **(B) Team** — create PRs for KB changes and skill improvements

**If Team:** Verify `gh` CLI:
```bash
gh --version 2>/dev/null
```
If not available, warn: "GitHub CLI not found. Install it for PR workflows, or switch to solo mode."

---

## Phase 3b: Upstream Contributions (optional)

"Would you like to contribute skill improvements back to the QABuddy community?
When you use `/qa-improve` to fix a skill, you'll get an option to submit a PR to
the upstream QABuddy repo. Only universal improvements — not team-specific changes."

- **(A) Yes** — enable upstream contributions
- **(B) No** — improvements stay local/team only

**If Yes:** Requires `gh` CLI (already checked in Phase 3 if team mode). Store the upstream repo URL.

---

## Phase 4: Write Config

Build the config object from answers:

```json
{
  "version": "1.0",
  "contextSource": "{jira|spec|chat|custom}",
  "teamMode": "{solo|team}",
  "jiraProject": "{PROJ or null}",
  "customContextMethod": "{description or null}",
  "githubCli": true/false,
  "contributeUpstream": true/false,
  "learningsPath": "features-kb/LEARNINGS.md",
  "runsDir": ".qa-reports/runs",
  "retainRuns": "captured",
  "upstreamRepo": "TimothyHan/qa-buddy-skills",
  "defaultBranch": "main",
  "createdAt": "{ISO timestamp}"
}
```

Detect default branch:
```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Show the full config to the SDT: "Here's your configuration. Save it?"
- **(A) Save** — write `.qabuddy.json`
- **(B) Change something** — go back to the relevant question

---

## Phase 4b: Initialize the Learnings Layer

If the file at `learningsPath` doesn't exist, create it (no question needed — every
project gets one; see `{{REFERENCE_PATH}}/self-improve.md` for the protocol):

```markdown
# Project Learnings

Project-specific rules QABuddy captured from real runs. Every skill reads this
file at start (`active` entries override references) and appends evidence-backed
entries when a run teaches something new. Protocol: references/self-improve.md.
Entry format — `## LRN-YYYYMMDD-NN: title` with **Status** (active|promoted|retired),
**Scope**, **Statement**, **Overrides**, **Evidence**.

<!-- No entries yet. Skills append below as the project teaches them. -->
```

Tell the SDT: "Created `{learningsPath}` — QABuddy will evolve to fit this project
by capturing learnings there on every skill run. Commit it; it's team knowledge.
A sibling `learnings-log.jsonl` will appear on the first run — append-only record of
what each run applied, contradicted, captured, and how it ended — and
`fingerprints.jsonl` on the first fingerprinted failure. Commit both."

Then make sure `.gitignore` has these two lines (add them if missing — derived
and local, never committed):

```
.qa-reports/
features-kb/.cache/
```

---

## Phase 5: Team Practices (optional)

"Does your team have documented processes for any of these? (select all that apply)"
- [ ] Bug triage / intake process
- [ ] Hotfix testing workflow
- [ ] Test data management (seeding, cleanup, fixtures)
- [ ] Release workflow (freeze, rollback, cutoff)
- [ ] Accessibility requirements (WCAG level, tools)
- [ ] CI/CD pipeline (stages, which tests run where, failure policy, browser matrix)
- [ ] None of these yet

**For each selected:** "Paste it, point to a file, or describe it briefly. I'll save it so all skills follow it."

Save each to `features-kb/team-practices/`:
```bash
mkdir -p features-kb/team-practices
```

| Practice | Saved to | Used by |
|----------|----------|---------|
| Bug triage | `features-kb/team-practices/bug-triage.md` | `/qa-qa` |
| Hotfix testing | `features-kb/team-practices/hotfix-testing.md` | `/qa-qa`, `/qa-verify-fix` |
| Test data | `features-kb/team-practices/test-data.md` | `/qa-qa`, `/qa-test-cases`, `/qa-exploratory` |
| Release workflow | `features-kb/team-practices/release-workflow.md` | `/qa-verify-fix` |
| Accessibility | `features-kb/team-practices/accessibility.md` | `/qa-qa`, `/qa-test-cases`, `/qa-exploratory` |
| CI/CD pipeline | `features-kb/team-practices/ci-cd-pipeline.md` | `/qa-qa`, `/qa-test-plan` |

**If "none":** "That's fine. Skills will ask you case-by-case when these come up. You can add team practices later by running `/qa-setup` again."

---

## Phase 5b: PR Automation (optional)

Only when the repository is on GitHub (`git remote get-url origin` names github.com)
and `gh` is available; skip silently otherwise, and always skip in headless mode.

"Want QABuddy to run on pull requests? Each PR gets its diff mapped to your features,
test cases written, optionally the running app explored and the gaps automated, then one
coverage-heatmap comment and a companion PR carrying the tests."
- **(A) Yes, set it up** (Recommended when team mode is `team`)
- **(B) Not now** — run `/qa-setup` again later, or the scaffolder by hand

**If Yes:**
1. **Probe, don't ask.** `package.json` `scripts.start` / `dev` → the start command; a port
   in that script, `.env.example`, or the README → the app URL. Present both as a
   recommendation: "Start with `npm start` on http://localhost:3000 — correct?"
2. **Scaffold:**
   ```bash
   node {{REFERENCE_PATH}}/bin/pr-coverage.js init --app-start "{cmd}" --app-url "{url}" --labels true
   ```
   It writes `.github/workflows/qabuddy.yml` (a caller of QABuddy's reusable workflow),
   creates the `qa:*` labels, and prints what is still missing.
3. **Walk the SDT through what only they can do, one item at a time, and verify each
   before moving on.** **Never collect a token or key yourself — never ask the SDT to
   paste one into the chat.** Before the token commands, say who pays: a token from
   `claude setup-token` bills the Claude subscription of whoever minted it — fine for a
   personal repo; a team repo should mint it from a dedicated account or use an API key.
   - **Token** — `claude setup-token`, then `gh secret set CLAUDE_CODE_OAUTH_TOKEN`
     (subscription) — or `gh secret set ANTHROPIC_API_KEY` (API credit). Verify:
     `gh secret list` shows one of the two names (names only, never values).
   - **App login, if any** — secrets `TEST_USER` / `TEST_PASS` (verify with
     `gh secret list`), or plain `test-user` / `test-pass` inputs in the caller for a
     public demo account.
   - **Actions may open pull requests** — check with
     `gh api repos/{owner}/{repo}/actions/permissions/workflow --jq .can_approve_pull_request_reviews`;
     if `false`, offer to enable it (`gh api -X PUT` on the same path with
     `-F can_approve_pull_request_reviews=true`) and run that only on an explicit yes — it
     is a repository setting.
   - **`sources.json` for every feature** — the scaffolder lists the features without one.
     This is crucial: a feature without it maps to nothing and its heatmap stays empty.
     Offer to run `/qa-test-plan {feature}` now for each; if declined, say the first PR's
     preflight will name them.
   Do not close this step while an item is unverified unless the SDT explicitly defers it;
   deferred items go in the Phase 6 summary.
4. **Explain the default in one paragraph:** `kb` on every PR open → one heatmap comment
   and a companion PR with the tests; merging the companion only refreshes the heatmap.
   Nothing more runs unless asked — labels `qa:explore` / `qa:automate` / `qa:full` or
   `/qabuddy …` comments per PR, or `after-companion-merge: full` in the caller to chain
   explore ∥ automate after a reviewed companion. Offer `default-phases`,
   `after-companion-merge`, `issues-for`, `gate-on` if the SDT wants different behaviour.
5. Suggest committing the caller together with `.qabuddy.json`.

---

## Phase 6: Next Steps

After saving:

"QABuddy is configured for this project.

Your setup:
- Context source: {source}
- Team mode: {mode}
- {jira project / spec location / custom method}
- Team practices: {N} documented, {M} not yet defined
- Learnings layer: {learningsPath} + learnings-log.jsonl (self-improve active on every skill run)
- PR automation: {caller written — token ✓ · login ✓ · Actions PR setting ✓ · sources.json ✓ | deferred: … | not set up}

Next: Run `/qa-start {EPIC-KEY or feature description}` to begin the guided workflow.
Or use any skill individually: `/qa-test-plan`, `/qa-review-ticket`, etc."

**Status:** DONE
**Summary:** QABuddy configured — .qabuddy.json created
**Next steps:** Run /qa-start to begin guided workflow
