# Rubric, case and control schema — RFC 0005 PR1

Files under `core/skills/<skill>/tests/` that `node test.js` validates (`testRubrics`).
No model calls happen here; PR2 adds the runner and the judge.

```
tests/
  rubric.json                 # the contract the skill is graded against
  cases/<id>/case.json        # one scenario the runner is pointed at
  cases/<id>/input/           # copied into the scratch workspace before the run
  cases/<id>/judge-notes.md   # facts only the judge sees (never in input/)
  controls/<criterion>.md     # a deliberately degraded artifact (judge / check criteria)
  controls/<criterion>/       # a deliberately degraded run directory (process criteria)
```

## rubric.json

| Field | Rule |
|---|---|
| `skill` | equals the directory name |
| `skill_version` | equals the `version` in `SKILL.md` — a skill edit that changes a constraint must touch the rubric |
| `rubric_version` | integer ≥ 1 |
| `judge.model` | an Opus id (`claude-opus-*`), never the runner's model — RFC 0005 decision 15 |
| `judge.prompt` | path of the judge prompt (shipped by PR2) |
| `judge.temperature` | 0 — the intent; the `claude` CLI exposes no temperature flag, so repeatability is measured instead (RFC 0005 §5 c) |
| `artifacts` | globs (relative to the workspace) of the files the judge grades — `features-kb/**/test-cases/*.md` and the mapping for test-cases; the session report for exploratory |
| `threshold` | `null` until `calibration` exists; then the number calibration derived |
| `calibration` | `null`, or `{ date, artifacts, agreement: {criterion: 0..1}, floor_agreement }` written by `eval.js calibrate` (PR3) |
| `criteria[]` | see below |

### criteria[]

| Field | Rule |
|---|---|
| `id` | kebab-case, unique in the rubric |
| `kind` | `judge` (0–3 by the judge), `check` (deterministic over produced files), `process` (deterministic over the run directory) |
| `weight` | integer 1–3 |
| `floor` | integer 0–3; `> 0` means a must-criterion: any run below it fails the skill, and a control must exist |
| `cites` | `{ "constraint": n }` and/or `{ "self_check": n }` — resolved against the numbered items under `## Constraints` and the items under the Self-Evaluation heading in `SKILL.md` (numbered lists or `- [ ]` lists, counted in order) |
| `statement` | one testable sentence |
| `anchors` | `judge` only: `"0"`..`"3"`, each a sentence describing that score |
| `check` | `check`/`process` only: `{ field, op, value }` |

`check.field` prefixes — `check` kind: `files:<glob>` (every produced file matching the glob), `file:<path>`; `process` kind: `run:<file>` (a file in `.qa-reports/runs/<run>/`), `exec:` (the headless execution file — tool calls by name), `log:` (this run's lines in `features-kb/learnings-log.jsonl`).

`check.op` — `contains`, `not_contains`, `matches` (JavaScript regex, multiline), `count_gte` (`value` = `{ "pattern", "min" }`).

**Score** = Σ(weight × score / 3) / Σ weight, on 0–1. `check`/`process` criteria score 3 when the check holds and 0 when it does not.

## cases/<id>/case.json

| Field | Rule |
|---|---|
| `id` | equals the directory name |
| `description` | what the case exercises |
| `app` | `"v1"`, `"v2"`, `"v3"` (fixture app variant, started by the runner) or `null` |
| `port` | integer |
| `runner_args` | the argument string handed to the skill (`projects --headless …`) |
| `tags` | free |

`input/` must be non-empty. `judge-notes.md` is optional; when present, no line of it (24+ characters, not a heading or comment) may appear in any file under `input/` — the `/qa-eval` ANSWER-KEY rule.

## controls

Every criterion with `floor > 0` has one. Markdown controls start with
`<!-- rubric-control: criterion=<id> case=<case-id> expect=below-floor -->` and are a realistic
artifact for that case with exactly the graded thing broken. Directory controls hold the file the
`process` check reads (`scratchpad.md`, `exec.jsonl`, `learnings-log.jsonl`).

`test.js` evaluates `check` and `process` controls now: the check **must fail** on its control.
`judge` controls are validated structurally here and judged in PR2 (`eval.js controls`), where a
control scoring at or above its floor fails the job as "rubric vacuous".

## calibration (PR3)

`node bin/eval.js calibrate <skill> --init` assembles `tests/calibration/<id>/` from every markdown
control (source `control`), every eval-run workspace under `.qa-reports/evals/<skill>/` (source
`eval-run`, with the run's scratchpad, exec and learnings log so process criteria grade too), and
`--extra` files (source `external`, no case → no judge notes). Each entry holds `artifact/`,
`meta.json`, a blank `human.json` and a `scoring-sheet.md` with the anchors.

A human fills `human.json` blind — one 0–3 per judge criterion and `acceptable` — before looking at
any judge output. `node bin/eval.js calibrate <skill>` then judges every entry N times and reports:

| gate | rule |
|---|---|
| (b) agreement | exact-score agreement ≥ 0.8 per judge criterion over every (entry, pass) with a human score; floor agreement 1.0 on floored criteria |
| (c) repeatability | every entry's total spread across passes ≤ 0.1 |
| size | ≥ 10 human-scored entries |
| threshold | the minimum judge mean total among `eval-run` entries the human marked acceptable — controls and external artifacts feed agreement only, since they lack run data |

Only when all four hold does the command write `calibration` and `threshold` into `rubric.json`;
`--dry-run` / `--judge-only` report without writing. Changing the judge model, an anchor, or a
cited constraint resets calibration (delete the block and re-run).
