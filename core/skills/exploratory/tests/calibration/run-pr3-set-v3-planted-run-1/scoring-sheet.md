# Scoring sheet — exploratory · run-pr3-set-v3-planted-run-1

Source: eval-run · case v3-planted · from .qa-reports/evals/exploratory/pr3-set/v3-planted/run-1/workspace

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
**소요 시간:** 6분 / 45분 (계획) — Blocker 결함 조기 발견 및 전체 초점 영역 커버 완료로 조기 종료 | **URL:** http://localhost:4173
**모드:** headless, 무인 실행 (SDT 부재) — 모든 확인 단계에서 옵션 (A) 자동 채택

## 세션 결과
| 지표 | 건수 |
|------|------|
| 새 시나리오 | 3 |
| 결함 | 4 |
| UX 우려 | 2 |
| 누락된 요구사항 | 0 |
| 질문 | 0 |

## 초점 영역 결과
| 초점 영역 | 소요 시간 | 발견 건수 | 비고 |
|----------|----------|---------|------|
| 검색/필터 (AC5) | ~2분 | 2 (F4, F5) | 대소문자 무시 매칭은 정상 동작 |
| 빈 상태 (AC6) | -- | 0 | **미완료** — Delete 결함(F1)으로 실제 0건 상태 도달 불가 |
| 프로젝트 생성 입력 변형 | ~2분 | 2 (F3, XSS/유니코드 정상) | 특수문자·이모지·CJK 정상 이스케이프 |
| 중복 이름 엣지 케이스 | ~1분 | 2 (F2, F6) | 대소문자 다른 중복은 통과되어버림 |
| 삭제 확인 다이얼로그 | ~1분 | 1 (F1, Blocker) | Keep/Cancel은 정상 |
| 접근성 (키보드) | <1분 | 1 (F7) | Escape로 모달 닫히지 않음 |

## 상세 발견 사항

### 발견 1: 삭제가 서버에 반영되지 않음 (204 반환에도 프로젝트가 그대로 남음)
**범주:** 결함 | **심각도:** Blocker | **우선순위:** High
**초점 영역:** 삭제 확인 다이얼로그 | **발견 경로:** 상태 전환 / 오류 복구 휴리스틱
**수행한 것:** "website redesign" 행에서 Delete → 확인 다이얼로그에서 Delete 클릭 (id=5). 이어서 스크립트 태그 이름의 프로젝트(id=3)에서도 동일하게 재현.
**기대한 것:** AC4/TC-04에 따라 프로젝트가 목록에서 사라져야 함.
**실제 일어난 것:** `DELETE /api/projects/5` → `204 No Content` (성공 응답), 이어진 `GET /api/projects`와 전체 페이지 새로고침 후에도 서버 응답 바디에 id=5, id=3 프로젝트가 그대로 남아 있음. UI 목록에서도 계속 표시됨. **id=3과 id=5 양쪽에서 재현** — 특정 레코드 문제가 아닌 일반 결함으로 판단.
**증거:** `.qa-reports/screenshots/delete-fails-project-persists.png` (풀페이지, 새로고침 후 상태) | **콘솔/네트워크:** `DELETE /api/projects/5 => 204`, 직후 `fetch('/api/projects', {cache:'no-store'})` 응답에 id=5 존재 확인
**조치:** 버그 등록 필요 (최우선). `features-kb/features/projects/bugs/BUG-001.md`로 기록. TC-04가 현재 FAIL 상태일 가능성 높음 — `/qa-qa`로 재확인 필요.

### 발견 2: 중복 이름 검사가 대소문자를 구분함 (AC3 의도 위반 가능성)
**범주:** 결함 | **심각도:** Normal | **우선순위:** Medium
**초점 영역:** 중복 이름 엣지 케이스 | **발견 경로:** 입력 변형 휴리스틱
**수행한 것:** 기존 "Website Redesign"이 있는 상태에서 "website redesign"(소문자)으로 새 프로젝트 생성.
**기대한 것:** AC3 취지상 동일 이름(대소문자 무시)은 중복으로 거부되어야 함 — 특히 AC5 검색이 대소문자 무시로 매칭되므로 사용자는 두 이름을 사실상 같은 것으로 인식함.
**실제 일어난 것:** `POST /api/projects` → `201 Created`. 목록에 "Website Redesign"과 "website redesign" 두 개의 사실상 동일한 프로젝트가 공존하게 됨.
**증거:** 스냅샷 `page-2026-09-05T08-59-25-613Z.yml` (5번째 행 "website redesign" 추가 확인) | **콘솔/네트워크:** `POST /api/projects => 201`
**조치:** 팀 논의 필요 — 의도된 동작인지 확인 후 `/qa-test-cases projects --update`로 AC3에 대소문자 규칙 명시.

