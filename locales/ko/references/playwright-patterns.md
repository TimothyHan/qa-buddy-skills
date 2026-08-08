# Playwright 패턴 — 생성되는 스위트의 코드 표준

[Playwright 공식 베스트 프랙티스](https://playwright.dev/docs/best-practices)를
기본 전제로 두고, 실전 프로젝트에서 얻은 추가 규칙을 얹습니다. 두 문서가
충돌하면: 이 문서가 명시적으로 다른 선택을 한 경우(예: 셀렉터 우선순위)는 이
문서를, 그 외에는 공식 문서를 따릅니다.

사용처: `/e2e-setup`, `/e2e-pom`, `/e2e-write`, `/test-cases`(Playwright 스케치).
워크플로는 각 스킬의 SKILL.md가, 코드 수준 지식은 이 문서가 담당합니다.

> 출처: 저자의 `playwright-test-patterns` 스킬(slowhama/playwright-best-practices)
> + QABuddy execute-mode 평가와 Toolshop 실전 검증(2026-08-07)에서 확인된 교훈.
> **QABuddy 배포판에서는 이 사본이 canonical입니다.**

---

## 필수 규칙 (MUST)

### 구조
- 모든 Playwright 파일은 단일 `playwright/` 부모 폴더 아래에(설정 파일은 bare
  `npx playwright test`가 동작하도록 레포 루트에). 앱 `src/`에 섞지 않는다.
- 스펙 파일에는 의도(행동 + 단언)만. CSS 셀렉터, HTTP 라우트, 파싱 로직은
  페이지 객체/API 클라이언트 계층으로.
- 셋업 → 테스트 → 티어다운을 전용 훅으로 분리. 여러 단계 플로우는 `test.step`
  으로 감싸고 step 이름은 요구사항 수준으로.
- 정리(teardown)는 훅 또는 auto fixture에. 본문 끝 인라인 정리는 테스트가
  실패하면 실행되지 않는다.

### 대기 (waits)
- `page.waitForTimeout()` 금지. 시간이 아니라 상태를 기다린다.
- 비동기 fetch를 유발하는 액션은 2단 대기: `waitForResponse` → 렌더된 요소
  대기. **response 수신 ≠ 렌더 완료.**
- `waitForResponse`/`waitForEvent` 프로미스는 유발 액션 **이전에** 생성
  (`Promise.all` 페어링).
- `.all()`은 auto-wait하지 않는 스냅샷. 호출 전 `first().waitFor()` 또는 기대
  개수 단언으로 렌더를 먼저 보장.

### 셀렉터
- 우선순위: `getByTestId` > `getByRole(name)` > label/placeholder > CSS(최후
  수단, `fragile` 표시). XPath 금지. (공식 문서는 `getByRole` 우선 — 마크업
  리팩터링 내성을 위해 testId를 우선하는 의도적 선택)
- **테스트 속성 컨벤션을 프로브할 것** — `data-test`, `data-cy` 등이면 설정에
  `use.testIdAttribute` 필수. 러너 밖 스크립트는 별도로
  `selectors.setTestIdAttribute(...)`.
- **이름 조회는 exact-match**: `filter({ hasText: name })`은 부분 일치 —
  "Pliers"가 "Combination Pliers"에도 매칭된다(실전에서 잘못된 카드 클릭 +
  strict mode 위반으로 확인). `filter({ has: page.getByText(name, { exact:
  true }) })` 사용.
- 2개 이상 매칭되는 로케이터(숨겨진 채 attached된 요소 포함!)는 부모로 스코프
  (`row.getByTestId`), `.nth()` 인덱싱 금지.
- 로케이터는 페이지 객체에 모아 export. 스펙은 `expect(pom.locators.x(page))`
  로 조합.

### 테스트 데이터 (병렬 안전)
- 엔티티 이름에 worker+repeat 엔트로피:
  `` `${접두사}-${Date.now()}-w${workerIndex}r${repeatEachIndex}` ``.
  `Date.now()`만으로는 병렬 워커나 `--repeat-each` 인스턴스가 같은 밀리초에
  충돌한다(실전 확인).
- 전역 개수 단언 금지(`이전 + 1`). *내* 엔티티의 존재/부재를 이름/id로 단언.
- 생성한 데이터는 반드시 정리 — disposal context(생성이 undo를 큐잉) 또는
  훅. 정리는 공개 API로, 테스트 환경 전용 리셋 훅에 의존 금지.
- 시딩/사전 조건은 API로(UI 시딩은 느리고 취약 — API가 없을 때만, 부채로 기록).

### 크게 실패시키기 (fail loudly)
- `findIndex` 결과를 가드 없이 `nth()`에 넘기지 않는다: `-1`은 조용히 마지막
  요소가 된다. `if (index === -1) throw` 필수.
- 탐색 헬퍼가 `undefined`를 반환하면 호출자가 즉시 단언.
- 모든 `textContent()` 읽기에 `.trim()`.
- API 클라이언트는 내부에서 상태 코드 단언, 네거티브 테스트는 기대 코드를
  인자로. **스펙이 의존하기 전에 네거티브 경로까지 포함해 스모크 실행** —
  상태 코드 컨벤션은 앱마다 다르다(404를 기대한 DELETE가 멱등 204일 수 있음.
  실전 확인). 가정하지 말고 관찰할 것.

### 매처 선택
| 의도 | 매처 |
| --- | --- |
| 배열 전체가 순서까지 일치 | `toEqual` |
| 배열에 특정 요소 하나 존재 | `toContainEqual` (배열 전체를 넘기지 말 것) |
| 순서 무관 동등 | `arrayContaining` + `toHaveLength` |
| 객체 일부 필드만 확인 | `toMatchObject` / `objectContaining` |

## 금지 (NEVER)

`waitForTimeout` · `test.only` 커밋(`forbidOnly: !!CI`) · 전역 개수 단언 ·
하드코딩된 데이터 이름 · 본문 끝 인라인 정리 · 자동으로 사라지는 컴포넌트에
대한 단언 경쟁(토스트: 지속되는 결과를 단언하거나, 유발 직후 web-first 단언으로
잡을 것) · 스펙 파일 안의 CSS/라우트 · `beforeAll`에서 테스트 스코프 fixture ·
테스트 환경 전용 엔드포인트 의존.

---

## 병렬 실행 (최소 2 워커 정책)

`workers = clamp(floor(cores/2), 최소 2, 최대 사용 가능 계정 수)` — 직렬로만
통과하는 스위트는 순서 의존 버그를 숨기고 있다. 상황별 격리 전략:

| 상황 | 전략 |
| --- | --- |
| 계정 ≥ 워커 | worker-indexed 계정 (아래 템플릿) |
| 계정 부족 + 가입 API 존재 | 계정 추가 프로비저닝 제안(사용자 확인 후) |
| 단일 계정 / 전역 단일 테넌트 | 공유 상태를 변경하는 스펙은 종속 프로젝트로: `{ name: 'global-state', dependencies: ['parallel'], workers: 1 }`. 프로젝트별 `workers: 1`은 **필수** — `--repeat-each`는 같은 파일의 인스턴스도 워커에 분산시키므로 파일 묶기만으로는 직렬화되지 않는다(실전 확인). |

플레이크 게이트는 프로젝트별로: `--repeat-each`는 종속(dependency) 프로젝트를
반복하지 않는다 — `--project={이름} --repeat-each=3`을 각각 실행.

**모든 스펙이 `--repeat-each` 대상은 아니다.** 반복은 단언이 타이밍에
좌우될 수 있는 테스트(렌더링, 네트워크)에만 가치가 있다. 결정적 네거티브
인증 테스트(틀린 비밀번호 → 에러 표시)는 반복해도 타이밍 플레이크를 드러낼
수 없고, 앱에 brute-force 잠금(N회 실패 시 계정 잠금 — 흔한 보안 기능)이
있으면 반복이 잠금을 유발해 같은 계정을 쓰는 모든 테스트가 무관해 보이는
증상으로 연쇄 실패한다(실전 확인 2026-08-07: 3회 임계값, *올바른* 비밀번호
로그인의 waitForURL 타임아웃 등으로 위장된 실패). 이런 테스트는 별도
프로젝트로 분리해 1회만 실행하고 플레이크 게이트에서 제외한다.

**검증 스펙도 행동 스펙과 같은 worker-indexed 계정 격리를 쓴다.**
`pom-verification.spec.ts`가 계정 인지 fixture 대신 기본 `@playwright/test`를
직접 쓰면 어느 워커에서 돌든 config 기본 storageState의 같은 계정으로
인증된다 → `--repeat-each` + 2워커에서 같은 스펙의 두 인스턴스가 **같은
계정으로 동시에** 사용자별 상태(즐겨찾기 등)를 변경하며 레이스. 증상은 일반
플레이크처럼 보인다("context has been closed", 있어야 할 요소의 클릭
타임아웃). 해결: 검증 스펙도 동일한 계정/api fixture를 소비하고, 다른
워커가 만질 수 있는 주변 상태를 읽는 대신 자기 대상 데이터를 self-seed한다.

### Worker-indexed 계정 (실전 검증 템플릿)

```ts
// global-setup.ts: 계정별 API 로그인 → .auth/worker-{i}.json
// (localStorage 토큰 앱은 storageState를 합성:
//  { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name, value }] }] })

// fixtures.ts
const ACCOUNTS = [
  { email: process.env.TEST_USER!, name: 'Jane Doe', stateFile: '.auth/worker-0.json' },
  { email: process.env.TEST_USER_2!, name: 'Jack Howe', stateFile: '.auth/worker-1.json' },
];

export const test = base.extend<{ account: Account }>({
  account: async ({}, use, testInfo) => {
    await use(ACCOUNTS[testInfo.parallelIndex % ACCOUNTS.length]);
  },
  storageState: async ({ account }, use) => {          // 내장 옵션 오버라이드
    await use(path.resolve(__dirname, account.stateFile));
  },
});
```

스펙은 계정 불가지론적으로: 하드코딩된 사용자명 대신 `account.name`을 단언.
사용자별 사전 조건은 self-seed(`ensureX` 헬퍼) — 특정 계정의 시드 데이터에
의존하지 않는다.

---

## 템플릿

### 무상태 함수형 POM
```ts
import { type Page, type Locator } from '@playwright/test';

const locators = {
  itemRows: (page: Page): Locator => page.getByTestId('item-row'),
  rowByName: (page: Page, name: string): Locator =>
    page.getByTestId('item-row').filter({ has: page.getByText(name, { exact: true }) }),
  addButton: (page: Page): Locator => page.getByTestId('add-button'),
};

export const somePage = {
  locators,
  async goto(page: Page) {
    const loaded = page.waitForResponse((r) =>
      r.url().includes('/api/items') && r.request().method() === 'GET');
    await page.goto('/items');
    await loaded;
    await locators.itemRows(page).first().waitFor(); // response ≠ 렌더
  },
  async deleteByName(page: Page, name: string) {
    const row = locators.rowByName(page, name);
    await expect(row, `"${name}" 행이 있어야 함`).toHaveCount(1); // fail loudly
    await row.getByTestId('delete-button').click();               // 행 스코프
    await expect(row).toHaveCount(0);
  },
};
```

클래스 기반 POM(소규모 팀, 긴 플로우): 같은 규칙, `BasePage`는 얕게만 — 깊은
상속 금지. Fixture 주입 POM(페이지 객체가 많을 때): fixture로 인스턴스를
주입해 생성 노이즈 제거.

### 얇은 API 클라이언트 + disposal context
```ts
// fixtures.ts
export type DisposalContext = [APIClientFunction, ...unknown[]][];
export const test = base.extend<{ disposalContext: DisposalContext }>({
  disposalContext: [async ({ request }, use) => {
    const ctx: DisposalContext = [];
    await use(ctx);
    while (ctx.length) {              // LIFO — 테스트가 실패해도 실행됨
      const [fn, ...args] = ctx.pop()!;
      await fn(request, ...args);
    }
  }, { auto: true }],
});

// client.ts — 생성이 곧 정리 예약, 정리 헬퍼는 멱등
export const createItem = async (request, name, disposalContext, expStatusCode = 201) => {
  const response = await request.post('/api/items', { data: { name } });
  expect(response.status()).toBe(expStatusCode);
  if (response.status() === 201) disposalContext?.push([deleteItemIfExists, name]);
  return response;
};
export const deleteItemIfExists = async (request, name) => {
  const found = (await listItems(request)).find((i) => i.name === name);
  if (found) await deleteItem(request, found.id);    // "이미 없음" = 성공
};
```

전역 상태 테스트는 **delete-with-undo**: 삭제할 때마다 재생성을 disposal
context에 큐잉 — 단언이 실패해도 공유 데이터가 복원된다.

### 네트워크 인지 동기화
```ts
const refetch = page.waitForResponse((r) =>
  r.url().includes('/api/items') && r.request().method() === 'GET'); // 클릭 이전에 장전
await page.getByTestId('add-button').click();
await refetch;                                                       // response 수신
await expect(page.getByTestId('item-row')
  .filter({ has: page.getByText(name, { exact: true }) })).toBeVisible(); // 렌더 확인
```

### 역할별 UI 목킹
```ts
await page.route('**/api/me', (route) =>
  route.fulfill({ json: { user: 'view-only', role: 'viewer' } })); // goto 이전에 등록
await page.goto('/');
await expect(row.getByTestId('delete-button')).toHaveCount(0);
```
(라우트는 fixture/클라이언트에, 스펙 파일에는 두지 않는다. 라이브 E2E는 얇게;
에러/빈/엣지/역할 상태는 `page.route` 목킹 테스트가 담당.)

---

## 안티패턴 → 교정

| ❌ | ✅ |
| --- | --- |
| `await page.waitForTimeout(3000)` | 상태 대기: `await expect(locator).toBeVisible()` |
| `await button.click(); await page.waitForResponse(...)` | 프로미스를 클릭 전에 생성 |
| `const rows = await locator.all()` (대기 없이) | `first().waitFor()` 후 `.all()` |
| `rows.nth(table.findIndex(...))` | `-1` 가드 후 throw |
| `expect(count).toBe(before + 1)` | `toContainEqual(objectContaining({ id }))` |
| `name: 'test-item'` / `` `x-${Date.now()}` `` | worker+repeat 엔트로피 추가 |
| 이름 조회에 `filter({ hasText: name })` | `filter({ has: getByText(name, { exact: true }) })` |
| 본문 마지막 줄 정리 | disposal context 또는 `afterEach` |
| 테이블 파싱: `.all()` 후 셀마다 `await textContent()` | `evaluateAll`로 원자적 읽기 — 루프 중 리렌더로 행이 detach되면 타임아웃까지 매달림 |
| 파싱한 행에 `nth(index)`로 액션 | 내용 앵커 로케이터 (`filter({ has: getByText(value, { exact: true }) })`) — 동시 행 변동에 인덱스가 조용히 밀림 |
| 공유 테이블 파싱 결과에 일회성 `toContainEqual` | `expect.poll(() => parse())` — 파싱은 auto-retry가 없어 단일 스냅샷은 동시 렌더에 플레이크 |
| `expect(arr).toContainEqual(전체배열)` | `toEqual` 또는 요소 하나만 |
| `baseURL: 'https://host/api'` + `get('/items')` | 트레일링 슬래시 `…/api/` + 상대 경로 |
| `beforeAll(async ({ request }) => ...)` | 자체 컨텍스트 생성: `request.newContext(...)` |
| 테스트마다 `newContext({ storageState })` | `storageState` 옵션 fixture 오버라이드 |

## 함정 (알아두면 디버깅이 빨라지는 것들)

- `request.newContext()`는 `use.baseURL`을 상속하지 않는다 — 명시적으로 지정.
- 경로 포함 base URL은 트레일링 슬래시 + 상대 경로. `/items`는 base의 `/api`를
  URL 결합 규칙으로 대체해버린다.
- 로케이터 개수는 hidden 요소도 센다. `toHaveCount(0)` 실패인데 화면에 안
  보이면 DOM에 남은(attached) 숨겨진 요소를 의심.
- `getAttribute('aria-expanded')`의 `"false"`는 truthy 문자열. `!== 'true'`.
- `reuseExistingServer: !CI`는 포트의 좀비 서버에 붙는다. `lsof -ti :<port>`.
- `fullyParallel`은 같은 파일의 테스트도 다른 워커로 흩는다. 순서 의존
  테스트는 `test.describe.configure({ mode: 'serial' })`.
- worker에 할당하는 `readdir` 목록은 `.sort()` 필수 — 순서는 플랫폼마다 다르다.
- 컨테이너를 *교체*하는 빈 상태(테이블이 숨김이 아니라 제거됨)는 존재/부재
  단언으로 — visibility 토글이 아니라.
- 빈 상태에 **아무 요소도 렌더하지 않는** 앱도 있다 — 항목의 부재를 단언하고
  제품 관찰로 기록할 것. 존재하지 않는 메시지를 기다리도록 지어내지 않는다.
