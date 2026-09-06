# RFC 0005 — Implementation plan

Working document for [RFC 0005](0005-rubric-scored-evals.md). One section per PR: files,
behaviour, checks, acceptance, cost. Each PR is green on `node test.js` and independently
revertable. Timothy merges every PR.

Conventions that apply throughout: en + ko twins for every `SKILL.md` and reference edit; badge
re-sync when the check count moves; no credentials in committed files; `dist/` is generated.

---

## PR1 — Schema, structural checks, pilot rubrics and cases

**Goal:** everything that needs no model call. After this PR the repo carries validated rubrics and
cases for `test-cases` and `exploratory`, and `test.js` refuses malformed ones.

### Files

```
core/skills/eval/rubric.schema.md          # human-readable schema (the JSON below), en
locales/ko/skills/eval/rubric.schema.md    # ko twin
core/skills/test-cases/tests/rubric.json
core/skills/test-cases/tests/cases/<id>/{case.json,input/,judge-notes.md}   × 3
core/skills/test-cases/tests/controls/<criterion>.md                        × one per floored criterion
core/skills/exploratory/tests/rubric.json
core/skills/exploratory/tests/cases/…                                       × 3
core/skills/exploratory/tests/controls/…
test.js                                     # testRubrics()
```

### Rubric schema

```jsonc
{
  "skill": "<name>", "skill_version": "<semver, must equal SKILL.md>", "rubric_version": 1,
  "judge": { "model": "<pinned id>", "prompt": "core/skills/eval/judge.md", "temperature": 0 },
  "threshold": null,                          // null until calibrated
  "calibration": null,                        // { "date", "artifacts", "agreement": {criterion: 0.9}, "floor_agreement": 1.0 }
  "criteria": [
    {
      "id": "<kebab>", "kind": "judge" | "check" | "process",
      "weight": 1..3, "floor": 0..3,           // floor 0 = no floor
      "cites": { "constraint": n } | { "self_check": n } | both,
      "statement": "<one sentence, testable>",
      "anchors": { "0": "...", "1": "...", "2": "...", "3": "..." },   // judge only
      "check": { "field": "...", "op": "...", "value": "..." }          // check/process only
    }
  ]
}
```

`field` prefixes for `process`: `run:<file>` (a file in the run directory: `scratchpad.md`,
`events.jsonl`, `profile.json`), `exec:` (the headless execution file — tool calls by name),
`log:` (`features-kb/learnings-log.jsonl` lines for this run). Operators are the existing
simulate/execute set plus `count_gte`.

### Case schema

```jsonc
// case.json
{ "id": "projects-happy", "app": "v1" | "v3" | null, "port": 4173,
  "runner_args": "projects --headless --url http://localhost:4173",
  "description": "…", "tags": ["happy-path"] }
```

`input/` is copied into the scratch workspace before the run (a `features-kb/`, `.qabuddy.json`
with `contextSource: "spec"`, spec files, existing tests). `judge-notes.md` is read by the judge
only.

### Pilot rubrics (from the skills' numbered constraints and self-checks)

`test-cases` v0.5.2:

| id | kind | w | floor | cites | statement |
|---|---|---|---|---|---|
| traceability | judge | 3 | 2 | C3, SE1 | every AC has ≥ 1 case, every case names its AC, gaps listed |
| coverage-honesty | judge | 2 | 2 | SE2 | `full` only with happy + negative + boundary; otherwise `partial` |
| no-code | check | 1 | 1 | C2, SE6 | no fenced code in the cases document |
| dedup-by-assertion | judge | 2 | 1 | C5, SE3, SE4 | an existing test is credited only with the assertion that would fail (judge-notes name the vacuous test) |
| prioritization | judge | 1 | 0 | C6, SE5 | P0 ≤ 50 %, at least one P0 on the core happy path |
| observed-or-unverified | judge | 2 | 1 | C7, SE7 | labels, seeds, values, requests are backed by `Observed:` or marked `(unverified)` |
| probed-app | process | 1 | 1 | C7 | `run:scratchpad.md` matches `^Observed:` or `(unverified)` |
| cited-sources | process | 1 | 0 | preamble ob. 2 | `log:` has ≥ 1 `applied` line for this run |
| status-block | check | 1 | 1 | template | cases document ends with `**Status:**` |

