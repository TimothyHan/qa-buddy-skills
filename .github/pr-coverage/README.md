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
the PR comment.

## What runs

| Trigger | Phases |
|---|---|
| PR opened / ready for review | `kb` — test cases, §6.5 mapping, gaps, heatmap |
| label `qa:explore` · comment `/qabuddy explore` | + headless exploratory session |
| label `qa:automate` · comment `/qabuddy automate` | + page objects and specs for unautomated test cases |
| label `qa:full` · comment `/qabuddy full` | everything |
| comment `/qabuddy kb` | back to the kb phase only |

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
everything produced has been delivered.

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
