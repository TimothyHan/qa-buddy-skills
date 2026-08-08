---
name: test-cases
version: 0.3.3
description: |
  Jira 티켓의 인수 조건(AC)에서 테스트 케이스를 생성합니다. Playwright E2E 테스트
  시나리오와 개발자용 단위 테스트 체크리스트를 작성합니다. 테스트 케이스는 추적성을 위해
  요구사항에 매핑됩니다.
  사용 시점: "테스트 케이스 작성", "테스트 생성", "PROJ-789 E2E 테스트", "이 티켓 테스트 케이스".
  사용하지 않는 경우: 티켓 테스트 가능성 리뷰(/qa-review-ticket 사용), 테스트 실행(/qa-qa 사용), 앱 탐색(/qa-exploratory 사용).
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - agent
  - ask
  - jira
  - confluence
preamble-tier: 2
---

# /qa-test-cases: AC에서 테스트 케이스 생성

SDT 파트너로서 티켓의 테스트 케이스를 생성합니다. Jira에서 티켓의 AC를 가져오고,
에픽 테스트 계획과 대조하여 다음을 작성합니다:
1. Playwright E2E 테스트 시나리오 (구현 준비 완료 수준)
2. 단위 테스트 체크리스트 (개발자용)
3. 요구사항-테스트 매핑 (추적성 확보)

## 제약 조건

1. **프로젝트의 테스트 스타일에 맞추세요.** 기존 Playwright 테스트를 먼저 읽으세요. 동일한 패턴, import, 헬퍼, 페이지 오브젝트를 사용하세요.
2. **Playwright 스케치는 출발점입니다.** 최종 코드가 아닙니다. 유용할 만큼 구체적이되 과도하게 설계하지 마세요.
3. **모든 테스트 케이스는 요구사항에 매핑됩니다.** 고아 테스트도 없고, 테스트되지 않은 AC도 없어야 합니다.
4. **단위 테스트 체크리스트는 개발자용입니다.** 간결하고 실행 가능하게 작성하세요 — 무엇을 테스트할지 설명하고, 방법은 적지 마세요.
5. **기존 테스트와 중복하지 마세요.** 이미 커버되는 시나리오가 있으면 새로 만들지 말고 참조하세요.
6. **우선순위를 과감하게 정하세요.** AC가 3개인 티켓에 테스트 케이스 30개가 필요하지 않습니다. 실제 버그를 잡아내는 데 집중하세요.

---

## 1단계: 컨텍스트 수집

**입력:** 사용자가 티켓 키(예: `PROJ-789`)를 제공하거나 티켓 상세 정보를 붙여넣습니다.

1. **`.qabuddy.json` 확인** (파일이 있으면) — 컨텍스트 소스와 팀 모드를 읽습니다.
   - `contextSource: "spec"` → 질문 전에 워크스페이스에서 스펙 파일을 먼저 검색
   - `contextSource: "chat"` → Jira를 건너뛰고 SDT에게 직접 컨텍스트 요청
   - `contextSource: "jira"` 또는 설정 없음 → 기본 동작

2. **방법론 참조 문서를 읽습니다** (`{{REFERENCE_PATH}}/playbook/`):
   - `test-distribution.md` — 가장 낮은 적절한 계층에 테스트 배치, 중복 제거 규칙
   - `test-types.md` — 수동 vs 자동화, UAT vs 기능 테스트 구분
   - `maintenance-and-ci.md` — 브라우저 매트릭스 (Playwright는 Chrome, Firefox, Safari, Edge에서 실행)
   - Playwright 스케치를 쓸 때는 `{{REFERENCE_PATH}}/playwright-patterns.md`도 —
     스케치가 그 문서의 셀렉터/대기/데이터 규칙을 따라야 `/qa-e2e-write`가
     재작업 없이 구현할 수 있습니다
   - 그 다음 프로젝트 학습 파일(프리앰블 참조) — 이 스킬에 스코프된 active
     `LRN-` 항목이 위 레퍼런스들을 오버라이드합니다; 적용한 ID를 인용하세요

3. **티켓을 가져옵니다** (Jira MCP가 있으면 사용, 없으면 SDT에게 제공하거나 파일을 지정하도록 요청):
   - 요약, 설명, AC
   - 상위 에픽 키
   - UI 목업 또는 디자인 링크 (첨부 파일이나 코멘트에서)
   - 연결된 Confluence 페이지 (디자인 스펙, PRD, API 문서)

4. **연결된 Confluence 페이지를 가져옵니다** (있는 경우):
   - 연결된 페이지에서 상세 스펙, 데이터 모델, API 계약, UI 플로우를 읽습니다
   - AC에 없는 테스트 가능한 요구사항을 추출합니다 (유효성 검증 규칙, 오류 코드, 엣지 케이스)

5. **에픽 테스트 계획을 로드합니다** (있는 경우):
   - `features-kb/features/{EPIC-KEY}/test-plan.md`를 읽습니다
   - 테스트 계획의 어떤 시나리오가 이 티켓에 매핑되는지 확인합니다

6. **저장소의 기존 테스트를 확인합니다:**
   - Playwright 테스트 디렉터리에서 관련 테스트를 검색합니다
   - 네이밍 컨벤션, 페이지 오브젝트 패턴, 테스트 데이터 설정, 테스트 스타일을 파악합니다

