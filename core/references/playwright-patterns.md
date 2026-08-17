# Playwright Patterns — code standards for generated suites
<!-- qab: scope=e2e-setup,e2e-pom,e2e-write,test-cases -->

Distilled field rules layered on top of the [official Playwright best
practices](https://playwright.dev/docs/best-practices). The official docs are
the baseline; this file adds the rules that come from running suites in anger.
Where the two conflict deliberately (selector priority), this file wins.

Consumed by: `/e2e-setup`, `/e2e-pom`, `/e2e-write`, `/test-cases` (Playwright
sketches). The e2e SKILL.md files carry the workflow; this file carries the
code-level knowledge that is too large to inline there.

> Provenance: distilled from the author's `playwright-test-patterns` skill
> (slowhama/playwright-best-practices) plus lessons proven live in QABuddy's
> execute-mode evals and the Toolshop dogfood (2026-08-07). **This copy is
> canonical for QABuddy** — improve it here, backport upstream if desired.

---

## MUST rules
<!-- qab: id=must-rules tier=must -->

### Structure
- All Playwright files under one `playwright/` parent folder (config at repo
  root so bare `npx playwright test` works). Never mixed into app `src/`.
- Spec files carry intent only: behavior + assertions. CSS selectors, HTTP
  routes, parsing logic belong in page objects / API clients.
- Setup → test → teardown in dedicated hooks (`beforeEach`/`afterEach`…);
  multi-stage flows wrapped in `test.step` named at requirement level.
- Teardown in hooks or auto fixtures, never inline at the end of a test body
  (skipped on failure).

### Waits
- `page.waitForTimeout()` is banned. Wait on state, not time.
- Actions that trigger async fetches get **two-stage waits**:
  `waitForResponse` → then assert the rendered element. **Response received ≠
  rendered** (some apps re-render hundreds of ms after the response).
- Create `waitForResponse`/`waitForEvent` promises **before** the triggering
  action (`Promise.all` pairing).
- `.all()` is a non-waiting snapshot — call `first().waitFor()` or assert an
  expected count before it.

### Selectors
- Priority: `getByTestId` > `getByRole(name)` > label/placeholder > CSS (last
  resort, mark `fragile`). Never XPath. (Deliberate divergence from the
  official `getByRole`-first advice: testids survive markup refactors.)
- **Probe the test-attribute convention** — `data-test`, `data-cy` etc. need
  `use.testIdAttribute` in config, and raw scripts outside the runner need
  `selectors.setTestIdAttribute(...)` separately.
- **Name lookups are exact-match**: `filter({ hasText: name })` is substring
  matching — "Pliers" also matches "Combination Pliers". Use
  `filter({ has: page.getByText(name, { exact: true }) })`.
- A locator matching >1 element (hidden-but-attached ones count) is scoped to
  a parent (`row.getByTestId(...)`), never `.nth()`-indexed.
- Locators live in page objects and are exported; specs compose
  `expect(pom.locators.x(page))`.

### Test data (parallel-safe)
- Entity names need worker+repeat entropy:
  `` `${prefix}-${Date.now()}-w${workerIndex}r${repeatEachIndex}` ``.
  `Date.now()` alone collides when parallel workers or `--repeat-each`
  instances hit the same millisecond.
- No global count assertions (`before + 1`) — concurrent tests break them.
  Assert *your* entity's presence/absence by name or id.
- Everything created gets cleaned up — disposal context (creation queues its
  own undo) or `afterEach`/`afterAll`. Cleanup goes through public API, never
  test-env-only reset hooks.
- Seeding and preconditions via API, not UI (slow, fragile). UI seeding only
  when no API exists — and flag it as debt.

### Fail loudly
- Guard `findIndex` before `nth()`: `-1` silently becomes "last element".
- Helpers returning `undefined` get asserted immediately by the caller.
- `.trim()` every `textContent()` read — DOM whitespace breaks `===`.
- API clients assert status internally
  (`expect(response.status()).toBe(expStatusCode)`); negative tests pass the
  expected code. **Smoke every client function including negative paths before
  specs rely on it** — status conventions vary per app (a DELETE may be
  idempotent 204 where you expect 404). Never assume, observe.

### Matcher selection
| Intent | Matcher |
| --- | --- |
| Whole array equal, order included | `toEqual` |
| One element exists in array | `toContainEqual` (never pass a whole array — it asks "does the array contain this array") |
| Order-independent equality | `arrayContaining` + `toHaveLength` |
| Subset of object fields | `toMatchObject` / `objectContaining` |

## NEVER
<!-- qab: id=never tier=must -->

`waitForTimeout` · committed `test.only` (config: `forbidOnly: !!CI`) · global
count assertions · hardcoded entity names · inline teardown at body end ·
racing auto-dismissing UI (toasts: assert the durable outcome, or catch with a
web-first assertion immediately after the trigger) · CSS/routes in spec files ·
test-scoped fixtures (`page`, `request`) in `beforeAll` · depending on
test-env-only endpoints.

---

## Parallelism (min-2-workers policy)
<!-- qab: id=parallelism -->

`workers = clamp(floor(cores/2), min 2, max usable accounts)` — a suite that
only passes serially is hiding ordering bugs. Isolation strategy by situation:

| Situation | Strategy |
| --- | --- |
| Accounts ≥ workers | Worker-indexed accounts (template below) |
| Accounts short, registration API exists | Provision more (ask first) |
| Single account / global single-tenant data | Shared-state-mutating specs go in a dependent project: `{ name: 'global-state', dependencies: ['parallel'], workers: 1 }`. The per-project `workers: 1` is **mandatory** — `--repeat-each` spreads instances of the same file across workers, so file grouping alone does not serialize. |

Flake-gate per project: `--repeat-each` does **not** repeat dependency
projects — run `--project={name} --repeat-each=3` for each.

**Not every spec belongs under `--repeat-each`.** Repetition only has value
for tests where the assertion could plausibly race (rendering, network
timing). A deterministic negative-auth test (wrong password → error shown)
can't reveal a timing flake by repeating — and if the app has brute-force
lockout (locks an account after N failed attempts, common security feature),
repeating it risks tripping that lockout and cascading failures into every
other test authenticating as that account. Put such tests in their own
project, run once as part of the plain `npx playwright test` pass, excluded
from the flake-gate command. (Diagnosed live, 2026-08-07: a wrong-password
test run 5× across gates 1+2+3 tripped a real 3-attempt lockout, and every
subsequent test using that account — including the *correct*-password login
— failed for an unrelated reason. Root cause took real debugging to find
because the failure signatures looked unrelated: `waitForURL` timeout on
valid login, wrong error text on the negative test, and a cascading product
click timeout, all from one shared cause.)

**Verification specs must use the same worker-indexed account isolation as
the behavioral specs — or they become the parallel-unsafe outlier.** A
`pom-verification.spec.ts` written against `@playwright/test` directly
(rather than the project's account-aware fixture) always authenticates as the
config's default `storageState`, regardless of which worker executes it.
Under `--repeat-each` with 2+ workers, two repeats of that same spec can run
**concurrently as the same real account**, racing on shared per-user state
(e.g., both reading/mutating a favorites list at once). The failure looks
like generic flakiness — "context has been closed", a click timing out on an
element that should be there — but the actual cause is two browser contexts
mutating one account simultaneously. Fix: verification specs consume the
same worker-indexed `account`/`api` fixtures as everything else, and
self-seed their own target data rather than reading ambient state that
another concurrent worker might also be touching.

### Worker-indexed accounts (proven template)

```ts
// global-setup.ts: one API login per account → .auth/worker-{i}.json
// (for localStorage-token apps, synthesize storageState:
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
  storageState: async ({ account }, use) => {          // built-in option override
    await use(path.resolve(__dirname, account.stateFile));
  },
});
```

Specs must be account-agnostic: assert `account.name`, never a hardcoded user.
Self-seed per-user preconditions (`ensureX` helpers) — never rely on one
account's seed data.

---

## Templates
<!-- qab: id=templates -->

### Stateless functional POM
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
    await locators.itemRows(page).first().waitFor(); // response ≠ rendered
  },
  async deleteByName(page: Page, name: string) {
    const row = locators.rowByName(page, name);
    await expect(row, `row "${name}" must exist`).toHaveCount(1); // fail loudly
    await row.getByTestId('delete-button').click();               // row-scoped
    await expect(row).toHaveCount(0);
  },
};
```

Class-based POM (small team, long flows): same rules, shallow `BasePage` at
most — no deep inheritance. Fixture-injected POM (many page objects): inject
instances via fixtures to kill construction noise.

### Thin API client + disposal context
```ts
// fixtures.ts
export type DisposalContext = [APIClientFunction, ...unknown[]][];
export const test = base.extend<{ disposalContext: DisposalContext }>({
  disposalContext: [async ({ request }, use) => {
    const ctx: DisposalContext = [];
    await use(ctx);
    while (ctx.length) {              // LIFO — runs even when the test failed
      const [fn, ...args] = ctx.pop()!;
      await fn(request, ...args);
    }
  }, { auto: true }],
});

