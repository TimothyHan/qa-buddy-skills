---
name: e2e-write
version: 0.1.3
description: |
  테스트 케이스로부터 e2e 테스트 스위트를 작성합니다: 사전 조건용 API
  클라이언트, fixture, 그리고 증명된 POM 위의 의도만 담은 스펙. 로케이터를
  절대 지어내지 않습니다 -- 페이지에 POM이 없으면 먼저 /qa-e2e-pom을
  호출합니다. 스위트가 세 게이트(green, 다시 green(정리 증명),
  --repeat-each=3에서 green(플레이크 증명))와 금지 패턴 기계 린트를 통과해야
  완료입니다.
  사용 시점: "write e2e tests", "automate test cases", "generate the test suite", "API client for tests".
  사용하지 않을 때: Playwright 셋업 시 (/qa-e2e-setup 사용), 페이지 객체 빌드/힐링 시 (/qa-e2e-pom 사용), 수동 테스트 실행 시 (/qa-qa 사용).
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - ask
  - browser
preamble-tier: 1
---

# /qa-e2e-write: 테스트 스위트 생성

테스트 케이스를 통과하는, 재실행 가능한, 플레이크 없는 스위트로 바꿉니다.
`playwright/AUTOMATION.md`(결정)와 `/qa-e2e-pom`의 POM + 인벤토리를 읽습니다.
어휘는 POM과 API 클라이언트; 스펙은 의도만 담습니다.

**코드 표준:** 클라이언트, fixture, 스펙 코드를 쓰기 전에
`{{REFERENCE_PATH}}/playwright-patterns.md`를 읽으세요 -- 템플릿(disposal
context, worker-indexed 계정, 네트워크 동기화), 매처 테이블, 안티패턴 목록이
거기 있습니다. Phase 5 린트는 그 문서의 NEVER 섹션을 강제합니다. 그 다음
프로젝트 학습 파일(프리앰블 참조) -- 이 스킬에 스코프된 active `LRN-`
항목이 그 패턴들을 오버라이드합니다.

## 제약 사항

1. **로케이터를 절대 지어내지 않습니다.** 스펙과 헬퍼는 POM export만
   사용합니다. POM 없는 페이지 → `/qa-e2e-pom` 스킬(build 모드)을 호출하고 그
   게이트 통과 후 계속합니다. 매핑 안 된 요소에 인라인으로
   `getByTestId(...)`를 쓰는 것이 이 스킬의 대표적 실패입니다.
2. **스펙은 의도만.** 스펙 파일에 `page.locator(`, raw CSS/XPath,
   `page.route(` 금지 -- 셀렉터는 POM에, 라우트/요청은 API 클라이언트나
   fixture에 삽니다.
3. **사전 조건은 UI가 아니라 API로.** 상태는 API 클라이언트로 시딩합니다.
   해당 작업의 API 호출이 관찰되지 않은 경우에만 UI 시딩 -- 그리고 보고서에
   부채로 플래그합니다.
4. **병렬 안전 데이터.** 엔티티 이름에는 worker+repeat 엔트로피 --
   `Date.now()`만으로는 동시 워커나 `--repeat-each` 인스턴스가 같은 밀리초에
   충돌합니다 (실전 확인 2026-08-07). 헬퍼 사용:
   `` `${prefix}-${Date.now()}-w${workerIndex}r${repeatEachIndex}` ``.
   전역 개수 단언(`before + 1`) 금지 -- 내 엔티티를 이름/id로 단언합니다.
   스위트는 ≥2 worker로 돕니다 (AUTOMATION.md가 개수와 격리 전략을 기록) --
   **셋업이 플래그한 공유 상태 기능**을 건드리는 테스트는 병렬 프로젝트가
   아니라 종속 `global-state` 프로젝트로 갑니다.
5. **만든 것은 공개 API로 정리합니다.** disposal context 또는
   `afterEach`/`afterAll`로 -- 테스트 본문 끝 인라인 금지(실패 시 건너뜀),
   테스트 환경 전용 훅(예: 리셋 엔드포인트) 의존 금지: 스위트는 그런 게 없는
   환경에서도 살아남아야 합니다.
6. **상태 기반 대기만.** `waitForTimeout` 금지. 비동기 fetch를 유발하는
   액션은 2단 대기: `waitForResponse`(프로미스는 액션 **이전에** 생성) → 그
   다음 렌더된 요소 단언. Response 수신 ≠ 렌더 완료.
7. **자동으로 사라지는 UI와 경쟁하지 않습니다.** 토스트와 일시적 배너: 대신
   지속되는 결과(행 존재 / 엔티티 기준 개수)를 단언하거나, 유발 액션 직후
   web-first 단언으로 토스트를 잡습니다 -- 다른 대기 후에는 절대 금지.
8. **Red 게이트에 DONE 없음.** 정직한 상태 보고 자체가 게이트입니다 (Phase 5).

---

## Phase 1: 입력

- 테스트 케이스 (KB 경로 또는 파일) -- 스펙의 진실 원천
- `playwright/AUTOMATION.md` -- 없으면 `/qa-e2e-setup` 먼저, 중단
- TC가 건드리는 모든 화면의 POM + 인벤토리 -- 없거나 불완전 → 누락 화면에
  대해 `/qa-e2e-pom` build 모드 호출 (제약 1)
- `/qa-e2e-pom`이 저장했다면 `playwright/api-capture.json`; AUTOMATION.md에
  있다면 OpenAPI 스펙