7. **이 티켓의 기존 테스트 케이스를 확인합니다:**
   - `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md`
   - 이미 있으면 새로 작성하는 것이 아니라 업데이트입니다

---

## 2단계: 테스트 케이스 설계

### E2E 테스트 케이스 (Playwright)

각 AC에 대해 하나 이상의 테스트 케이스를 생성합니다:

```markdown
### TC-{NNN}: {테스트 케이스 제목}

**Requirement:** {TICKET-KEY}의 AC #{N}
**Priority:** P0 | P1 | P2
**Type:** happy-path | negative | edge-case | boundary

**사전 조건:**
- {필요한 설정}

**단계:**
1. {페이지}로 이동
2. {동작}
3. {동작}

**기대 결과:**
- {관찰 가능한 결과}

**Playwright 스케치:**
```typescript
test('{테스트 제목}', async ({ page }) => {
  // Arrange
  await page.goto('{url}');

  // Act
  await page.getByRole('{role}', { name: '{name}' }).click();
  await page.getByLabel('{label}').fill('{value}');

  // Assert
  await expect(page.getByText('{expected}')).toBeVisible();
});
```
```

**AC당 최소 커버리지:**
- happy path 1개, 네거티브 케이스 1개, 해당하는 경우 경계값 케이스

**우선순위 규칙:**
- **P0:** 핵심 사용자 플로우 — 머지 전에 반드시 통과
- **P1:** 오류 처리, 유효성 검증, 엣지 케이스 — 릴리스 전에 통과해야 함
- **P2:** 완성도, 성능, 드문 경로

### 단위 테스트 체크리스트 (개발자용)

```markdown
## 단위 테스트 체크리스트

### {모듈/파일}
- [ ] {함수}: {일반적인 입력}에 대해 올바른 결과를 반환
- [ ] {함수}: {엣지 케이스}를 처리 (null, 빈 값, 오버플로우)
- [ ] {함수}: {잘못된 입력}에 대해 오류를 throw/반환
- [ ] {유효성 검증}: {특정 잘못된 데이터}를 거부
- [ ] {상태 전환}: {상태 A}에서 {상태 B}로 올바르게 전환
```

---

## 3단계: 요구사항 추적성

요구사항에서 테스트 케이스로의 매핑을 생성합니다:

```json
{
  "ticket": "PROJ-789",
  "epic": "PROJ-123",
  "mappings": [
    {
      "requirement": "AC #1: ...",
      "e2e_tests": ["TC-001"],
      "unit_tests": ["validate-form-data"],
      "coverage": "full"
    }
  ],
  "unmapped_requirements": [],
  "test_gaps": []
}
```

**커버리지 값:** `full` (모든 측면 테스트됨) | `partial` (갭이 `test_gaps`에 기록됨) | `none` (명확히 표시)

---

## 4단계: 자체 검증

저장 전에 세 가지 산출물 간의 일관성을 확인합니다. 발견된 문제를 수정합니다. 한 번만 확인하고 반복하지 않습니다.

1. `mappings`의 모든 AC에 최소 하나의 테스트 케이스가 있는지. 테스트가 없는 AC는 `unmapped_requirements`에 나열
2. `coverage: "full"`은 happy path + 네거티브 + 경계값이 테스트된 것을 의미. 그렇지 않으면 `"partial"`로 하향 조정
3. 새 테스트 케이스가 기존 Playwright 테스트와 중복되지 않는지 — 중복이면 참조로 대체
4. 단위 테스트 체크리스트 항목이 기존 단위 테스트와 겹치는지 확인
5. P0/P1/P2 분배: P0이 50% 초과하지 않으며, 핵심 happy path에 대해 최소 P0 하나가 존재
6. Playwright 스케치가 프로젝트 컨벤션에 맞는지 (import 스타일, 페이지 오브젝트 패턴, assertion 스타일)

---

## 5단계: 결과물 저장

### 테스트 케이스 문서 저장:
`features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md`

### 추적성 매핑 저장:
`features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}-mapping.json`

### SDT에게 제시:
- "빠진 시나리오가 있나요?"
- "P1에서 P0으로 올려야 할 항목이 있나요?"
- "테스트 데이터 관련 우려 사항이 있나요?"

### 에픽 테스트 계획 업데이트 (있는 경우):
`features-kb/features/{EPIC-KEY}/test-plan.md`에서 테스트 케이스가 생성된 시나리오의 상태 열을 업데이트합니다.

**다음 단계 제안:** "테스트 케이스가 준비되었습니다. 기능이 구현되면 `/qa-qa {TICKET-KEY}`를 실행하여 테스트를 수행하세요."

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {한 줄 요약}
**다음 단계:** {SDT가 다음에 해야 할 작업, 또는 "없음"}

---

## 일괄 처리 모드

사용자가 "PROJ-1, PROJ-2, PROJ-3 테스트 케이스 만들어줘"라고 요청한 경우:
- 각 티켓을 처리한 후 요약을 보여줍니다:

```markdown
| Ticket | E2E 테스트 | 단위 테스트 | 커버리지 | 갭 |
|--------|-----------|------------|----------|------|
```
