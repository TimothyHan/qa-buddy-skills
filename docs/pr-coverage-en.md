# QABuddy on CI

Experimental since 0.9.0. The interactive skills are unchanged, and everything below was
checked on one demo repository. The design record is [RFC 0004](rfc/0004-headless-pr-coverage.md).
한국어: [pr-coverage.md](pr-coverage.md)

When you open a pull request, QABuddy looks at what it changed, finds the acceptance
criteria of the features that own that code, and posts one comment showing which criteria
have tests and which don't. Where criteria are empty it writes test cases, and if you ask,
it runs the app, explores it, writes Playwright tests, and opens a separate PR with them.
People make the calls. Whether to merge that PR, and what to do about what exploration
found, is not QABuddy's decision.

The model does not guess what to test. Each feature has a `sources.json` that says which
code it owns, and the diff reaches the feature and its acceptance criteria through those
files. The test cases the feature already has, its past exploratory sessions, and the
learnings captured from earlier runs decide what gets written next. And "covered" is only
said when there is evidence on disk.

---

## What lands on the PR

**One comment.** Every run updates the same comment in place. Three rows from a real
comment on the demo repository:

| AC | Unit | API | E2E | Manual | Exploratory |
|---|---|---|---|---|---|
| **AC1** — A user can sign in with valid credentials … | 🔴 | 🔴 | ✅ TC-01 · PASS | 🟡 TC-01 | ⚪ |
| ⚠️ **AC4** — A user can delete a project … no longer appears in the list. | 🟡 | 🔴 | ⚠️ ✅ TC-04 · FAIL | 🟡 TC-04 | ⚪ |
| **AC6** — With zero projects, the page shows a "No projects yet" message … | 🔴 | 🔴 | ✅ TC-07 · not run | 🟡 TC-07 | ⚪ |

Rows are acceptance criteria, columns are test layers. A cell means one of five things.

- ✅ Covered. A file that verifies this criterion exists. For a spec, the run result is attached.
- 🟡 Designed but not proven. There is a test case, but no file or report that executed it.
- 🔴 Nothing.
- ⚪ That layer did not run this time.
- ⚠️ A failing spec or an exploratory finding on this criterion. AC4 above is one.

A collapsed "Evidence" list under the table names the file behind every cell. The last
line says what this run cost and which secret paid.

**One PR.** The generated files go on a branch `qabuddy/pr-<number>`, opened as a PR
against the original PR's branch. We call it the companion PR. Its description is a to-do
list. Again from the demo repository:

> **Fix on `demo/soft-delete-2` (author)**
> - [ ] **BUG-001** (P1) — Deleted projects remain in the list after a reload
> - [ ] **BUG-002** (Normal) — No error toast when Create is rejected for a soft-deleted project's name
>
> Then comment `/qabuddy heatmap` on #6 to re-verify. Keep the fix on the source branch — this PR carries the tests, and the failing spec should turn green there.
>
> **Decide (reviewer)**
> - [ ] issues/10 — Escape does not close the delete-confirmation dialog

Bugs get fixed by the author on the original branch. The companion carries the tests, so
once the fix lands the red spec turns green there. Findings that need a person become
GitHub issues, and a rerun updates the same issue instead of opening another.

**One announcement.** The original PR gets a comment saying a PR with tests was opened,
with the fixes and decisions summarised. When the companion merges, it gets a 🚀 and a
"merged into" line.

---

## First run

1. **Build the knowledge base first. This step is mandatory.** To connect a PR's changed
   code to features and their acceptance criteria, every feature needs a `feature.md` and a
   `sources.json`, and `/qa-test-plan` is what writes them. CI does not create them. Run it
   locally once per feature, commit the resulting `features-kb/`, and merge it into the
   base branch.

   ```
   /qa-test-plan PROJ-123        # a Jira key, or a feature slug in spec mode
   ```

   With an empty knowledge base, `preflight` leaves a "could not start" comment and never
   calls the model. A feature without `sources.json` maps to no change at all, and the
   comment comes out empty.