`exploratory` v0.4.6:

| id | kind | w | floor | cites | statement |
|---|---|---|---|---|---|
| finding-correctness | judge | 3 | 2 | C4 | findings match the app's known state (judge-notes: planted bug present/absent); no invented bugs |
| classification | judge | 2 | 1 | C3 | every finding has severity and priority from the scales |
| evidence | judge | 2 | 1 | C4, SE | every finding has steps, expected/actual, evidence, action |
| charter-quality | judge | 1 | 0 | Phase 2 | focus areas ranked by risk, each names a heuristic |
| no-duplicate-scenarios | judge | 1 | 1 | SE2 | no "new scenario" duplicates a KB test (judge-notes list them) |
| duration-recorded | check | 1 | 1 | SE | report has a numeric Duration |
| console-checked | process | 1 | 0 | C5 | `exec:` shows console/network tool calls after interactions |
| no-questions | process | 1 | 1 | headless | `exec:` has zero `AskUserQuestion` |

### Cases

`test-cases`: **projects-happy** (fixture app v1, the acme `projects` feature with six ACs, app
reachable → exercises constraint 7); **thin-ticket** (a story with placeholder ACs → gaps and
NEEDS_CONTEXT, no invented ACs); **vacuous-coverage** (existing Playwright tests where one
"covers" AC3 with an assertion that cannot fail; judge-notes name it).

`exploratory`: **v1-clean** (no planted bug; the correctness criterion penalizes invented
findings); **v3-planted** (delete returns 204 but the row stays — the RFC 0004 (c) case, found
3/3 so far); **quick-timebox** (`--quick`; duration and unexplored areas must be recorded).

### `test.js` checks (`testRubrics`)

- rubric parses; `skill_version` equals the `SKILL.md` frontmatter version
- every criterion: id unique, kind valid, weight 1–3, floor 0–3, `cites` resolves — constraint
  `n` exists in the `## Constraints` list, self-check `n` in the self-evaluation list
- `judge` criteria have four anchors; `check`/`process` have a `check` block with a known operator
- every criterion with `floor > 0` has `tests/controls/<id>.md`
- `threshold` is null unless `calibration` is present
- `judge.model` is an Opus id and never equals the runner model passed to `eval.js` (decision 15)
- every case has `case.json` + `input/`; no file under `input/` contains a line from
  `judge-notes.md` (the ANSWER-KEY rule)
- CONTRIBUTING: new section "Rubrics" (en + ko), submission checklist item

### Acceptance

`node test.js` green with the new checks counted (badge bump). No LLM calls in this PR. The
rubric tables above are reviewed by Timothy line by line before merge — decision 14.

---

## PR2 — `bin/eval.js`: run, judge, report

**Goal:** the local bench. One command runs a skill headless per case × n, grades, and writes a
report. Controls are judged first.

### Commands

```
node bin/eval.js run <skill> [--cases a,b] [--runs 3] [--ref <git-ref>] [--model <id>] [--out <dir>]
node bin/eval.js judge <artifact-dir> --rubric <path> [--notes <file>] [--passes 3]
node bin/eval.js controls <skill>          # judge the controls only; exit 1 on any vacuous criterion
node bin/eval.js report <eval-dir>         # regenerate report.md from scores.json
```

### `run` protocol

1. Resolve the QABuddy ref: default = working tree; `--ref` builds that ref into a temp dir and
   points the runner's skill path at it (the RFC 0004 install step, reused).
2. `controls` first. Any control at or above its floor → exit 1, no runner spend.
3. Per case: start the fixture app variant if `app` is set (`APP_VARIANT=… PORT=… node server.js`,
   `POST /api/reset` between runs); create a scratch workspace outside the repo; copy `input/`.
4. Per run: `claude -p` with the RFC 0004 headless flags (`--model`, allowed tools, no
   `AskUserQuestion`, turn and dollar caps from `case.json` or defaults kb-sized: 80 turns / $5).
   Capture the execution file, the run directory (`.qa-reports/runs/<run>/`), the KB artifacts,
   cost and turns.
5. Grade: `check` and `process` criteria deterministically; `judge` criteria via one judge call per
   run with the case input, judge-notes, the artifact(s) and the criteria. Judge output is JSON:
   `{ criterion: { score, evidence } }`; a score without a quotable `evidence` string is recorded as
   0 (a grade nobody can audit is not a grade).
