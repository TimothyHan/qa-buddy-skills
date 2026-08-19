---
name: start
version: 0.3.4
description: |
  가이드 방식의 E2E QA 워크플로우. 테스트 계획, 티켓 리뷰, 테스트 케이스 생성을
  순차적으로 진행하며, 각 단계가 끝나면 SDT가 검토할 수 있도록 멈춥니다.
  중단된 경우 이전 지점부터 다시 시작합니다. 새 에픽의 주요 진입점입니다.
  Use when: "start", "begin workflow", "qa workflow", "guided qa", "new epic".
  Do NOT use when: working on a single ticket (use individual skills), reconfiguring settings (use /qa-setup), mid-sprint status check.
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
  - jira
  - jira-fields
  - confluence
  - confluence-write
  - browser
preamble-tier: 2
---

# /qa-start: 가이드 QA 워크플로우

QABuddy 오케스트레이터 역할을 수행합니다. 새 에픽에 대한 전체 QA 계획 워크플로우를
SDT와 함께 진행합니다: 테스트 계획 -> 티켓 리뷰 -> 테스트 케이스. 각 단계가 끝나면
SDT의 검토와 승인을 받고 다음 단계로 넘어갑니다.

## 제약 조건

1. **매 단계 후 멈춘다.** SDT의 승인 없이 다음 단계로 넘어가지 않는다.
2. **스킬 로직을 중복 구현하지 않는다.** 세부 지침은 playbook 방법론 파일을 참조한다. 조율만 하고 직접 재구현하지 않는다.
3. **중단 시 이어서 진행한다.** 시작할 때 `features-kb/index.json`에서 워크플로우 상태를 확인한다. 이전 실행이 중단된 상태라면 이어서 진행할지 제안한다.
4. **설정을 따른다.** `.qabuddy.json`에서 컨텍스트 소스와 팀 모드를 읽고 그에 맞게 동작한다.
5. **한 번에 하나의 에픽만 다룬다.** 각 실행은 하나의 에픽 또는 기능만 처리한다.

---

**스크래치패드 (실행 프로토콜):** Phase 1 전에 실행의 `scratchpad.md`에 `## Plan`을 쓰고, 페이즈 경계와 모든 리뷰 옵션 일시정지마다 `## State`를 갱신한 뒤 스크래치패드를 다시 읽고 계속합니다; 눈에 띄는 것은 그때그때 `## Candidate learnings`에 적습니다.

## Phase 1: 초기화

**입력:** 에픽 키 (예: `PROJ-123`), 문서 경로, 또는 기능 설명.

1. **`.qabuddy.json` 읽기** -- 파일이 없으면 설정 마법사를 실행한다:
   - 컨텍스트 소스 선택: (A) Jira, (B) 스펙 문서, (C) 채팅/붙여넣기, (D) 커스텀
   - 팀 모드 선택: (A) 솔로, (B) 팀
   - 설정을 저장하고 계속 진행

2. **이전 작업 상태 확인** -- `features-kb/index.json`에서 이 에픽의 워크플로우 상태를 읽는다.
   이전 실행 기록이 있으면:
   - 완료된 항목을 보여준다 (테스트 계획, 리뷰, 테스트 케이스)
   - 묻는다: (A) 중단된 지점부터 이어서 진행, (B) 처음부터 새로 시작

3. **방법론 참조 자료를 로드한다** -- `{{REFERENCE_PATH}}/playbook/`에서:
   - `metrics-and-coverage.md` -- 커버리지 목표
   - `shift-left.md` -- 요구사항 정렬
   - `test-distribution.md` -- 피라미드/다이아몬드 구조, 중복 제거
   - `test-types.md` -- 자동화 vs 수동
   - `defect-lifecycle.md` -- SLA 기대치

**확인 단계:** "설정이 준비되었습니다. {epic}에 대한 테스트 계획을 시작하시겠습니까?"

---

## Phase 2: 테스트 계획

`/qa-test-plan` 방법론에 따라 테스트 계획을 작성한다.

1. **에픽 관련 정보 가져오기** -- 설정에 따라 달리 처리한다:
   - `jira` -> Atlassian MCP를 통해 에픽과 연결된 스토리를 조회한다
   - `spec` -> 작업 공간에서 스펙 파일을 읽는다 (`docs/`, `specs/` 검색 또는 SDT에게 직접 확인)
   - `chat` -> SDT에게 에픽 상세, AC, 스토리 목록을 요청한다
   - 각 스토리의 Jira `description` 필드를 읽는다 -- AC가 별도 필드가 아닌 여기에 있는 경우가 많다. 플레이스홀더 텍스트는 AC 누락으로 표시한다.

2. **AC를 추출하고 `feature.md`를 초기화한다** -- AC를 기능별로 그룹화하고, `features-kb/features/{EPIC-KEY}/feature.md`에 바로 작성한다. KB 구조를 초기화한다 (`mkdir -p` test-cases, reviews, qa-reports, bugs).

3. **이미 Resolved/Done 상태인 스토리의 경우** -- git log/diff/grep로 코드베이스에서 테스트 근거를 조사한다. Confirmed (파일 경로 포함) 또는 Unverified로 표시한다.

4. **분석한다** -- 테스트 범위, 자동화 가능성 (Playwright/RestAssured/단위/수동), 위험 영역, 의존성을 파악한다.