### 발견 3: 정확히 같은 이름 중복 제출 시 오류 토스트가 표시되지 않음 (AC3/TC-03 불일치)
**범주:** 결함 | **심각도:** Major | **우선순위:** High
**초점 영역:** 중복 이름 엣지 케이스 | **발견 경로:** 오류 복구 휴리스틱
**수행한 것:** 이미 존재하는 "Website Redesign"과 완전히 동일한 이름으로 재생성 시도.
**기대한 것:** TC-03 명세: "error toast 'Name already exists'; list unchanged."
**실제 일어난 것:** 서버는 `409 Conflict`로 정확히 응답(목록도 변경 없음 — 그 부분은 정상)하지만, 화면에는 어떤 오류 토스트/메시지도 나타나지 않음. 다이얼로그가 아무 피드백 없이 그대로 열려 있어 사용자는 왜 아무 일도 일어나지 않는지 알 수 없음.
**증거:** `.qa-reports/screenshots/duplicate-exact-case-toast.png` (다이얼로그 열린 채 토스트 없음) | **콘솔/네트워크:** `POST /api/projects => 409`
**조치:** TC-03이 현재 UI 관점에서 FAIL 상태일 가능성 높음 — 버그 등록 및 `/qa-qa` 재확인 필요.

### 발견 4: 빈 이름/공백만 있는 이름 제출 시에도 오류 피드백 없음
**범주:** 결함 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** 프로젝트 생성 입력 변형 | **발견 경로:** 입력 변형 휴리스틱
**수행한 것:** 이름 필드를 비운 채 Create 클릭, 이어서 공백 3칸만 입력 후 Create 클릭.
**기대한 것:** 서버 유효성 검증 실패에 대해 사용자에게 보이는 오류 메시지.
**실제 일어난 것:** 두 경우 모두 `POST /api/projects => 400 Bad Request`이지만 UI에는 어떤 메시지도 표시되지 않음(다이얼로그가 조용히 그대로 남음). 발견 3과 근본 원인이 같아 보임(오류 응답을 토스트/인라인 메시지로 연결하는 공통 로직 누락).
**증거:** `.qa-reports/screenshots/create-empty-name-no-error.png` | **콘솔/네트워크:** `POST /api/projects => 400` (x2)
**조치:** 발견 3과 함께 하나의 버그로 묶어 등록 권장("생성 실패 시 오류 피드백 미표시").

### 발견 5: 검색어의 앞뒤 공백이 트리밍되지 않아 매칭 실패
**범주:** 새로운 테스트 시나리오 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** 검색/필터 (AC5) | **발견 경로:** 입력 변형 휴리스틱
**수행한 것:** 검색창에 `"  Website  "`(앞뒤 공백 포함) 입력.
**기대한 것:** 일반적으로 검색어는 트리밍 후 매칭되어 "Website Redesign"이 표시되어야 함(대소문자 무시 매칭은 이미 정상 확인).
**실제 일어난 것:** `input.value`는 공백을 그대로 유지("  Website  ")하고, 트리밍 없이 부분 문자열 매칭을 시도해 매칭 실패 → "No projects yet" 표시(발견 6과 연쇄).
**증거:** `browser_evaluate`로 확인한 raw input value `"  Website  "` | **콘솔/네트워크:** 클라이언트 사이드 필터링(추가 네트워크 요청 없음), 정상
**조치:** `/qa-test-cases projects --update`로 AC5에 트리밍 케이스 추가.

### 발견 6: 검색 결과 0건일 때도 "No projects yet"(전체 빈 상태) 문구를 재사용해 오해 소지
**범주:** UX 개선 사항 | **심각도:** Minor | **우선순위:** Low
**초점 영역:** 검색/필터 (AC5) — AC6과 교차 | **발견 경로:** 데이터 무결성 / 사용자 페르소나 휴리스틱
**수행한 것:** 검색창에 매칭되는 프로젝트가 없는 문자열("zzznomatch") 입력.
**기대한 것:** AC6의 "No projects yet"는 계정에 프로젝트가 전혀 없을 때의 문구로 정의됨. 검색 결과가 0건인 것과는 다른 상황이므로 구분된 문구(예: "No projects match your search")가 필요.
**실제 일어난 것:** 프로젝트가 실제로 2개 이상 존재함에도 검색 결과 0건이면 AC6과 동일한 "No projects yet"가 표시됨 — 사용자가 데이터를 잃었다고 오인할 수 있음.
**증거:** `.qa-reports/screenshots/projects-search-no-match.png` | **콘솔/네트워크:** 정상
**조치:** UX 개선 제안으로 등록. AC6 테스트 케이스 작성 시 이 구분을 명시.

