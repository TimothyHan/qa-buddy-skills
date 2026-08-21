# RFC 0001 — 컨텍스트 컴파일러: QABuddy 스킬을 위한 측정되고 컴파일되는 지식

| | |
|---|---|
| **상태** | Accepted 2026-08-17 — 구현 진행 (어느 PR이 반영됐는지는 §8) |
| **저자** | Timothy Han (계획), Claude (리뷰 + 수렴) |
| **기원** | `tim-doc/context-compiler-plan.md`, `qabuddy-self-learning-roadmap.md`, `context-compiler-plan-review.md` (2026-08-16, 이 저장소 밖) |
| **번역** | 이 문서는 [영문 원본](0001-context-compiler.md)의 **비규범 전문 번역**입니다. 두 판이 다르면 영문판이 규범입니다 — RFC는 결정 기록이라 이중 유지되지 않으며(결정 7), 이 번역본은 영문판 변경 시 수동으로 따라갑니다. |

**한 문장:** 절차는 사람이 쓰고, 지식은 컴파일되고, 선택은 점수화되고, 승격은 게이트를 거친다.

---

## 요약

QABuddy의 학습 레이어(`LEARNINGS.md` → 읽기 → distill → 승격)는 지금 모든 화살표를 LLM이 산문을 읽어 판단한다 — **아무것도 세지 않는다.** 이 RFC는 그 루프에 숫자를 붙인다:

- **스킬(절차)은 사람이 작성하고 그대로 둔다.** 페이즈, 게이트, 산출물 형식, KB 경로는 고정 계약이다. 스킬은 컴파일하지 않는다 — 고정된 절차가 있어야 지식의 효과를 측정할 수 있다 (부록 B).
- **지식(레퍼런스 섹션 + 학습)은 실행마다 컴파일한다.** 각 `##` 섹션이 `REF-<file>#<id>`로 주소를 갖고, 실행마다 `slice.md` 하나로 선택되어 매니페스트(무엇이 들어갔고 무엇이 빠졌는지)와 함께 기록된다.
- **읽기 경로가 쓰기 경로가 된다.** 적용(`applied`)·모순(`contradicted`)·포착(`captured`)·결과(`outcome`)가 `features-kb/learnings-log.jsonl`에 append-only로 쌓인다. LLM이 JSON을 직접 쓰지 않도록 40줄짜리 `bin/qab.js` 헬퍼가 쓴다.
- **distill은 산문 판단 대신 산술로 바뀐다.** 승격 후보 = `applied ≥ 3 (≥ 3 runs) ∧ contradicted = 0`; 반증 = `contradicted ≥ 2` 또는 지문(fingerprint) 재발; 미적용 = 후보 ≥ 10회, 적용 0회. 사람이 승인하고, 레퍼런스 편집은 eval 게이트를 통과해야 한다.
- **9개 PR, 두 그룹.** PR0–PR6은 동작 변화 없음(측정·감사 가능성만 추가). §7.4 게이트를 통과할 때만 PR7(점수 기반 선택, 플래그 뒤)·PR8(옵트인 자동 상태 변경)로 간다.
- **결론 (2026-08-19): PR7은 만들지 않는다 (결정 16 · §9.3 Outcome).** 게이트는 열렸고(프로파일 2개, outcome 9·8, 적용 편차 확인) 그래서 게이트가 허가한 **측정을 실제로 수행했다** — 그 측정이 점수화에 반대했다. 28회 실행에서 한 번도 적용되지 않은 섹션 18개 중 **선택(selection) 실패는 0건**이다: 3개는 애초에 발화 불가(이 프로젝트에 없는 `team-practices/` 파일을 가리키는 조건부 포인터), 8개는 프리앰블이 다시 진술하고 있고, 7개는 아직 그런 종류의 일을 하지 않았을 뿐이다. 점수화 대신 **스코프 정리와 중복 제거**가 `/qa-qa` 슬라이스를 278줄/48% 유휴에서 **203줄/4%**로 줄였다 — PR7이 얻어내려던 감축을 결정론적으로 달성한 것이다. **RFC 0001은 PR0–PR6에서 닫는다.** 다만 이것은 **한 프로젝트의 데이터에 대한 판정이지 점수화 자체에 대한 판정이 아니다** — 라이브러리가 크고 프로파일이 여럿이며 CI·UAT·지표 작업이 실제로 일어나는 프로젝트는 게이트를 정당하게 통과할 수 있다. 그런데 **지금은 그렇게 판단해도 손을 쓸 수 없다**: 선택(scope)이 배포되는 파일 안에 있어 업데이트 때 덮어써지고, 컴파일러는 `.qabuddy.json`에서 `learningsPath`·`runsDir`만 읽는다. 그래서 PR7·PR8은 QABuddy가 한 번 배포하는 단계가 아니라 **프로젝트가 자기 측정으로 여는 능력**으로 재정의한다 — **RFC 0002(프로젝트 소유 컴파일러 설정)**.
- **하지 않을 것:** LLM이 레퍼런스를 쓰는 일, 마크다운에 카운터 넣기, 벡터 스토어, 두 컴파일러(`build.js`/컨텍스트 컴파일러) 합치기, "깨끗한 실행은 흔적을 남기지 않는다" 원칙 훼손.

---

## 0. 정의

| 용어 | 뜻 |
|---|---|
| **소스(Source)** | 주소를 갖는 지식 한 단위: 레퍼런스 섹션(`REF-…`) 또는 학습(`LRN-…`) |
| **라이브러리(Library)** | 모든 소스: `core/references/**` + 프로젝트의 `LEARNINGS.md` |
| **프로파일(Profile)** | 실행이 다루는 문제를 작은 닫힌 열거형으로 기술한 것 (v0: 4 필드) |
| **pfp / ffp** | 문제 지문 / 실패 지문 — sha256 앞 12 hex |
| **슬라이스(Slice)** | 한 실행을 위해 선택된 소스들의 원문 그대로 + 무엇이 들어가고 빠졌는지의 매니페스트 |
| **컴파일 단계** | (스킬, 프로파일, 라이브러리, 스코어보드) → 슬라이스. 결정적. 스킬 실행당 한 번 |
| **스코어보드(Scoreboard)** | 소스별 파생 카운터(`in_slice, applied, contradicted, last_applied, runs`); 재생성 가능한 캐시, 절대 진실의 원천이 아님 |
| **절차(Procedure)** | 스킬의 안정적이고 사람이 쓴 페이즈/게이트/형식 (`SKILL.md`) |
| **지식(Knowledge)** | 실행에 주입되는 진화하는 사실/규칙 (슬라이스) |
| **SDT** | QABuddy를 운용하는 사람 테스터 |

---

## 1. 문제

지금의 루프는 포착 → 읽기 → distill → 승격이며, **모든 화살표가 LLM의 산문 읽기다**. 이 저장소에서 관찰된 결과 (2026년 8월):

- "승격에는 날짜가 다른 3회 이상 실행의 증거가 필요하다"를 코드가 검사할 수 없다.
- 은퇴는 어떤 실행이 모순을 *알아채 주기*를 기다린다; 조용한 무관련성은 영원히 은퇴하지 않는다.
- `Evidence:`는 출생증명서이지 실적 기록이 아니다.
- 실행 안의 단계 구분이 없어 목록 모양 항목(LRN-20260808-03, -06)이 생겼다 — "항목당 사실 하나" 위반.
- `.qa-reports/` + `features-kb/features/`의 산출물 중 `LRN-`을 인용한 것은 단 **1개** — "적용한 것을 인용하라"가 측정 가능하게 지켜지지 않고, 지금은 *안 지킨 것*과 *관련이 없던 것*을 구별할 수도 없다.
- eval 픽스처는 simulate 모드에서 모델이 채점한다; 뮤테이션 스모크(v0.4.0)는 스킬 하나를 삭제해도 구조 검사 740개가 green임을 보였다. 그런 심판에 최적화된 컴파일러는 심판의 비위를 맞추는 법을 배울 것이다.
- 단일 작성자 마크다운; 같은 날 ID 충돌; 포착 시점에 궤적(trajectory)이 버려짐.

