# RFC 0001 — Context Compiler: measured, compiled knowledge for QABuddy skills

| | |
|---|---|
| **Status** | Accepted 2026-08-17 — implementation in progress (see §8 for which PRs have landed) |
| **Authors** | Timothy Han (plan), Claude (review + convergence) |
| **Origin** | `tim-doc/context-compiler-plan.md`, `qabuddy-self-learning-roadmap.md`, `context-compiler-plan-review.md` (2026-08-16, outside this repo) |
| **Locale** | This RFC is an English design record with a Korean summary below. It is not dual-maintained; the *artifacts it produces* (references, preambles, skills) are en/ko as usual. |

**One sentence:** procedure is authored, knowledge is compiled, selection is scored, promotion is gated.

---

## 한국어 요약

QABuddy의 학습 레이어(`LEARNINGS.md` → 읽기 → distill → 승격)는 지금 모든 화살표를 LLM이 산문을 읽어 판단한다 — **아무것도 세지 않는다.** 이 RFC는 그 루프에 숫자를 붙인다:

- **스킬(절차)은 사람이 작성하고 그대로 둔다.** 페이즈, 게이트, 산출물 형식, KB 경로는 고정 계약이다. 스킬은 컴파일하지 않는다 — 고정된 절차가 있어야 지식의 효과를 측정할 수 있다 (부록 B).
- **지식(레퍼런스 섹션 + 학습)은 실행마다 컴파일한다.** 각 `##` 섹션이 `REF-<file>#<id>`로 주소를 갖고, 실행마다 `slice.md` 하나로 선택되어 매니페스트(무엇이 들어갔고 무엇이 빠졌는지)와 함께 기록된다.
- **읽기 경로가 쓰기 경로가 된다.** 적용(`applied`)·모순(`contradicted`)·포착(`captured`)·결과(`outcome`)가 `features-kb/learnings-log.jsonl`에 append-only로 쌓인다. LLM이 JSON을 직접 쓰지 않도록 40줄짜리 `bin/qab.js` 헬퍼가 쓴다.
- **distill은 산문 판단 대신 산술로 바뀐다.** 승격 후보 = `applied ≥ 3 (≥ 3 runs) ∧ contradicted = 0`; 반증 = `contradicted ≥ 2` 또는 지문(fingerprint) 재발; 미적용 = 후보 ≥ 10회, 적용 0회. 사람이 승인하고, 레퍼런스 편집은 eval 게이트를 통과해야 한다.
- **9개 PR, 두 그룹.** PR0–PR6은 동작 변화 없음(측정·감사 가능성만 추가). §7.4 게이트를 통과할 때만 PR7(점수 기반 선택, 플래그 뒤)·PR8(옵트인 자동 상태 변경)로 간다.
- **하지 않을 것:** LLM이 레퍼런스를 쓰는 일, 마크다운에 카운터 넣기, 벡터 스토어, 두 컴파일러(`build.js`/컨텍스트 컴파일러) 합치기, "깨끗한 실행은 흔적을 남기지 않는다" 원칙 훼손.

세부 스키마·결정·PR별 단계는 아래 영문 본문을 따른다.

---

## 0. Definitions

| Term | Meaning |
|---|---|
| **Source** | One addressable unit of knowledge: a reference section (`REF-…`) or a learning (`LRN-…`) |
| **Library** | All sources: `core/references/**` + the project's `LEARNINGS.md` |
| **Profile** | Small closed-enum description of the problem a run is about (v0: 4 fields) |
| **pfp / ffp** | Problem fingerprint / failure fingerprint — 12-hex sha256 prefixes |
| **Slice** | The sources selected for one run, verbatim, plus a manifest of what was included and dropped |
| **Compile step** | (skill, profile, library, scoreboard) → slice. Deterministic. Runs once per skill run |
| **Scoreboard** | Derived counters per source (`in_slice, applied, contradicted, last_applied, runs`); rebuildable cache, never source of truth |
| **Procedure** | The stable, authored phases/gates/format of a skill (`SKILL.md`) |
| **Knowledge** | The evolving facts/rules injected into a run (the slice) |
| **SDT** | The human tester operating QABuddy |

---

## 1. Problem

Today the loop is capture → read → distill → promote, and **every arrow is an LLM reading prose**. Consequences observed in this repo (Aug 2026):

- "Promotion needs evidence from 3+ dated runs" cannot be checked by code.
- Retirement waits for a run to *notice* a contradiction; silent irrelevance never retires.
- `Evidence:` is a birth certificate, not a track record.
- No within-run tier → list-shaped entries (LRN-20260808-03, -06) that violate "one fact per entry".
- Only **1** artifact in `.qa-reports/` + `features-kb/features/` cites an `LRN-` — "cite what you apply" is not measurably honored, and today we cannot tell *not honored* from *not relevant*.
- Eval fixtures are model-graded in simulate mode; a mutation smoke (v0.4.0) showed 740 structural checks green with a skill deleted. A compiler optimized against such a judge would learn to please it.
- Single-writer markdown; same-day ID collisions; trajectory discarded at capture time.