// client.ts — creation queues its own undo; cleanup helpers are idempotent
export const createItem = async (request, name, disposalContext, expStatusCode = 201) => {
  const response = await request.post('/api/items', { data: { name } });
  expect(response.status()).toBe(expStatusCode);
  if (response.status() === 201) disposalContext?.push([deleteItemIfExists, name]);
  return response;
};
export const deleteItemIfExists = async (request, name) => {
  const found = (await listItems(request)).find((i) => i.name === name);
  if (found) await deleteItem(request, found.id);    // "already gone" = success
};
```

Global-state tests use **delete-with-undo**: each deletion queues its own
recreation into the disposal context, so shared data is restored even when the
assertion fails.

### Network-aware synchronization
```ts
const refetch = page.waitForResponse((r) =>
  r.url().includes('/api/items') && r.request().method() === 'GET'); // armed BEFORE
await page.getByTestId('add-button').click();
await refetch;                                                       // response in
await expect(page.getByTestId('item-row')
  .filter({ has: page.getByText(name, { exact: true }) })).toBeVisible(); // rendered
```

### Role-variant UI via mocking
```ts
await page.route('**/api/me', (route) =>
  route.fulfill({ json: { user: 'view-only', role: 'viewer' } })); // before goto
await page.goto('/');
await expect(row.getByTestId('delete-button')).toHaveCount(0);
```
(Routes live in fixtures/clients, never in spec files. Live e2e stays thin;
error/empty/edge/role states belong to `page.route`-mocked tests.)

---

## Anti-pattern → correction
<!-- qab: id=anti-pattern-correction -->

| ❌ | ✅ |
| --- | --- |
| `await page.waitForTimeout(3000)` | wait on state: `await expect(locator).toBeVisible()` |
| `await button.click(); await page.waitForResponse(...)` | arm the promise before the click |
| `const rows = await locator.all()` (no wait) | `first().waitFor()` then `.all()` |
| `rows.nth(table.findIndex(...))` | guard `-1`, then throw |
| `expect(count).toBe(before + 1)` | `toContainEqual(objectContaining({ id }))` |
| `name: 'test-item'` / `` `x-${Date.now()}` `` | add worker+repeat entropy |
| `filter({ hasText: name })` for by-name lookup | `filter({ has: getByText(name, { exact: true }) })` |
| cleanup on the last line of the test body | disposal context or `afterEach` |
| table parse: `.all()` then per-cell `await textContent()` | atomic read via `evaluateAll` — a re-render mid-loop detaches rows and the await hangs until timeout |
| act on a parsed row via `nth(index)` | content-anchored locator (`filter({ has: getByText(value, { exact: true }) })`) — concurrent row churn silently shifts indexes |
| one-shot `expect(parsed).toContainEqual(...)` on shared-table data | `expect.poll(() => parse())` — parses don't auto-retry; concurrent renders make single snapshots flaky |
| `expect(arr).toContainEqual(wholeArray)` | `toEqual`, or pass one element |
| `baseURL: 'https://host/api'` + `get('/items')` | trailing slash `…/api/` + relative `get('items')` |
| `beforeAll(async ({ request }) => …)` | build your own context: `await request.newContext(...)` |
| per-test `newContext({ storageState })` | override the `storageState` option fixture |

## Pitfalls (debugging accelerators)
<!-- qab: id=pitfalls -->

- `request.newContext()` does **not** inherit `use.baseURL` — pass it explicitly.
- Base URLs with a path need a trailing slash + relative paths; `/items`
  *replaces* the base's `/api` under URL-join rules.
- Locator counts include hidden-but-attached elements. `toHaveCount(0)`
  failing with nothing visible → suspect a hidden element left in the DOM.
- `getAttribute('aria-expanded')` returns the string `"false"` — truthy.
  Compare `!== 'true'`.
- `reuseExistingServer: !CI` attaches to zombie servers on the port. Stale
  behavior for no reason → `lsof -ti :<port>`.
- `fullyParallel` scatters same-file tests across workers; order-dependent
  tests need `test.describe.configure({ mode: 'serial' })`.
- `.sort()` any `readdir` listing you assign to workers — order is
  platform-dependent.
- Empty states that *replace* the container (table removed, not hidden) need
  presence/absence assertions, not visibility toggles.
- Some apps render **no element at all** for empty states — assert absence of
  items and record the product observation; don't invent a message to wait for.