반자율 = 루프에 숫자를 주고, 그 숫자에만 근거해, 자율성 사다리의 가장 낮은 안전한 단에서만 행동하게 하는 것.

---

## 2. 아키텍처

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

두 컴파일러는 공존하며 절대 합치지 않는다: `build.js`(설치당 한 번, `core/` → `dist/`)와 컨텍스트 컴파일러(실행당 한 번, 라이브러리 → 슬라이스).

---

## 3. 데이터 모델 (수렴 완료)

모든 런타임 파일은 **프로젝트 콘텐츠**다: 사용자 저장소에 살고, 배포되지 않으며, 이중 로케일이 아니다. 로그는 **append-only JSONL**이고 제자리 편집은 없다. 모든 라인이 `"v"`를 지니며, 리더는 모든 이전 버전을 영원히 수용한다.

### 3.1 소스 ID — 주석 전용, 기본은 `##`

```markdown
## Selectors
<!-- qab: id=selectors scope=e2e-pom,e2e-write,qa tier=should -->
```

- ID = `REF-<file-stem>#<id>`; `playbook/` 아래는 `REF-playbook/<stem>#<id>`. 영구적이다; 제목은 자유롭게 바꾸되 id는 절대 바꾸지 않는다.
- 제목 텍스트에 `{#slug}`를 넣지 않는다(GitHub에서 문자 그대로 렌더링됨; id는 주석이 이미 지님).
- `##`는 기본적으로 주소를 가진다. `###`는 **자기 `qab:` 주석을 지닐 때만** 주소를 가지며, 아니면 부모에 속한다.
- `scope=`는 쉼표로 구분한 스킬 이름 또는 `all`(기본 `all`). `tier=`는 `must | should | context`(기본 `should`; `must`는 레일과 스킬이 구조적으로 의존하는 섹션에만).
- 한국어 대응본은 `qab:` 주석을 **그대로** 복사한다. `build.js`는 중복 id나 en/ko id 집합 불일치에서 실패한다 — tier 누락에서는 실패하지 **않는다**.
- **PR3에서 확정:** H1 주석은 섹션이 상속하는 파일 기본값(`scope=`, `tier=`)을 지니며, 지식이 H1 바로 아래 있는 파일에는 `id=`를 둘 수 있다(`terminology.md` → `REF-playbook/terminology#terms`, `execution-sequence.md` → `#sequence`); `README.md`·`index.md`는 내비게이션이라 제외; 코드 펜스 안의 `##`는 제목이 아니다; `index.json`은 `dist/<…>/references/`에만 생성(`core/`에는 없음); `qab:` 줄은 플레이북 70줄 예산에서 제외; `Overrides:`는 `REF-…`, `SKILL:<name> "…"`(스킬 절차 오버라이드), 또는 `none`/`없음`을 받는다.
- 학습에 선택 필드 둘이 추가된다: `**Fingerprint:** ffp-…`와 `**Profile:** surface=web`(`Scope:`와 AND). `Overrides:`는 ID(`REF-playwright-patterns#preconditions (extends)`) 또는 `none`/`없음`.

### 3.2 프로파일 v0 — 4 필드, 전부 결정적

```json
{"schema":"profile/1","skill":"qa","surface":"web|api|cli|mobile|mixed|unknown","pom":"exists|partial|none|n/a","ticket_kind":"feature|bug|regression|refactor|unknown"}
```

출처: `skill`은 호출에서; `surface`는 `playwright/AUTOMATION.md` 존재 여부에서; `pom`은 `playwright/pom/` 존재에서; `ticket_kind`는 Jira 이슈 타입에서(LLM 없음). `unknown`은 일급 값이다. `pfp` = `skill`을 뺀 정규 JSON의 sha256 앞 12 hex. 필드는 실제 학습이 `Profile:` 좁히기를 필요로 할 때만 추가한다.

### 3.3 `features-kb/learnings-log.jsonl` — 스키마 v1

```jsonl
{"v":1,"ts":"2026-08-20T09:12:04Z","run":"qa-PROJ-456-3f9a2c","skill":"qa","event":"applied","src":"LRN-20260808-03"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"contradicted","src":"LRN-20260808-04","note":"HOME isolation not needed: script uses --prefix"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"captured","src":"LRN-20260816-09"}
{"v":1,"ts":"…","run":"…","skill":"qa","event":"outcome","status":"DONE"}
{"v":1,"ts":"…","run":"…","skill":"qa","pfp":"3b9e0c1a77d4","event":"compiled","sources":["…"],"used":171,"max":220}
```

| event | 시점 | 필드 | 반영 |
|---|---|---|---|
| `applied` | 소스가 출력을 눈에 띄게 좌우함 (기존의 "적용한 것을 인용하라") | `src` | PR1 (LRN), PR4 (REF) |
| `contradicted` | 라이브 관찰이 active 소스와 모순됨 | `src`, `note` | PR1 |
| `captured` | 새 LRN이 작성됨 | `src` | PR1 |
| `outcome` | 완료 상태 | `status` (`DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`) | PR1 |
| `compiled` | 컴파일 단계 종료 | `pfp`, `sources[]`, `used`, `max`, `dropped[]` | PR5 |
| `escalated` | 실행이 완료될 수 없었음 | `reason` | PR5 |

`pfp`는 모든 이벤트에서 선택 사항(PR5 이전에는 없음). `writer:"manual"`은 echo 폴백으로 쓰인 라인 표시. 경로 = `learningsPath`(`.qabuddy.json`, 기본 `features-kb/LEARNINGS.md`)의 형제 파일. `run` = `<skill>-<ticket|branch>-<6hex>`.

### 3.4 `features-kb/fingerprints.jsonl` (PR6)

```jsonl
{"v":1,"ts":"…","run":"…","skill":"e2e-pom","ffp":"a3f9c21b0e44","kind":"locator-not-found","key":"checkout/place-order-btn","active":["LRN-20260808-02"]}
```

`ffp` = sha256(`kind + "\n" + 정규화된 key`)의 앞 12 hex. `kind`는 닫힌 어휘로 신중히 늘린다: `locator-not-found | ac-unmapped | spec-flaky | ci-step-failed | env-unreachable | auth-failed | fixture-missing | assertion-mismatch | tool-unavailable`. `active` = 슬라이스 안에서 `Fingerprint:`가 이 `ffp`와 같은 LRN들 → 자동 반증 증거.

### 3.5 스코어보드 v1 — `features-kb/.cache/scoreboard.json` (PR6), 파생

```json
{"rebuilt_at":"…","per_source":{"LRN-20260808-03":{"in_slice":14,"applied":11,"contradicted":0,"last_applied":"2026-09-10","runs":12}}}
```

v1에는 `wins/losses`가 없다 — `DONE` 비율은 거의 상수라 순위 정보를 지니지 않는다; `applied/in_slice`와 `contradicted`가 신호다. `per_profile`은 로그에 서로 다른 `pfp`가 2개 이상, 각각 outcome이 `MIN_SAMPLES`개 이상일 때만 (PR7) 추가한다.

### 3.6 `references/index.json` (PR3, 배포됨, `build.js`가 생성)

