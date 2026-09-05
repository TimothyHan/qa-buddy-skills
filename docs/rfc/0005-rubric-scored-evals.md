# RFC 0005 — Rubric-scored skill evals: grading performance, not shape

**Status:** Draft | **Author:** Timothy Han (with Claude) | **Created:** 2026-09-05
**Depends on:** RFC 0004 (headless runs, `claude -p`, the reusable workflow) · RFC 0001 (run directory, `events.jsonl`, `learnings-log.jsonl`)
**Companion:** [0005-rubric-scored-evals-plan.md](0005-rubric-scored-evals-plan.md) — per-PR implementation plan
**Locale:** English is the normative record; 한국어 요약 below.

## 한국어 요약

지금의 `/qa-eval`은 스킬 출력의 **형태**를 검사한다 (`contains "TC-"`, `not_contains "```typescript"`).
simulate 모드는 스킬을 읽은 모델이 스스로 시뮬레이션하고 스스로 채점하므로 순환적이고,
execute 모드는 강하지만 코드 산출 스킬 3개에만 있다. 이 도구로는 세 질문에 답할 수 없다:

1. 플레이북 섹션을 뺐을 때 출력이 **나빠졌는가** (2026-09-05 리뷰가 "ablation 필요"로 남긴 4건).
2. `/qa-improve`의 수정이 스킬을 **더 좋게** 했는가, 아니면 그냥 다르게 했는가.
3. 모델이 바뀌면 스킬이 필요로 하는 컨텍스트가 바뀌는가 (CONTRIBUTING의 Sonnet 피로 전제는 2026-04-11에 쓰였고 Sonnet 5에서 검증된 적이 없다).

이 RFC는 **루브릭 기반 채점**을 더한다. 세 역할을 분리한다: **러너**(대상 모델에서 헤드리스로
스킬 실행, 루브릭을 모름), **판정자**(별도 모델 호출, 입력·산출물·루브릭만 받고 SKILL.md는 절대
보지 않음), **결정적 검사**(exit code, grep, 로그 — 공짜이고 정확함). 기준은 스킬 자신의
제약·자체 평가 항목에서 나오고 그 줄을 인용해야 한다. 가중 합계 하나로 게이트하지 않는다 —
**must 기준마다 바닥값**이 있고 하나라도 깨지면 FAIL이다. 모든 must 기준은 **네거티브 컨트롤**
(일부러 망가뜨린 산출물)이 바닥 아래로 떨어지는 것을 증명해야 하며, 판정자는 사람이 채점한
산출물 10개와 대조해 **캘리브레이션**되기 전에는 PASS/FAIL을 내지 못한다. 실행은 케이스당 3회,
평균과 편차를 보고한다.

파일럿은 `test-cases`와 `exploratory` (로그에 실행이 가장 많고, 산문 산출, fixture 앱이 둘 다
지원). 첫 결정은 2026-09-05 리뷰가 남긴 ablation 4건이다.

---

## 1. Problem

`/qa-eval` grades **shape**. Of 72 fixtures across 13 skills, 66 are simulate-mode: the model
reads `SKILL.md`, imagines the run, and checks strings such as `contains "READY"` against its own
imagined output. Six are execute-mode (three code-producing skills) and actually run Playwright —
those are the only fixtures that grade behavior.

Three questions the repo needed to answer this week and could not:

| Question | Where it came up | What the current evals say |
|---|---|---|
| Did removing a playbook section make the output worse? | 2026-09-05 freshness review left four candidates as "needs ablation on Sonnet 5" (triple-statement pattern, `techniques-per-heuristic`, `shift-left#principles`, the CONTRIBUTING fatigue premise) | nothing — no fixture asserts quality |
| Did a `/qa-improve` fix make the skill better, or just different? | `/qa-improve` Phase 4 gates on `pass_after ≥ pass_before` over shape assertions | a fix that degrades reasoning while keeping headings passes |
| Does a model upgrade change what the skills need? | CONTRIBUTING: "Sonnet suffers instruction fatigue" — written 2026-04-11, never re-tested | nothing |

The citation logs (RFC 0001) can say which sections were *used*; they cannot say whether the
output would have been worse without them. That requires running the skill twice and comparing
quality, which requires a way to score quality that is not the runner grading itself.

## 2. Design

### 2.1 Three roles, three contexts

| Role | What it is | Sees | Never sees |
|---|---|---|---|
| **Runner** | the skill, executed headless on the target model against a case (RFC 0004 `claude -p` path; the reusable workflow in CI) | the installed skill, the case input, the app | the rubric, the judge notes |
| **Judge** | one separate model call per artifact, pinned model, temperature 0 | the case input, the artifact(s), judge-only notes, the rubric's `judge` criteria with anchors | `SKILL.md`, the runner's transcript, other runs' scores |
| **Checks** | deterministic assertions: the existing execute-mode operators, greps, exit codes, and process checks over the run directory (`events.jsonl`, `scratchpad.md`, the execution file) | run artifacts | — |

Simulate mode's circularity comes from one context playing all three roles. Separating them is the
whole design; everything else is bookkeeping.

### 2.2 Rubric — `core/skills/<skill>/tests/rubric.json`

```jsonc
{
  "skill": "test-cases", "skill_version": "0.5.2", "rubric_version": 1,
  "judge": { "model": "claude-sonnet-5", "prompt": "core/skills/eval/judge.md" },
  "threshold": null,                       // set by calibration (§2.6); null = report only, never PASS/FAIL
  "criteria": [
    { "id": "traceability", "kind": "judge", "weight": 3, "floor": 2,
      "cites": { "constraint": 3, "self_check": 1 },
      "statement": "Every AC has at least one test case and every test case names its AC; no orphans, no untested ACs.",
      "anchors": { "0": "ACs without cases and no gap listed", "1": "gaps exist but are not listed as gaps",
                   "2": "complete, one mapping inconsistency", "3": "complete and consistent across cases, mapping and gap list" } },
    { "id": "no-code", "kind": "check", "weight": 1, "floor": 1,
      "cites": { "constraint": 2 },
      "check": { "field": "files:features-kb/**/test-cases/*.md", "op": "not_contains", "value": "```typescript" } },
    { "id": "probed-or-unverified", "kind": "process", "weight": 2, "floor": 1,
      "cites": { "constraint": 7, "self_check": 7 },
      "check": { "field": "run:scratchpad.md", "op": "matches", "value": "^Observed:|\\(unverified\\)" } }
  ]
}
```

- **Criteria derive from the skill's own contract.** Every criterion carries `cites`, resolved by
  `test.js` against the numbered constraints and self-evaluation items in `SKILL.md`. A rubric
  cannot grade something the skill never promised, and a `/qa-improve` fix that changes a
  constraint has to touch the rubric that cites it.
- **Three kinds.** `judge` (scored 0–3 with anchors), `check` (existing fixture operators, binary
  → 0 or 3), `process` (operators over the run directory: did the skill log `applied`, write
  `Observed:` lines, call `AskUserQuestion` — the RFC 0004 (f) pattern generalized).
- **0–3 anchored scale**, not 1–10. Reproducibility over granularity; anchors make disagreement
  between judge and human diagnosable.
- **Score** = Σ(weight × score/3) / Σ weight, on 0–1. **Floors** are checked per criterion per run.

### 2.3 Cases — `core/skills/<skill>/tests/cases/<id>/`

```
cases/
  projects-happy/
    case.json        # { "app": "v1", "port": 4173, "input": "...", "runner_args": "projects --headless" }
    input/           # what the runner gets: ticket/spec text, features-kb files, existing tests
    judge-notes.md   # facts only the judge sees (which existing test is vacuous, where the planted bug is)
