# RFC 0004 — Headless Mode and PR-Triggered Coverage Runs

| | |
|---|---|
| **Status** | Draft — proof of concept on branch `poc/cloud-service`; not proposed for `main` |
| **Author** | Timothy Han (with Claude) |
| **Created** | 2026-09-04 |
| **Depends on** | RFC 0001 (run protocol, evidence log), RFC 0003 (Akela engine); KB spec §6.5 |
| **Supersedes** | nothing — interactive behaviour is unchanged; headless is opt-in |
| **Locale** | English normative; Korean twin to follow |

## 1 · Problem

QABuddy is interactive by construction. Every skill pauses for the SDT — Review
Options after each phase, "does this look right?" before a charter, "confirm?" on a
page-object screenshot — and the guided workflow will not advance without a human.
That is the right default for a QA engineer at a keyboard. It is also the only thing
standing between the skills and a pull request: a PR has a bounded diff, a natural
trigger, a place to write results, and a reviewer already waiting, but nobody is
there to answer (A).

Two smaller gaps sit underneath. Nothing in the knowledge base says *which code a
feature owns*, so a diff cannot be mapped to the features it touches. And test
coverage is only ever stated per AC as `full | partial | none` — an intent recorded by
the mapping, not proof on disk — so a per-layer coverage view (unit / API / e2e /
manual / exploratory) has no data to draw from.

This RFC adds the smallest set of things that lets a workflow run the existing skills
unattended on a PR and post one honest coverage comment: a headless mode, a
`sources.json` per feature, a canonical layered mapping, and a deterministic script
that does everything the model should not.

## 2 · Decisions

1. **No new skill.** Headless is a *mode* of the existing skills, defined once in the
   Tier 1 preamble (`core/preamble-base.md` "Headless Mode") and reinforced at the
   handful of gates that are truly blocking. `QABUDDY_HEADLESS=1` is the primary
   switch because skills invoke skills (`/qa-e2e-write` → `/qa-e2e-pom`) and an env
   var survives the hop; `--headless` is a per-invocation alias. Defaults are unchanged:
   the eval fixture that asserts `/qa-start` pauses stays green.
2. **Determinism boundary.** Everything that maps, scores, renders, or posts lives in
   `bin/pr-coverage.js` (zero dependencies, shipped as
   `{{REFERENCE_PATH}}/bin/pr-coverage.js`). The model produces knowledge-base and
   Playwright artifacts; it never decides what "covered" means and never talks to the
   GitHub API. The workflow runs the script before the skills (`touched`) and after
   them (`heatmap`, `comment`).
3. **Write scope.** A headless run writes only under `features-kb/`, `playwright/`,
   `playwright.config.*`, and `.qa-reports/`. It never commits, pushes, or opens a PR.
   Delivery is the workflow's job: one sticky comment on the source PR (found by the
   marker `<!-- qabuddy:heatmap -->`, patched in place) and one companion PR on branch
   `qabuddy/pr-<n>` into the base branch, opened by a workflow step. Nothing writes to
   the base branch directly.
4. **`features-kb/features/<key>/sources.json`** (KB spec §6.8) is the canonical
   diff→feature mapping: `sources` globs the feature owns, `tests.{unit,api,e2e}` globs
   where its tests live, `exclude` winning over both. `/qa-test-plan` writes it (step
   4b; proposed and confirmed interactively, mandatory headless). When no feature
   matches a diff the workflow's default is `--fallback none`: nothing runs, nothing is
   spent, and the comment names the unmapped files. `--fallback all` (every feature,
   flagged in the comment) is opt-in for repositories that have not written
   `sources.json` yet.
5. **The mapping shape is KB spec §6.5** — `testCases[{id, layer, type, status}]`,
   `unitTests[]`, `coverage` — written by `/qa-test-cases` in both modes. The scanner
   stays read-compatible with the two legacy shapes (`e2e_tests[]`/`unit_tests[]`, flat
   `tests[]`) and treats `META — …` strings as infrastructure evidence, never TC ids.
6. **Evidence rule.** A heatmap cell is `covered` only with a resolved path: a spec
   whose `test()` title carries the TC id (with pass/fail from Playwright's JSON
   reporter when present), a unit file that names the AC or TC, a saved QA report that
   executed the TC, or an exploratory session row that lists the AC. A test case that
   exists without proof is `partial`; no test case is `gap`. This is test-plan's
   "never claim coverage without a file path" applied per layer.
7. **Headless exploratory persists into the KB** at
   `features-kb/features/<key>/exploratory/<date>.md` (KB spec §6.9) — the same report
   `/qa-exploratory` saves under the gitignored `.qa-reports/` — with an `ACs` column in
   Focus Area Results so the Exploratory column has evidence. Provisional: see §5.
