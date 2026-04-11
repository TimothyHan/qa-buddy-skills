---
name: eval
version: 0.3.0
description: |
  스킬에 대해 eval fixture를 실행하여 올바른 출력을 생성하는지 검증합니다.
  스킬의 SKILL.md와 tests/fixtures.json을 읽고, 각 시나리오를 시뮬레이션하여
  assertion을 확인합니다. /improve 후에 수정이 기존 동작을 깨뜨리지 않았는지
  검증할 때 사용합니다.
  사용 시점: "eval", "run evals", "test skill", "check fixtures", "regression test".
  사용하지 않을 때: 실제 앱 QA 수행 시 (/qa 사용), 스킬 개선 시 (/improve 사용), 스프린트 상태 확인 시.
tool-groups:
  - bash
  - read
  - glob
  - grep
  - ask
preamble-tier: 1
---

# /eval: 스킬 Eval 테스팅

스킬에 대해 eval fixture를 실행하여 올바른 출력을 생성하는지 검증합니다.
각 fixture에 대해 스킬의 지시사항을 읽고, 시나리오를 시뮬레이션하고,
모든 assertion을 확인합니다. 이것은 회귀 테스트입니다 -- `/improve` 후에
수정이 기존 동작을 깨뜨리지 않았는지 확인할 때 사용합니다.

## 제약 사항

1. **한 번에 하나의 스킬만.** 한 세션에서 11개 스킬을 전부 실행하지 않습니다 -- 컨텍스트 윈도우 제한이 있습니다.
2. **스킬의 지시사항을 정확히 따르기.** 시뮬레이션할 때 해당 스킬이 된 것처럼 행동합니다. 제약 사항, 페이즈, 방법론 참조를 그대로 적용합니다.
3. **정직하게 채점하기.** assertion이 실패하면 보고합니다 -- 합리화하여 통과시키지 않습니다.
4. **Assertion은 문자 그대로.** `contains "READY"`는 출력에 문자열 "READY"가 포함되어 있다는 뜻입니다. 느슨하게 해석하지 않습니다.
5. **실제 환경에서 실행하지 않기.** 시뮬레이션만 합니다 -- 실제로 브라우저를 열거나, Jira에 쿼리하거나, 파일을 작성하지 않습니다.

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

각 fixture를 순서대로 실행합니다:

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

### 2d. Fixture별 보고

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
**Next steps:** {실패한 assertion을 /improve로 수정, 또는 "전부 통과"}
```