```

`judge-notes.md` is `ANSWER-KEY.md` generalized: `/qa-eval` constraint 7 already forbids showing
the key to the skill under eval; the same rule holds here and `test.js` checks that no case's
`input/` contains its notes' text. Cases reuse the eval fixture app (v1 baseline, v3 planted bug)
and the RFC 0004 scratch repository; a case for a Jira-dependent skill ships its context as
spec-mode files.

### 2.4 Negative controls — the eval's own mutation smoke

`test-suite-verification#mutation-smoke` applied to the grader: a rubric that has never scored a
bad artifact low has no detection power. Every criterion with a floor ships one degraded artifact
under `tests/controls/<criterion>.md` (a real output with that one thing broken: an AC dropped
from the mapping, a case with a code block, "Confirmed" without a file path). The eval job judges
the controls first; **a control that scores at or above its floor fails the job with "rubric
vacuous: <criterion>"** before any runner cost is spent.

### 2.5 Sampling

Three runs per case. Report per criterion mean, min and max; verdict per skill:

- **PASS**: mean total ≥ threshold **and** zero floor breaches across all runs.
- **FAIL** otherwise, naming the criterion and the run.
- **A/B** (two QABuddy refs, same cases, same model): per-criterion delta of means with both
  spreads. A drop larger than the larger spread is a regression; anything inside the spread is
  "not distinguishable at n=3" and is reported as exactly that.