```json
{"REF-playwright-patterns#selectors":{"file":"playwright-patterns.md","heading":"Selectors","scope":["e2e-pom","e2e-write","qa"],"tier":"should","lines":15}}
```

### 3.7 실행 디렉터리 (PR5) — `.qa-reports/runs/<run_id>/`

`profile.json`, `slice.md`, `scratchpad.md`(`## Candidate learnings`는 항상; `## Plan` / `## State`는 tier-2 다단계 스킬만), `events.jsonl`(이 실행의 라인, 프로젝트 로그에도 추가됨). `.qa-reports/`의 나머지와 함께 gitignore. 실행이 `captured`/`contradicted`/`escalated`면 보존, 아니면 정리 가능(`retainRuns: captured|all|none`).

### 3.8 슬라이스 + 매니페스트 (PR5)

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

본문은 원문 그대로다. 컴파일러는 선택할 뿐, 절대 바꿔 쓰지 않는다.

---

## 4. 헬퍼 — `bin/qab.js`

의존성 0의 Node 스크립트. 소스는 저장소의 `bin/qab.js`, `build.js`가 `dist/<platform>/references/bin/qab.js`로 배포한다. 기존 references 심볼릭 링크를 통해 모든 플랫폼에서 `node {{REFERENCE_PATH}}/bin/qab.js …`로 도달 가능 — **설치 스크립트 변경 없음**. 모델은 인자만 넘기고 JSON을 직접 타이핑하지 않는다.

| 서브커맨드 | 반영 | 하는 일 |
|---|---|---|
| `run-id --skill <s> [--ticket <k>]` | PR1 | `<skill>-<ticket|branch>-<6hex>` 출력; `.qa-reports/.qab-run`에 `{run, skill, started}` 기록 |
| `log <event> [<src>] [--note …] [--status …] [--run <id>] [--skill <s>]` | PR1 | v1 라인 1줄 추가; `run`/`skill`은 플래그 → `QAB_RUN` 환경변수 → 마커 → `unknown` 순 |
| `stats [--since <date>]` | PR1 | 로그의 소스별 표: `applied, contradicted, last_applied, runs` (PR5 이후 `in_slice` 추가) |
| `compile --skill <s> [--ticket <k>]` | PR5 | §5; PR7 전까지 비점수 |
| `fp <kind> <key>` / `fp --list` | PR6 | §3.4 라인 추가(`active`는 현재 슬라이스에서 계산); 이 실행의 지문 나열 |
| `scoreboard` | PR6 | 두 로그에서 `.cache/scoreboard.json` 재생성 |

Node가 없을 때의 폴백(드묾 — `build.js`부터 Node가 필요): `"writer":"manual"`을 붙이는 문서화된 `echo` 레시피; distill이 manual 비율을 보고한다.

---

## 5. 컴파일 단계

**후보 집합:** `skill ∈ scope(s) ∧ (LRN status active) ∧ profile ⊇ Profile(s)`.
**PR5 (비점수):** `tier=must` 먼저, 그 다음 나머지 후보를 파일 순서로(LRN은 선언된 경우 자기가 오버라이드하는 REF 뒤, 아니면 모든 REF 뒤), `budget.max_lines`(tier-2 220 / tier-1 120)까지 패킹. 그 외는 전부 → `dropped: budget`. **수용 기준: 슬라이스의 소스 집합이 스킬이 이전에 읽던 것과 같음** — 세 스킬에서 확인.
**PR7 (점수, `compiler.scoring` 뒤):** `score = applied_ratio × contradiction_penalty × recency × freq`; `must` = ∞; 최근 3 실행 내 모순 → ×0.25; 휴면 = 후보 ≥ 10 ∧ 적용 0(달력 감쇠는 탈락 조건이 아님); 최고 탈락 후보의 10% 오디션; `per_profile` 항은 데이터가 있을 때만(§3.5). 빈 스코어보드의 첫날 = PR5 동작.

---

## 6. 학습 루프

### 6.1 런타임 의무 (프리앰블; 3개 항목, 각 ≤ 2줄 — 강한 예산)

1. **시작 시 읽기** — `qab.js run-id`, 이후 (PR5+) `qab.js compile` 후 `slice.md` 읽기; 폴백: 레퍼런스 + 학습 파일, 스킬 스코프, `active`. 충돌 시 학습이 레퍼런스를 이긴다.
2. **인용하고 로그** — 출력을 좌우한 모든 소스를 ID로 인용하고 `qab.js log applied <id>`; 모순되면 → 적용하지 말고 `log contradicted --note`, 보고서에 플래그; (PR5+) 실행 스크래치패드에 `## Candidate learnings` 유지.
3. **마무리** — 세 가지 포착 트리거 적용(PR5+: 후보에만); 발화하면 → 항목 추가 + `log captured`; 없으면 → 아무것도 쓰지 않음; `log outcome --status`. `/qa-improve`는 제안만, 절대 스스로 실행하지 않음.

### 6.2 distill이 계산하는 것 (산문 판단을 대체)

| 발견 | 규칙 | 반영 |
|---|---|---|
| 승격 후보 | `applied ≥ 3` (서로 다른 실행 `≥ 3`) ∧ `contradicted = 0` ∧ (`Fingerprint:` 있으면) 활성화 이후 ffp 무반응 ∧ 일반화 가능(LLM, 마지막) | PR1 (+ffp PR6) |
| 반증 (모순) | `contradicted ≥ 2` ∧ 마지막 모순 이후 `applied` 없음 | PR1 |
| 반증 (지문) | 이 LRN이 `active`에 있는 `fingerprints.jsonl` 라인 존재 | PR6 |
| 미적용 | 후보 집합에 ≥ 10회 ∧ 적용 0회 (PR5의 `in_slice` 필요) | PR5 |
| 중복 (지문) | 같은 `Fingerprint:` ∧ 같은 `Scope:` | PR6 |
| 중복 (진술) / 복사 | LLM 검사 (기존) | — |
| 건강함 | — | — |

LLM의 역할은 두 판단으로 줄어든다: *이 프로젝트 너머로 일반화 가능한가?* 와 *이것은 복사인가?*

### 6.3 게이트

1. **사람 게이트** — 모든 상태 변경과 레퍼런스 편집에 (기존).
2. **eval 게이트** (PR2) — 승격 시: 승격 대상 섹션의 스코프에 있는 모든 스킬의 `tests/fixtures.json`을 전/후로 실행; 모든 스킬에서 `pass_after ≥ pass_before`일 때만 머지; 아니면 `features-kb/LEARNINGS.rejected.md`에 실패한 픽스처 id를 기록하고 LRN은 `active`로 남는다.
3. **크리틱** (PR2) — `/qa-improve --distill --dry-run`은 `features-kb/distill-proposal-<date>.md`만 쓰고 아무것도 편집하지 않는다. 트리거: `active > 30`, 반증 발견, 또는 요청/일정.
4. **옵트인 자동 상태 변경** (PR8, `autoStatusChanges: true`) — 지문으로 확정된 반증 시 `active → retired`; `applied ≥ MIN_SAMPLES ∧ contradicted = 0`이면 `candidate → active`; 감사 이벤트 기록. 레퍼런스 편집은 절대 자동이 아니다.

---

## 7. 확정된 결정

