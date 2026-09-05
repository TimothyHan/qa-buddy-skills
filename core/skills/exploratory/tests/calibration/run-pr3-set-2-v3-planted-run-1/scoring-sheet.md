# Scoring sheet — exploratory · run-pr3-set-2-v3-planted-run-1

Source: eval-run · case v3-planted · from .qa-reports/evals/exploratory/pr3-set-2/v3-planted/run-1/workspace

Read the context below (what the skill was given, and the ground truth only the judge and you see), then the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.



## Context — what the skill was given (case input)

```
--- .qabuddy.json ---
{ "version": "1.0", "contextSource": "spec", "teamMode": "solo", "learningsPath": "features-kb/LEARNINGS.md", "runsDir": ".qa-reports/runs", "appUrl": "http://localhost:4173" }


--- features-kb/features/projects/feature.md ---
# Feature: Projects management (projects)

**Key:** `projects` (contextSource: spec)

## Capabilities

### C1. Authentication
- AC1: sign in with valid credentials → Projects page with the list; invalid → error on /login.

### C2. Project list management
- AC2: create a project with a unique name → success toast, project in list.
- AC3: duplicate name → error toast "Name already exists", list unchanged.
- AC4: delete from the row after confirming in a dialog → project gone from list.

### C3. Finding projects
- AC5: search box filters rows by name fragment.
- AC6: zero projects → "No projects yet", no table.

## Out of scope
- Status filter dropdown — no AC.


--- features-kb/features/projects/test-cases/projects.md ---
# Test Cases: Projects management

**Ticket:** projects | **Epic:** projects
AC1–AC4 covered. AC5 and AC6 have no test cases yet.

### TC-01: Sign in with valid credentials — AC1, P0, happy-path
Open /login → enter qa@acme.test / demo123 → submit. Expected: Projects page, list visible.

### TC-02: Create a project — AC2, P0, happy-path
New project → unique name → Create. Expected: success toast; project in the list.

### TC-03: Duplicate project name rejected — AC3, P1, negative
New project → existing name → Create. Expected: error toast "Name already exists"; list unchanged.

### TC-04: Delete a project — AC4, P0, happy-path
Delete on the target row → confirm. Expected: project no longer in the list.

**Status:** DONE_WITH_CONCERNS
**Summary:** 4 cases; AC5/AC6 unmapped
**Next steps:** /qa-test-cases projects --update


--- features-kb/index.json ---
{ "projects": { "title": "Projects management", "status": "active", "stories": ["projects"], "testCaseCount": 4, "acCovered": 4, "notes": "AC5/AC6 have no test cases yet" } }

```

## Context — ground truth (judge notes; the skill never saw this)

# Judge notes — v3-planted (fixture app v3)

One planted defect: `DELETE /api/projects/:id` returns 204 but does not remove the project. After confirming Delete, the row stays in the list (also after reload). This violates AC4 and is Blocker or Critical (core CRUD broken, no workaround).

A consequence the same defect produces, and which is a valid second finding rather than an invented one: creating a project with the name of a "deleted" project is rejected with 409 "Name already exists", because the project still exists server-side (AC2/AC3 interplay). Reporting both is correct; reporting only the delete is acceptable; reporting the 409 without the delete is a partial find.

Everything else works as in v1. The non-bug behaviours from v1-clean (350 ms re-render, toast auto-dismiss, shared Delete name, unlabeled search, bare empty state, inert status filter) still apply.
Existing KB test cases: TC-01 sign in, TC-02 create, TC-03 duplicate rejected, TC-04 delete.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. Filing any of these as a question or missing requirement is correct; filing one as a defect is a real observation in the wrong category (see the `finding-correctness` anchors).

## Artifact — what you score (the same files the judge grades)

### .qa-reports/exploratory-projects-2026-09-05.md

````
# 탐색적 테스트 보고서
**기능:** Projects management | **에픽:** projects | **날짜:** 2026-09-05
**소요 시간:** 11분 / 45분 (계획보다 조기 종료 — Blocker 결함 확인 후 커버리지 충분 판단) | **URL:** http://localhost:4173

## 세션 결과
| 지표 | 건수 |
|------|------|
| 새 시나리오 | 3 |
| 버그 | 3 |
| UX 우려 | 2 |
| 누락된 요구사항 | 1 |
| 질문 | 0 |