n=3 detects large effects only. That is stated in every report rather than hidden behind a decimal.

### 2.6 Judge calibration

A rubric starts with `threshold: null` and can only report. To gate it must be calibrated:

1. The maintainer scores ≥ 10 artifacts by hand with the rubric — real outputs from the logs plus
   the controls.
2. The judge scores the same artifacts three times each.
3. Agreement per criterion (exact score) ≥ 80 %, floor decisions 100 %, judge repeatability across
   the three passes within 0.1 total. Otherwise the anchors are revised, not the judge.
4. The threshold is derived — the lowest total among artifacts the maintainer marked acceptable —
   and recorded with the calibration date and agreement in `rubric.json`.

Changing the judge model, the anchors, or the skill's constraints resets calibration.

### 2.7 Where it runs

- **Local:** `node bin/eval.js run <skill> [--cases a,b] [--runs 3] [--ref <git-ref>]` — wraps
  the RFC 0004 headless invocation per case × run, collects the run directory and KB artifacts into
  `.qa-reports/evals/<skill>/<ts>/`, runs checks, calls the judge, writes `scores.json` and
  `report.md`. `eval.js judge <dir>` grades an existing artifact directory without running the
  skill (calibration, re-grading after an anchor change).
- **CI:** `skill-eval.yml`, manual dispatch with `skill`, `ref-a`, `ref-b`, `model`. Two refs make
  the ablation bench. Cost cap per job; the job stops at the cap and reports partial.
- **Model attribution:** every `scores.json` records the runner and judge models. The 2026-09-05
  review found that general run profiles carry no model field; `eval.js` fixes it for evals, and a
  small Akela change (`AKELA_MODEL` → `profile.model`) fixes it for all runs.

### 2.8 Relationship to the existing evals

| Layer | Grades | Cost | Stays? |
|---|---|---|---|
| `test.js` structural checks | files, ids, budgets, rubric well-formedness | free | yes, gains rubric checks |
| simulate fixtures | output shape, self-graded | tokens, no runner | yes for skills without cases; deprecated for a skill once its rubric is calibrated |
| execute fixtures | generated code by running it | runner + Playwright | yes — they become `check` criteria with floors in the code skills' rubrics |
| **rubric eval** | quality, per criterion, model-attributed | runner × n + judge | new |

`/qa-improve` Phase 4 step 3 becomes: fixtures still pass **and**, when the changed skill has a
calibrated rubric, `eval.js` before/after shows no floor breach and no regression outside the spread.

## 3. Resolved decisions

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Who grades? | a separate judge call that never sees `SKILL.md` or the transcript | simulate mode is circular because one context runs and grades; the judge grades the artifact against the contract, not the procedure |
| 2 | Where do criteria come from? | the skill's numbered constraints and self-checks, cited and resolved by `test.js` | the rubric is the contract the skill already claims; it cannot drift from the skill silently |
| 3 | Scale | 0–3 with written anchors | granularity beyond that is noise; anchors make judge/human disagreement diagnosable |
| 4 | Gate shape | threshold **and** per-criterion floors | a weighted sum hides one collapsed criterion; same reasoning as RFC 0002 decisions 2 and 11 |
| 5 | Are controls optional? | no — every floored criterion ships one, judged first, vacuous rubric fails the job | `test-suite-verification`: a check that has never gone red proves nothing |
| 6 | Runs per case | 3, with spread reported; effects inside the spread are "not distinguishable" | honest about statistical power; one sample would flap |
| 7 | When may a rubric gate? | only after calibration against ≥ 10 hand-scored artifacts with ≥ 80 % agreement and 100 % on floors | an uncalibrated judge is an opinion with a decimal point |
| 8 | Threshold | derived from calibration, never typed in | same rule as RFC 0002 decision 10: constants come from evidence, not knobs |
| 9 | Process criteria | deterministic over the run directory, never judged from the transcript | exact and free; the RFC 0004 (f) `AskUserQuestion` count is the precedent |
| 10 | Code skills | execute-mode commands become `check` criteria with floors | running the generated suite beats any rubric |
| 11 | Pilot skills | `test-cases` and `exploratory` | most runs in the logs (7 + 7 in payload-poc, 6 + 1 in skills-test), prose outputs, both supported by the fixture app; first decision is the four open ablations |
| 12 | Judge-only facts | `judge-notes.md`, never in the runner's input; `test.js` checks | `/qa-eval` constraint 7 (`ANSWER-KEY.md`) generalized |
| 13 | Model attribution | runner and judge models recorded in every score file | evidence that cannot say which model produced it cannot answer the model-upgrade question |
| 14 | Who writes rubrics? | a human; the tool validates | RFC 0002 §6: no LLM-written config; a rubric is the eval's config |