6. Write `scores.json` and `report.md`; tear down the app.

### `scores.json`

```jsonc
{ "schema": "eval-scores/1", "skill": "test-cases", "skill_version": "0.5.2", "rubric_version": 1,
  "ref": { "name": "HEAD", "sha": "…" }, "models": { "runner": "claude-sonnet-5", "judge": "claude-opus-5" },
  "controls": { "traceability": { "score": 1, "floor": 2, "ok": true }, … },
  "cases": [ { "id": "projects-happy", "runs": [
      { "n": 1, "cost_usd": 1.24, "turns": 33, "run_dir": "…",
        "criteria": { "traceability": { "score": 3, "evidence": "…" }, "no-code": { "score": 3 } },
        "total": 0.86, "floor_breaches": [] } ] } ],
  "summary": { "mean": 0.84, "min": 0.79, "max": 0.88, "floor_breaches": 0,
               "verdict": "PASS" | "FAIL" | "REPORT-ONLY (uncalibrated)", "cost_usd": 11.9 } }
```

### Judge prompt — `core/skills/eval/judge.md`

Fixed text, versioned with the rubric: you grade one artifact against numbered criteria; you have
not seen and must not infer the procedure that produced it; for each criterion pick the anchor
that fits, quote the line(s) that decide it, output JSON only; if the evidence for a score is not
in the artifact, score 0. Inputs are appended in a fixed order: case input, judge notes, artifact,
criteria.

### Model attribution

`eval.js` records both models. In parallel, a small Akela PR: the launcher forwards `QAB_MODEL`
as `AKELA_MODEL` and compile stamps `profile.model`; the RFC 0004 workflow sets it from
`inputs.model`. Interactive Claude Code sessions cannot set it reliably; those runs stay
unattributed and `stats` says so.

### Acceptance

- `eval.js controls test-cases` and `… exploratory` exit 0 (every control below floor, 3/3 passes)
  — RFC §5 (a).
- `eval.js run test-cases --runs 1` completes on the fixture app under $5 and writes a report
  whose verdict is `REPORT-ONLY (uncalibrated)`.
- `eval.js judge` on the same artifact three times: totals within 0.1 — RFC §5 (c).
- `test.js`: a smoke that runs `eval.js report` on a committed sample `scores.json` and checks the
  markdown has the per-criterion table and the spread line; no model calls in CI.

### Cost

Per skill, 3 cases × 3 runs × ≈ $1.3 (RFC 0004 local figures: test-cases $1.24, exploratory
$1.31) ≈ $12, plus ≈ 10 judge calls.

---

## PR3 — Calibration

**Goal:** thresholds that come from evidence. After this PR the two pilot rubrics can gate.

### Steps

1. Assemble ≥ 10 artifacts per skill: real outputs from the logged projects (payload-poc,
   skills-test — with their inputs reconstructed as cases), the PR2 runs, and the controls.
2. Timothy scores each with the rubric (a scoring sheet per artifact, `tests/calibration/<id>.json`:
   per-criterion score + acceptable yes/no).
3. `node bin/eval.js calibrate <skill>`: judges each artifact three times, computes per-criterion
   agreement, floor agreement, repeatability; proposes `threshold` = min total among artifacts
   marked acceptable; writes the `calibration` block into `rubric.json` only when RFC §5 (b) and
   (c) hold, otherwise prints the criteria to revise.
4. Anchor revisions are commits; each re-runs calibration. Two failed revisions on one criterion →
   move it to `check`/`process` or drop it (RFC §5 (b) kill).

### Acceptance

- Both pilot rubrics carry a `calibration` block and a non-null `threshold`.
- `eval.js run` on each pilot skill reports `PASS` or `FAIL`, never `REPORT-ONLY`.
- RFC §6 gains the calibration table: artifacts, agreement per criterion, threshold.

---

## PR4 — A/B mode, CI workflow, the four ablations

**Goal:** the ablation bench, and the first decisions it pays for.

### `eval.js ab`

```
node bin/eval.js ab <skill> --a <ref> --b <ref> [--cases …] [--runs 3] [--model <id>]
```

