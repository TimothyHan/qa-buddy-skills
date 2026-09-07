# QABuddy on CI

**Status:** experimental, shipped in 0.9.0 — everything below is built and measured on one
demo repository; the interactive skills are unchanged. Design record:
[RFC 0004](rfc/0004-headless-pr-coverage.md).

한국어: [pr-coverage.md](pr-coverage.md)

QABuddy can run on every pull request of a repository, unattended: it maps the PR's diff to
the features in that repo's knowledge base, writes or updates test cases, optionally
explores the running app and automates the gaps with Playwright, then posts **one coverage
heatmap comment** and delivers the generated files as a **companion pull request**. A human
stays in the loop at two points — reviewing the companion, and deciding what the
exploratory session could not — and the bot never writes to the base branch.

---

## What a PR gets

| Artifact | Where | What it says |
|---|---|---|
| **Coverage heatmap** | one sticky comment on the PR, patched in place after every run | one row per acceptance criterion of every feature the diff touched; columns Unit / API / E2E / Manual / Exploratory; ✅ covered only with evidence on disk, 🟡 designed but not proven, 🔴 gap, ⚪ not run this time, ⚠️ a failing spec or an exploratory finding |
| **Companion PR** | `qabuddy/pr-<n>` → the PR's own branch | the generated test cases, mapping, sessions, page objects and specs; its description is a work list — what it adds, findings, *fix on the source branch*, *decide*, *not automated yet* |
| **Announcement** | one comment per companion | the fixes for the author, the decisions for the reviewer; gets 🚀 and a "merged into" line when the companion merges |
| **Issues** | labelled `qabuddy` | one per finding that needs a human, de-duplicated so reruns update rather than duplicate |
| **Run artifact** | Actions → the run | every phase's execution log, the heatmap JSON, the Playwright results |

"Covered" is earned, not declared: a spec whose `test()` title carries the test-case id, a
unit file that names the AC, a saved QA report that executed the case, or a persisted
exploratory row that lists the AC. A test case without proof is *partial*. This is
test-plan's "never claim coverage without a file path" rule applied per layer.

---

## Phases, and what triggers them

| Phase | Session | Produces | Typical cost |
|---|---|---|---|
| `kb` | `/qa-test-cases --update` | test cases for every AC, the layered traceability mapping, gap analysis | ~$1, 3–6 min |
| `explore` | `/qa-exploratory --quick` with Playwright MCP against the running app | a persisted session with an AC-keyed results table, screenshots, bug files | ~$1–2, 4–8 min |
| `automate` | `/qa-e2e-setup` (once) → `/qa-e2e-pom` → `/qa-e2e-write` | page objects proven live, specs whose titles carry TC ids, the suite executed for results | ~$3–4, 12–17 min |

Each phase is its own Claude session on its own runner with its own turn and budget cap;
explore and automate run **in parallel** after kb. A full run on the demo app is about
22 minutes and $6. No session ever asks a question: headless mode takes the stated
recommendation at every pause and records it as an *Auto-decision*.

| Trigger | Runs |
|---|---|
| PR opened, or marked ready for review | the caller's `default-phases` (`kb` by default) |
| labels `qa:explore` · `qa:automate` · `qa:full`, or comments `/qabuddy explore` · `automate` · `full` · `kb` | those phases, on that PR |
| a reviewer **merges the companion PR** | by default only the free heatmap refresh on the merged branch; with `after-companion-merge: full` the rest of the chain on the source PR, stopping once a companion that carried automation has merged |
| `/qabuddy heatmap`, or automatically when the chain completes | model-free refresh: re-map the diff, run the suite on the branch as it is, re-post the heatmap — about 90 seconds, $0 |

Never: on every push, on drafts, on forks, or on the companion PRs themselves. One run per
PR at a time; a newer trigger cancels the older run.

---

## Set it up in a repository

Three ways to the same fifteen-line caller. The runner installs QABuddy itself from
`qabuddy-ref`, so your locally installed version only matters for the last two:

1. **By hand** — copy the caller below (or from
   [`.github/pr-coverage/README.md`](../.github/pr-coverage/README.md)) into
   `.github/workflows/qabuddy.yml`, set `app-start` and `app-url`, then go through the
   prerequisites table. Works from any installed QABuddy version.
2. **The wizard** — `/qa-setup` offers a *PR Automation* step after saving the config,
   probes the start command and URL, runs the scaffolder, then walks you through the
   prerequisites and verifies each one before it lets you go.
3. **The scaffolder** —
   ```bash
   node ~/.claude/skills/qa-references/bin/pr-coverage.js init --app-start "node server.js" --app-url http://localhost:4173 --labels true
   ```

**Already using QABuddy in this repository?** Your config stays; only the caller is
added. Re-run `/qa-setup` and pick *Keep, and set up PR automation* (offered while the
repo has no caller yet), go straight there with `/qa-setup --pr`, or run the scaffolder
above. Two things older repositories tend to hit: features created before this work have
no `sources.json`, so their code maps to nothing until one `/qa-test-plan` run per feature
writes it — the scaffolder and preflight both name them; and branches cut before the
caller was committed cannot chain on a merged companion until the base is merged in.

**Which QABuddy build?** The runner needs nothing from you — the caller pins a release tag
(`v0.9.0` or later) and installs it. Your local install only matters for the wizard and
the scaffolder, which need 0.9.0 or later: `git pull`, `node build.js all`, re-run
`dist/claude/setup` — or from scratch:

