---
name: e2e-pom
version: 0.1.1
description: |
  라이브 요소 디스커버리로 Page Object Model을 빌드하고 유지합니다 --
  셀렉터를 절대 추측하지 않습니다. Build 모드는 사용자와 페어링: 테스트
  케이스에서 요소 인벤토리를 도출하고, 실행 중인 앱에 대해 모든 로케이터를
  증명하고, 하이라이트 스크린샷으로 확인받은 후에만 POM에 넣습니다.
  Heal 모드는 검증 스펙이 깨졌을 때 자율 실행: 재디스커버리, 명확한 이름
  변경은 자동 수정, 제거된 요소는 플래그, 그 외에는 아무것도 건드리지 않음.
  사용 시점: "build POM", "page objects", "map elements", "heal selectors", "verification spec failing".
  사용하지 않을 때: 초기 Playwright 셋업 시 (/e2e-setup 사용), 테스트 스펙 작성 시 (/e2e-write 사용), 테스트 케이스 생성 시 (/test-cases 사용).
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

# /e2e-pom: 페이지 객체 디스커버리 & 힐링

두 가지 모드. **Build**는 인터랙티브 -- 발견한 것을 사용자가 확인합니다.
**Heal**은 자율 실행 -- 드리프트를 수리하고 수리할 수 없는 것은 플래그합니다.
둘 다 POM 스타일, 인증, white-box 모드를 위해 `playwright/AUTOMATION.md`
(`/e2e-setup` 산출물)를 읽습니다. AUTOMATION.md 없음 → `/e2e-setup` 먼저.

**코드 표준:** POM 코드를 쓰기 전에
`{{REFERENCE_PATH}}/playwright-patterns.md`를 읽으세요 -- POM 템플릿, 셀렉터
규칙, exact-match / 스코핑 함정이 거기 있습니다. 그 다음 프로젝트 학습
파일(프리앰블 참조) -- 이 스킬에 스코프된 active `LRN-` 항목이 그 패턴들을
오버라이드합니다.

## 제약 사항

1. **라이브 증명 없이 로케이터 없음.** 셀렉터는 실행 중인 앱에 대해 실행된
   후에만 POM에 들어갑니다: 해석됨, 기대 개수(1, 또는 스코프된 n), 보임.
   디스커버리 중 앱 접속 불가 → 증명 안 된 요소는 POM 밖에 남고 상태는
   BLOCKED. 그럴듯한 추측을 절대 쓰지 않습니다.
2. **수요 기반 인벤토리.** 주어진 테스트 케이스가 건드리는 요소만 매핑합니다.
   "온 김에 전부 매핑해줘"라는 요청은 거절하고 설명합니다: 참조되지 않는
   요소는 검증 불가능한 유지보수 부채 -- 테스트 케이스가 필요로 할 때
   매핑됩니다.
3. **셀렉터 우선순위:** `getByTestId` > `getByRole(name)` > label/placeholder
   > CSS (최후 수단, `fragile: true` 표시). XPath 금지.
4. **중복은 인덱싱이 아니라 스코핑으로.** 로케이터가 요소 2개 이상에 매칭되면
   (숨겨진 채 attached된 것도 셈!), 부모로 스코프(`row.getByTestId`)하지
   `.nth()`를 쓰지 않습니다. DOM이 해소 못 하는 모호함 → 사용자에게 질문
   (build) 또는 플래그 (heal).
5. **이름 조회는 exact-match.** `filter({ hasText: name })`은 부분 일치 --
   "Pliers"가 "Combination Pliers"에도 매칭됩니다. 이름 기반 행/카드
   로케이터는 `filter({ has: page.getByText(name, { exact: true }) })`.
   (실전에서 확인: 엉뚱한 상품 클릭 + strict mode 위반, 2026-08-07.)
6. **검증 스펙이 게이트입니다.** build/heal이 DONE을 보고하기 전에
   `pom-verification.spec.ts`가 green이어야 합니다. 드리프트 감지기이기도
   하니 스위트에 유지하세요. 검증 스펙도 행동 스펙과 같은 worker-indexed
   계정 fixture를 사용하고 자기 대상 데이터를 self-seed합니다 -- config 기본
   storageState를 직접 쓰면 모든 워커가 같은 계정으로 인증되어
   `--repeat-each`에서 레이스가 생깁니다 (실전 확인 2026-08-07).
7. **Heal은 건강한 항목을 절대 건드리지 않습니다.** 검증이 실패한 항목만
   변경할 수 있습니다. 통과 중인 로케이터에 대한 "수정"은 결함입니다.

---

## Build 모드

### Phase B1: 테스트 케이스에서 요소 인벤토리

테스트 케이스(KB 경로 또는 사용자가 준 파일)를 읽습니다. 각 TC에 대해
방문하는 화면과 단계/기대가 건드리는 요소를 나열합니다. 테이블로 출력:
요소 → 화면 → 출처 TC. 이 테이블이 곧 범위입니다; 그 외에는 아무것도
디스커버리하지 않습니다 (제약 2).

### Phase B2: 라이브 디스커버리