2. Create `.github/workflows/qabuddy.yml` and paste this in. Change only how your app
   starts. Everything else lives in QABuddy's workflow.

   ```yaml
   name: QABuddy
   on:
     pull_request:
       types: [opened, ready_for_review, labeled, closed]
     issue_comment:
       types: [created]
   permissions:
     contents: write
     pull-requests: write
     issues: write
   jobs:
     qabuddy:
       uses: TimothyHan/qa-buddy-skills/.github/workflows/qa-buddy-pr.yml@v0.9.1
       with:
         app-start: "node server.js"
         app-url: "http://localhost:4173"
       secrets: inherit
   ```

   If you would rather not write it, run `/qa-setup --pr`. It finds the start command
   and URL for you and walks through the steps below, checking each one. From a terminal,
   this does the same:

   ```bash
   node ~/.claude/skills/qa-references/bin/pr-coverage.js init --app-start "node server.js" --app-url http://localhost:4173 --labels true
   ```

3. Store a token as a repository secret. This is the token that pays. Who pays is under
   "Cost and accounts" below.

   ```bash
   claude setup-token
   ```

   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN
   ```

   QABuddy, the wizard included, never takes the token value. You run `gh secret set`
   yourself.

4. If the app has a login, add `TEST_USER` and `TEST_PASS` as secrets too.

5. Allow Actions to open pull requests in the repository settings: Settings → Actions →
   General → "Allow GitHub Actions to create and approve pull requests".

6. Open a PR. The first job, `preflight`, checks the five items above before calling the
   model, and if anything is missing it says what and how to fix it in a comment.

`qabuddy.yml` lives in your repository. The actual jobs live in QABuddy's repository at
`qa-buddy-pr.yml@v0.9.1`. The runner installs QABuddy at that tag itself, so the version
on your machine does not matter. Only `/qa-setup` and the `init` command need a local
copy, and 0.9.0 or later is enough.

---

## When it runs, and when it doesn't

The default is quiet. Opening a PR, or marking it ready for review, runs the `kb` phase
and nothing else. Writing the test cases and posting the comment and the companion takes
about a dollar and a few minutes. That is all.

Ask for more on the PR itself. Add a label `qa:explore`, `qa:automate`, or `qa:full`, or
comment `/qabuddy explore`, `/qabuddy automate`, `/qabuddy full`, or `/qabuddy kb`.

Merging the companion recomputes the comment. No model is involved, so it takes about
ninety seconds and costs nothing. Commenting `/qabuddy heatmap` does the same. Use it
after fixing a bug.

If you want the next phases to follow a merge on their own, put
`after-companion-merge: full` in the caller. Then reviewing and merging the kb companion
runs exploration and automation, and their results arrive as a second companion. It stops
once a companion that carried automation has merged.

**When it does not run.** Not on every push. Not on draft PRs, not on PRs from forks, and
not on companion PRs themselves. One run per PR at a time, and a new request cancels the
one in progress.

---

## The three phases

| Phase | What it does | About |
|---|---|---|
| `kb` | `/qa-test-cases --update`. A test case per acceptance criterion, the mapping per layer, the gap analysis | $1, 3–6 min |
| `explore` | `/qa-exploratory --quick`. Explores the running app through Playwright MCP. A results table, screenshots, bug files | $1–2, 4–8 min |
| `automate` | `/qa-e2e-setup` (first time only) → `/qa-e2e-pom` → `/qa-e2e-write`. Page objects and specs, then the suite is run | $3–4, 12–17 min |

Each phase is its own Claude session on its own runner, with a cap on turns and on
budget. explore and automate run side by side after kb. All three on the demo app take
about 22 minutes and 6 dollars.

No session asks a question. Wherever a skill would normally stop and ask, it takes the
stated recommendation and records that choice as an *Auto-decision*. Anything that needs
judgment ends as `BLOCKED` and goes to a person.

---

## When exploration finds something

- **A bug** is listed under "fix" in the companion description and the announcement, and
  its criterion gets a ⚠️. The author fixes it on the original branch and checks with
  `/qabuddy heatmap`.
- **A new scenario** becomes a test case on the next kb run and a spec on the next automate.
- **A UX concern or a missing requirement** becomes a GitHub issue. A reviewer or product
  decides.
- **Something learned about the app** is kept as an `LRN-` entry, so the next run does not
  find it again.

---

## Cost and accounts

This workflow runs on Claude only. Even if you use the skills in Cursor or Copilot, the CI
side is `anthropics/claude-code-action`.

The cost goes to the secret you stored. A token from `claude setup-token` bills the Claude
subscription of whoever made it. For a personal repository that is fine. For a team
repository, make the token from a dedicated account, or use an `ANTHROPIC_API_KEY` with
credit.

None of this is hidden. `/qa-setup` says who pays before it shows the token commands,
`init` prints the same, and every comment ends with what the run spent and which secret
paid.

---

## Already using QABuddy in this repository

Keep the config and add the caller. `/qa-setup --pr` is the quickest way. Re-running
`/qa-setup` also offers "Keep, and set up PR automation".

Two things older repositories tend to run into. Features created earlier have no
`sources.json`; one `/qa-test-plan` per feature writes it, and its output has to be merged
before CI can map anything. That is not optional: it is the same requirement as step 1 of
the first run. Both `init` and preflight tell you which features. And branches created before the caller was committed do not
react to a companion merge until the base is merged in, because GitHub reads PR workflows
from the PR's own branch. Preflight warns about that too.

**If you change your mind mid-setup**, answer "stop" in `/qa-setup` or undo it like this:

```bash
node ~/.claude/skills/qa-references/bin/pr-coverage.js init --remove
```

That deletes the caller and the `qa:*` labels and leaves secrets and repository settings
alone. A caller without a token would put a "could not start" comment on every PR, so
QABuddy never leaves one behind.

---

## Settings

These go under `with:` in the caller.

| Input | Default | Meaning |
|---|---|---|
| `app-start`, `app-url` | | How to start the app and where it answers. Required |
| `health-path` | `/` | Path to poll until the app is up |
| `install` | `npm ci` | How to install dependencies |
| `default-phases` | `kb` | What runs on open: `kb,explore`, `kb,automate`, `kb,explore,automate` |
| `after-companion-merge` | `none` | After a companion merges. `none` refreshes the comment only; `full` and `automate` run the remaining phases |
| `delivery` | `companion-pr` | `commit` pushes straight onto the original branch, no companion |
| `issues-for` | `decisions` | Which findings become issues. `all` includes bugs, `none` opens nothing |
| `gate-on` | `none` | When the `qabuddy / gate` check fails: `at-risk`, `suite`, `gaps`. To block merges, require it in branch protection; that rule is the repository owner's to set |
| `kb-turns` / `kb-budget` and the rest | 80 / $5, 120 / $10, 300 / $25 | Per-phase caps |
| `model` | `claude-sonnet-5` | |
| `test-user`, `test-pass` | | Only for a public demo account. Real logins go in secrets |
| `extra-prompt` | `.github/qabuddy/extra.md` | Project instructions added to every phase |
| `qabuddy-ref` | `v0.9.1` | The QABuddy tag installed on the runner |

---

## Further reading

- The workflow's internals and every input: [`.github/qa-buddy-pr/README.md`](../.github/qa-buddy-pr/README.md)
- Why it is built this way, the measurements, the kill criteria: [RFC 0004](rfc/0004-headless-pr-coverage.md)
- The format of `sources.json` and of exploratory session files: knowledge-base spec §6.8 and §6.9
