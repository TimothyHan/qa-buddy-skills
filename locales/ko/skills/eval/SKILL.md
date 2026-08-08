---
name: eval
version: 0.4.1
description: |
  스킬에 대해 eval fixture를 실행하여 올바른 출력을 생성하는지 검증합니다.
  fixture별 두 가지 모드: simulate(SKILL.md를 읽고 시나리오를 시뮬레이션하여
  assertion 확인)와 execute(스킬이 생성한 아티팩트를 로컬 fixture 앱에 대해
  실제로 실행하고 exit code와 파일 검사로 채점). /qa-improve 후에 수정이 기존
  동작을 깨뜨리지 않았는지 검증할 때 사용합니다.
  사용 시점: "eval", "run evals", "test skill", "check fixtures", "regression test".
  사용하지 않을 때: 실제 앱 QA 수행 시 (/qa-qa 사용), 스킬 개선 시 (/qa-improve 사용), 스프린트 상태 확인 시.
tool-groups:
  - bash
  - read
  - write
  - glob
  - grep
  - ask
  - browser
preamble-tier: 1
---

# /qa-eval: 스킬 Eval 테스팅

스킬에 대해 eval fixture를 실행하여 올바른 출력을 생성하는지 검증합니다.
각 fixture는 자신의 모드를 선언합니다:

- **`simulate`** (기본값) -- 스킬의 지시사항을 읽고, 시나리오를 시뮬레이션하고,
  가상의 출력에 대해 assertion을 확인합니다. 산출물이 산문(보고서, 판정,
  계획)인 스킬용.
- **`execute`** -- 로컬 fixture 앱에 대해 스킬을 실제로 실행한 다음, 생성된
  아티팩트를 실행하여 채점합니다 (`npx playwright test`, grep, 파일 검사).
  산출물이 코드인 스킬용 (`/qa-e2e-setup`, `/qa-e2e-pom`, `/qa-e2e-write`). 생성된
  아티팩트는 실행되어야만 통과 -- 그럴듯해 보이는 것으로는 통과하지 못합니다.

## 제약 사항

1. **한 번에 하나의 스킬만.** 한 세션에서 모든 스킬을 전부 실행하지 않습니다 -- 컨텍스트 윈도우 제한이 있습니다.
2. **스킬의 지시사항을 정확히 따르기.** 시뮬레이션하거나 실행할 때 당신이 곧 그 스킬입니다. 제약 사항, 페이즈, 방법론 참조를 그대로 적용합니다.
3. **정직하게 채점하기.** assertion이 실패하면 보고합니다 -- 합리화하여 통과시키지 않습니다.
4. **Assertion은 문자 그대로.** `contains "READY"`는 출력에 문자열 "READY"가 포함되어 있다는 뜻입니다. 느슨하게 해석하지 않습니다.
5. **Simulate 모드는 실제 환경을 절대 건드리지 않습니다** -- 브라우저도, Jira도, 파일 쓰기도 없습니다.
6. **Execute 모드는 로컬 fixture 앱과 스크래치 워크스페이스만 건드립니다.** 외부 시스템 금지: Jira도, 실제 스테이징 URL도, `localhost` 밖의 네트워크도 안 됩니다. 생성되는 모든 아티팩트는 일회용 워크스페이스 디렉토리에 두고, QABuddy 레포에는 절대 두지 않습니다.
7. **평가 대상 스킬로 행동하는 동안 `ANSWER-KEY.md`를 절대 열지 않습니다.** 답안지는 채점 전용입니다. 디스커버리는 실행 중인 앱에 대해 이루어져야 합니다. 시뮬레이션 중에 답안지를 읽었다면 그 fixture는 무효 -- 통과가 아니라 하네스 오류로 보고합니다.
8. **스크립트된 사용자 응답이 사용자를 대신합니다.** Execute fixture는 스킬의 인터랙티브 게이트를 위한 `user_responses`를 포함합니다. 스크립트된 대로만 답합니다. 응답이 스크립트되어 있는 게이트에서 스킬이 질문하지 않았다면 그것 자체가 발견 사항입니다 -- 여러 fixture가 스킬이 실제로 멈추는지를 assertion합니다.

---

## Phase 1: 스킬 및 Fixture 로드

**입력:** 스킬 이름 (예: `qa`, `review-ticket`, `test-plan`)

1. **스킬 읽기:** `core/skills/{skill}/SKILL.md`
2. **Fixture 읽기:** `core/skills/{skill}/tests/fixtures.json`
3. **프리앰블 읽기** (`preamble-tier` 기반으로 주입될 내용)

fixtures.json이 없는 경우: "{skill}에 대한 fixture가 없습니다. `core/skills/{skill}/tests/fixtures.json`에 생성하세요."

보고: "{skill} v{version}에 대해 {N}개의 fixture를 로드했습니다."

---

## Phase 2: Fixture 실행

각 fixture를 순서대로, `mode`에 따라 분기합니다 (`simulate` 또는 생략 →
2a–2d; `execute` → 2E).

### 2a. 설정
- fixture의 `input`을 읽습니다 (시나리오 설명, 사전 조건)
- fixture의 `assertions`를 읽습니다 (확인할 항목)

### 2b. 시뮬레이션
- 해당 스킬이 되어 행동합니다. 주어진 입력 시나리오에 대해 SKILL.md 지시사항을 페이즈별로 따릅니다.
- 스킬이 생성할 출력을 만듭니다 (보고서, 판정, 테이블, 상태 블록).
- 간결하게 유지합니다 -- 전체 출력이 아니라 assertion을 확인할 수 있을 만큼만 필요합니다.

### 2c. 채점
각 assertion에 대해 연산자를 적용합니다:

| Operator | 확인 방법 |
|----------|----------|
| `eq` | 출력 필드가 값과 정확히 일치 |
| `contains` | 출력에 해당 문자열이 포함됨 |
| `not_contains` | 출력에 해당 문자열이 포함되지 않음 -- 포함되어 있으면 실패 |
| `matches` | 출력이 정규식 패턴과 일치 |
| `exists` | 필드 또는 섹션이 존재하고 비어있지 않음 |
| `length_eq` | 배열/목록이 정확히 N개 항목 |
| `length_gte` | 배열/목록이 최소 N개 항목 |

기록: PASS 또는 FAIL과 함께 근거를 남깁니다 (관련 출력을 인용).

### 2E. Execute 모드 fixture

Execute fixture는 세 가지 블록을 추가로 가집니다:

```json
{
  "id": "fx-101",
  "mode": "execute",
  "description": "생성된 스위트가 v3에서 red가 된다 (네거티브 컨트롤)",
  "env": { "variant": "v3", "port": 4173 },
  "input": { "task": "…스킬을 무엇에 대해 실행할지…" },
  "user_responses": { "confirm-highlights": "confirm all", "auth-strategy": "accept recommendation" },
  "assertions": [ … ]
}
```

**러너 프로토콜:**

1. **워크스페이스.** QABuddy 레포 밖에 스크래치 디렉토리를 생성(세션 내 재사용 가능). 스킬이 생성하는 모든 아티팩트는 여기에.
2. **Fixture 앱 기동.** `core/skills/eval/tests/fixture-app/`에서:
   `APP_VARIANT={env.variant} PORT={env.port} node server.js`를 백그라운드로.
   fixture 시작 전(그리고 서버를 공유하는 fixture 사이)에 `POST /api/reset`.
3. **스킬을 실제로 실행.** 대상 스킬의 SKILL.md를 페이즈별로 워크스페이스에서,
   `http://localhost:{port}`에 대해 따릅니다. 인터랙티브 게이트에서는
   `user_responses`로만 답합니다. 실제 브라우징, 실제 파일 쓰기(워크스페이스
   한정), 실제 `npx playwright test`.
4. **채점.** assertion을 적용합니다(아래 연산자). 명령 출력을 근거로 인용.
5. **정리.** fixture 앱 종료. 요약을 쓸 때까지 워크스페이스 보존(근거),
   그 후엔 폐기 가능.
6. **Fixture 간 워크스페이스 상태.** 공유 워크스페이스 아티팩트를 변경하는
   fixture(예: heal 모드가 POM을 재작성)는 원래 빌드를 기대하는 fixture로
   그 상태를 누출시키면 안 됩니다. 변경 전에 스냅샷(워크스페이스 안에서 git
   commit, 또는 복사)하고 이후 복원합니다. 변경된 스냅샷은 근거로 보존.

**Execute 모드 assertion 연산자** (simulate 표에 추가; `file:` 접두사는 양쪽
모드에서 동작):

| 필드 접두사 / 연산자 | 확인 방법 |
|----------|----------|
| `cmd:{command}` + `exit_code` | 워크스페이스에서 `{command}` 실행; exit code가 값과 일치해야 함 |
| `cmd:{command}` + `output_contains` / `output_matches` | 실행 후 stdout+stderr 확인 |
| `files:{glob}` + `not_contains` | glob에 매칭되는 모든 파일 grep; 패턴이 어디든 나타나면 FAIL |
| `files:{glob}` + `contains` | 매칭 파일 중 최소 하나에 패턴이 존재 |
| `file:{path}` + `exists` / `json_valid` | 파일 존재 / JSON 파싱 성공 |
| `count:{files-glob 또는 json-path}` + `eq` / `lte` | 매칭 개수 / 배열 길이가 값과 같음 / 이하 |

Playwright 실행은 워크스페이스 자체 config 사용; `--reporter=line`을 넘기고
exit code를 캡처 -- 그것이 곧 pass/fail assertion의 성적입니다. 플레이크
게이트는 fixture의 명령에 명시된 대로 `--repeat-each=N`. assertion에 필요한
명령이 아예 실행 불가하면(의존성 누락, config 크래시) 그 명령에 의존하는
모든 assertion이 그 근거와 함께 FAIL -- fixture를 조용히 건너뛰는 일은
없습니다.

### 2d. Fixture별 보고 (양쪽 모드 공통)

```
Fixture: {id} -- {description}
  ✓ contains "READY" -- 판정 라인에서 발견
  ✓ contains "AC Assessment" -- 출력 섹션 헤더에서 발견
  ✗ contains "Given" -- 누락 시나리오 테이블에서 미발견
  Result: 2/3 PASS
```

---

## Phase 3: 요약

모든 fixture를 완료한 후:

```markdown
# Eval 결과: {skill} v{version}

| Fixture | Description | Pass | Fail | Result |
|---------|-------------|------|------|--------|
| fx-001 | {description} | 3 | 0 | PASS |
| fx-002 | {description} | 2 | 1 | FAIL |

## 요약
- Fixture: 총 {N}개, {passed}개 통과, {failed}개 실패
- Assertion: 총 {N}개, {passed}개 통과, {failed}개 실패
- **통과율: {%}**

## 실패한 Assertion
| Fixture | Assertion | Evidence |
|---------|-----------|----------|
| fx-002 | contains "Given" | 출력에서 미발견 |

**Status:** DONE | DONE_WITH_CONCERNS
**Summary:** {skill} eval: {pass_rate}% ({passed}/{total} fixtures)
**Next steps:** {실패한 assertion을 /qa-improve로 수정, 또는 "전부 통과"}
```
