# Test cases — Projects management (projects)

**Spec:** docs/specs/projects.md · **Feature:** features-kb/features/projects/feature.md
**Context source:** spec (no Jira ticket; base URL http://localhost:4173, test account qa@acme.test / demo123)
**Generated:** headless run, no live-app probe — steps referencing UI controls use labels/testids visible in `docs/specs/projects.md` and the existing `playwright/tests/smoke.spec.ts`; anything not directly sourced from those is marked `(unverified)` and should be confirmed by `/qa-e2e-pom` before automation.

## Distribution

| Layer | Count | Target (diamond — thin UI over CRUD API) |
|---|---|---|
| Unit | 14 | 20% |
| E2E | 10 | 10% |

No API-layer test suite exists in this repo yet, so API-level coverage (create/delete/list/auth endpoints) is folded into the unit checklist rather than left uncovered — flagged as a gap below.

Priority split: P0 3 (30%), P1 5 (50%), P2 2 (20%) — under the 50% P0 cap ([[REF-playbook/risk-and-priority#effort-allocation]]), with at least one P0 on the core happy path (TC-001, TC-003, TC-006).

---

## E2E test cases

### TC-001: Sign in with valid credentials

**Requirement:** AC1 (docs/specs/projects.md)
**Priority:** P0
**Type:** happy-path

**사전 조건:**
- Test account qa@acme.test / demo123 exists and is not already signed in.

**단계:**
1. /login으로 이동
2. 이메일에 `qa@acme.test`, 비밀번호에 `demo123` 입력
3. 로그인 제출

**기대 결과:**
- Projects 페이지(/projects)로 이동한다.
- 프로젝트 목록이 표시된다 (0건이면 AC6의 빈 상태가, 1건 이상이면 테이블이 보여야 함 — TC-010과 상호 배타적으로 검증).
- "새 프로젝트" 진입점(existing smoke test의 `new-project-button` testid)이 보인다.

---

### TC-002: Sign in with invalid credentials

**Requirement:** AC1 (docs/specs/projects.md)
**Priority:** P1
**Type:** negative

**사전 조건:**
- 없음 (로그인 전 상태)

**단계:**
1. /login으로 이동
2. 이메일에 `qa@acme.test`, 비밀번호에 잘못된 값(예: `wrongpass`) 입력
3. 로그인 제출

**기대 결과:**
- 에러 메시지가 표시된다 (unverified: 정확한 문구).
- 페이지가 /login에 그대로 머문다 — Projects 페이지로 이동하지 않는다.

---

### TC-003: Create a project with a unique name

**Requirement:** AC2 (docs/specs/projects.md)
**Priority:** P0
**Type:** happy-path

**사전 조건:**
- 로그인된 상태 (TC-001).
- 입력할 프로젝트 이름이 현재 목록에 존재하지 않음 — 자동화 시 실행마다 고유한 이름 생성 필요 (사전 조건, 격리를 위해; 구체적 생성 방식은 `/qa-e2e-write`가 결정).

**단계:**
1. Projects 페이지에서 새 프로젝트 진입점(`new-project-button`) 클릭
2. 고유한 이름 입력
3. 저장/생성 제출

**기대 결과:**
- 성공 토스트가 표시된다.
- 생성한 프로젝트가 목록에 나타난다.

---

### TC-004: Create a project with an empty name is rejected

**Requirement:** AC2 (docs/specs/projects.md) — implied client-side validation, not explicit in AC text
**Priority:** P2
**Type:** edge-case

**사전 조건:**
- 로그인된 상태.

**단계:**
1. 새 프로젝트 진입점 클릭
2. 이름 필드를 비워둔 채 제출 시도

**기대 결과:**
- 프로젝트가 생성되지 않는다 (unverified: 정확한 에러 표시 방식 — 인라인 검증인지 토스트인지는 spec에 없음).
- 목록에 새 항목이 추가되지 않는다.

---

### TC-005: Creating a project with a duplicate name is rejected

**Requirement:** AC3 (docs/specs/projects.md)
**Priority:** P1
**Type:** negative

**사전 조건:**
- 로그인된 상태.
- 목록에 이미 존재하는 프로젝트 이름 하나를 알고 있음 (TC-003에서 만든 이름 재사용 가능).

**단계:**
1. 새 프로젝트 진입점 클릭
2. 이미 존재하는 프로젝트와 동일한 이름 입력
3. 저장/생성 제출

**기대 결과:**
- 에러 토스트 "Name already exists"가 표시된다.
- 목록은 변경되지 않는다 (건수와 내용이 제출 전과 동일).

---

### TC-006: Delete a project after confirming

**Requirement:** AC4 (docs/specs/projects.md)
**Priority:** P0
**Type:** happy-path

**사전 조건:**
- 로그인된 상태.
- 목록에 삭제 가능한 프로젝트가 최소 1개 존재 (TC-003에서 생성한 것 재사용 가능).

**단계:**
1. 대상 프로젝트 행의 삭제 컨트롤 클릭
2. 확인 다이얼로그에서 확인(confirm) 선택

**기대 결과:**
- 다이얼로그가 닫힌다.
- 해당 프로젝트가 목록에서 더 이상 보이지 않는다.

---

### TC-007: Cancelling the delete confirmation keeps the project

**Requirement:** AC4 (docs/specs/projects.md)
**Priority:** P1
**Type:** negative

**사전 조건:**
- 로그인된 상태.
- 목록에 프로젝트가 최소 1개 존재.

**단계:**
1. 대상 프로젝트 행의 삭제 컨트롤 클릭
2. 확인 다이얼로그에서 취소 선택

**기대 결과:**
- 다이얼로그가 닫힌다.
- 해당 프로젝트가 목록에 그대로 남아 있다.

---

### TC-008: Search filters the list by name fragment

**Requirement:** AC5 (docs/specs/projects.md)
**Priority:** P1
**Type:** happy-path

**사전 조건:**
- 로그인된 상태.
- 목록에 이름이 서로 다른 프로젝트가 최소 2개 존재하며, 그중 하나만 검색어를 포함.

**단계:**
1. 검색창에 한 프로젝트 이름의 일부 문자열 입력

**기대 결과:**
- 입력한 문자열을 이름에 포함하는 행만 보인다.
- 포함하지 않는 다른 행은 더 이상 보이지 않는다.

---

### TC-009: Search with no matches shows an empty result

**Requirement:** AC5 (docs/specs/projects.md)
**Priority:** P2
**Type:** boundary

**사전 조건:**
- 로그인된 상태.
- 목록에 프로젝트가 최소 1개 존재.

**단계:**
1. 검색창에 어떤 프로젝트 이름과도 일치하지 않는 문자열 입력

**기대 결과:**
- 목록에 행이 하나도 보이지 않는다 (unverified: AC6의 "No projects yet" 문구가 검색 결과 0건에도 재사용되는지, 별도의 "결과 없음" 상태가 있는지는 spec에 명시되지 않음 — `/qa-e2e-pom`에서 실제 앱을 확인해 결정).

---

### TC-010: Zero projects shows the empty state

**Requirement:** AC6 (docs/specs/projects.md)
**Priority:** P1
**Type:** edge-case

**사전 조건:**
- 로그인된 상태.
- 계정에 프로젝트가 0개 (전용 격리 계정 또는 기존 프로젝트를 모두 삭제한 상태 — 자동화 시 공유 시드 데이터를 비우지 않도록 격리 전략은 `/qa-e2e-write`가 결정).

**단계:**
1. Projects 페이지로 이동

**기대 결과:**
- "No projects yet" 메시지가 표시된다.
- 테이블이 렌더링되지 않는다.

---

## Out of scope (no AC coverage)

- 상태 필터 드롭다운은 시각적 요소로만 존재 — spec에 명시된 대로 테스트 케이스를 만들지 않음.

---

## Unit test checklist (for developers)

### Auth
- [ ] 올바른 이메일/비밀번호 조합에 대해 인증 성공을 반환
- [ ] 잘못된 비밀번호에 대해 인증 실패를 반환하고 에러를 노출
- [ ] 존재하지 않는 이메일에 대해 인증 실패를 반환

### Project creation
- [ ] 고유한 이름으로 프로젝트 생성 성공
- [ ] 이미 존재하는 이름(대소문자까지 완전히 동일)에 대해 생성을 거부
- [ ] 대소문자만 다른 이름을 중복으로 취급할지 여부 — 현재 spec에 명시 없음, 구현 결정 시 테스트로 고정
- [ ] 빈 이름 또는 공백만 있는 이름을 거부

### Deletion
- [ ] 존재하는 프로젝트 id 삭제 시 목록에서 제거되고 성공을 반환
- [ ] 존재하지 않는/이미 삭제된 id 삭제 시도 시 에러를 반환 (경합 상태 대비)

### Search / filter
- [ ] 이름에 부분 문자열을 포함하는 항목만 반환
- [ ] 대소문자 구분 여부 처리 (spec 미명시 — 구현 결정 시 테스트로 고정)
- [ ] 빈 검색어 입력 시 전체 목록 반환
- [ ] 일치 항목이 없을 때 빈 결과를 반환 (예외를 던지지 않음)

### Empty state
- [ ] 프로젝트 0개일 때 목록 렌더 함수가 테이블 대신 빈 상태 표시를 반환

### 검출력
- [ ] 변경 모듈에 프로젝트의 뮤테이션 도구(Stryker/PIT/mutmut 등, 설정되어 있다면) 실행 — 자동 뮤테이션은 유닛 레이어 담당 ([[REF-playbook/test-suite-verification#mutation-smoke]])

---

**Status:** DONE_WITH_CONCERNS
**Summary:** AC1–AC6에 대해 E2E 10건 + 유닛 체크리스트 14항목을 생성하고 요구사항 매핑을 저장함; 앱을 확인하지 못한 헤드리스 실행이라 일부 UI 세부사항은 `(unverified)`로 표시됨.
**Next steps:**
- `/qa-e2e-pom`으로 실행 중인 앱을 확인해 `(unverified)` 표시된 항목(에러 문구, 빈 이름 검증 방식, 검색 결과 0건의 정확한 UI, 이름 중복의 대소문자 처리)을 확정한 뒤 `/qa-e2e-write`로 자동화.
- Auto-decision: 리뷰 옵션에서 SDT 확인이 필요한 지점은 모두 (A) 승인으로 진행함 (헤드리스/무인 실행) — "빠진 시나리오", "P1→P0 조정", "테스트 데이터 우려"에 대한 SDT 피드백은 받지 못함; 위 next step에서 재확인 필요.
- API 레이어 테스트 스위트가 아직 없음 — 유닛 체크리스트가 그 공백을 임시로 메움; 팀이 API 레이어를 도입하면 해당 항목을 이관.
