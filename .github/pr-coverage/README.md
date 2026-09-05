# QABuddy on pull requests — reusable workflow

`.github/workflows/pr-coverage.yml` runs QABuddy headlessly on a consumer repository's pull
requests: it maps the diff to features in that repo's `features-kb/`, writes or updates test
cases, optionally explores the running app and automates the gaps with Playwright, posts one
sticky coverage-heatmap comment on the PR, and opens a companion PR with the knowledge-base and
Playwright changes. Design record: [RFC 0004](../../docs/rfc/0004-headless-pr-coverage.md).

## Use it from another repository

```bash
node ~/.claude/skills/qa-references/bin/pr-coverage.js init \
  --app-start "node server.js" --app-url http://localhost:4173 --labels true
```

That writes `.github/workflows/qabuddy.yml` (about fifteen lines, all of them about *your*
app), creates the `qa:*` labels, and lists what is still missing. The consumer repo needs:

- `.qabuddy.json` and a `features-kb/` with at least one feature that has a `sources.json`
  (KB spec §6.8) — `/qa-setup` and `/qa-test-plan` produce these;
- one secret: `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`, bills the subscription) or
  `ANTHROPIC_API_KEY` (needs API credit); `TEST_USER` / `TEST_PASS` if the app has a login;
- the repository setting that lets Actions create pull requests (for the companion PR).

The `preflight` job checks all of this before any model spend and explains what is missing in
the PR comment. One GitHub mechanic to know: `pull_request` workflows run from the PR's own
branch, so a branch cut *before* the caller was added does not chain on a merged companion
until the base branch is merged into it — preflight warns when that is the case.

## What runs

| Trigger | Phases |
|---|---|
| PR opened / ready for review | `kb` — test cases, §6.5 mapping, gaps, heatmap |
| label `qa:explore` · comment `/qabuddy explore` | + headless exploratory session |
| label `qa:automate` · comment `/qabuddy automate` | + page objects and specs for unautomated test cases |
| label `qa:full` · comment `/qabuddy full` | everything |
| comment `/qabuddy kb` | back to the kb phase only |
| comment `/qabuddy heatmap` | no model: re-map the diff, run the suite on the branch as it is, re-post the heatmap |
| a reviewer merges the companion that carried automation | the chain is complete: the same model-free refresh, so the heatmap reflects the merged branch |
| a reviewer merges the companion PR `qabuddy/pr-<n>` into the source branch | the rest on PR `<n>` — `after-companion-merge` input: `full` (default; explore runs beside automate, so it adds cost of about a dollar and no wall time), `automate`, or `none`; skipped when that companion already carried automation |

The caller's `default-phases` input sets what runs on open (`kb` by default; `kb,explore,automate`
for everything on every PR). Labels and comments override per PR. `kb` is always included —
explore and automate build on the test cases and mapping it writes, and it costs about a dollar.

Jobs: `resolve → preflight → kb → (explore ∥ automate) → deliver`. Each phase is its own
Claude session with its own `--max-turns` / `--max-budget-usd` (inputs). Phases hand their
trees to each other as artifacts; `deliver` unions explore and automate with a three-way
merge (`pr-coverage.js merge`, kb tree as the base), opens or updates the companion PR
`qabuddy/pr-<n>` **into the source PR's own branch** (so its diff is only the tests and they
merge to the base branch together with the feature), posts one comment announcing it the
first time, posts the heatmap, and fails the run honestly if any phase failed — after
everything produced has been delivered. When a reviewer merges the companion, the
announcement comment gets a 🚀 reaction and a "Merged into `branch`" line.

## What the companion PR says

Its description is a work list rendered by `pr-coverage.js summary` from what the phases wrote —
the exploratory session's findings, the bug files, each phase's close file, the heatmap, and the
suite results: what the PR adds, the findings, and three to-do lists — **fix on the source
branch** (author; then `/qabuddy heatmap` re-verifies), **decide** (reviewer), **not automated
yet**. Findings that need a human become GitHub issues (`issues-for`: `decisions` by default,
`all` to include bugs, `none`), labelled `qabuddy`, de-duplicated by a hidden marker so a rerun
updates rather than duplicates, and linked from both the PR body and the announcement comment.
The fix belongs on the source branch, not the companion: the companion carries the tests, and
the failing spec that documents the bug should turn green there once the fix lands.

## Blocking merges

Every job reports a check, but "the run finished" is the wrong thing to gate a QA bot on: a
run that found a failing spec still finishes green, because that failure is what it delivers.
The `gate` job turns a policy into a check you can require in branch protection
(`qabuddy / gate` when the caller job is named `qabuddy`):

| `gate-on` | fails when |
|---|---|
| `none` (default) | never — advisory |
| `at-risk` | any AC has a failing spec or an exploratory finding |
| `suite` | the executed Playwright suite has failures |
| `gaps` | any AC has no test case in any layer |

## Files here

| File | Role |
|---|---|
| `prompts/header.md` + `kb.md` / `explore.md` / `automate.md` | the per-phase prompts; a consumer's `extra-prompt` file is appended to the header |
| `render.js` | fills `{{PR}} {{PHASE}} {{FEATURES}} {{BASE_URL}} {{BASE_SHA}}` |
| `install.sh` | installs QABuddy on the runner (global symlinks, the path QABuddy's own CI proves) |
| `mcp.json` | Playwright MCP for the browser phases |

The deterministic pieces — diff→feature mapping, the heatmap, the sticky comment, the phase
merge, preflight, init — are `bin/pr-coverage.js`; the model only produces knowledge-base and
Playwright artifacts.
