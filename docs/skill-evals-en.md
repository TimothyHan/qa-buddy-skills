# Skill evals — grading what a skill produces

한국어: [skill-evals.md](skill-evals.md) · Design: [RFC 0005](rfc/0005-rubric-scored-evals.md) · Schema: [`core/skills/eval/tests/RUBRIC-SCHEMA.md`](../core/skills/eval/tests/RUBRIC-SCHEMA.md)

QABuddy has two kinds of evals. **Fixtures** (`/qa-eval`, `tests/fixtures.json`) check the
*shape* of a skill's output — a heading is present, a string is absent — and are free. **Rubric
evals** (`bin/eval.js`) check the *quality*: the skill runs for real on the target model, a
separate judge scores the artifact against the skill's own constraints, and the verdict is one a
human has vouched for. This page is about the second kind.

## What one run does

```bash
node bin/eval.js run test-cases
```

1. **Controls first.** Every floored criterion has a deliberately broken artifact under
   `tests/controls/`. The judge scores them; if any lands at or above its floor the rubric is
   vacuous and the job stops before spending anything on the runner.
2. **Runner.** For each case under `tests/cases/<id>/`, three times: start the fixture app
   variant the case names, copy the case's `input/` into a scratch workspace, and run
   `claude -p "/qa-<skill> <args>"` on the target model with the headless preamble (never ask,
   take option A, write only under `features-kb/`, `playwright/`, `.qa-reports/`).
3. **Grading.** `check` criteria grep the produced files; `process` criteria read the run
   directory and the tool-call stream; `judge` criteria go to one Opus call with the case input,
   the judge-only notes, the artifact and the anchors — and never the skill's `SKILL.md`. A judge
   score without a quoted line of evidence is 0.
4. **Verdict.** Total = Σ(weight × score / 3) / Σ weight. **PASS** needs mean ≥ threshold and
   zero floor breaches in any run; otherwise FAIL, naming the criterion and the run. An
   uncalibrated rubric reports `REPORT-ONLY` and never gates.

Output: `.qa-reports/evals/<skill>/<timestamp>/{report.md, scores.json, eval.log, <case>/run-n/}`.

## The commands

| command | does | cost |
|---|---|---|
| `run <skill> [--cases a,b] [--runs 3] [--model id] [--eval-budget usd]` | the eval above | ≈ $3 test-cases, ≈ $8 exploratory |
| `controls <skill> [--passes 3]` | judge the controls only | cents |
| `scope <skill> --a <ref> --b <ref>` | say whether any rubric criterion cites what changed between the refs; `ab` runs it first | free |
| `ab <skill> --a <ref> --b <ref> [--cases] [--runs 3] [--force]` | build and install each ref in turn, run both, gate B against A per criterion; skips when `scope` says no criterion cites the change | ≈ 2× a run |
| `ab --resume <ab-dir>` | continue an A/B whose runs were cut short — finished runs and built variants are reused | the missing runs only |
| `ab --restore` | put the global `qa-*` links back from the snapshot a crashed `ab` left behind | free |
| `judge <workspace> --skill s --case id` | grade an existing artifact directory | cents |
| `calibrate <skill> --init` / `calibrate <skill>` | assemble the calibration set / compare the judge with the human scores | cents |
| `report <dir>` | re-render `report.md` | free |

`ab` **swaps your global QABuddy install** (`~/.claude/skills/qa-*`) for each variant and restores
the exact previous symlinks afterwards — on a clean exit, on Ctrl-C, and after a crash; if even that
fails, the snapshot stays in `~/.claude/skills/.qab-eval-ab.lock` and `ab --restore` finishes the
job. Do not run QABuddy skills on the same machine during an A/B. Variants are built under the A/B's
own directory (`<ab-dir>/install/<a|b>`), never in the system temp folder, and every run's scores are
written as they land, so a crash after eight of nine runs costs one run to resume. `--runs 1` is a
legitimate cheap look for a change you only want to see, not gate. The same commands run in CI on
demand via `.github/workflows/skill-eval.yml`.

## Reading a report

- **Gate** (A/B) — `PASS` or `BLOCKED`, decided **relative to A**: a criterion whose delta exceeds the
  run spread, or a floor breached in B on a criterion A never breached, blocks. The absolute PASS/FAIL
  against the calibrated threshold is printed as information only — the first real run (2026-09-12)
  put `main` itself at 0.571 against 0.857, so an absolute gate would fail every PR and say nothing.