Runs both refs on the same cases, same judge; `report.md` adds a per-criterion delta table
(mean A, mean B, spread A, spread B, verdict: `regression` / `improvement` / `not distinguishable
at n=3`). Discrimination check first: RFC §5 (d) — `--a HEAD --b <HEAD with constraint 7 removed>`
must show a regression on `observed-or-unverified` for `projects-happy`; if it does not, the bench
stops and says so.

### `skill-eval.yml`

Manual dispatch: `skill`, `ref-a`, `ref-b` (optional), `model`, `runs`, `budget-usd`. Installs
QABuddy at each ref the RFC 0004 way, runs `eval.js ab` (or `run`), uploads
`.qa-reports/evals/` with `include-hidden-files: true`, posts the delta table as the job summary.
Stops at `budget-usd` and reports partial. Secrets as in RFC 0004.

### The four ablations (each an A/B on the relevant pilot skill)

| # | Variant B | Skill / case | Decides |
|---|---|---|---|
| 1 | constraint + phase step + self-check collapsed to one statement for the "observed beats assumed" rule | test-cases / projects-happy | whether the triple-statement pattern buys anything on Sonnet 5 |
| 2 | `exploratory-heuristics#techniques-per-heuristic` removed from scope | exploratory / v3-planted | whether the technique lists change what gets found |
| 3 | `shift-left#principles` removed from scope | test-plan (needs a case; or defer to PR6) | — |
| 4 | preamble + skill at 2× length (duplicated phrasing) vs current | test-cases / all three | whether "instruction fatigue" is measurable on Sonnet 5 |

Outcomes go into RFC §6 with the delta tables; each decided ablation becomes a normal PR (scope
edit or skill edit) citing the eval run.

### Acceptance

- Discrimination check passes on both pilot skills.
- ≥ 1 ablation decided — RFC §5 (f).
- A/B cost ≤ $30 per pair — RFC §5 (e).

---

## PR5 — Wiring into `/qa-improve` and `/qa-eval`

**Goal:** the eval is part of the normal change flow, not a side tool.

- `/qa-improve` Phase 4 step 3 (en + ko): after fixtures, if the changed skill has a calibrated
  rubric, run `eval.js ab --a <base> --b <working tree>`; a floor breach or a regression outside the
  spread blocks delivery; the per-criterion delta goes into the PR body. Distill's promotion gate
  (Distill rule 4) uses the same comparison for the skills in the promoted section's scope.
- `/qa-eval --rubric <skill>` (en + ko): delegates to `eval.js run`; the summary template gains the
  per-criterion table and the verdict line; simulate mode is marked deprecated for skills with a
  calibrated rubric.
- CONTRIBUTING (en + ko): "Rubrics" section finalized; submission checklist: "if the skill has a
  rubric, `eval.js ab` before/after attached to the PR".
- `README` roadmap paragraph and the self-learning guide §6 mention the bench in one line each.

### Acceptance

- One `/qa-improve` fix on a pilot skill delivered through the new gate, with the delta table in
  its PR.
- Skill versions bumped (improve, eval); fixtures updated; badge re-synced.

---

## PR6 — Remaining prose skills (optional, per skill)

Only when a skill has ≥ 8 logged runs to calibrate against. Order by log volume: `qa`,
`e2e-pom`/`e2e-write` (execute criteria as floors), `test-plan`, `review-ticket`, `verify-fix`.
Each is its own PR: rubric + 3 cases + controls + calibration.

---

## Cost summary

| Activity | Estimate |
|---|---|
| PR1, PR3 authoring, PR5 | no runner cost |
| one full `eval.js run` per pilot skill | ≈ $12 |
| calibration judge passes | < $2 per skill |
| one A/B | ≈ $25 |
| the four ablations | ≈ $100 |
| pilot total | ≈ $150 |

## Risks

- **Judge and runner are both Claude models.** Decision 15 puts Opus on the judge seat so the runner
  never grades itself or its twin; residual shared blind spots are what calibration (b) exists to
  catch. If (b) fails on a criterion a human grades easily, the anchors are the first suspect, the
  judge model the second.
- **Fixture app is too small** to show differences between variants (ceiling effect). Mitigation:
  the acme scratch repository cases and the thin/vacuous cases are designed to be hard, not happy.
- **n=3 noise swamps small effects.** Stated in every report; ablations that come out "not
  distinguishable" are left in place, not removed on a guess.