## 초점 영역 결과
| 초점 영역 | 소요 시간 | 발견 건수 | 비고 |
|----------|----------|---------|------|
| AC5/AC6 갭: 검색 필터 + 빈 상태 | ~3분 | 2 | 검색 자체는 정상 동작(대소문자 무시 포함); 빈 결과 카피 재사용 이슈 발견 |
| 프로젝트 생성 입력 변형 | ~4분 | 3 | 빈값/공백, XSS 이스케이프 검증, 최대 길이 미검증 |
| 삭제/중복 상태 전이 | ~4분 | 2 | **삭제가 서버에 반영되지 않는 Blocker 결함 발견**; 취소(Keep) 경로는 정상 |
| 상태(All/Active/Paused) 드롭다운 교차 확인 | 실행 중 병행 확인 | 1 | AC 없음에도 완전히 동작하는 기능 확인 |

## 상세 발견 사항

### 발견 1: 삭제가 서버 데이터에 반영되지 않음 (핵심 CRUD 실패)
**범주:** 결함 | **심각도:** Blocker | **우선순위:** High
**초점 영역:** 삭제 상태 전이 | **발견 경로:** 오류 복구 / 데이터 무결성 휴리스틱
**수행한 것:** 행의 "Delete" → 확인 다이얼로그에서 "Delete" 클릭 (id=3 "website redesign"에서 시작, id=2 "Mobile App"에서 재현 확인)
**기대한 것:** DELETE 요청 성공 시 해당 프로젝트가 목록에서 영구히 사라짐 (AC4)
**실제 일어난 것:** `DELETE /api/projects/{id}` 는 `204 No Content`를 반환하지만, 곧바로 이어지는 `GET /api/projects` (같은 세션 내 리페치 및 전체 페이지 새로고침 모두)에서 해당 프로젝트가 그대로 남아있음. UI에 오류 토스트도 없어 사용자는 삭제가 성공했다고 오인함. 서로 다른 두 행(id=2, id=3)에서 동일하게 재현되어 특정 레코드 문제가 아니라 삭제 기능 전체의 결함으로 판단.
**증거:** `.qa-reports/screenshots/delete-not-persisted-after-reload.png`, `.qa-reports/screenshots/delete-broken-both-rows-persist.png` | **콘솔/네트워크:** DELETE 응답 204, 이후 GET 200이지만 응답 바디에 항목이 그대로 포함됨(fetch로 직접 확인). 콘솔 에러 없음 — 조용히 실패.
**조치:** 버그로 등록 (Jira MCP 미연동 — 아래 KB에 기록). TC-04(P0)가 실제로는 실패 상태임을 `/qa-qa` 실행 시 반영 필요.

### 발견 2: 프로젝트 이름 중복 검사가 대소문자를 구분함
**범주:** 누락된 요구사항 | **심각도:** Normal | **우선순위:** Medium
**초점 영역:** 생성 입력 변형 | **발견 경로:** 입력 변형 휴리스틱
**수행한 것:** 기존 "Website Redesign"이 있는 상태에서 "website redesign"(소문자)으로 생성 시도
**기대한 것:** AC3에 따라 "Name already exists" 오류 토스트, 목록 불변
**실제 일어난 것:** 성공적으로 생성됨 (`POST /api/projects` → 201, "Project created" 토스트). 대소문자만 다른 사실상 동일한 이름의 프로젝트 두 개가 공존.
**증거:** `.qa-reports/screenshots/duplicate-name-case-insensitive-bypass.png` | **콘솔/네트워크:** POST 201 Created, 정상
**조치:** AC3에 대소문자 무시 중복 검사 여부를 명시하도록 팀 논의 후 테스트 케이스 추가 (`/qa-test-cases projects --update`).

### 발견 3: 검색 결과 0건일 때 "프로젝트 없음" 빈 상태 카피를 그대로 재사용
**범주:** UX 개선 사항 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** AC5/AC6 갭 | **발견 경로:** 입력 변형 / 상태 전환 휴리스틱
**수행한 것:** 프로젝트 2개가 존재하는 상태에서 검색창에 매칭되지 않는 문자열("zzz_no_match", 공백만) 입력
**기대한 것:** "검색 결과 없음"과 "프로젝트가 실제로 0개"는 사용자에게 다른 의미이므로 구분된 안내가 바람직함 (AC6는 실제 0개 상태만 명시, 검색 결과 0건은 미정의)
**실제 일어난 것:** AC6과 동일한 "No projects yet" 문구가 그대로 표시되어, 사용자가 프로젝트를 검색으로 못 찾는 것과 프로젝트가 아예 없는 것을 구분할 수 없음
**증거:** `.qa-reports/screenshots/search-no-match-wrong-empty-copy.png` | **콘솔/네트워크:** 정상
**조치:** UX 개선으로 등록 — "검색 결과 없음: '{query}'" 형태의 별도 문구 제안. AC5/AC6에 명시적 테스트 케이스로 추가.