8. **Runtime** is `anthropics/claude-code-action@v1` with a `prompt` (automation
   mode), the customer's own `ANTHROPIC_API_KEY`, per-phase `--max-turns` and
   `--max-budget-usd`, an explicit `--allowedTools` list, `--disallowedTools
   AskUserQuestion` as a belt-and-braces guard, and Playwright MCP (`@playwright/mcp
   --headless`) via `--mcp-config` for the browser. Skills are installed on the runner
   with `dist/claude/setup` (global symlinks, as CI already proves on ubuntu). The action
   receives the workflow's own `github_token`, so no Claude GitHub App install is needed —
   the sticky comment and the companion PR are posted by workflow steps, not by the action.
9. **Phases are selected by label or comment, never by every push.** `pull_request`
   `opened` / `ready_for_review` runs the cheap `kb` phase (test cases, mapping, gaps,
   heatmap). Labels `qa:explore`, `qa:automate`, `qa:full` add the expensive phases;
   `/qabuddy [explore|automate|full]` in a comment reruns. One concurrency group per
   PR, cancel-in-progress. Drafts are skipped.
11. **One session per phase.** `kb`, `explore`, and `automate` each run in their own
    `claude-code-action` invocation with their own `--max-turns` / `--max-budget-usd`
    and `continue-on-error: true`. Later phases build on the files earlier phases wrote.
    Delivery steps run `always()`; a final step fails the job if any phase failed, after
    everything produced has been delivered.
10. **Fork PRs are skipped.** GitHub withholds secrets from forks and the run needs an
    API key and a write token; the workflow's `if:` checks the head repository. This
    is documented, not solved — a hosted service would run forks read-only.

## 3 · Staged delivery

| Step | Repo | Content | Behaviour change |
|---|---|---|---|
| A | QABuddy | `bin/pr-coverage.js`, `testPrCoverage` (48 checks), KB spec §6.5 note + §6.8 + §6.9 (en + ko), this RFC | none — new file, new docs |
| B | QABuddy | Headless Mode in the preambles (en + ko), gate edits in start / test-plan / test-cases / exploratory / e2e-setup / e2e-pom, six `headless` fixtures | none unless `QABUDDY_HEADLESS=1` or `--headless`; `/qa-test-cases` now writes the §6.5 mapping shape in both modes |
| C | `qabuddy-poc-acme` | Scratch customer repo: Acme Projects app, seeded KB (AC1–AC6, TC-01–TC-04 mapped, AC5/AC6 deliberately unmapped), workflow, prompt, MCP config; control PR and demo PR; `kb` phase | n/a (new repo) |
| D | `qabuddy-poc-acme` + this RFC | `qa:explore`, `qa:automate`, `qa:full`; seeded Playwright scaffold; measurements recorded in §4; Accept / Kill | n/a |

Nothing in this RFC is proposed for `main`. The branch is a proof of concept; the
decision to promote any part of it is Timothy's, after §4 has numbers.

## 4 · Measurement and kill criteria