```bash
git clone --branch v0.9.0 https://github.com/TimothyHan/qa-buddy-skills.git && cd qa-buddy-skills && npm ci && node build.js all && dist/claude/setup
```

The caller says only how to run *your* app; the jobs, prompts, merge and preflight live in
QABuddy's reusable workflow, so a QABuddy release is a workflow release:

```yaml
jobs:
  qabuddy:
    uses: TimothyHan/qa-buddy-skills/.github/workflows/pr-coverage.yml@v0.9.0
    with:
      app-start: "node server.js"
      app-url: "http://localhost:4173"
    secrets: inherit
```

**Claude only, and who pays.** The workflow runs on `anthropics/claude-code-action`,
whichever platform you use the skills on, and it spends against the token you store. A
subscription token from `claude setup-token` bills the Claude subscription of whoever
minted it, so a team repo should mint it from a dedicated account or use an API key with
credit. Nothing hides this: the wizard says it before the token commands, the scaffolder
repeats it, and every heatmap comment ends with the run's spend per phase and which secret
paid.

**Prerequisites** — the `preflight` job checks all of these before any model spend and
explains what is missing in the PR comment:

| Need | How |
|---|---|
| `.qabuddy.json` | `/qa-setup` |
| at least one feature with a `sources.json` (which code the feature owns; KB spec §6.8) | `/qa-test-plan` writes it |
| one token secret | `claude setup-token` → `gh secret set CLAUDE_CODE_OAUTH_TOKEN` (bills the Claude subscription), or `ANTHROPIC_API_KEY` with API credit |
| app login, if any | secrets `TEST_USER` / `TEST_PASS`, or plain `test-user` / `test-pass` inputs for a public demo account |
| Actions may open pull requests | Settings → Actions → General |
| a branch that carries the caller | any branch cut after adoption; older branches need the base merged in before the companion chain can trigger — preflight warns |

Nobody, including the wizard, ever collects the token value: you run `gh secret set` yourself.

**Changed your mind mid-setup** — no subscription, no API credit, not now? Say *stop* in the
wizard, or run `pr-coverage.js init --remove`: it deletes the caller and the `qa:*` labels
and touches nothing else. A caller without a token is never left behind, since every PR
would otherwise get a "could not start" comment. `/qa-setup --pr` brings it back later.

---

## Tune it (caller inputs)

| Input | Default | Meaning |
|---|---|---|
| `default-phases` | `kb` | what runs on open: `kb`, `kb,explore`, `kb,automate`, `kb,explore,automate` |
| `after-companion-merge` | `none` | what a merged companion continues with: `none` (heatmap refresh only), `full`, `automate` |
| `delivery` | `companion-pr` | `commit` pushes the generated files straight onto the PR's branch instead — one PR, no chain |
| `issues-for` | `decisions` | which findings become issues: `decisions`, `all` (bugs too), `none` |
| `gate-on` | `none` | verdict of the `qabuddy / gate` check: `at-risk`, `suite`, `gaps` — require it in branch protection to block merges; the bot never sets that rule |
| `kb-turns` / `kb-budget` … | 80 / $5, 120 / $10, 300 / $25 | per-phase caps |
| `model` | `claude-sonnet-5` | |
| `extra-prompt` | `.github/qabuddy/extra.md` | optional project instructions appended to every phase |
| `qabuddy-ref` | `v0.9.0` | QABuddy release tag (or any ref) installed on the runner |

---

## After an exploratory session

The session classifies each finding, and each kind has its own follow-up:

| Finding | Follow-up | Who |
|---|---|---|
| bug | listed under *fix on the source branch* in the companion's description and the announcement; the AC shows ⚠️; once fixed, `/qabuddy heatmap` re-verifies | author |
| new scenario | becomes a test case on the next kb run and a spec on the next automate | the chain |
| UX concern, missing requirement | a GitHub issue, linked under *decide* | reviewer / product |
| learning about the app | an `LRN-` entry, so later runs stop re-discovering it | automatic |

The fix belongs on the source branch, not on the companion: the companion carries the
tests, and the failing spec that documents the bug should turn green *there* once the fix
lands.

---

## How it is built

- **Deterministic where it can be.** `bin/pr-coverage.js` does the diff→feature mapping
  (`touched`), the heatmap and its evidence rules (`heatmap`), the sticky comment
  (`comment`), the three-way union of parallel phase trees (`merge`), the prerequisite
  check (`preflight`), the work list (`summary`), the issues (`issues`) and the scaffold
  (`init`). The model only produces knowledge-base and Playwright artifacts.
- **Headless is a mode, not a fork.** The Tier 1 preamble's *Headless Mode* applies to
  every skill: take the recommendation, log the auto-decision, close `BLOCKED` on an
  escalation, write only under `features-kb/`, `playwright/`, `.qa-reports/`. Interactive
  behaviour is unchanged.
- **One reusable workflow**, `.github/workflows/pr-coverage.yml`: `resolve → preflight →
  kb → (explore ∥ automate) → deliver → gate`. Prompts, the renderer, the installer and the
  MCP config ship beside it under `.github/pr-coverage/`.

Measured on the demo repository (`qabuddy-poc-acme`, a soft-delete refactor that leaves
deleted rows listed): exploration found the bug in every run, the generated suite went red
on exactly the delete-dependent tests, and no session asked a question across more than a
thousand turns. RFC 0004 §4 has the numbers and the kill criteria.