| # | 결정 | 내용 | 이유 |
|---|---|---|---|
| 1 | 로그 작성자 | PR1의 `bin/qab.js`, references 심볼릭 링크 아래 | 잘못된 라인은 영구적이다; 설치 스크립트는 손대지 않는다 |
| 2 | 앵커 메커니즘 | 주석 전용 id; `##` 기본; tier 기본 `should`; 빌드는 중복/로케일 불일치에서만 실패 | GitHub는 `{#slug}`를 문자 그대로 렌더링; `###`는 하위 부품; tier에는 데이터가 필요 |
| 3 | 프로파일 v0 | `skill, surface, pom, ticket_kind` | 채워지느냐가 아니라 재발하느냐 |
| 4 | 스코어보드 v1 | `wins/losses` 없음 | `DONE` 비율은 거의 상수 |
| 5 | 휴면 | 후보 횟수 기준 (후보 ≥ 10, 적용 0) | 몰아치는 솔로 사용; 달력 시계는 유효한 LRN을 잘못 지목 |
| 6 | P6a 시점 | eval 게이트 + dry-run 크리틱 = PR2 | 픽스처 + 로그에만 의존; 루프를 일찍 닫는다 |
| 7 | RFC 로케일 | en + ko 요약, 이중 유지 안 함 | 설계 기록이지 배포 산출물이 아님 |
| 8 | 스크래치패드 범위 | `## Candidate learnings`는 전 스킬; `## Plan/## State`는 tier-2만 | 관찰된 결함(목록 모양 LRN)은 후보로 고쳐진다 |
| 9 | 프리앰블 예산 | 3개 항목, 각 ≤ 2줄 | tier-1 프리앰블 ~34줄 × 14 스킬 |
| 10 | `cites` 연산자 | 추가 안 함; `LRN-\d{8}-\d{2}\|REF-[a-z0-9/-]+#[a-z0-9-]+`에 `matches` | 설탕일 뿐; 새 연산자는 eval SKILL en/ko + test.js `VALID_OPS`를 건드림 |
| 11 | Phase 0 | 숫자가 아니라 규칙: 모든 새 의무는 자기가 쓰는 산출물에 대한 execute 모드 픽스처 + PR 본문의 뮤테이션 스모크를 함께 배포 | simulate 픽스처는 모델이 채점 |
| 12 | 순서 | P2a(LRN 로그)를 P1(REF id)보다 먼저; REF 인용(P2b)은 그 뒤, 준수율 게이트 | P2a는 id가 필요 없다; 데이터 없는 id = 추측된 tier |
| 13 | 스킬은 사람이 쓴 채로 | 부록 B 참조 | 귀속(attribution)에는 통제가 필요; 픽스처는 절차 계약에 키잉됨 |
| 14 | 로케일 주기 (2026-08-17) | **런타임 대면** 파일(프리앰블, `self-improve.md`, `run-protocol.md`, 스킬 본문, 새 레퍼런스 파일)은 ko 대응본을 **같은 PR에서**; **사람 대면 문서**(CONTRIBUTING, README)는 main 최종 머지 전 통합 브랜치에서 ko 정합 1회; RFC는 en + ko 요약 유지 | 메인테이너는 `dist/ko`로 도그푸드한다 — 런타임 텍스트의 ko 드리프트는 테스트 실행이 다른 도구를 측정한다는 뜻; 문서는 순서가 안정될 때까지 출렁인다 |
| 15 | 통합 브랜치 (2026-08-17) | 모든 RFC PR은 `feat/context-compiler` 대상; `main`은 전 단계 + 테스트 후 한 번의 머지만 받는다 | `main`을 릴리스 가능하게 유지; 전체 변경에 릴리스 하나 |
| 15a | 실제로 일어난 일 (2026-08-17, 정정) | PR0–PR6(+ 첫 실제 승격과 `improve` 잔여물 수정)이 PR7/PR8 *이전에* `main`에 머지되어 **v0.5.0**으로 릴리스됐다 — 결정 15로부터의 일탈이지 결정의 개정이 아니다. 브랜치는 같은 커밋에서 `main`으로부터 재생성됐다; **PR7, PR8과 그 이후 전부는 다시 `feat/context-compiler`를 대상으로 하며, `main` 머지는 메인테이너의 명시적 승인이 있을 때만 일어난다** | 배포된 상태는 동작 중립이고 도그푸드됐으므로 되돌리는 대신 그대로 뒀다; 결정 자체는 유효하다 |
| 16 | §9.3 판정 (2026-08-19) | **이 프로젝트의 증거로는 PR7을 만들지 않는다.** 게이트는 열렸다 — 프로파일 2개가 outcome 9·8을 지녔고 적용은 측정 가능하게 불균등했다 — 그래서 게이트가 허가한 측정을 수행했다. 측정은 점수화에 반대했다: 28회 실행에서 한 번도 적용되지 않은 18개 섹션 중 **선택 실패는 0건**. 3개는 아예 발화 불가(이 프로젝트에 없는 `team-practices/` 파일을 가리키는 조건부 포인터), 8개는 프리앰블이 재진술, 7개는 그런 종류의 일이 아직 없었을 뿐. 스코프 정리가 `/qa-qa`를 278줄/48% 휴면에서 **203줄/4%**로 — PR7이 얻어내려던 감축을 결정론적으로 달성. RFC 0001은 PR0–PR6에서 닫는다. **이것은 한 프로젝트의 데이터에 대한 판정이지 점수화라는 아이디어에 대한 판정이 아니다** — 더 큰 라이브러리, 더 많은 프로파일, 더 다양한 작업을 가진 프로젝트는 게이트에 정직하게 도달할 수 있다. 다만 오늘은 그래도 행동할 수 없다: 선택이 배포되는 `qab: scope=` 주석 안에 살므로, PR7/PR8은 QABuddy가 한 번 배포하는 단계가 아니라 **프로젝트별 옵트인 경로**(RFC 0002)로 옮긴다 | 점수화는 후보의 순위를 매긴다; 휴면 중 순위 문제는 하나도 없었다. 전역 `applied` 점수는 이 프로젝트가 아직 그런 일을 안 했다는 죄로 CI·지표·UAT 지식을 강등시켰을 것이다 — 그리고 2026-08-19의 두 실행(`/qa-review-ticket`, `/qa-test-plan`)은 맞는 작업이 나타나는 순간 그 중 12개 섹션을 깨웠다 |

---

## 8. 구현 순서 — 9개 PR

모든 PR의 규칙: `feat/context-compiler` 대상(결정 15); 런타임 대면 파일은 en + ko, 문서 ko는 최종 정합으로 연기(결정 14); 변경된 모든 스킬에 버전 범프; `node build.js all` + `node test.js` green; **PR 본문에 새 의무마다 뮤테이션 스모크 제시**(의무 제거 → 픽스처 red → 복원 → green); 머지 전 CI green; PR0–PR6의 동작 변화 열은 *none*이어야 한다.

| PR | 상태 | 내용 | 동작 |
|---|---|---|---|
| **PR0** | 완료 | RFC를 저장소에; CONTRIBUTING 로드맵 포인터 | 없음 |
| **PR1** | 완료 | 학습 로그 + `qab.js run-id/log/stats` + 프리앰블 인용·로그 + distill 계산 열 + execute 픽스처 | 없음 |
| **PR2** | 완료 | eval 게이트 승격 + `--dry-run` 제안 | 없음 |
| **PR3** | 완료 | REF id(`qab:` 주석) + `index.json` + 로케일 정합 + `Overrides:` 이행 | 없음 |
| **PR4** | 완료 — 게이트 충족 5/5 REF, 4/5 LRN (skills-test, 실제 5회 실행 2026-08-17) | REF 인용 + REF `applied` 이벤트 + 준수율 게이트 | 없음 (토큰) |
| **PR5** | 배포 (PR4 게이트 충족 5/5 REF, 2026-08-17) | `qab.js compile` 비점수 + 실행 디렉터리 + 스크래치패드-lite + `run-protocol.md` | 없음 (집합 동일성) |
| **PR6** | 배포 2026-08-17 (결정 15a에 따라 `main`에 v0.5.0으로) (`fp`, `scoreboard`, `stats` 발견; 뮤턴트 8/8 red) | 지문 + 스코어보드 캐시 + 지문 반증/중복 | 없음 (`pom-stats.jsonl` heal 선호는 연기) |
| **게이트** | | §9.3 | |
| **PR7** | | `compiler.scoring` 뒤의 점수 선택 | 있음, 플래그 |
| **PR8** | | `autoStatusChanges` 옵트인 | 있음, 옵트인 |