On the demo PR (`server.js` changed so that DELETE returns 204 but the row stays
listed — the fixture app's `v3` behaviour arriving as a plausible refactor):

| | Criterion | Kill if |
|---|---|---|
| (a) | `touched` maps `server.js` → `projects`, deterministically | fails — the deterministic layer is wrong |
| (b) | Heatmap shows AC5 / AC6 as `gap` in E2E and Manual before the run; AC4 at risk after | fails — same |
| (c) | Headless exploratory reports a finding on the delete flow in ≥ 2 of 3 runs | (c) and (d) both fail on 3 consecutive runs |
| (d) | Automate phase produces specs whose titles carry TC ids; TC-04 red on the demo branch | see (c) |
| (e) | Cost within caps — kb ≤ $5, explore ≤ $10, automate ≤ $20, full ≤ $30 — and wall time ≤ 60 min | cost > 2× cap |
| (f) | Zero `AskUserQuestion` calls in the action's execution file | any call — headless leaked a question |

### Results so far (step C, 2026-09-05, `TimothyHan/qabuddy-poc-acme`)

| Check | Result |
|---|---|
| Control PR #1 (README only) | `resolve` + `run` green in ~1 min; `touched` mapped nothing; model step skipped; comment posted naming `README.md` as unmapped; **$0** |
| `/qabuddy` comment on #1 | second run patched the same comment (id unchanged, `updated_at` moved) — one comment per PR holds |
| Demo PR #2 (`server.js` soft-delete) | `touched` → `projects` deterministically (a); seeded heatmap posted: AC1–AC4 `partial` in E2E + Manual, AC5/AC6 `gap`, Exploratory `not run` (b, pre-run half); QABuddy installed on the runner from `poc/cloud-service` and `dist/claude/setup --status` clean |
| Model step on #2 | failed before any spend: `ANTHROPIC_API_KEY` secret not set, and the action attempted a GitHub App token exchange (fixed: `github_token` passed) |

### Local headless runs (step D, Timothy's Claude Code, `claude -p`, ko skills via the local symlink)

| Run | Result |
|---|---|
| `/qa-test-cases projects --update --headless` | DONE in 33 turns, 231 s, **$1.24**; zero questions, zero permission denials (f); three Auto-decisions in `.qa-reports/headless/qa-test-cases.json`; §6.5 mapping written; TC-05–TC-07 added so AC5/AC6 move from `gap` to `partial` (b, post-run half for the kb phase); captured LRN-20260904-02 (zero-match search and the true empty state render the same DOM) |
| `/qa-e2e-setup --headless` (Playwright MCP via `--mcp-config`) | DONE in 52 turns, 404 s, **$1.60**; zero questions; probed cookie auth → storageState, workers 2 + dependent global-state project (applied LRN-20260904-01), white-box = propose (because `sources.json` exists), functional POM; both gates green; four Auto-decisions in AUTOMATION.md and the close file; captured LRN-03 (`/api/reset` is harness-only) and LRN-04 (the four testability gaps). Scaffold seeded into `qabuddy-poc-acme` main so CI automate starts at `/qa-e2e-pom` |
| `/qa-exploratory projects --quick --headless --url …` against the soft-delete build (Playwright MCP) | DONE in 47 turns, 260 s, **$1.31**; zero questions; charter derived from the diff; **found the planted bug** — BUG-001, deleted rows stay listed (AC4, Blocker) — plus BUG-002, the duplicate-name check counts soft-deleted rows (AC2/AC3); session persisted to `features-kb/features/projects/exploratory/2026-09-04.md` with the AC-keyed table; screenshot evidence saved; the heatmap then shows AC2/AC3/AC4 ⚠️ with `#Finding` links — (c) 1 of 3 runs, (b) post-run half |

Local tally against §4: (a) ✓ · (b) ✓ · (c) 1/1 so far · (d) pending CI automate · (e) every
local phase far under its cap (kb $1.24 / $5, explore $1.31 / $10, setup $1.60) · (f) 0
questions across three headless runs, 132 turns.

### First full CI run (2026-09-05, PR #2, `/qabuddy full`, subscription OAuth token)

| | |
|---|---|
| Session | one `claude-code-action` session for all three phases: **222 turns, $8.18, 27.5 min**, final result `success` — then failed by the action because 222 > the 220-turn cap, which skipped the suite-execution step |
| Heatmap posted | every AC has a spec whose title carries its TC id (E2E ✅ ×6, "not run" because the results step was skipped); exploratory row for every AC, **AC4 ⚠️ finding**; 12 covered · 9 partial · 9 gap · 1 AC at risk |
| Companion branch `qabuddy/pr-2` | 30 files: TC-05/TC-06 added, §6.5 mapping, persisted exploratory session, BUG-001, page objects for login and projects with proof screenshots, POM inventory, API client, fixtures, seven specs, updated AUTOMATION.md. `gh pr create` was refused — the repository did not allow Actions to open PRs (setting enabled afterwards; PR #3 opened by hand) |
| Not uploaded | the `.qa-reports` artifact — `upload-artifact@v4` skips dot-directories unless `include-hidden-files: true` |
| Auth detours before this run | API key: valid but its organization had no credit (`billing_error`); first OAuth token: pasted value rejected (401); second OAuth token: worked. Each failed attempt cost $0 |

Tally after the first full run: (a) ✓ · (b) ✓ · (c) 2/2 (local + CI) · (d) specs with TC ids ✓,
pass/fail pending a run whose results step executes · (e) $8.18 for `full`, under the $25 cap ·
(f) `AskUserQuestion` was disallowed at the CLI; the run finished without a question.

**Design change from this run (decision 11):** one action session per phase — `kb`,
`explore`, `automate` — each with its own turn and budget cap and `continue-on-error`,
so a cap or failure in automation never discards the documentation phases, and the
results, companion PR, heatmap, and artifact steps always run. The job's final step
reports per-phase outcomes and fails the run honestly if any phase did.

## 5 · Open questions

- **`learnings-log.jsonl` under concurrent PRs.** Every headless run appends to the
  project-wide log and the companion PR carries the lines. Ten open PRs mean ten
  companion PRs appending to one file. Options: rebase-merge (trivial conflicts,
  manual), per-PR shards (`learnings-log/<pr>.jsonl`, needs an engine change
  upstream), or exclude the log from companion PRs (loses evidence). Not decided.
- **Exploratory persistence (decision 7).** Writing sessions into the KB makes them
  evidence but also makes the KB grow per PR. A retention rule (keep the latest N per
  feature) or a reference to the workflow artifact may be the better long-term home.
- **Companion PR targets base, artifacts were generated against head.** Test cases and
  specs written for behaviour that only exists on the source branch may be red on base
  until the source PR merges. The companion PR body says so; a hosted service would
  stack the companion on the source branch instead.
- **Skill discovery inside the action.** Claude Code discovers personal skills under
  `~/.claude/skills`; the workflow keeps a project-scope fallback (copy into
  `.claude/skills/`) behind a repository variable in case the action's runner scope
  differs. Verified in step C.
