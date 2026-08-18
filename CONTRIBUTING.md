# QABuddy 기여 가이드

[한국어](CONTRIBUTING.md) · [English](CONTRIBUTING-en.md)

QABuddy에 관심을 가져주셔서 감사합니다! 이 가이드는 스킬 추가부터 플레이북 편집, 업스트림 개선 제출까지 모든 내용을 다룹니다.

---

## 최소 모델 요구사항

스킬은 **Claude Sonnet**을 최소 모델로 설계합니다. 모든 스킬은 Sonnet의 컨텍스트 처리 범위 내에서 안정적으로 동작해야 합니다. Opus도 작동하지만, Sonnet이 기준선입니다.

**이유:** Sonnet은 장황한 스킬에서 지시 피로(instruction fatigue)가 발생합니다 — 후반 단계를 건너뛰거나 세밀한 규칙을 무시합니다. 모든 줄은 존재할 이유가 있어야 합니다.

| 구성 요소 | 예산 |
|-----------|--------|
| Preamble (Tier 1) | ~34줄 |
| Preamble (Tier 2) | ~78줄 |
| **스킬 본문** | **150-300줄** |
| 참조 파일 | 2-4개 파일, ~80-150줄 |
| **호출당 총합** | **~260-530줄** |

**규칙:**
1. AI가 이미 아는 것을 설명하지 마세요
2. 문단이 아닌 글머리 기호를 사용하세요
3. 템플릿은 구조를 보여주되, 채워진 예시는 불필요합니다
4. 자체 평가는 체크리스트입니다 (항목당 1줄)
5. 참조 파일 하나 = 주제 하나
6. 제출 전 Sonnet으로 테스트하세요

---

## 빠른 참조