Semi-autonomy = give the loop numbers, then let it act only on the numbers, at the lowest safe rung of the autonomy ladder.

---

## 2. Architecture

```
            ┌────────────────────────────────────────────┐
            │ LIBRARY   core/references/**  REF-<stem>#<id>│
            │           features-kb/LEARNINGS.md  LRN-…    │
            └───────────────┬────────────────────────────┘
 ticket/config/KB → PROFILE │ candidates (skill scope, active, profile)
                            ▼                    scoreboard (derived)
            ┌────────────────────────────┐◄──────────────────┐
            │ COMPILE  bin/qab.js compile│                   │
            │ (unscored PR5 → scored PR7)│                   │
            └───────────────┬────────────┘                   │
                            │ .qa-reports/runs/<run>/slice.md │
                            ▼                                 │
            ┌────────────────────────────┐                    │
            │ EXECUTE  unchanged SKILL.md│                    │
            │ reads slice, cites IDs,    │                    │
            │ candidate learnings        │                    │
            └───────────────┬────────────┘                    │
                            │ qab.js log … (never hand-written JSON)
                            ▼                                 │
            ┌────────────────────────────┐                    │
            │ RECORD   learnings-log.jsonl│───────────────────┘
            │          fingerprints.jsonl │
            └───────────────┬────────────┘
                            │ /qa-improve distill
                            ▼
            ┌────────────────────────────┐
            │ DISTILL  computed columns  │
            │ → proposal → human gate    │──► LIBRARY
            │ → eval gate (ref edits)    │
            └────────────────────────────┘
```

Two compilers coexist and are never merged: `build.js` (once per install, `core/` → `dist/`) and the context compiler (once per run, library → slice).

---

## 3. Data model (converged)

All runtime files are **project content**: they live in the user's repo, are never shipped, and are not dual-locale. Logs are **append-only JSONL**, never edited in place. Every line carries `"v"`; readers accept every earlier version forever.

### 3.1 Source IDs — comment-only, `##` by default

```markdown
## Selectors
<!-- qab: id=selectors scope=e2e-pom,e2e-write,qa tier=should -->
```

- ID = `REF-<file-stem>#<id>`; under `playbook/` → `REF-playbook/<stem>#<id>`. Permanent; rename the heading freely, never the id.
- No `{#slug}` in heading text (renders literally on GitHub; the comment already carries the id).
- `##` is addressable by default. A `###` is addressable **only** if it carries its own `qab:` comment; otherwise it belongs to its parent.
- `scope=` comma-separated skill names or `all` (default `all`). `tier=` `must | should | context` (default `should`; `must` only for rails and sections a skill structurally depends on).
- Korean twin copies the `qab:` comment verbatim. `build.js` fails on duplicate id or en/ko id-set mismatch — **not** on missing tier.
- **Settled in PR3:** the H1 comment carries file-level defaults (`scope=`, `tier=`) that sections inherit, and may carry `id=` for files whose knowledge sits directly under the H1 (`terminology.md` → `REF-playbook/terminology#terms`, `execution-sequence.md` → `#sequence`); `README.md` and `index.md` are navigation, excluded; `##` inside fenced code is not a heading; `index.json` is emitted into `dist/<…>/references/` only (not into `core/`); `qab:` lines are excluded from the 70-line playbook budget; `Overrides:` accepts `REF-…`, `SKILL:<name> "…"` (a skill-procedure override), or `none`/`없음`.
- Learnings gain two optional fields: `**Fingerprint:** ffp-…` and `**Profile:** surface=web` (AND-ed with `Scope:`). `Overrides:` uses IDs (`REF-playwright-patterns#preconditions (extends)`) or `none`/`없음`.

### 3.2 Profile v0 — four fields, all deterministic

```json
{"schema":"profile/1","skill":"qa","surface":"web|api|cli|mobile|mixed|unknown","pom":"exists|partial|none|n/a","ticket_kind":"feature|bug|regression|refactor|unknown"}
```

Sources: `skill` from invocation; `surface` from `playwright/AUTOMATION.md` if present; `pom` from `playwright/pom/` presence; `ticket_kind` from the Jira issue type (no LLM). `unknown` is a first-class value. `pfp` = first 12 hex of sha256 over canonical JSON excluding `skill`. Fields are added only when a real learning needs `Profile:` narrowing.

### 3.3 `features-kb/learnings-log.jsonl` — schema v1