## Phase 2: API 클라이언트

OpenAPI 스펙 또는 네트워크 캡처로부터, TC에 필요한 작업(시딩 + 정리 + 테스트
대상 변경)의 얇은 클라이언트를 생성합니다:

- 엔드포인트당 함수 하나; 내부에서 상태 코드 단언
  (`expect(response.status()).toBe(expStatusCode)`), 기대 코드는 파라미터 --
  네거티브 테스트가 4xx를 넘길 수 있게.
- 생성 함수는 자신의 undo를 disposal context에 큐잉합니다.

**게이트 2:** 각 함수를 환경에 대해 한 번씩 스모크 호출 -- 생성 → 확인 →
삭제 왕복, **스위트가 의존할 네거티브 경로 포함** (중복 생성, 없는 것 삭제).
상태 코드 컨벤션은 앱마다 다릅니다 (404 vs 멱등 204) -- API가 실제로
반환하는 것을 단언하지, 기대하는 컨벤션을 단언하지 않습니다. 한 번도 실행
안 된 클라이언트 함수는 추측입니다.

## Phase 3: Fixture

- 인증: 셋업의 storageState가 이미 제공 -- 로그인을 재구현하지 않습니다
- `disposalContext` auto fixture: LIFO undo 큐, 테스트가 실패해도 실행됨
- 스위트 파라미터용 옵션 fixture (이름 접두사, 기능 플래그)

## Phase 4: 스펙

기능 영역당 `describe` 하나. 테스트 케이스별로:

- 테스트 제목에 TC id: `test('TC-04: delete a project', …)`
- 요구사항 수준 단계마다 `test.step`, TC의 단계처럼 이름 붙이기
- 사전 조건은 `beforeEach`/fixture에서 API 클라이언트로 (제약 3)
- 대기는 제약 6–7대로; 매처 선택: 배열 전체 순서까지 → `toEqual`, 요소 하나
  존재 → `toContainEqual`, 부분 객체 → `toMatchObject`
- 빈/엣지 상태: 정확한 상태를 API로 시딩 (예: 소유한 엔티티 전부 삭제),
  환경이 비어있다고 가정하지 않기

## Phase 5: 게이트 -- 네 개 전부, 순서대로

이 게이트들의 근거: `{{REFERENCE_PATH}}/playbook/test-suite-verification.md` (검출력, 공허 단언).

1. **Green:** `npx playwright test` exit 0
2. **다시 green:** 즉시 재실행, exit 0 -- 누출된 데이터(409, 이름 충돌)가
   여기서 실패합니다; 단언이 아니라 정리를 고치세요
3. **플레이크 게이트:** `npx playwright test --repeat-each=3` exit 0. config에
   종속 프로젝트가 있으면 repeat-each는 종속 프로젝트를 반복하지 않습니다 --
   프로젝트별로 명시적으로 (`--project={이름} --repeat-each=3`).
   결정적 네거티브 인증 테스트(틀린 비밀번호 등)는 `--repeat-each` 대상이
   아닙니다 -- 타이밍 플레이크를 드러낼 수 없고, 앱에 brute-force 잠금이
   있으면 반복이 잠금을 유발해 그 계정의 다른 모든 테스트가 연쇄 실패합니다.
   별도 프로젝트로 1회만 실행 (실전 확인 2026-08-07 --
   playwright-patterns.md 참조).
4. **기계 린트** -- 생성된 파일 grep; 하나라도 걸리면 실패:

| 패턴 | 금지 위치 |
|---|---|
| `waitForTimeout` | 어디서나 |
| `test.only` | 어디서나 |
| `page.locator(`, raw CSS/XPath | 스펙 파일 |
| `page.route(` | 스펙 파일 |
| 하드코딩된 엔티티 이름 (데이터 팩토리에 엔트로피 없음) | 스펙/fixture |
| 테스트 환경 전용 엔드포인트 (리셋/시드 훅) | 어디서나 |

정직하게 고치려 했는데도 게이트 실패 → DONE_WITH_CONCERNS 또는 BLOCKED를
실패한 게이트의 출력과 함께 보고. 플레이키 ≠ 완료: 한 번 통과했지만
`--repeat-each`에서 실패하는 스위트는 실패한 테스트 이름과 함께 플레이키로
보고합니다 -- 절대 DONE이 아닙니다.

## Phase 6: 보고

- TC → 스펙 추적성 테이블 (TC id, 스펙 파일, 상태)
- 커버리지: 자동화됨 / 차단됨 (사유: fragile 셀렉터, API 없음, 플래그 요소)
- 부채: UI 시딩된 사전 조건, 사용 중인 fragile 셀렉터
- features KB가 구성되어 있으면 KB 포인터 갱신: 기능 → 스위트 위치, 커버된 TC

## 출력 전 자기 평가

- [ ] POM 밖 로케이터 0개; 스펙 안 라우트/요청 0개
- [ ] 모든 클라이언트 함수가 스모크 실행됨
- [ ] 네 게이트 전부 실행; 결과를 정직하게 보고
- [ ] 모든 테스트 제목에 TC id
- [ ] 두 번째 연속 green 실행으로 정리 증명

**Status:** DONE | DONE_WITH_CONCERNS (우려 사항 명시) | BLOCKED (게이트 + 출력 명시)
**Summary:** TC {n}개 자동화, 게이트 {gates}개 green, 부채 {d}건
**Next steps:** {CI 연결 | 부채 해소 | 검증 드리프트 시 /qa-e2e-pom heal}