## 커버리지 참고 (테스트되었으나 결함 없음)
- XSS/HTML 인젝션 페이로드(`<script>`, 따옴표)로 프로젝트 생성 → DOM에 올바르게 이스케이프되어 렌더링됨(`&lt;script&gt;...`). **안전.**
- 유니코드/이모지/CJK/RTL 혼합 이름("🚀 Проект 日本語") → 정상 생성 및 표시.
- 삭제 확인 다이얼로그의 Keep(취소) → 정상적으로 행 유지.
- 로그인: 잘못된 자격 증명 → 401 + "Invalid email or password" 인라인 메시지 정상 표시(AC1 커버).
- 검색 대소문자 무시 매칭("website" → "Website Redesign") → 정상.

## 발견 7: New project 모달이 Escape 키로 닫히지 않음
**범주:** UX 개선 사항 (접근성) | **심각도:** Trivial | **우선순위:** Low
**초점 영역:** 접근성 (키보드) | **발견 경로:** 접근성 휴리스틱
**수행한 것:** "New project" 모달 열린 상태에서 Escape 키 입력.
**기대한 것:** 일반적인 모달 관례상 Escape로 닫혀야 함.
**실제 일어난 것:** 모달이 그대로 열려 있음(Cancel 버튼 클릭으로만 닫힘).
**증거:** 스냅샷 비교(Escape 전/후 동일) | **콘솔/네트워크:** 정상
**조치:** 낮은 우선순위 UX 개선. Delete 확인 다이얼로그의 Escape 동작은 미검증(다음 세션 대상).

## 미탐색 영역 (다음 세션 대상)
- **AC6 실제 빈 상태("No projects yet", 테이블 없음)** — Delete 결함(발견 1)으로 인해 모든 프로젝트를 삭제해 0건 상태에 도달할 수 없었음. **발견 1 수정 후 최우선 재시도 필요.**
- Delete 확인 다이얼로그에서 Escape 키 동작.
- 상태 필터("All" 드롭다운) — feature.md에 AC 없음으로 범위 밖 처리(의도적 제외).
- 다중 탭 동시 편집, 세션 타임아웃, 느린 네트워크 시뮬레이션 — 시간/범위상 미탐색.
- 프로젝트 이름 최대 길이 경계값(매우 긴 문자열) — 미탐색.
- 모바일 뷰포트 반응형 확인 — 미탐색.

## 권장사항
- **차단됨** — 발견 1(삭제 결함, Blocker)이 핵심 CRUD 워크플로우를 완전히 막고 있어 UAT 진행 불가. 이 결함 수정 전까지 릴리스 후보로 부적합.
- 발견 1, 3 모두 기존 TC-04, TC-03의 통과 여부에 직접 영향 — `/qa-qa`로 공식 재실행 권장.

## 다음 조치
1. 발견 1(Blocker)을 최우선 버그로 등록 — Jira MCP 미사용 환경이므로 `features-kb/features/projects/bugs/BUG-001.md`에 기록됨.
2. 발견 3+4를 "생성/삭제 액션 실패 시 오류 피드백 없음"으로 묶어 버그 등록 — `features-kb/features/projects/bugs/BUG-002.md`.
3. `/qa-test-cases projects --update` 실행하여 AC5(트리밍, 대소문자), AC6(검색-빈 결과 vs 전체-빈 상태 구분)에 대한 테스트 케이스 신규 작성.
4. `/qa-qa`로 TC-03, TC-04 공식 재검증 — 현재 상태 기준 FAIL 예상.
5. 발견 1 수정 후 AC6 실빈 상태 탐색적 재세션 필요.

**Status:** DONE_WITH_CONCERNS
**Summary:** Projects 삭제 기능이 서버 응답(204)과 무관하게 실제로 동작하지 않는 Blocker 결함을 발견(재현 2건); 중복 이름/생성 실패 시 오류 피드백 누락 등 AC3 관련 결함도 확인됨.
**Next steps:** BUG-001(삭제 미반영, Blocker), BUG-002(오류 토스트 누락) 등록 완료 → `/qa-qa`로 TC-03/TC-04 재검증 → AC5/AC6 테스트 케이스 업데이트 → 결함 수정 후 AC6 재탐색.
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