## 4. Implementation sequence

Detail per PR, with files, checks and acceptance, is in the [plan](0005-rubric-scored-evals-plan.md).

| PR | Content | Cost |
|---|---|---|
| **0** | this RFC + plan | — |
| **1** | rubric and case schema; `test.js` checks; rubrics, 3 cases and controls for the two pilot skills | free |
| **2** | `bin/eval.js run` / `judge`; judge prompt; `scores.json` + `report.md`; controls-first | ≈ $12 per skill per full run |
| **3** | calibration: hand-scored set, `eval.js calibrate`, thresholds recorded | judge calls only |
| **4** | A/B mode + `skill-eval.yml`; run the four open ablations; record outcomes in §6 | ≈ $25 per A/B |
| **5** | `/qa-improve` Phase 4 wiring; `/qa-eval --rubric`; docs en + ko | — |
| **6** | (optional) rubrics for the remaining prose skills once each has ≥ 8 logged runs | per skill |

## 5. Measurement and kill criteria

| | Criterion | Kill if |
|---|---|---|
| (a) | every control scores below its floor in 3/3 judge passes | any control passes — that criterion's anchors are rewritten or the criterion dropped |
| (b) | calibration agreement ≥ 80 % per criterion, 100 % on floors | two anchor revisions do not reach it — the criterion is not judge-gradable, move it to `check`/`process` or drop it |
| (c) | judge repeatability on real artifacts: no floored criterion changes side of its floor across three passes, and ≥ 80 % of (artifact, criterion) pairs score identically *(revised 2026-09-05 — see §6: the original "total within 0.1" failed on granularity, one anchor step on a weight-3 criterion is 0.143)* | floor flips on real artifacts, or pair agreement below 0.8 — the instrument is unusable for that skill |
| (d) | discrimination: a deliberately degraded skill variant (e.g. `test-cases` with constraint 7 removed) scores below the intact one beyond the spread on the case that exercises it | it does not — the eval cannot see what the constraint buys, and cannot be used to decide ablations |
| (e) | cost ≤ $15 per skill run, ≤ $30 per A/B; wall ≤ 45 min | 2× either cap |
| (f) | at least one of the four open ablations is decided by the eval during the pilot | none — the bench is not paying for itself |

## 6. Outcomes

### PR2 — bench built (2026-09-05)

- Controls: test-cases 4/4 and exploratory 4/4 judge-criterion controls scored 0 in 3/3 Opus passes — every one below its floor (§5 a). $0.46.
- First real run, `test-cases` / `projects-happy`: 19 turns, 140 s, 0 questions, $0.71 runner + $0.21 judge; total 0.786, no floor breach. Every judge score carried a quoted line.
- Judge calls cost ≈ $0.01 each with `judge.md` as the whole system prompt and no tools; the runner is where the money goes ($0.44–0.81 per test-cases run, $2.1–2.9 per exploratory run at 93–118 turns).

### PR3 — calibration sets assembled, judge measured, human scoring pending (2026-09-05)