화면별로: 이동(셋업의 storageState로 인증됨), DOM/접근성 트리 읽기, 인벤토리
요소별 후보 셀렉터를 제약 3의 순위로 수집. 워크 중 네트워크 트래픽 캡처 --
요청/응답 쌍을 `playwright/api-capture.json`에 저장 (`/e2e-write`의 API
클라이언트가 공짜로 얻어갑니다).

### Phase B3: 증명하고 확인받기 (페어링 순간)

각 요소에 대해:
1. 최선의 후보를 실행: 개수, 가시성. 개수 >1 → 제약 4대로 스코프하고 재증명.
2. 증명된 모든 요소에 번호 매긴 하이라이트를 얹어 화면 스크린샷.
3. 화면당 스크린샷 하나를 사용자에게: "①–⑥을 목록대로 매핑했습니다 --
   확인해 주시겠어요?" 수정 사항 적용, 재증명, 재확인. 모호한 요소(예: "삭제
   버튼" 후보 둘)는 옵션으로 제시하지, 조용히 고르지 않습니다.

### Phase B4: 갭

testid도 없고 고유한 role/name/label도 없는 요소:
- **White-box (AUTOMATION.md 기준):** 앱 레포에서 testid 네이밍 컨벤션을
  grep하고 `data-testid` 패치를 생성 (diff로 제안, 또는 브랜치에 적용 --
  AUTOMATION.md에 기록된 쪽). 머지 전까지는 최선의 대체 셀렉터를
  `fragile: true`로 사용.
- **Black-box:** **테스트 가능성 갭 보고서**에 추가 -- 요소, 갭인 이유, 제안
  testid, 영향받는 TC -- 그리고 대체 셀렉터를 `fragile: true`로 사용.

갭 보고서는 범위 내 갭만 정확히 나열합니다. 범위 밖 관찰은 별도로 기록할 수
있지만 인벤토리에는 절대 들어가지 않습니다.

### Phase B5: 아티팩트 작성

AUTOMATION.md의 POM 스타일대로:

```
playwright/
  pom/{screen}.page.ts           # 로케이터 + 인터랙션 헬퍼
  pom/inventory/{screen}.json    # 디스커버리 기록 (아래 스키마)
  pom-verification.spec.ts       # 각 화면 방문, 모든 로케이터 단언
```

인벤토리 항목 스키마:

```json
{ "element": "project row", "selector": "getByTestId('project-row')",
  "strategy": "testid", "fragile": false, "screen": "/projects",
  "sourceTCs": ["TC-02", "TC-04"], "verified": "{ISO date}",
  "status": "verified" }
```

### Phase B6: 게이트

`npx playwright test pom-verification` 실행. Green + 사용자 확인 수신 →
DONE. 보고: 매핑된 요소 수, 갭(보고서 포함), fragile 개수.

---

## Heal 모드

입력: 실패한 검증 결과 (또는 스펙을 실행해 얻기).

### Phase H1: 피해 범위 확정

실패한 로케이터 → 영향받는 화면만. 건강한 화면은 출입 금지.

### Phase H2: 재디스커버리와 diff

영향받는 화면에서 디스커버리 재실행. 깨진 인벤토리 항목별로 판정:

| 발견 | 조치 |
|---|---|
| 같은 요소, 새 testid/속성 (role, 접근 가능한 이름, 위치 일치) | **자동 수리:** 셀렉터 + 인벤토리 갱신(`verified` 갱신), 이전 → 새것 기록 |
| 요소가 DOM에서 사라짐 | **플래그, 절대 "수정" 금지:** 인벤토리 `status: "missing"`, 영향받는 TC 나열, 플래그 사유와 함께 `test.fixme`로 검증에서 제외. 기능이 이동했는지 죽었는지는 사람이 판단합니다. |
| 모호함 (그럴듯한 후보 여럿) | 후보들과 함께 **플래그** -- 조용히 하나를 고르지 않음 |

### Phase H3: 게이트와 보고

검증 스펙 재실행 → green (사라진 요소는 삭제가 아니라 fixme). diff로 보고:
수리됨(이전 → 새 셀렉터), 플래그됨(영향 TC와 사람에게 물을 질문), 안 건드린
개수. 깨진 집합 밖의 편집 = 오류로 보고하고 되돌립니다.

---

## 출력 전 자기 평가

- [ ] 모든 POM 로케이터 뒤에 증명 실행이 있다 (build) / 깨진 항목만 변경됐다 (heal)
- [ ] 인벤토리가 테스트 케이스 수요를 정확히 커버 -- 그 이상은 없음
- [ ] 갭 보고서가 범위 내 갭 요소와 정확히 일치
- [ ] 검증 스펙이 green
- [ ] Build: 모든 화면의 하이라이트를 사용자가 확인

**Status:** DONE | DONE_WITH_CONCERNS (fragile/플래그 항목 -- 나열할 것) | BLOCKED (앱 접속 불가, 증명 안 된 요소 -- 나열할 것)
**Summary:** {모드}: 요소 {n}개 증명, 갭 {g}개, 플래그 {f}개
**Next steps:** {/e2e-write로 스펙 작성 | testid 패치 머지 | 플래그 요소 사람 리뷰}