### PR0 — RFC를 저장소에

- `docs/rfc/0001-context-compiler.md` (이 파일).
- `CONTRIBUTING.md` / `CONTRIBUTING-en.md`: Project Structure 아래 RFC를 링크하는 "로드맵" 문단 하나; 프로젝트 구조 트리에 `docs/rfc/` 추가; 낡은 수치 정정.
- **수용:** 링크 해석; `node test.js` green.

### PR1 — 읽기 경로 로그 (P2a) + 헬퍼 + 픽스처

1. `bin/qab.js`(~120줄, 의존성 0): §4의 `run-id`, `log`, `stats`. `.qabuddy.json`의 `learningsPath`를 읽고, 로그 경로는 형제 `learnings-log.jsonl`; 디렉터리 `mkdir -p`; UTC ISO `ts`; `v:1`; 모든 필드 JSON 인코딩; 성공 시 exit 0, 아니면 한 줄 오류와 함께 비-0. 파일을 절대 다시 쓰지 않는다.
2. `build.js`: 저장소 `bin/` → 모든 플랫폼·로케일의 `dist/<platform>/references/bin/`으로 복사(references 복사 후). `bin/qab.js`가 없으면 빌드 실패.
3. `core/references/self-improve.md`(+ko): 새 §"학습 로그" — 스키마 v1(§3.3, 이벤트 `applied/contradicted/captured/outcome`; `compiled/escalated`는 예약), `qab.js log` 레시피, 시작 시 `run-id`, 병렬 세션용 `--run`, `writer:"manual"` echo 폴백, "리더는 모든 이전 버전을 수용". 읽기 프로토콜 4단계 → "인용**하고 로그**"; 5단계 → "`contradicted` 로그". 포착 프로토콜 → "`captured` 로그". 라이프사이클 → distill이 로그를 읽는다.
4. `core/preamble-base.md`(+ko): Project Learnings 블록을 §6.1 항목 1–3으로 재작성(PR1 문구: compile 없음, 스크래치패드 아직 없음). 총 ≤ 10줄.
5. `core/skills/improve/SKILL.md`(+ko): Distill 모드가 `qab.js stats`를 읽음; 스윕 표에 `applied · contradicted · last_applied · runs` 열 추가; 승격 후보 규칙 = §6.2; 반증(모순) 규칙 = §6.2; 사람 게이트 유지. 버전 범프(마이너).
6. `core/skills/setup/SKILL.md`(+ko): `learningsPath` 옆에 `learnings-log.jsonl` 언급(커밋됨; append-only). 패치 범프.
7. `core/references/feature-knowledge-base-spec.md`(+ko): `features-kb/` 트리에 `learnings-log.jsonl` 한 줄.
8. 픽스처: `improve/tests/fixtures.json` — distill 출력에 계산 열이 있고 수치 승격 규칙을 적용함을 단언하는 새 픽스처(그럴듯한 오답: `applied` = 1인데 산문 증거로 승격). `e2e-setup/tests/fixtures.json`(execute 모드, 픽스처 앱) — 실행 후 `cmd: tail -n1 features-kb/learnings-log.jsonl` + `output_matches "event":"outcome"` 및 `output_matches "run":"e2e-setup-`.
9. `test.js`: (a) 모든 dist references 디렉터리에 `bin/qab.js` 존재; (b) **행동**: 스크래치 디렉터리에 `qab.js run-id`/`log`/`stats` 실행, 추가된 라인 파싱, `v/ts/run/skill/event/src` 단언, 두 번째 `log`가 다시 쓰지 않고 추가함을 단언; (c) 3줄 픽스처 로그의 `stats`가 기대 카운트 산출. EXPECTED_SKILLS 불변.
10. `README.md` / `README-en.md`: 학습 레이어 불릿 아래 한 줄("모든 실행이 applied/contradicted/captured/outcome를 `features-kb/learnings-log.jsonl`에 로그"); 구조 검사 수 재동기화.
11. **PR 본문의 뮤테이션 스모크:** 프리앰블 항목 2 삭제 → e2e-setup execute 픽스처 red; 복원 → green. `qab.js` JSON 인코딩 파괴 → test.js red.
- **수용:** 위 전부; 그 후 실제 5회 실행에 걸쳐 `outcome` 라인 ≥ 5와 스코프된 곳의 LRN `applied` 라인. **동작:** 없음.

### PR2 — eval 게이트 승격 + 크리틱 dry-run (P6a)

1. `improve/SKILL.md`(+ko) Distill 모드: 승격 단계는 레퍼런스 편집 전/후로 승격 대상 섹션 스코프의 모든 스킬에 `/qa-eval` 실행; `pass_after < pass_before` → 편집 되돌림, `features-kb/LEARNINGS.rejected.md` 기록(`날짜 · LRN · 대상 REF · 실패 픽스처 id`), LRN은 `active` 유지. 새 플래그 `--dry-run`: 전체 스윕 + 계산 열 → `features-kb/distill-proposal-<YYYY-MM-DD>.md`, 편집 0. 트리거 문구: `active > 30`, 반증 발견, SDT 요청.
2. `self-improve.md`(+ko): §게이트 (§6.3 항목 1–3).
3. 픽스처: `improve/tests/fixtures.json` — dry-run이 제안 파일을 만들고 어떤 `Status:` 편집도 `not_contains`; 퇴행한 승격은 픽스처 id를 명시하며 거부됨.
4. **뮤테이션 스모크:** 전/후 eval 단계 제거 → 픽스처 red.
- **수용:** 거부가 픽스처를 명명; dry-run은 편집 0. **동작:** 없음.

### PR3 — REF id + 인덱스 + 로케일 정합 (P1)

1. `core/references/**`의 모든 `##`(현재 76개) 아래에 `<!-- qab: id=… scope=… [tier=must] -->` 추가, `locales/ko/references/**`에 그대로 복사. `must` 대상: `playwright-patterns#never`와 여섯 하드리스트 스킬(`e2e-write e2e-setup e2e-pom test-cases setup improve`)이 의존하는 섹션; 나머지는 기본 `should`.
2. `build.js`: 주석 파싱 → 모든 dist에 `references/index.json`(§3.6); 중복 id에서 실패; en/ko id 집합이 다르면 실패.
3. `self-improve.md`(+ko): §소스 ID; 항목 템플릿에 선택적 `Fingerprint:` / `Profile:`; `Overrides:`는 ID 또는 `none`/`없음`.
4. `features-kb/LEARNINGS.md`(이 저장소의 도그푸드 파일): 실제 `Overrides:` 포인터 2개를 ID로 이행.
5. `test.js`: `LEARNINGS.md`의 모든 `Overrides:`가 `index.json`의 id로 해석되거나 `none`/`없음`; 모든 dist에 `index.json` 존재; en/ko id 집합 동일(`testKoreanCompleteness` 확장); **`core/references/**`의 모든 파일에 `locales/ko/references/**`의 동명 파일 존재** — `build.js`가 references *디렉터리*를 로케일별로 해석하므로 en 전용 새 파일은 조용히 `dist/ko`에 못 간다(결정 14).
6. `CONTRIBUTING(-en).md`: "지식 작성" 섹션(섹션 형식, 규칙), "새 로케일 추가" 앵커 규칙, 체크리스트 행.
- **수용:** 빌드가 인덱스 생성; 정합 테스트 green; `Overrides:` 해석. **동작:** 없음.