| skill | entries | sources | judge-only result |
|---|---|---|---|
| test-cases | 10 | 6 controls, 3 eval runs (projects-happy, thin-ticket, vacuous-coverage), 1 external (acme `projects.md`) | 3 passes, $2.20; real artifacts: 22/24 (artifact, criterion) pairs identical, **0 floor flips**; eval-run totals 0.881 / 0.857 / 0.762 with spread ≤ 0.024 |
| exploratory | 10 | 5 controls, 4 eval runs (quick-timebox, v1-clean, v3-planted ×2), 1 external (acme PR #2 session) | 3 passes, $2.86; real artifacts: pair agreement 0.83, **0 floor flips**; eval-run totals 0.77 / 0.76 / 0.67 / 0.85 (spread up to 0.128 on v3-planted, driven by `finding-correctness` and `classification` flips) |

What the first passes changed:

- **§5 (c) rewritten.** A one-anchor flip on a weight-3 criterion moves a 0–1 total by 0.143, so "total within 0.1" failed on granularity. The rule is now measured on real artifacts as pair agreement ≥ 0.8 and zero floor flips; controls report variance but gate detection power only.
- **Anchors and notes must not disagree.** The exploratory notes said an unspecified behaviour filed as a bug scores 1; anchor 0 still called it "invented", and the judge followed the anchor (0/1/0 on one real run). The rule now lives in anchor 1 and the notes only state facts.
- **Judge notes must be complete about unspecified behaviour.** The v1-clean session filed the case-sensitive duplicate check as a defect; the spec never decides it, and the notes had not said so, so the judge scored the finding as invented. The notes now list the unspecified behaviours and score such a finding 1 (right observation, wrong category), not 0.
- **The ko build labels duration `소요 시간`.** The `duration-recorded` check failed on 3/3 real runs for that reason alone; it now accepts both labels. A check written from the English template against a Korean install is a locale bug in the rubric, not in the skill.
- **Skill findings surfaced by the bench, for `/qa-improve`:** `test-cases` skipped the live probe on a reachable app in a headless run and marked details `(unverified)` instead; `thin-ticket` with no app got no "unreachable" note in the scratchpad; the cases document carried a fenced block once in three runs.

### PR4 — discrimination check and ablations (2026-09-05)

**§5 (d), discrimination.** `eval.js ab test-cases --a HEAD --b eval/degraded-test-cases-no-c7 --cases projects-happy --runs 3` (the variant drops constraint 7, Phase 1 step 8 and self-check 7 — the "observed beats assumed" rule in all three places). 6 runs, $4.67.

| criterion | A (intact) | B (rule removed) | verdict |
|---|---|---|---|
| probed-app (process) | 3 / 3–3 | 0 / 0–0, floor breached in 3/3 runs | **regression** |
| observed-or-unverified (judge) | 2 / 1–3 | 1 / 1–1 | inside A's spread |
| total | 0.841, spread 0.238 | 0.722, spread 0.096 | not distinguishable at n=3 |

The bench sees what the rule buys: the process criterion separates the variants cleanly and every B run breaches a floor, so B would FAIL any calibrated gate. The total is masked by A's own variance (one A run scored `coverage-honesty` 0). Two lessons for ablations: read the per-criterion table, not the total; and a criterion that the removed text feeds directly (here `probed-app`) is the one to watch.

**Ablations** (variant branches `eval/ablation-*`, pinned A = `feat/rfc-0005-pr4-ab`): results are appended below as they land.

| # | variant B | skill / cases | result |
|---|---|---|---|
| 1 | the observed-beats-assumed rule stated once (Phase 1 step 8 only; constraint 7 and self-check 7 dropped) | test-cases / all three, 3 runs | pending |
| 2 | `exploratory-heuristics#techniques-per-heuristic` removed | exploratory / v3-planted, 3 runs | pending |
| 3 | `shift-left#principles` removed | test-plan | deferred — no test-plan case (plan PR6) |
| 4 | constraints, self-checks and two preamble sections restated verbatim (≈ 1.6× length) | test-cases / all three, 3 runs | pending |

Thresholds stay `null` until the maintainer fills `human.json` for the twenty entries (blind, from the scoring sheets) and `eval.js calibrate` passes gates (b) and (c).

## 7. Non-goals

- **Not a replacement for execute mode.** Running generated code stays the strongest grade.
- **Not all 13 skills.** Two pilots; the rest only with logged runs to calibrate against.
- **No cross-skill leaderboard.** Scores compare a skill to itself across variants and models.
- **No auto-merge on score.** The eval informs a human decision; it does not make one.
- **No LLM-authored rubrics or anchors.** Same rule as RFC 0002 §6 for config.
- **No project-level rubrics yet** (see open question 1).

## 8. Open questions

1. Should projects add their own criteria (`PRJ-` style) so a team's expectations grade the same
   output? Deferred until two pilots show the judge is stable.
2. Judge model: same family as the runner (Sonnet 5 grading Sonnet 5, different context) or a
   different one? Calibration (b) decides empirically; the risk of shared blind spots is noted.
3. Case inputs for Jira-dependent skills (`review-ticket`, `test-plan`) — spec-mode files are the
   plan; whether they exercise the skills realistically is unknown until PR6.
4. Should `stats` learn to read `scores.json` so a section's citation count can sit beside the
   quality delta of removing it?