```jsonl
{"v":1,"ts":"2026-08-20T09:12:04Z","run":"qa-PROJ-456-3f9a2c","skill":"qa","event":"applied","src":"LRN-20260808-03"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"contradicted","src":"LRN-20260808-04","note":"HOME isolation not needed: script uses --prefix"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"captured","src":"LRN-20260816-09"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"outcome","status":"DONE"}
{"v":1,"ts":"…","run":"…","skill":"qa","pfp":"3b9e0c1a77d4","event":"compiled","sources":["…"],"used":171,"max":220}
```

| event | when | fields | lands |
|---|---|---|---|
| `applied` | a source visibly shaped output (the existing "cite what you apply") | `src` | PR1 (LRN), PR4 (REF) |
| `contradicted` | live observation contradicted an active source | `src`, `note` | PR1 |
| `captured` | a new LRN was written | `src` | PR1 |
| `outcome` | completion status | `status` (`DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`) | PR1 |
| `compiled` | end of compile step | `pfp`, `sources[]`, `used`, `max`, `dropped[]` | PR5 |
| `escalated` | run could not complete | `reason` | PR5 |

`pfp` is optional on every event (absent before PR5). `writer:"manual"` marks a line written by the echo fallback. Path = sibling of `learningsPath` (`.qabuddy.json`, default `features-kb/LEARNINGS.md`). `run` = `<skill>-<ticket|branch>-<6hex>`.

### 3.4 `features-kb/fingerprints.jsonl` (PR6)

```jsonl
{"v":1,"ts":"…","run":"…","skill":"e2e-pom","ffp":"a3f9c21b0e44","kind":"locator-not-found","key":"checkout/place-order-btn","active":["LRN-20260808-02"]}
```

`ffp` = 12 hex of sha256(`kind + "\n" + normalized key`). `kind` closed vocabulary, grown deliberately: `locator-not-found | ac-unmapped | spec-flaky | ci-step-failed | env-unreachable | auth-failed | fixture-missing | assertion-mismatch | tool-unavailable`. `active` = LRNs in the slice whose `Fingerprint:` equals this `ffp` → automatic falsification evidence.

### 3.5 Scoreboard v1 — `features-kb/.cache/scoreboard.json` (PR6), derived

```json
{"rebuilt_at":"…","per_source":{"LRN-20260808-03":{"in_slice":14,"applied":11,"contradicted":0,"last_applied":"2026-09-10","runs":12}}}
```

No `wins/losses` in v1 — `DONE` rate is near-constant and carries no ranking information; `applied/in_slice` and `contradicted` are the signal. `per_profile` is added (PR7) only when the log shows ≥ 2 distinct `pfp` each with ≥ `MIN_SAMPLES` outcomes.

### 3.6 `references/index.json` (PR3, shipped, generated by `build.js`)

```json
{"REF-playwright-patterns#selectors":{"file":"playwright-patterns.md","heading":"Selectors","scope":["e2e-pom","e2e-write","qa"],"tier":"should","lines":15}}
```

### 3.7 Run directory (PR5) — `.qa-reports/runs/<run_id>/`