### PR4 — REF 인용 (P2b)

1. `preamble-base.md`(+ko) 항목 2: "모든 소스(`LRN-…` 또는 `REF-…`)를 인용". `self-improve.md`: REF 인용 의무.
2. `improve` distill: `stats` 표에 REF 행 포함; 미적용 자리 표시(`in_slice` 필요, PR5).
3. **준수율 게이트 (수용):** 실제 5회 실행에 걸쳐, 읽기 집합에 REF가 있는 스킬에서 4회 이상이 섹션 단위 REF `applied` 라인을 지님. `qab.js stats`가 이를 "citation compliance … overall: x/y REF"로 출력 — PR5 시작 전에 읽을 것. 미충족이면 PR5가 섹션 단위로 패킹하기 전에 후속으로 id를 파일 수준(`REF-playwright-patterns`)으로 굵게 만든다.
4. **PR4에서 확정:** `qab.js log applied REF-…`는 헬퍼 옆의 배포된 `references/index.json`에 대해 id를 검증하고, 모르거나 잘못된 id를 최근접 제안과 함께 거부한다 — 오타 난 id는 절대 로그에 들어가지 않는다; LRN id는 프로젝트 콘텐츠라 형식만 맞으면 통과.
- **동작:** 없음 (약간의 토큰 비용).

### PR5 — 비점수 컴파일 + 실행 디렉터리 + 스크래치패드-lite (P3)

1. `qab.js compile --skill <s> [--ticket <k>]`: 프로파일 v0(§3.2), 후보 집합(§5), `must` → 파일 순서 → 예산 패킹, `.qa-reports/runs/<run>/{profile.json,slice.md}` 기록, `compiled` 이벤트 추가, 슬라이스 경로 출력. 매니페스트는 §3.8. `qab.js log`는 실행의 `events.jsonl`에도 추가.
2. `core/references/run-protocol.md`(+ko, 신규): 컴파일 단계, 매니페스트 필드, 폴백 규칙, 스크래치패드 섹션과 작성 시점, `retainRuns`.
3. `preamble-base.md`(+ko): 항목 1에 "`qab.js compile` 실행; `slice.md` 읽기; 폴백…"; 항목 2에 "`## Candidate learnings`"; 항목 3 "트리거는 후보에 적용". 여전히 3개 항목. §Context Recovery: 최신 `.qa-reports/runs/` 스캔.
4. tier-2 다단계 스킬(`qa test-plan test-cases e2e-setup e2e-pom e2e-write exploratory review-ticket`, +ko): 페이즈 헤더에 한 줄 "`## State` 갱신; Review Options 일시정지에서 스크래치패드 재독". 패치 범프. 하드리스트된 레퍼런스는 이 PR에서 **유지**.
5. `.qabuddy.json`(setup 스킬): `runsDir`(기본 `.qa-reports/runs`), `retainRuns`(기본 `captured`).
6. `test.js`: 행동 — 픽스처 라이브러리에 `qab.js compile`을 실행하면 소스 집합이 스킬 스코프 active 집합과 같은 슬라이스 산출; `must` 먼저; 매니페스트 파싱됨.
7. 픽스처: execute 모드 — `file:.qa-reports/runs/*/slice.md exists`; 스크래치패드에 `## Candidate learnings`.
- **수용:** 세 스킬에서 집합 동일성; 후보 → 트리거 통과분만 `LEARNINGS.md` 도달. **동작:** 없음.
- **PR5에서 확정:** (a) 비점수 컴파일에는 **예산 상한 없음**(`budget: {max: 0, used: N}`) — 집합 동일성이 구성적으로 성립하고 `used`는 지표로 흐른다; 상한은 점수화(PR7)와 함께 온다; (b) `must`가 아닌 `scope=all` 섹션(KB 스펙, 용어)은 **패킹하지 않는다** — 오늘 실행마다 읽는 스킬이 없다 — 그리고 distill의 미선택 열이 볼 수 있게 `dropped: general-scope`로 나열한다; (c) `compile`은 `run-id`를 함의한다(마커의 실행이 이 스킬 것이면 재사용); (d) 슬라이스 본문은 `## <REF-id> — <heading>`으로 렌더링하고 섹션 자체의 제목과 `qab:` 주석은 제거; LRN 본문 = Statement + Overrides; (e) 하드리스트된 레퍼런스 파일은 스킬에 남지만, 프리앰블은 슬라이스에 그 섹션이 이미 있다고 말한다(매니페스트에 그 파일의 섹션이 없을 때만 파일을 연다) — `test.js`가 모든 하드리스트 파일이 스킬의 선언된 읽기 집합에 있음을 증명; (f) 프로파일 v0에 LLM 단계는 없다: `surface`는 `playwright/AUTOMATION.md` 존재, `pom`은 `playwright/pom/*.page.ts`, `ticket_kind`는 키 접두사(`BUG-`) 아니면 `unknown`; (g) 스크래치패드 `## Plan/## State` 줄은 tier-2 스킬 7개(`exploratory qa review-ticket start test-cases test-plan verify-fix`)에만; e2e-* 스킬은 tier-1이다(그들을 나열한 RFC 원문이 틀렸다).

### PR6 — 지문 + 스코어보드 (P4)

1. 발신 지점(각 한 줄, +ko): `e2e-pom` heal → `locator-not-found`; `e2e-write` 게이트 → `spec-flaky`, `fixture-missing`; `qa` → `ac-unmapped`, `env-unreachable`, `auth-failed`, `assertion-mismatch`; `verify-fix` → `ci-step-failed`. `qab.js fp <kind> <key>`가 현재 슬라이스에서 계산한 `active`와 함께 §3.4 라인 추가.
2. 포착 규칙(`self-improve.md`): 이 실행에서 지문이 발신됐고 포착 트리거가 "규칙이 현실 앞에서 깨짐"이면 새 LRN의 `Fingerprint:`를 자동 설정.
3. `qab.js scoreboard`: `.cache/scoreboard.json` 재생성(`per_source`에 `in_slice` 포함); `.gitignore` 템플릿에 `features-kb/.cache/` 추가.
4. distill(+ko): 지문 반증, 지문 중복, 재발 표.
5. 선택: `e2e-pom` heal 전략 통계 사이드카(`pom-stats.jsonl`), `tries ≥ MIN_SAMPLES`일 때 선호.
- **수용:** 픽스처 앱의 반복 실패 → LRN이 `active`에 있는 fp 라인 → distill이 반증으로 나열. **동작:** heal 모드 선호만.
- **PR6에서 확정:** (a) `key` 정규화는 파서가 아니라 안전망 — 소문자화; ISO 타임스탬프/날짜, UUID, hex 해시(≥ 7, 숫자 포함), `:포트`, 숫자 연속 ≥ 5 제거; 공백과 매달린 구분자 정리; `checkout / btn` ≡ `checkout/btn`. 키는 애초에 클래스 수준(`화면/요소`, `티켓/AC#`, `spec › TC-id`, `파이프라인/단계`)이어야 한다. (b) `active` = **이 실행의 슬라이스 매니페스트**에서 `Fingerprint:`가 일치하는 LRN; 슬라이스가 없으면(단순 `run-id`) 스킬의 스코프된 active 학습으로 폴백 — 따라서 프로파일로 탈락한 학습은 그 실행에서 "active"가 아니며 그 실행이 반증하지 못한다. (c) fp 라인은 `<run>/fingerprints.jsonl`에 미러링; `pfp`는 있으면 실행의 `profile.json`에서 복사. (d) `stats` 행은 이제 모든 `active` LRN 포함(0 행도 생략 아닌 표시)과 `compiled` 이벤트의 `in_slice` 열; 발견: `falsified (fingerprint <ffp> ×n)`, `duplicate (fingerprint) of <가장 오래된 id>`(같은 `Fingerprint:` ∧ 같은 `Scope:` 집합), `in_slice ≥ 10 ∧ applied = 0`의 `never applied (in_slice N)`; 승격 열은 추가로 LRN 자신의 ffp가 **LRN의 날짜 이후** 무반응이어야 하며 LRN 전용(REF 행은 절대 승격 후보 아님). (e) 스코어보드 v1 = `{v, rebuilt_at, per_source{in_slice, applied, contradicted, last_applied, runs}, per_fingerprint{kind, key, count, runs, active, first, last}}`; `runs`는 `stats`의 의미 유지(`applied`가 있는 서로 다른 실행); `wins/losses` 없음(결정 4); 필요 시 재생성, gitignore(`features-kb/.cache/`, setup 스킬이 추가). (f) `pom-stats.jsonl`(heal 전략 선호)은 안 만듦 — 선호할 heal 데이터가 아직 없다; 따라서 PR6의 동작 변화는 *없음*.