### 발견 4: 빈 값/공백만 있는 이름 제출 시 클라이언트 검증 없이 서버 왕복 발생
**범주:** UX 개선 사항 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** 생성 입력 변형 | **발견 경로:** 입력 변형 휴리스틱
**수행한 것:** "New project" 모달에서 이름을 비운 채 또는 공백(`"   "`)만 입력 후 "Create" 클릭
**기대한 것:** 클라이언트 단에서 즉시 "Name is required" 표시
**실제 일어난 것:** `POST /api/projects` 요청이 서버까지 전달되어 `400 Bad Request`로 콘솔 에러 발생 후에야 오류 메시지 표시됨. 최종 사용자 경험은 정상이나 불필요한 네트워크 왕복과 콘솔 노이즈 발생.
**증거:** `.qa-reports/screenshots/empty-name-400-console-error.png` | **콘솔/네트워크:** 400 Bad Request 콘솔 에러 2건
**조치:** UX 개선 사항으로 등록 — 클라이언트 측 사전 검증 추가 제안.

### 발견 5: 프로젝트 이름 최대 길이 제한 없음, 테이블에서 줄바꿈/말줄임 없이 그대로 렌더링
**범주:** UX 개선 사항 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** 생성 입력 변형 | **발견 경로:** 입력 변형 휴리스틱 (최대 길이+1)
**수행한 것:** 200자 "A" 반복 문자열로 프로젝트 생성
**기대한 것:** 합리적인 최대 길이 검증 또는 테이블에서 말줄임(ellipsis) 처리
**실제 일어난 것:** 그대로 저장 및 렌더링되어 실제 화면에서는 레이아웃이 깨질 가능성 높음(뷰포트 렌더링 확인은 후속 세션 권장)
**증거:** 스냅샷에 200자 셀 확인(`page-2026-09-05T09-17-53-575Z.yml`) | **콘솔/네트워크:** 정상, 201 Created
**조치:** 새 테스트 시나리오로 등록 — 실제 뷰포트 스크린샷으로 레이아웃 깨짐 여부 후속 확인 필요.

### 발견 6 (긍정 확인): 프로젝트 이름 HTML 이스케이프 정상 — XSS 없음
**범주:** 새로운 테스트 시나리오 | **심각도:** N/A | **우선순위:** N/A
**초점 영역:** 생성 입력 변형 | **발견 경로:** 입력 변형 휴리스틱 (특수문자)
**수행한 것:** `<img src=x onerror=alert(1)>`를 이름으로 생성
**기대한 것/실제 일어난 것:** 텍스트로 안전하게 이스케이프되어 렌더링됨(스크립트 미실행, alert 없음). 정상.
**증거:** `.qa-reports/screenshots/xss-attempt-escaped-correctly.png`
**조치:** 회귀 방지를 위한 보안 테스트 케이스로 정식 등록 권장.

### 발견 7 (새 테스트 시나리오): 상태(All/Active/Paused) 드롭다운은 AC 없이도 완전히 동작
**범주:** 새로운 테스트 시나리오 | **심각도:** N/A | **우선순위:** N/A
**초점 영역:** 교차 기능 확인 | **발견 경로:** 교차 기능 휴리스틱
**수행한 것:** feature.md에 "Out of scope — no AC"로 명시된 상태 필터 드롭다운을 열고 "Active" 선택
**기대한 것/실제 일어난 것:** 클라이언트 사이드로 완전히 필터링되어 정상 동작(서버 재요청 없음, `GET /api/projects`는 페이지 로드시 1회만 발생). 방치된 죽은 UI가 아니라 실제 기능이 존재.
**증거:** 스냅샷 `page-2026-09-05T09-08-18-140Z.yml`
**조치:** 팀에 AC 추가 여부 논의 요청(질문) 및 `/qa-test-cases projects --update`로 커버리지 반영 제안.

## 미탐색 영역
- 실제 브라우저 뷰포트에서의 시각적 렌더링(200자 이름, 모바일 폭 등) — headless 스냅샷만 확인, 스크린샷 기반 시각 회귀는 다음 세션에서.
- 키보드 전용 탐색/접근성(포커스 트랩, 스크린 리더) — 시간 배분상 미실행.
- 동시성(탭 2개, 동시 삭제/생성) — Blocker 결함 발견 후 우선순위 하향, 다음 세션 권장.
- 네트워크 장애 강제 주입(오프라인 모드) 후 UI 복구 여부.

## 권장사항
- **차단됨** — 발견 1(삭제 미영속) 은 AC4/TC-04(P0)의 핵심 시나리오를 깨뜨리는 Blocker 결함으로, 수정 전에는 UAT 진행 불가.