5. **테스트 계획 초안을 작성한다** -- 전략 테이블 (E2E, API, 단위, 수동), 갭 분석 (검증된 커버리지만 포함), 환경 요구사항, 시작/종료 기준, 리스크를 정리한다.

6. **자체 평가한다** -- 모든 스토리에 시나리오가 있는가? 갭 분석에 공수 추정이 포함되어 있는가? 추론으로 판단한 테스트 상태는 없는가? feature.md가 완성되었는가?

7. **저장한다** -- `features-kb/features/{EPIC-KEY}/test-plan.md`에 저장한다. `features-kb/index.json`의 `workflow.testPlan`을 `"complete"`로 업데이트한다.

**확인 단계:** "테스트 계획 초안을 작성했습니다. 검토해 주세요. 준비되면: (A) 승인하고 계속 진행, (B) 피드백이 있습니다."

피드백이 있으면 -> 수정을 반복한다. 승인하면 -> 다음 단계로 진행한다.

---

## Phase 3: 티켓 리뷰

**`contextSource`가 "jira"가 아니면 건너뛴다** -- 티켓 리뷰는 개별 Jira 티켓이 필요하다. 스펙/채팅 모드에서는 SDT에게 알리고 Phase 4로 이동한다.

에픽에 연결된 각 스토리에 대해:

1. **티켓 정보를 가져온다** -- 요약, AC, 유형, 연결된 티켓, 댓글
2. **테스트 가능성을 점검한다** -- AC 완성도, 누락된 시나리오 (에러 상태, 빈 상태, 권한, 동시성, 엣지 케이스), 테스트 가능성 이슈, 차단 요소
3. **자체 평가한다** -- 판정이 발견 사항과 일치하는가? 지나치게 플래그하고 있지는 않은가? AC가 Given/When/Then 형식으로 되어 있는가?
4. **결과를 출력한다** -- 판정 (READY / NEEDS WORK / BLOCKED), AC 평가, 누락된 시나리오, 권장 테스트 접근법
5. **저장한다** -- `features-kb/features/{EPIC-KEY}/reviews/{TICKET-KEY}-review.md`에 저장한다

`features-kb/index.json`을 업데이트한다: `workflow.ticketReviews.{TICKET-KEY}: "{verdict}"`.

**확인 단계:** "{N}개 스토리를 리뷰했습니다: {X}개 READY, {Y}개 NEEDS WORK, {Z}개 BLOCKED. READY 스토리에 대한 테스트 케이스를 생성하시겠습니까?"

---

## Phase 4: 테스트 케이스

각 READY 스토리에 대해 (비-Jira 모드에서는 전체 스토리):

1. **티켓 관련 정보를 가져온다** + 연결된 Confluence 페이지가 있으면 함께 확인한다
2. **테스트 계획을 로드한다** -- 이 티켓에 매핑된 시나리오를 확인한다
3. **저장소의 기존 테스트를 읽는다** -- 프로젝트의 Playwright 패턴에 맞춰 매칭한다
4. **테스트 케이스를 생성한다** -- E2E (Playwright 스케치), 단위 테스트 체크리스트, 우선순위 (P0/P1/P2) 포함
5. **추적성 매핑을 생성한다** -- AC -> 테스트 케이스 -> 커버리지 상태
6. **자체 평가한다** -- 추적성이 유지되는가, 중복은 없는가, 우선순위 분포가 적절한가, Playwright 스케치가 일관적인가
7. **저장한다** -- `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md` 및 매핑 JSON에 저장한다

`features-kb/index.json`을 업데이트한다: `workflow.testCases.{TICKET-KEY}: "complete"`.

**확인 단계:** "{N}개 스토리에 대한 테스트 케이스를 생성했습니다 (총 {X}개). 검토 후 승인해 주세요."

---

## Phase 5: 요약 및 다음 단계

워크플로우 요약을 제시한다:

```markdown
# QA 계획 완료: {EPIC-KEY}

| 단계 | 상태 | 상세 |
|------|------|------|
| 테스트 계획 | 완료 | E2E/API/단위/수동 전반에 걸쳐 {N}개 시나리오 |
| 티켓 리뷰 | {완료/건너뜀} | {X}개 READY, {Y}개 NEEDS WORK |
| 테스트 케이스 | 완료 | {M}개 스토리에 걸쳐 {N}개 테스트 케이스 |

## 커버리지
- 테스트 케이스가 있는 AC: {N}/{total} ({%})
- P0 테스트 케이스: {N}개
- 커버리지 갭: {목록 또는 "없음"}

## 다음 단계
1. NEEDS WORK 스토리 -> 피드백을 반영한 뒤 `/qa-review-ticket`을 다시 실행
2. 기능이 QA 준비되면 -> 티켓별로 `/qa-qa {TICKET-KEY}` 실행
3. 버그 수정이 완료되면 -> `/qa-verify-fix {BUG-KEY}` 실행
4. 스프린트 현황을 확인하려면 -> `/qa-sprint-status` 실행
5. 탐색적 테스트를 진행하려면 -> `/qa-exploratory {EPIC-KEY}` 실행
```

`features-kb/index.json`을 업데이트한다: `workflow.phase: "planning-complete"`.

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {EPIC-KEY}에 대한 QA 계획 완료 -- {M}개 스토리에 걸쳐 {N}개 테스트 케이스
**Next steps:** 기능이 테스트 준비되면 /qa-qa를 실행하세요