### 게이트 — PR7 이전 (§9.3)

상태 2026-08-19: **게이트가 열렸다 닫혔다 — §9.3 Outcome 참조; PR7은 만들지 않았다(결정 16).** 아래 2026-08-17 기록은 게이트 도달 전 표본이 어땠는지의 기록으로 남긴다.

상태 2026-08-17: 프로파일 두 개 존재 — `5408a28cb4ac`(`web/exists/unknown`)에 귀속된 outcome **5**개, `a80fefa0c1ba`(`web/exists/bug`)에 **4**개. 세 번째 그룹의 outcome 5개에는 **`pfp`가 없다**: PR5의 컴파일 단계 이전 실행이라 프로파일에 귀속될 수 없고 게이트에 셈해지지 않는다(이 파일의 이전 기록이 이를 세어 프로파일 A가 10 outcome이라 했다 — 정정함). 게이트는 프로파일당 ≥ 8이 필요하므로, 스토리 키 실행 약 3회와 버그 키 실행 약 4회가 더 쌓일 때까지 PR7은 닫혀 있다. 표본 크기는 게이트의 절반일 뿐이다: 로그가 *불균등한* 적용도 보여야 하며, 그 형태는 `qab.js stats`가 이미 보여준다(`REF-playwright-patterns#must-rules`는 5/5 실행에서 적용 vs 반복해서 컴파일되고 한 번도 적용 안 된 섹션들).

### PR7 — 점수 선택 (P5) — **만들지 않음 (결정 16, §9.3 outcome)**

_기록을 위해 설계를 남긴다; 게이트는 열렸고 측정은 만들지 말라고 답했다._

_2026-08-20에 **RFC 0002 PR D**로 실체화됨: 바닥값을 가진 프로파일별, 노브 대신 상수,
각 프로젝트 자신의 게이트(또는 로그에 결정으로 기록되는 오버라이드) 뒤에서._

`.qabuddy.json` `compiler: {scoring, explore_rate: 0.10, min_samples: 8, budget_lines}`; §5대로 점수화; 데이터가 있으면 `per_profile`; 매니페스트가 `score`, `n`, `(audition)`, `dropped` 사유 표시; 여섯 하드리스트를 `tier=must scope=<skill>`로 전환; 플랫폼 설정에 `{{COMPILE_CMD}}` 자리표시자; CONTRIBUTING "컴파일러 변경"(증거 표 필수). 킬 기준 §9.3.

### PR8 — 옵트인 자동 상태 변경 (P6b) — **만들지 않음 (결정 16, §9.3 outcome)**

_기록을 위해 설계를 남긴다; PR7의 게이트에 의존했는데 그 게이트가 만들지 말라고 닫혔다. RFC 0002 §2.4에서 프로젝트가 여는 능력으로 재정의됨._

기본 `autoStatusChanges: false`; true면 §6.3 항목 4를 변경마다 감사 이벤트와 함께.

---

## 9. 측정

### 9.1 기준선
PR1–PR6 로그가 *곧* 기준선이다(`scoring: off` = 오늘의 동작). 별도 기준선 실행 없음.

### 9.2 지표 (스킬별; `pfp` 기록 후엔 pfp별)
픽스처 통과율(`/qa-eval`, 강한 게이트) · outcome 비율(`DONE` / 비환경) · 슬라이스 크기 · 적용 비율(`applied / in_slice`) · 모순 비율 · manual-writer 비율.

### 9.3 PR7 이전 게이트와 킬 기준
**PR7로 가는 조건:** PR1–PR4 로그가 불균등한 적용(거의 매 실행 적용되는 소스와 사실상 전혀 적용 안 되는 소스의 공존)을 보이고, **동시에** 서로 다른 `pfp` ≥ 2개가 각각 outcome ≥ 8을 지닐 것. 아니면 PR1–PR6은 그 자체로 완결이다.

#### Outcome (2026-08-19): 게이트 열림, 측정 수행, **PR7은 만들지 않음**

두 조건 모두 충족됐다 — `5408a28cb4ac` 9 outcome, `a80fefa0c1ba` 8, 그리고 적용은 불균등했다(56개 섹션 중 29개가 한 번도 적용 안 됨). 게이트가 인가하는 측정이 던져진 질문에 답했고, 답은 '아니오'였다. **모든 휴면 섹션을 원인별로 분류했다:**

| 원인 | 수 | 점수화에 갖는 의미 |
|---|---|---|
| 발화 불가 — 이 프로젝트에 하나도 없는 `features-kb/team-practices/` 파일을 가리키는 조건부 포인터 | 3 | 점수는 이들의 순위를 매길 수 없다; 필요한 건 은퇴나 조건이지 순위가 아니다 |
| 프리앰블이 재진술 (`run-protocol#*`, `self-improve#*`, `improve`+`setup`에만 스코프) | 8 | 중복이다. 해법은 중복 제거 — 심각도 척도 사본 제거가 이미 보여준 것 |
| 맞는 작업이 아직 없었음 (UAT, CI, 지표, 탐색) | 7 | 점수화는 옳지만 아직 안 쓰였을 뿐인 지식을 강등시켰을 것 |
| **컴파일러가 잘못 선택** | **0** | — |

**반대 증거는 직접적이다.** 2026-08-19의 `/qa-review-ticket` 실행이 이전에 죽어 있던 섹션 5개를 인용했고, `/qa-test-plan` 실행이 재배치된 9개 중 7개를 인용했다 — 계획에 커버리지 목표를 세우지 *말라*고 말해서 인용을 얻은 `metrics-and-coverage#code-coverage` 포함(서드파티 앱, 계측 없음). 이전 스냅숏으로 만든 점수라면 이들 전부를 제거했을 것이다.