- **Per criterion** — mean, min, max and floor breaches over all runs. Read this table, not the
  total: a rule that only feeds one criterion moves one row.
- **Runner line** — under each run's evidence, what the runner said it did when it finished. When
  every criterion is 0 and no artifact matched, this line tells you whether the skill closed in chat
  instead of writing its file.
- **Spread** — max − min of the run totals. In an A/B a delta larger than the larger spread is a
  regression or an improvement; anything smaller is "not distinguishable at this n". Three runs
  detect large effects only, and the report says so.
- **Evidence** — every judge score quotes the line that decided it. If a score looks wrong, the
  quote tells you whether the artifact or the anchor is at fault.

## When to run it

- **`/qa-improve` runs it for you** (0.8.0): a fix to a skill with a calibrated rubric is A/B'd
  against the base ref before delivery; a floor breach or a regression outside the spread blocks it.
  Since 0.8.1 it first runs `scope`: a change no criterion cites (a phase bullet, a doc line) skips
  the A/B and says so, because three runs cannot measure it anyway.
- **Any hand edit** to a calibrated skill, the preamble, or a playbook section it reads — the
  CONTRIBUTING checklist asks for the `ab` table in the PR.
- **Model upgrades** — same cases, `--model` on both sides.
- **Playbook ablations** — a variant branch plus one `ab` (RFC 0005 §6 has four worked examples).
- **A periodic baseline** — a `run` per calibrated skill every few weeks catches runner drift.

Not on every commit: a full pass is real money and an hour of bench time.

## Calibration — why the judge is trusted

A rubric starts with `threshold: null` and can only report. To gate it must pass calibration:

1. `calibrate <skill> --init` assembles `tests/calibration/<entry>/` from the controls, the eval-run
   workspaces and any `--extra` file. Each entry gets a `scoring-sheet.md` that holds the case
   input, the judge notes, the artifact and the anchors — everything the judge sees.
2. The maintainer scores every entry **blind**, one 0–3 per judge criterion plus `acceptable`
   (would you take this from a colleague as-is?), into `human.json`. A file whose `scored_by`
   starts with `proposed:` — a draft by a model — never counts.
3. `calibrate <skill>` judges every entry three times and reports: exact agreement per criterion
   (gate ≥ 0.8), floor agreement per entry by majority of passes (gate 1.0), repeatability on real
   artifacts (pair agreement ≥ 0.8, no floor flips), and the proposed threshold = the lowest judge
   total among eval-run entries marked acceptable.
4. Only when every gate holds does it write `threshold` and `calibration` into `rubric.json`.

The rule that made both pilots pass: **when the judge and the human disagree, reword the anchor or
correct a mis-scored entry against the anchor; never move a human score toward the judge.** Both
pilot rubrics needed two or three passes. Changing an anchor, the judge model, or a cited
constraint resets calibration.

## Adding a rubric to another skill

1. `tests/rubric.json` — criteria derived from the skill's numbered constraints and self-checks
   (`cites` must resolve), 0–3 anchors for `judge` criteria, floors on the must-criteria,
   `judge.model` an Opus id, `artifacts` globs for what the judge grades.
2. `tests/cases/<id>/` — at least three: a happy path, a thin or adversarial input, and one that
   exercises the skill's hardest constraint. `judge-notes.md` holds the ground truth the judge needs
   and must never appear under `input/`.
3. `tests/controls/` — one broken artifact per floored criterion; `node test.js` executes the
   `check`/`process` ones and refuses a control that does not fail.
4. `node bin/eval.js controls <skill>` — every judge control below its floor.
5. Generate ten artifacts (three runs plus the controls gets you most of the way), score them,
   calibrate.

`node test.js` validates all of it structurally; `CONTRIBUTING` has the checklist.

## Current state

| skill | threshold | judge | agreement (lowest criterion) |
|---|---|---|---|
| test-cases | 0.857 | claude-opus-5 | 0.90 |
| exploratory | 0.709 | claude-opus-5 | 0.83 |

The other skills have fixtures only. They get a rubric when they have enough logged runs to
calibrate against (RFC 0005 plan, PR6).

The first real gate run (2026-09-12, PR #87) scored `main` at 0.571 on test-cases: the thin-ticket
case closed in chat without writing its file in four runs of six, and the skill skips the app probe
and claims coverage it did not verify in headless mode. The first is fixed (constraint 8); the second
is an open `/qa-improve` item, and until it lands the absolute verdict on test-cases reads FAIL —
which is why the gate is relative.