`profile.json`, `slice.md`, `scratchpad.md` (`## Candidate learnings` always; `## Plan` / `## State` for tier-2 multi-phase skills), `events.jsonl` (this run's lines, also appended to the project log). Gitignored with the rest of `.qa-reports/`. Retained if the run `captured`/`contradicted`/`escalated`, else prunable (`retainRuns: captured|all|none`).

### 3.8 Slice + manifest (PR5)

```markdown
---
manifest: 1
run: qa-PROJ-456-3f9a2c   skill: qa   pfp: 3b9e0c1a77d4
profile: {surface: web, pom: exists, ticket_kind: feature}
compiler: qab 0.x   scoring: off
budget: {max: 220, used: 187}
sources:
  - REF-playwright-patterns#never        tier: must
  - REF-playwright-patterns#selectors    tier: should
  - LRN-20260808-03                      lrn
dropped:
  - REF-playbook/metrics-and-coverage#defect-health   reason: budget
---
## REF-playwright-patterns#never
<verbatim section text>
## LRN-20260808-03
<verbatim Statement + Overrides; Evidence omitted>
```

Body is verbatim. The compiler selects; it never paraphrases.

---

## 4. Helper — `bin/qab.js`

Zero-dependency Node script, source at repo `bin/qab.js`, shipped by `build.js` to `dist/<platform>/references/bin/qab.js`. Reachable from every platform as `node {{REFERENCE_PATH}}/bin/qab.js …` via the existing references symlink — **no setup-script change**. The model passes bare arguments; it never types JSON.

| Subcommand | Lands | Does |
|---|---|---|
| `run-id --skill <s> [--ticket <k>]` | PR1 | prints `<skill>-<ticket|branch>-<6hex>`; writes `.qa-reports/.qab-run` `{run, skill, started}` |
| `log <event> [<src>] [--note …] [--status …] [--run <id>] [--skill <s>]` | PR1 | appends one v1 line; `run`/`skill` from flags → `QAB_RUN` env → marker → `unknown` |
| `stats [--since <date>]` | PR1 | per-source table from the log: `applied, contradicted, last_applied, runs` (+ `in_slice` after PR5) |
| `compile --skill <s> [--ticket <k>]` | PR5 | §5; unscored until PR7 |
| `scoreboard` | PR6 | rebuild `.cache/scoreboard.json` from both logs |

Fallback when Node is absent (rare — `build.js` already requires it): documented `echo` recipe with `"writer":"manual"`; distill reports the manual ratio.

---

## 5. Compile step

**Candidate set:** `skill ∈ scope(s) ∧ (LRN status active) ∧ profile ⊇ Profile(s)`.
**PR5 (unscored):** pack `tier=must` first, then remaining candidates in file order (LRNs after their overridden REF where declared, else after all REFs), until `budget.max_lines` (220 tier-2 / 120 tier-1). Everything else → `dropped: budget`. **Acceptance: the slice's source set equals what the skill read before** on three skills.
**PR7 (scored, behind `compiler.scoring`):** `score = applied_ratio × contradiction_penalty × recency × freq`; `must` = ∞; contradicted in last 3 runs → ×0.25; dormancy = candidate ≥ 10 ∧ applied 0 (no calendar decay as a drop condition); 10 % audition of the best dropped candidate; `per_profile` term only with data (§3.5). Day-1 with an empty scoreboard = PR5 behaviour.

---

## 6. Learning loop

### 6.1 Runtime obligations (preamble; 3 items, ≤ 2 lines each — hard budget)

1. **Read at start** — `qab.js run-id`, then (PR5+) `qab.js compile` and read `slice.md`; fallback: references + learnings file, skill-scoped, `active`. Learning beats reference on conflict.
2. **Cite and log** — cite every source that shapes output by ID and `qab.js log applied <id>`; contradicted → don't apply, `log contradicted --note`, flag in report; (PR5+) keep `## Candidate learnings` in the run scratchpad.
3. **Close** — apply the three capture triggers (PR5+: to candidates only); fire → append entry + `log captured`; none → write nothing; `log outcome --status`. Suggest `/qa-improve`, never self-launch.

### 6.2 What distill computes (replaces prose judgment)

| Finding | Rule | Lands |
|---|---|---|
| Promotion candidate | `applied ≥ 3` across `≥ 3` distinct runs ∧ `contradicted = 0` ∧ (if `Fingerprint:`) ffp silent since activation ∧ generalizable (LLM, last) | PR1 (+ffp PR6) |
| Falsified (contradiction) | `contradicted ≥ 2` ∧ no `applied` after the last contradiction | PR1 |
| Falsified (fingerprint) | any `fingerprints.jsonl` line with this LRN in `active` | PR6 |
| Never-applied | in candidate set ≥ 10× ∧ applied 0× (needs `in_slice` from PR5) | PR5 |
| Duplicate (fingerprint) | same `Fingerprint:` ∧ same `Scope:` | PR6 |
| Duplicate (statement) / Copy | LLM check (existing) | — |
| Healthy | — | — |

The LLM's role shrinks to two judgments: *generalizable beyond this project?* and *is this a copy?*

### 6.3 Gates

1. **Human gate** on every status change and reference edit (existing).
2. **Eval gate** (PR2) on promotion: run `tests/fixtures.json` for every skill in the promoted section's scope before/after; merge only if `pass_after ≥ pass_before` for every skill; else `features-kb/LEARNINGS.rejected.md` names the failing fixture ids and the LRN stays `active`.
3. **Critic** (PR2): `/qa-improve --distill --dry-run` writes `features-kb/distill-proposal-<date>.md`, never edits. Triggers: `active > 30`, any falsified finding, or on request/schedule.
4. **Opt-in auto status** (PR8, `autoStatusChanges: true`): `active → retired` on fingerprint-confirmed falsification; `candidate → active` on `applied ≥ MIN_SAMPLES ∧ contradicted = 0`; audit event. Reference edits are never automatic.

---

## 7. Resolved decisions

| # | Decision | Resolution | Why |
|---|---|---|---|
| 1 | Log writer | `bin/qab.js` in PR1, under the references symlink | malformed lines are permanent; setup scripts untouched |
| 2 | Anchor mechanics | comment-only ids; `##` default; tier default `should`; build fails only on dup / locale mismatch | GitHub renders `{#slug}` literally; `###` are sub-parts; tiers need data |
| 3 | Profile v0 | `skill, surface, pom, ticket_kind` | recurrence, not just populability |
| 4 | Scoreboard v1 | no `wins/losses` | `DONE` rate near-constant |
| 5 | Dormancy | candidate-count (≥ 10 candidacies, 0 applied) | bursty solo usage; calendar clock flags valid LRNs |
| 6 | P6a timing | eval gate + dry-run critic = PR2 | depends only on fixtures + log; closes the loop early |
| 7 | RFC locale | en + ko summary, not dual-maintained | design record, not a shipped artifact |
| 8 | Scratchpad scope | `## Candidate learnings` all skills; `## Plan/## State` tier-2 only | the observed defect (list-shaped LRNs) is fixed by candidates |
| 9 | Preamble budget | 3 items, ≤ 2 lines each | tier-1 preamble is ~34 lines; ×14 skills |
| 10 | `cites` op | not added; `matches` on `LRN-\d{8}-\d{2}\|REF-[a-z0-9/-]+#[a-z0-9-]+` | sugar; new op touches eval SKILL en/ko + test.js `VALID_OPS` |
| 11 | Phase 0 | a rule, not a count: every new obligation ships an execute-mode fixture on the artifact it writes + mutation smoke in the PR body | simulate fixtures are model-graded |
| 12 | Order | P2a (LRN log) before P1 (REF ids); REF citation (P2b) after, compliance-gated | P2a needs no ids; ids without data = guessed tiers |
| 13 | Skills stay authored | see Appendix B | attribution needs a control; fixtures key on procedure contracts |
| 14 | Locale cadence (2026-08-17) | **runtime-facing** files (preambles, `self-improve.md`, `run-protocol.md`, skill bodies, any new reference file) get their ko twin **in the same PR**; **human-facing docs** (CONTRIBUTING, README) get one ko parity pass on the integration branch before the final merge to main; RFC stays en + ko summary | the maintainer dogfoods on `dist/ko` — ko drift in runtime text means the test runs measure a different tool; docs churn until the sequence settles |
| 15 | Integration branch (2026-08-17) | all RFC PRs target `feat/context-compiler`; `main` receives one merge after all phases + testing | keeps `main` releasable; one release for the whole change |

---

## 8. Implementation sequence — 9 PRs

Rules for every PR: target `feat/context-compiler` (decision 15); en + ko for any runtime-facing file, docs ko deferred to the final pass (decision 14); version bump on every changed skill; `node build.js all` + `node test.js` green; **PR body shows the mutation smoke** for each new obligation (remove the obligation → fixture red → restore → green); CI green before merge; behaviour change column must say *none* for PR0–PR6.

| PR | Status | Contents | Behaviour |
|---|---|---|---|
| **PR0** | done | RFC in repo; CONTRIBUTING roadmap pointer | none |
| **PR1** | done | learnings log + `qab.js run-id/log/stats` + preamble cite-and-log + distill computed columns + execute fixture | none |
| **PR2** | done | eval-gated promotion + `--dry-run` proposal | none |
| **PR3** | done | REF ids (`qab:` comments) + `index.json` + locale parity + `Overrides:` migration | none |
| **PR4** | done — gate met 5/5 REF, 4/5 LRN (skills-test, 5 real runs 2026-08-17) | REF citation + REF `applied` events + compliance gate | none (tokens) |
| **PR5** | shipped (PR4 gate met 5/5 REF, 2026-08-17) | `qab.js compile` unscored + run dir + scratchpad-lite + `run-protocol.md` | none (set-equality) |
| **PR6** | | fingerprints + scoreboard cache + falsified/duplicate-by-fp | heal-mode preference only |
| **gate** | | §9.3 | |
| **PR7** | | scored selection behind `compiler.scoring` | yes, flagged |
| **PR8** | | `autoStatusChanges` opt-in | yes, opt-in |

### PR0 — RFC in repo

- `docs/rfc/0001-context-compiler.md` (this file).
- `CONTRIBUTING.md` / `CONTRIBUTING-en.md`: one "Roadmap" paragraph under Project Structure linking the RFC; project-structure tree gains `docs/rfc/`; stale counts corrected.
- **Acceptance:** links resolve; `node test.js` green.

### PR1 — Log the read path (P2a) + helper + fixture

1. `bin/qab.js` (~120 lines, zero deps): `run-id`, `log`, `stats` per §4. Reads `learningsPath` from `.qabuddy.json`; log path = sibling `learnings-log.jsonl`; `mkdir -p` the directory; UTC ISO `ts`; `v:1`; JSON-encodes all fields; exit 0 on success, non-zero with a one-line error otherwise. Never rewrites the file.
2. `build.js`: copy repo `bin/` → `dist/<platform>/references/bin/` for every platform and locale (after the references copy). Fail the build if `bin/qab.js` is missing.
3. `core/references/self-improve.md` (+ ko): new §"Learnings log" — schema v1 (§3.3, events `applied/contradicted/captured/outcome`; `compiled/escalated` reserved), the `qab.js log` recipe, `run-id` at start, `--run` for parallel sessions, echo fallback with `writer:"manual"`, "readers accept every earlier version". Read protocol step 4 → "cite **and log**"; step 5 → "log `contradicted`". Capture protocol → "log `captured`". Lifecycle → distill reads the log.
4. `core/preamble-base.md` (+ ko): Project Learnings block rewritten to §6.1 items 1–3 (PR1 wording: no compile, no scratchpad yet). ≤ 10 lines total.
5. `core/skills/improve/SKILL.md` (+ ko): Distill Mode reads `qab.js stats`; sweep table gains columns `applied · contradicted · last_applied · runs`; Promotion candidate rule = §6.2; Falsified (contradiction) rule = §6.2; keep human gate. Version bump (minor).
6. `core/skills/setup/SKILL.md` (+ ko): mention `learnings-log.jsonl` next to `learningsPath` (committed; append-only). Patch bump.
7. `core/references/feature-knowledge-base-spec.md` (+ ko): `features-kb/` tree gains `learnings-log.jsonl` (one line).
8. Fixtures: `improve/tests/fixtures.json` — new fixture asserting distill output contains the computed columns and applies the numeric promotion rule (plausible-wrong: promotes on prose evidence with `applied` = 1). `e2e-setup/tests/fixtures.json` (execute mode, fixture app) — after the run, `cmd: tail -n1 features-kb/learnings-log.jsonl` + `output_matches "event":"outcome"` and `output_matches "run":"e2e-setup-`.
9. `test.js`: (a) `bin/qab.js` present in every dist references dir; (b) **behavioural**: run `qab.js run-id`/`log`/`stats` against a scratch dir, parse the appended line, assert `v/ts/run/skill/event/src` and that a second `log` appends rather than rewrites; (c) `stats` on a 3-line fixture log yields the expected counts. EXPECTED_SKILLS unchanged.
10. `README.md` / `README-en.md`: one line under the learnings layer bullet ("every run logs applied/contradicted/captured/outcome to `features-kb/learnings-log.jsonl`"); structural-check count resynced.
11. **Mutation smoke in PR body:** delete preamble item 2 → e2e-setup execute fixture red; restore → green. Break `qab.js` JSON encoding → test.js red.
- **Acceptance:** all of the above; then, over the next 5 real runs, ≥ 5 `outcome` lines and LRN `applied` lines where scoped. **Behaviour:** none.

### PR2 — Eval-gated promotion + critic dry-run (P6a)

1. `improve/SKILL.md` (+ ko) Distill Mode: promotion step runs `/qa-eval` for every skill in the promoted section's scope before and after the reference edit; `pass_after < pass_before` → revert edit, write `features-kb/LEARNINGS.rejected.md` (`date · LRN · target REF · failing fixture ids`), LRN stays `active`. New flag `--dry-run`: full sweep + computed columns → `features-kb/distill-proposal-<YYYY-MM-DD>.md`, zero edits. Trigger text: `active > 30`, any falsified finding, SDT request.
2. `self-improve.md` (+ ko): §Gates (§6.3 items 1–3).
3. Fixtures: `improve/tests/fixtures.json` — dry-run produces a proposal file and `not_contains` any `Status:` edit; a regressed promotion is rejected naming the fixture id.
4. **Mutation smoke:** remove the before/after eval step → fixture red.
- **Acceptance:** rejection names the fixture; dry-run makes zero edits. **Behaviour:** none.

### PR3 — REF ids + index + locale parity (P1)

1. Add `<!-- qab: id=… scope=… [tier=must] -->` under every `##` in `core/references/**` (76 today) and copy verbatim into `locales/ko/references/**`. `must` for: `playwright-patterns#never` and the sections the six hard-listing skills (`e2e-write e2e-setup e2e-pom test-cases setup improve`) depend on; everything else defaults `should`.
2. `build.js`: parse comments → `references/index.json` (§3.6) into every dist; fail on duplicate id; fail if en and ko id sets differ.
3. `self-improve.md` (+ ko): §Source IDs; entry template gains optional `Fingerprint:` / `Profile:`; `Overrides:` uses IDs or `none`/`없음`.
4. `features-kb/LEARNINGS.md` (this repo's dogfood file): migrate the two real `Overrides:` pointers to IDs.
5. `test.js`: every `Overrides:` in `LEARNINGS.md` resolves to an id in `index.json` or is `none`/`없음`; `index.json` present in every dist; en/ko id sets equal (extends `testKoreanCompleteness`); **every file under `core/references/**` has a same-named file under `locales/ko/references/**`** — `build.js` resolves the references *directory* per locale, so an en-only new file would silently never reach `dist/ko` (decision 14).
6. `CONTRIBUTING(-en).md`: "Authoring Knowledge" section (section format, rules), "Adding a New Locale" anchor rule, checklist rows.
- **Acceptance:** build emits index; parity test green; `Overrides:` resolve. **Behaviour:** none.

### PR4 — REF citation (P2b)

1. `preamble-base.md` (+ ko) item 2: "cite every source (`LRN-…` or `REF-…`)". `self-improve.md`: REF citation obligation.
2. `improve` distill: `stats` table includes REF rows; never-applied placeholder (needs `in_slice`, PR5).
3. **Compliance gate (acceptance):** over 5 real runs, ≥ 4 have REF `applied` lines at section granularity for skills whose read set includes REFs. `qab.js stats` prints this as "citation compliance … overall: x/y REF" — read it before starting PR5. If not met, coarsen ids to file level (`REF-playwright-patterns`) in a follow-up before PR5 packs by section.
4. **Settled in PR4:** `qab.js log applied REF-…` validates the id against the shipped `references/index.json` (next to the helper) and rejects unknown/malformed ids with the nearest suggestions — a mistyped id never enters the log; LRN ids are project content and pass on form alone.
- **Behaviour:** none (small token cost).

### PR5 — Unscored compile + run dir + scratchpad-lite (P3)

1. `qab.js compile --skill <s> [--ticket <k>]`: profile v0 (§3.2), candidate set (§5), pack `must` → file order → budget, write `.qa-reports/runs/<run>/{profile.json,slice.md}`, append `compiled` event, print the slice path. Manifest per §3.8. `qab.js log` also appends to the run's `events.jsonl`.
2. `core/references/run-protocol.md` (+ ko, new): compile step, manifest fields, fallback rule, scratchpad sections and when to write them, `retainRuns`.
3. `preamble-base.md` (+ ko): item 1 gains "run `qab.js compile`; read `slice.md`; fallback…"; item 2 gains "`## Candidate learnings`"; item 3 "triggers apply to candidates". Still 3 items. §Context Recovery: scan latest `.qa-reports/runs/`.
4. Tier-2 multi-phase skills (`qa test-plan test-cases e2e-setup e2e-pom e2e-write exploratory review-ticket`, + ko): one line at phase headers "update `## State`; re-read scratchpad at Review Options pauses". Patch bumps. Hard-listed references **stay** in this PR.
5. `.qabuddy.json` (setup skill): `runsDir` (default `.qa-reports/runs`), `retainRuns` (default `captured`).
6. `test.js`: behavioural — `qab.js compile` on a fixture library produces a slice whose source set equals the skill-scoped active set; `must` first; manifest parses.
7. Fixtures: execute-mode — `file:.qa-reports/runs/*/slice.md exists`; scratchpad has `## Candidate learnings`.
- **Acceptance:** set-equality on 3 skills; candidates → only trigger-passing reach `LEARNINGS.md`. **Behaviour:** none.
- **Settled in PR5:** (a) the unscored compile has **no budget cap** (`budget: {max: 0, used: N}`) — set-equality holds by construction, `used` still flows into metrics; caps arrive with scoring (PR7); (b) `scope=all` sections that are not `must` (KB spec, terminology) are **not packed** — no skill reads them per run today — and are listed under `dropped: general-scope` so distill's never-selected column can raise them; (c) `compile` implies `run-id` (reuses the marker's run if it is this skill's); (d) slice bodies render as `## <REF-id> — <heading>` with the section's own heading and `qab:` comment removed; LRN bodies = Statement + Overrides; (e) hard-listed reference files stay in skills, but the preamble says the slice already contains their sections (open a file only if the manifest has none from it) — `test.js` proves every hard-listed file is in the skill's declared read set; (f) profile v0 has no LLM step: `surface` from `playwright/AUTOMATION.md` presence, `pom` from `playwright/pom/*.page.ts`, `ticket_kind` from key prefix (`BUG-`) else `unknown`; (g) scratchpad `## Plan/## State` line only in the 7 tier-2 skills (`exploratory qa review-ticket start test-cases test-plan verify-fix`); the e2e-* skills are tier-1 (RFC text listing them was wrong).

### PR6 — Fingerprints + scoreboard (P4)

1. Emission points (one line each, + ko): `e2e-pom` heal → `locator-not-found`; `e2e-write` gates → `spec-flaky`, `fixture-missing`; `qa` → `ac-unmapped`, `env-unreachable`, `auth-failed`, `assertion-mismatch`; `verify-fix` → `ci-step-failed`. `qab.js fp <kind> <key>` appends §3.4 line with `active` computed from the current slice.
2. Capture rule (`self-improve.md`): if a fingerprint was emitted in this run and the capture trigger was "rule failed against reality", set the new LRN's `Fingerprint:` automatically.
3. `qab.js scoreboard`: rebuild `.cache/scoreboard.json` (`per_source` incl. `in_slice`); `.gitignore` template gains `features-kb/.cache/`.
4. Distill (+ ko): Falsified-by-fingerprint, Duplicate-by-fingerprint, recurrence table.
5. Optional: `e2e-pom` heal strategy stats sidecar (`pom-stats.jsonl`), preferred when `tries ≥ MIN_SAMPLES`.
- **Acceptance:** fixture-app recurring failure → fp line with LRN in `active` → distill lists it falsified. **Behaviour:** heal-mode preference only.

### Gate — before PR7 (§9.3)

### PR7 — Scored selection (P5)

`.qabuddy.json` `compiler: {scoring, explore_rate: 0.10, min_samples: 8, budget_lines}`; scoring per §5; `per_profile` when data exists; manifest shows `score`, `n`, `(audition)`, `dropped` reasons; convert the six hard-lists to `tier=must scope=<skill>`; `{{COMPILE_CMD}}` placeholder in platform configs; CONTRIBUTING "Changing the Compiler" (evidence table required). Kill criteria §9.3.

### PR8 — Opt-in auto status (P6b)

`autoStatusChanges: false` default; when true, §6.3 item 4 with an audit event per change.

---

## 9. Measurement

### 9.1 Baseline
PR1–PR6 logs *are* the baseline (`scoring: off` = today's behaviour). No separate baseline run.

### 9.2 Metrics (per skill; per `pfp` once recorded)
Fixture pass rate (`/qa-eval`, hard gate) · outcome rate (`DONE` / non-environment) · slice size · applied ratio (`applied / in_slice`) · contradiction rate · manual-writer ratio.

### 9.3 Gate before PR7 and kill criteria
**Proceed to PR7 only if** the PR1–PR4 logs show uneven application (some sources applied on nearly every run, others essentially never) **and** ≥ 2 distinct `pfp` each with ≥ 8 outcomes. Otherwise PR1–PR6 stand on their own.
**Kill** (set `scoring: false`) if after 30 scored runs on a `pfp` with baseline data: fixture pass rate < baseline for any skill, or outcome rate < baseline − 5 pts, or applied ratio does not rise. The `dropped:` and `(audition)` lines are the post-mortem.

---

## 10. Non-goals

- No LLM writes to references — not at PR8 either.
- No counters in markdown prose; numbers live in JSONL.
- No vector store; word-overlap retrieval is the escape hatch if `Scope:` + cap stop working.
- Don't merge `build.js` and the context compiler.
- Don't generate skills; procedure stays authored (Appendix B).
- Don't touch "a clean run leaves no trace" — candidates make it easier to honor.
- Don't dual-locale project content (`LEARNINGS.md`, logs, run dirs).
- Don't put anything under the six setup scripts until PR7 (`{{COMPILE_CMD}}` only).
- No log rotation, no `retainRuns` pruning code, until a project needs it.

---

## Appendix A — Pivot, not rebuild

QABuddy is ~70 % of a context compiler already: library (`references/` + `LEARNINGS.md`), selection index (`Scope:`), a compile step (preamble "read at start"), flags (`.qabuddy.json`), a build tool, a judge (`fixtures.json`), and a feedback path (distill/promote/retire). The delta: the compile step is keyed by skill name and selects everything active; this RFC keys it by profile and (eventually) selects by score. That is a change to one protocol section plus counters. The one real refactor is separating knowledge from procedure — six skills hard-list references and embed checklists; those move to `tier=must` sections.

## Appendix B — Why predefined skills stay

A context compiler compiles *knowledge*. Something must still say what to *do* with it, and it must hold still:

1. **Attribution needs a control.** Vary knowledge, hold procedure fixed, watch outcomes. If both vary per run, a bad outcome is confounded and nothing can be learned about the knowledge.
2. **Evaluation is keyed to procedure.** Fixtures assert output contracts (tables, files, status blocks). An assembled-per-run procedure has no stable contract; you'd fixture the assembler, which is an LLM judgment.
3. **Gates are procedure.** Review Options, escalation, confirm-before-destructive, KB path convention. As scoreable knowledge they could be dropped by budget; as `must` they are procedure with extra steps.
4. **Interop is a contract.** `test-plan` → `test-cases` → `qa` → `verify-fix` chain through fixed artifact shapes and `index.json`.
5. **Invocation and packaging.** `/qa-test-cases PROJ-789` tells the SDT what appears where; platforms load *skills*.

What may legitimately shrink later: 14 procedures are probably four shapes (analyze-and-produce, execute-and-report, scaffold-code, meta) — a template refactor after PR1–PR6 have data. Selecting *among* fixed procedures (routing) is fine and exists; assembling them is not. Inside a phase the agent already plans freely (`## Plan`). The frame is thin; the freedom is inside it.