**감축을 만든 것은 대신** 스코프 정리와 중복 제거였다(PR #26–#29). `/qa-qa`는 278줄/48% 휴면에서 **203줄/4%**가 됐고 — 남은 휴면 섹션은 발화 불가 3개 중 하나다. 점수화가 덜어줄 예산 압력이 남아 있지 않다.

**의도적 보류 (2026-08-19, 메인테이너 결정):** 발화 불가한 `#team-specific-processes` 섹션 3개는 그대로 둔다. 이 프로젝트에서는 검증 불가능하다 — 그들이 의존하는 조건을 여기서 평가할 수 없다 — 그래서 이 프로젝트의 증거만으로 은퇴시키면 과적합이 된다.

**PR7을 언젠가 재검토한다면**, 데이터가 말하는 형태는 바닥값을 가진 프로파일별(`tier=must` + 같은 `pfp`에서 최근 적용된 것)이지 절대 전역 `applied` 랭킹이 아니다; 그리고 프로파일 2개 × outcome ~14개는 프로파일별 랭킹에는 여전히 얇다.

#### 이 판정이 확립하지 *않는* 것

위 전부는 **한 프로젝트의 데이터**다 — 공개 데모 앱을 한 명의 메인테이너가 28회 실행한 것. *이* 저장소가 다음에 무엇을 만들지 결정하기에는 충분하다. 점수 선택이 일반적으로 틀렸다고 결론 내리기에는 충분하지 않으며, 이 섹션을 그렇게 읽어서는 안 된다. 큰 하우스 플레이북과 여러 `pfp`, 실제 CI/UAT/지표 작업을 가진 프로젝트는 진짜로 다른 분포를 보일 수 있고, 이 게이트에 정직하게 도달할 수 있다.

발화 불가한 `#team-specific-processes` 3개에도 같은 신중함을 적용했다: 한 프로젝트의 침묵은 증명이 아니기에 그대로 뒀다.

#### 구조적 발견 — 판정보다 중요한 것

그 결론에 도달하는 데 필요했던 작업은 `core/references/**` 전반의 `qab: scope=` 주석 편집이었다 — `maintenance-and-ci`를 `qa`에서 빼고, `#not-reproducible`을 넓히고, 심각도 척도를 중복 제거하는 것. **QABuddy 사용자는 그 무엇도 할 수 없다.** 그 파일들은 도구와 함께 배포되고 업데이트 때 교체된다; 컴파일러는 `.qabuddy.json`에서 `learningsPath`와 `runsDir`만 읽는다. 그래서 레이어가 갈라져 있다:

| 레이어 | 소유 | 업데이트 후 생존 |
|---|---|---|
| 지식 (`LEARNINGS.md`) | 프로젝트 | 예 |
| **선택** (어떤 섹션이 어떤 스킬에 닿는가) | **배포 파일** | **아니오** |

이 비대칭이 진짜 블로커다. 데이터가 점수화를 정당화*했던* 프로젝트도 행동할 수 없고, 자기 도메인에 스코프가 안 맞는 프로젝트는 포크하거나 업스트림 PR을 기다려야 한다는 뜻이다. 그래서 PR7과 PR8은 한 번 배포되는 단계가 아니라 **프로젝트가 자기 측정으로 여는 능력**으로 재정의된다 — **RFC 0002(프로젝트 소유 컴파일러 설정)** 참조: `tier=must` 바닥값을 가진 프로젝트 수준 스코프 오버라이드, 프로젝트 소유 레퍼런스 섹션, 사용자가 자기 로그로 돌릴 수 있는 게이트 리포트.
**킬 기준** (`scoring: false`로 되돌림): 기준선 데이터가 있는 `pfp`에서 점수화 실행 30회 후, 어느 스킬이든 픽스처 통과율 < 기준선, 또는 outcome 비율 < 기준선 − 5pt, 또는 적용 비율이 오르지 않으면. `dropped:`와 `(audition)` 라인이 부검 자료다.

---

## 10. 하지 않을 것

- LLM이 레퍼런스를 쓰는 일 없음 — PR8에서도.
- 마크다운 산문에 카운터 없음; 숫자는 JSONL에 산다.
- 벡터 스토어 없음; `Scope:` + 상한이 작동을 멈추면 단어 겹침 검색이 탈출구.
- `build.js`와 컨텍스트 컴파일러를 합치지 않는다.
- 스킬을 생성하지 않는다; 절차는 사람이 쓴다 (부록 B).
- "깨끗한 실행은 흔적을 남기지 않는다"를 건드리지 않는다 — 후보 방식이 오히려 지키기 쉽게 한다.
- 프로젝트 콘텐츠(`LEARNINGS.md`, 로그, 실행 디렉터리)를 이중 로케일로 만들지 않는다.
- 여섯 설치 스크립트에 `{{COMPILE_CMD}}` 이상 아무것도 넣지 않는다(원래 "PR7까지"였으나 PR7을 만들지 않았다 — 가드레일은 이제 그냥 유효하다).
- 로그 로테이션, `retainRuns` 정리 코드 없음 — 어떤 프로젝트가 필요로 할 때까지.

---

## 부록 A — 재구축이 아니라 피벗

QABuddy는 이미 컨텍스트 컴파일러의 ~70%다: 라이브러리(`references/` + `LEARNINGS.md`), 선택 인덱스(`Scope:`), 컴파일 단계(프리앰블 "시작 시 읽기"), 플래그(`.qabuddy.json`), 빌드 도구, 심판(`fixtures.json`), 피드백 경로(distill/승격/은퇴). 델타: 지금의 컴파일 단계는 스킬 이름으로 키잉되어 active 전부를 선택한다; 이 RFC는 프로파일로 키잉하고 (궁극적으로) 점수로 선택한다. 그것은 프로토콜 한 섹션의 변경 + 카운터다. 진짜 리팩터링 하나는 지식과 절차의 분리다 — 여섯 스킬이 레퍼런스를 하드리스트하고 체크리스트를 내장한다; 그것들은 `tier=must` 섹션으로 옮긴다.

## 부록 B — 미리 정의된 스킬이 남는 이유

컨텍스트 컴파일러는 *지식*을 컴파일한다. 그 지식으로 무엇을 *할지*는 여전히 무언가가 말해야 하고, 그것은 고정되어 있어야 한다:

1. **귀속에는 통제가 필요하다.** 지식을 변화시키고 절차를 고정한 채 결과를 본다. 둘 다 실행마다 변하면 나쁜 결과는 교란되어 지식에 대해 아무것도 배울 수 없다.
2. **평가는 절차에 키잉된다.** 픽스처는 출력 계약(표, 파일, 상태 블록)을 단언한다. 실행마다 조립되는 절차에는 안정된 계약이 없다; 조립기를 픽스처링하게 되는데 그것은 LLM 판단이다.
3. **게이트가 곧 절차다.** Review Options, 에스컬레이션, 파괴적 작업 전 확인, KB 경로 규약. 점수화 가능한 지식이면 예산에 밀려 떨어질 수 있다; `must`라면 그냥 단계가 더 붙은 절차다.
4. **상호 운용은 계약이다.** `test-plan` → `test-cases` → `qa` → `verify-fix`는 고정된 산출물 형태와 `index.json`으로 연결된다.
5. **호출과 패키징.** `/qa-test-cases PROJ-789`는 SDT에게 무엇이 어디에 나타나는지 말해준다; 플랫폼은 *스킬*을 로드한다.

나중에 정당하게 줄어들 수 있는 것: 14개 절차는 아마 네 가지 형태(분석-산출, 실행-보고, 코드 스캐폴드, 메타)다 — PR1–PR6의 데이터가 쌓인 후의 템플릿 리팩터링. 고정된 절차들 *가운데서* 선택(라우팅)은 괜찮고 이미 존재한다; 조립은 아니다. 페이즈 안에서 에이전트는 이미 자유롭게 계획한다(`## Plan`). 프레임은 얇다; 자유는 그 안에 있다.