| 하고 싶은 작업 | 방법 |
|---|---|
| **새 스킬 추가** | [새 스킬 추가](#새-스킬-추가) |
| **기존 스킬 수정** | `core/skills/<skill>/SKILL.md`를 편집하고 `node build.js all` 실행 |
| **플레이북 지식 추가** | [SDT 플레이북](#sdt-플레이북-지식-편집-및-추가) |
| **스킬 이슈 보고** | `/qa-improve`를 실행하거나 [수동으로 제안서 작성](#스킬-이슈-보고) |
| **로케일 추가** | [새 로케일 추가](#새-로케일-추가) |
| **플랫폼 추가** | [새 플랫폼 추가](#새-플랫폼-추가) |

---

## 프로젝트 구조

```
qa-buddy-skills/
├── build.js                     # Build script (node, zero deps)
├── test.js                      # 740 structural checks
├── core/                        # Edit here — single source of truth
│   ├── skills/ (14)             # Skill templates (procedure)
│   ├── references/              # Knowledge: playwright-patterns, self-improve, KB spec
│   │   └── playbook/            # 11 methodology files + index
│   ├── preamble-base.md         # Tier 1 (all skills)
│   └── preamble-full.md         # Tier 2 additions
├── platforms/                   # 3 configs + 6 setup scripts
├── locales/ko/                  # Korean translation
├── docs/rfc/                    # Design records (accepted RFCs)
└── dist/                        # Generated — never edit directly
```

**핵심 규칙:** `core/`와 `platforms/`에서 편집하세요. `dist/`는 절대 편집하지 마세요. `node build.js all`을 실행하여 재생성하세요.

**로드맵:** 학습 레이어를 산문 판단에서 측정 기반으로 옮기는 중입니다 — 실행별 컴파일된 지식 슬라이스, append-only 학습 로그, 산술 기반 distill, eval 게이트 승격. 설계와 단계별 순서는 [RFC 0001 — Context Compiler](docs/rfc/0001-context-compiler.md)(영문, 한국어 요약 포함)에 있습니다. 이 가이드에서 특정 단계와 함께 바뀌는 섹션은 해당 단계의 PR에서 갱신합니다 — 미리 바꾸지 않습니다.

---

## 새 스킬 추가

### 1. 디렉터리 생성

```bash
mkdir -p core/skills/my-skill/tests
```

### 2. SKILL.md 작성

모든 스킬은 다음 구조를 따릅니다:

```markdown
---
name: my-skill
version: 0.3.0
description: |
  What the skill does.
  Use when: "trigger phrase 1", "trigger phrase 2".
  Do NOT use when: scenarios that should use a different skill.
tool-groups:
  - bash
  - read
  - jira
preamble-tier: 2
---

# /my-skill: Short Title

One paragraph describing the role.

## Constraints
1. **Most important rule.** Explanation.
2. **Second rule.** Explanation.

---

## Phase 1: ...
**Load methodology references** from `{{REFERENCE_PATH}}/playbook/`:
- `file.md` — what it covers
...

## Phase N: Self-Evaluation
1. Check item
2. Check item
3. **Format check** — verify output includes: {required sections}
Fix issues found. One pass.

---

## Phase N+1: Output
...
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {next action}
```

### 3. 평가 픽스처 추가

`core/skills/my-skill/tests/fixtures.json`을 생성합니다:

```json
{
  "skill": "my-skill",
  "version": "0.3.0",
  "fixtures": [
    {
      "id": "fx-001",
      "description": "Happy path scenario",
      "input": { "context": "description of input" },
      "assertions": [
        { "field": "output", "op": "contains", "value": "expected string" }
      ],
      "tags": ["happy-path"]
    }
  ]
}
```

assertion 연산자 -- simulate 모드: `eq`, `contains`, `not_contains`, `matches`, `exists`, `length_eq`, `length_gte`; execute 모드 (`cmd:`/`files:`/`file:`/`count:` 필드): `exit_code`, `output_contains`, `output_matches`, `json_valid`, `lte`.

### 4. 연결

- 새 tool group을 사용하는 경우 `platforms/claude.json`에 추가
- 6개 설치 스크립트 모두의 `SKILLS` 배열에 추가
- `core/project-instructions.md`의 스킬 테이블과 라우팅에 추가
- 플레이북 파일을 참조하는 경우 `index.md`의 "Used by" 열에 추가
- 빌드: `node build.js all`
- 테스트: `node test.js`

---

## 스킬 작성 규칙

<details>
<summary><strong>구조, Frontmatter, 계층, 플레이스홀더</strong></summary>

**구조 순서:** Frontmatter -> 제목 + 설명 -> 제약 조건 -> 단계(Phases) -> 자체 평가 -> 출력

**Frontmatter 필드:**

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `name` | 예 | kebab-case, 디렉터리 이름과 일치 |
| `version` | 예 | Semver. 변경 시 버전 올림 |
| `description` | 예 | 여러 줄 가능. "Use when:"과 "Do NOT use when:" 포함 |
| `tool-groups` | 예 | 추상 기능 ([tool group 목록](#tool-groups)) |
| `preamble-tier` | 예 | `1` (최소) 또는 `2` (심각도 + 에스컬레이션 포함 전체) |

**Preamble 계층:**

| 계층 | 주입 내용 | 사용 대상 |
|------|---------|---------|
| `1` | 컨텍스트 복구 + 완료 상태 (34줄) | 경량 스킬 |
| `2` | Tier 1 + 심각도 테이블 + 에스컬레이션 + 질문 방법 (78줄) | 대화형, 분류가 많은 스킬 |

**플레이스홀더:** `{{REFERENCE_PATH}}` -> 빌드 시 플랫폼별 참조 경로로 치환됩니다.

</details>

<details>
<summary><strong>Tool Groups</strong></summary>

| 그룹 | Claude Code 도구 | 용도 |
|-------|-------------------|---------|
| `bash` | Bash | 셸 명령 |
| `read` | Read | 파일 읽기 |
| `write` | Write | 파일 생성 |
| `edit` | Edit | 파일 수정 |
| `glob` | Glob | 파일 찾기 |
| `grep` | Grep | 내용 검색 |
| `agent` | Agent | 서브 에이전트 |
| `ask` | AskUserQuestion | 사용자에게 질문 |
| `web-search` | WebSearch | 웹 검색 |
| `jira` | jira_get_issue, jira_search | Jira 티켓 |
| `jira-fields` | jira_list_fields | Jira 필드 |
| `confluence` | confluence_search, confluence_get_page | Confluence 읽기 |
| `confluence-write` | confluence_create_page, confluence_update_page | Confluence 작성 |
| `browser` | Chrome ext + Preview + Playwright | 브라우저 테스트 |

Cursor와 Copilot은 `tool-groups`를 무시합니다 — 해당 에이전트가 도구를 자동 탐색합니다.

</details>

<details>
<summary><strong>작성 스타일</strong></summary>

- **간결하게 작성하세요.** AI가 이미 아는 방법이면 한 줄이면 충분합니다
- **문단보다 글머리 기호를 사용하세요**
- **제약 조건은 상단에 배치하세요** — AI가 작업 시작 전에 제한 사항을 확인해야 합니다
- **자체 평가는 체크리스트로 작성하세요** — 번호 항목, 줄당 하나
- **자체 평가에 형식 검사를 포함하세요** — 필수 출력 섹션을 나열하세요
- **모든 스킬에 완료 상태를 포함하세요** — DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT

</details>

---

## 런타임 의무 (모든 스킬)

프리앰블이 모든 스킬 실행에서 이를 강제합니다; 스킬 작성자는 이를 거스르거나 다시 쓰지 마세요. 설계: [RFC 0001](docs/rfc/0001-context-compiler.md). ▸ 표시는 이후 RFC 단계에서 들어옵니다.

| 시점 | 의무 | 기록 위치 |
|---|---|---|
| 학습이 출력을 결정할 때마다 | ID 인용; `qab.js log applied LRN-…` | `learnings-log.jsonl` |
| 실행 중 관찰이 active 학습과 모순 | 적용하지 않음; `qab.js log contradicted LRN-… --note`; 보고서에 플래그 | `learnings-log.jsonl` |
| 완료 | 세 가지 포착 트리거 적용; 발화하면 LRN 작성 + `log captured`; 그 다음 `log outcome --status <S>` | `LEARNINGS.md`, `learnings-log.jsonl` |
| 시작 | `qab.js compile --skill <name>` → `slice.md` 읽기 (학습 파일 + 매니페스트에 나열된 레퍼런스 섹션 읽기를 대체); 폴백: 레퍼런스 + `LEARNINGS.md` | `.qa-reports/runs/<run>/{slice.md,profile.json,scratchpad.md,events.jsonl}` |
| 실행 중 | 눈에 띄는 것 → `## Candidate learnings` (증거 문턱 없음); tier-2 스킬은 `## Plan` / `## State`도 유지하고 일시정지마다 다시 읽음 | `scratchpad.md` |
| 완료 | 세 가지 포착 트리거는 **후보들에게만** 적용 | `LEARNINGS.md`, `learnings-log.jsonl` |
| 이름 붙은 실패 클래스를 만남 (`e2e-pom` heal → `locator-not-found`; `e2e-write` 게이트 → `spec-flaky`, `fixture-missing`; `qa` → `ac-unmapped`, `env-unreachable`, `auth-failed`, `assertion-mismatch`; `verify-fix` → `ci-step-failed`) | `qab.js fp <kind> "<key>"` — 실행당 서로 다른 클래스마다 한 줄; 헬퍼가 `active` 아래 학습을 나열하면 플래그 | `fingerprints.jsonl` |
| 이 실행에 지문이 있는 트리거 1 포착 | 새 LRN의 `Fingerprint:`를 그 ffp로 설정 (`qab.js fp --list`) | `LEARNINGS.md` |

`bin/qab.js`가 `learnings-log.jsonl`과 `fingerprints.jsonl`의 유일한 작성자입니다 — 모델은 인자만 넘기고 JSON을 손으로 쓰지 않습니다. `dist/<platform>/references/bin/`으로 배포되며 `test.js`(`testRuntimeHelper`, `testCompile`, `testFingerprints`)가 동작을 검증합니다. 스키마: `self-improve.md` §학습 로그·§실패 지문 (`"v": 1`; 리더는 모든 이전 버전을 수용 — 로그는 append-only이고 사용자 저장소에 수년간 남습니다). 지문 `kind` 어휘는 닫혀 있습니다(`qab.js`의 `FP_KINDS`, `self-improve.md`에 미러; `test.js`가 일치를 검사) — 스킬에 감지 지점과 ko 대응본을 함께 넣을 때만 kind를 추가하세요. `qab.js scoreboard`는 `features-kb/.cache/scoreboard.json`(파생 캐시)을 씁니다 — 진실로 읽지도, 커밋하지도 마세요. 런타임 파일(`LEARNINGS.md`, `learnings-log.jsonl`, `fingerprints.jsonl`, `.qa-reports/`)은 프로젝트 콘텐츠입니다: 이 저장소에 없고, 이중 로케일도 아닙니다.

---

## SDT 플레이북: 지식 편집 및 추가

플레이북은 `core/references/playbook/`에 집중된 파일(파일당 ~35-70줄)로 관리됩니다. 전체 목록은 `index.md`를 참조하세요.

<details>
<summary><strong>현재 플레이북 파일</strong></summary>

| 파일 | 다루는 내용 |
|------|--------|
| `terminology.md` | 표준화된 용어 (AC, SDT, DoR, DoD) |
| `risk-and-priority.md` | 심각도/우선순위 척도, 공수 배분 |
| `metrics-and-coverage.md` | 코드 커버리지, 요구사항 커버리지, 결함 + 테스트 건강 지표 |
| `shift-left.md` | 요구사항 조기 검증, 정합성 확인 |
| `test-distribution.md` | 테스트 피라미드/다이아몬드, 중복 제거 |
| `test-types.md` | 수동 vs 자동, UAT vs 기능 테스트 |
| `execution-sequence.md` | 스프린트 전반의 테스트 실행 순서 |
| `defect-lifecycle.md` | 결함 유형, 상태, SLA, 회귀 테스트 |
| `maintenance-and-ci.md` | 불안정(flaky) 테스트, 시간 예산, CI 게이트 |
| `exploratory-heuristics.md` | 10개 휴리스틱 범주, 기법 체크리스트 |

</details>

**편집:** 범위 내에서 작업하고, 70줄 이하로 유지하고, `node build.js all`을 실행하세요.

**모든 `##` 섹션은 주소를 가진 소스입니다** (RFC 0001 PR3). id는 제목 바로 다음 줄의 HTML 주석에 둡니다 — 제목 텍스트에는 절대 넣지 않습니다:

```markdown
## Selectors
<!-- qab: id=selectors tier=must -->
- rule
```

| 필드 | 값 | 의미 |
|---|---|---|
| `id=` | kebab-case, **영구** | `REF-<file-stem>#<id>`가 됨 (`playbook/` 아래는 `REF-playbook/<stem>#<id>`). 제목은 자유롭게 바꿔도 되지만 id는 절대 바꾸지 않음 |
| `scope=` | 쉼표 구분 스킬 이름, 또는 `all`(기본) | 이 섹션을 받을 수 있는 스킬. 보통 H1 주석에 파일 기본값으로 한 번 두고 섹션이 상속 |
| `tier=` | `must` / `should`(기본) / `context` | `must` = 스코프된 스킬의 슬라이스에 항상 들어가고 먼저 패킹됨 — 레일, NEVER 목록, 스킬이 구조적으로 의존하는 템플릿. `must`는 비싸므로 절대 `all`에 스코프하지 않음 |

규칙: 코드 펜스 밖의 `##` 제목은 모두 주석을 달아야 함(`###`는 부모에 속함); H1 주석은 파일 기본값을 담고, 지식이 H1 바로 아래 있는 파일(`terminology.md`, `execution-sequence.md`)은 `id=`도 가질 수 있음; `README.md`/`index.md`는 내비게이션이라 제외. 한국어 대응본은 `qab:` 주석을 **그대로** 복사 — `node build.js all`은 중복 id, 태그 없는 `##`, en/ko id 집합 불일치, 같은 이름의 ko 대응본이 없는 `core/references` 파일에서 실패합니다(레퍼런스 *디렉터리*가 로케일별로 결정되므로 en 전용 파일은 조용히 `dist/ko`에 도달하지 못함). 빌드는 모든 dist에 `references/index.json`(id → 파일, 제목, scope, tier, 줄 수)을 배포합니다. `qab:` 줄은 플레이북 70줄 예산에 포함되지 않습니다.

**새 지식 추가:**
1. 기존 파일에 맞는 내용인가요? 거기에 섹션을 추가하세요. 새로운 주제라면 새 파일을 만드세요 — **ko 대응본도 함께**.
2. 파일은 70줄 이하, 섹션은 ~25줄 이하로. 데이터에는 테이블, 규칙에는 글머리 기호. 사람이 아닌 AI를 위해 작성하세요.
3. `qab:` 주석을 추가하세요: 영구 id를 고르고, `scope=`를 이 섹션을 받아야 할 스킬로(또는 파일 기본값에 의존), `tier`는 정직하게.
4. `index.md`에 파일 이름, 설명, "Used by" 스킬을 업데이트하세요; 스킬이 하드 리스트한 레퍼런스가 있다면 그 스킬의 Phase 1 방법론 참조에도 연결 — 실제로 필요한 스킬에만.
5. `node build.js all` (`index.json` 재생성, 패리티 검사) → `node test.js`.

**학습은 소스를 id로 가리킵니다.** 학습의 `Overrides:`는 섹션 id(`REF-playwright-patterns#must-rules`), 스킬 규칙(`SKILL:test-cases "…"`), 또는 `없음`을 씁니다 — `test.js`가 이 저장소의 `features-kb/LEARNINGS.md`가 해석되는지 검사합니다.

**플레이북에 넣지 말아야 할 것:** 도구별 지시사항, 프로젝트 구성, 스킬 워크플로우 세부사항, preamble 내용의 중복.

---

## 스킬 이슈 보고

### 자동 (권장)

`/qa-improve`를 실행하거나 리뷰 일시정지 시점에서 **(C) Tool feedback**을 선택하세요. AI가 다음을 수행합니다:
1. 무엇이 발생했고 무엇이 예상되었는지 질문
2. 스킬 + CONTRIBUTING.md 읽기
3. 근본 원인 분류 -> 제안서 생성 -> 수정 적용 -> 평가 실행 -> 전달

### 수동

<details>
<summary><strong>개선 제안서 템플릿</strong></summary>

```markdown
# Skill Improvement Proposal: `<skill-name>`
**Version:** current → proposed
**Root cause:** [missing constraint | wrong phase order | instruction gap |
  self-eval gap | template issue | over-reliance on context | scope drift]

## Problem
[What went wrong and why]

## Root Cause
[Which phase/instruction/gap — quote the specific text]

## Proposed Changes
| # | Location | Change | Description |
|---|----------|--------|-------------|

## Expected Outcome
[How this fix prevents recurrence]

## Budget Check
Current / After / Within 300-line budget?
```

</details>

---

## 새 로케일 추가

빌드 시스템은 `locales/<code>/`에서 로드하고, 번역되지 않은 파일은 `core/`로 폴백합니다.

1. 생성: `mkdir -p locales/<code>/skills/{qa,verify-fix,...}/` 및 `locales/<code>/references/playbook/`
2. 번역: preamble, project-instructions, 모든 스킬, 모든 플레이북 파일
3. 복사 (번역하지 마세요): `feature-knowledge-base-spec.md`
4. 빌드: `node build.js all --locale <code>`

**가이드라인:** 산문을 번역하세요. 기술 용어, 코드 블록, 파일 경로, 상태 코드, `{{placeholders}}`는 영어를 유지하세요.

---

## 새 플랫폼 추가

1. `platforms/<platform>.json` 생성 (name, reference_path, tool_groups, project_file)
2. `platforms/setup-<platform>` (bash) 및 `.ps1` (PowerShell) 생성
3. `build.js`의 `ALL_PLATFORMS`에 추가
4. `node build.js <platform>` 실행

---

## KB 경로 규칙

모든 스킬은 `features-kb/features/{EPIC-KEY}/`를 기본 경로로 사용합니다. `features-kb/epics/` (레거시)는 절대 사용하지 마세요.

---

## 제출 전 체크리스트

### 빌드
- [ ] `dist/`가 아닌 `core/`에서 편집했는지 확인
- [ ] `node build.js all` 통과
- [ ] 3개 플랫폼 모두 빌드 완료 (각 11개 스킬)
- [ ] 로케일이 있는 경우: `node build.js all --locale <code>` 통과

### 품질
- [ ] 스킬 본문 300줄 이하
- [ ] 총 컨텍스트 530줄 이하
- [ ] 제약 조건이 상단에 위치, 형식 검사가 포함된 자체 평가, 완료 상태로 마무리
- [ ] 평가 픽스처 존재 (최소 3개 시나리오: happy path, 오류, 엣지 케이스)
- [ ] description에 `Do NOT use when:` 포함

### 테스트
- [ ] `node test.js` 통과
- [ ] `/qa-eval {skill}` 모든 픽스처 통과
- [ ] 실제 작업에 Sonnet으로 테스트 완료
- [ ] AI가 모든 단계를 건너뛰지 않고 수행

### 통합
- [ ] 설치 스크립트 (6개 전체)와 project-instructions에 추가됨
- [ ] 방법론 파일이 변경된 경우 플레이북 인덱스 업데이트됨
- [ ] `features-kb/epics/` 경로 없음