## 다음 조치
1. 발견 1(삭제 버그)을 `features-kb/features/projects/bugs/BUG-001.md`로 등록 완료 — 개발팀에 즉시 에스컬레이션 필요.
2. `/qa-test-cases projects --update` 실행하여 AC5(검색), AC6(빈 상태 vs 검색 0건 구분), 대소문자 중복 검사, XSS 이스케이프, 상태 드롭다운을 테스트 케이스에 반영.
3. 발견 1 수정 후 `/qa-verify-fix`로 재검증.
4. 발견 7(상태 드롭다운)의 AC 추가 여부를 팀에 확인(질문).
5. Auto-decision (headless 실행, SDT 부재): 모든 리뷰 일시정지 지점에서 옵션 (A) 승인 자동 선택 — 차터 승인, 발견 사항 분류 확정, 세션 조기 종료 판단(45분 계획 중 11분 시점에 Blocker 확인 후 커버리지 충분 판단하여 마무리).

**Status:** DONE_WITH_CONCERNS
**Summary:** Projects 삭제 기능이 서버에 전혀 반영되지 않는 Blocker 결함 확인(2개 행에서 재현); 그 외 대소문자 중복 우회, 빈 상태 카피 재사용 등 5건 추가 발견.
**Next steps:** 삭제 버그 즉시 에스컬레이션 → 수정 후 `/qa-verify-fix`; `/qa-test-cases projects --update`로 AC5/AC6 및 신규 시나리오 반영.
````

## Criteria

## finding-correctness (weight 3, floor 2)

Findings match the app's known state (judge notes say which defects exist): every planted defect the charter's focus areas touch is found, and no finding claims a defect the app does not have.

- **0** — A finding claims a defect the app does not have (the judge notes list what exists), or a planted defect in a focus area that was explored is reported as working.
- **1** — No invented defects, but either a planted defect in an explored focus area was missed and the area is not marked unexplored, or a real observation the spec does not decide (judge notes list these) is filed as a defect instead of a question or missing requirement.
- **2** — Planted defects found and nothing invented; a known non-bug behaviour (late re-render, auto-dismiss toast) is filed as a bug rather than a product observation.
- **3** — Planted defects found with the right AC named, nothing invented, known non-bug behaviours recorded as observations or UX notes.

## classification (weight 2, floor 1)

Every finding carries a severity and a priority from the playbook scales, and the values are consistent with the finding's impact.

- **0** — At least one finding has no severity or no priority.
- **1** — All findings are classified but at least one value is not from the scale, or a Blocker/Critical has no evidence.
- **2** — All findings classified from the scale; one classification is inconsistent with the described impact.
- **3** — All findings classified from the scale and consistent with impact; a deleted row that stays listed is Blocker or Critical, a cosmetic note is Minor or Trivial.

## evidence (weight 2, floor 1)

Every finding has concrete steps, a distinct expected and actual, evidence (screenshot path or described observation), and an action.

- **0** — A finding lacks steps, or expected and actual are the same sentence, or there is no evidence field.
- **1** — All fields present but at least one finding's steps cannot be followed (no starting page, no data named).
- **2** — All findings reproducible from their steps; one evidence entry is generic ("see screenshot") without a path or observation.
- **3** — Every finding reproducible, expected/actual distinct, evidence specific, action names the next skill or owner.

## charter-quality (weight 1, floor 0)

The charter names a mission, lists what is already tested, and ranks focus areas by risk with a heuristic and a time estimate each — direction, not scripted steps.

- **0** — No charter, or focus areas are scripted step lists rather than areas.
- **1** — Charter present but focus areas have no heuristic or no risk rationale.
- **2** — Focus areas ranked with heuristics and rationale; the "Already Tested" section ignores the KB test cases that exist.
- **3** — Ranked focus areas with heuristic, rationale and time; "Already Tested" reflects the KB and repo tests; out-of-scope named.

## no-duplicate-scenarios (weight 1, floor 1)

No finding categorized as a new test scenario duplicates a test case already in the KB or a test in the repo (judge notes list them).

- **0** — A "new test scenario" restates an existing KB test case.
- **1** — No duplicates, but a new scenario overlaps an existing case without saying how it differs.
- **2** — New scenarios are distinct; one could have referenced the existing case it extends.
- **3** — New scenarios are distinct and each says which existing case it extends or why none applies.

## unexplored-noted (weight 1, floor 0)

Every charter focus area either has findings or an explicit unexplored note, and the report lists what the next session should cover.

- **0** — A focus area has neither findings nor an unexplored note.
- **1** — All areas accounted for, but the next-session list is missing.
- **2** — All areas accounted for with a next-session list; one item is vague ("more testing").
- **3** — All areas accounted for; next-session items are specific enough to become a charter.
