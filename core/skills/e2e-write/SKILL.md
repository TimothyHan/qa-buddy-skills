---
name: e2e-write
version: 0.1.1
description: |
  Write the e2e test suite from test cases: API client for preconditions,
  fixtures, and intent-only specs on top of a proven POM. Never invents
  locators — if a page has no POM, it invokes /e2e-pom first. Done only when
  the suite passes three gates: green, green again (cleanup proof), and green
  under --repeat-each=3 (flake proof), plus a mechanical lint of banned patterns.
  Use when: "write e2e tests", "automate test cases", "generate the test suite", "API client for tests".
  Do NOT use when: setting up Playwright (use /e2e-setup), building/healing page objects (use /e2e-pom), manual test execution (use /qa).
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

# /e2e-write: Test Suite Generation

Turn test cases into a passing, re-runnable, flake-free suite. Reads
`playwright/AUTOMATION.md` (decisions) and the POM + inventory from
`/e2e-pom`. The vocabulary is the POM and API client; the specs carry intent
only.

**Code standards:** read `{{REFERENCE_PATH}}/playwright-patterns.md` before
writing client, fixture, or spec code — templates (disposal context,
worker-indexed accounts, network sync), the matcher table, and the
anti-pattern list live there. The Phase 5 lint enforces its NEVER section.
Then the project learnings file (per the preamble) — active `LRN-` entries
scoped here override those patterns.

## Constraints

1. **Never invent a locator.** Specs and helpers use POM exports only. A page
   without a POM → invoke the `/e2e-pom` skill (build mode) and continue after
   its gate passes. Writing `getByTestId(...)` for an unmapped element inline
   is the defining failure of this skill.
2. **Specs are intent-only.** No `page.locator(`, no raw CSS/XPath, no
   `page.route(` in spec files — selectors live in the POM, routes/requests in
   the API client or fixtures.
3. **Preconditions via API, not UI.** Seed state with the API client. UI
   seeding only where no API call was observed for the operation — and flag it
   as debt in the report.
4. **Parallel-safe data.** Entity names need worker+repeat entropy —
   `Date.now()` alone collides when concurrent workers or `--repeat-each`
   instances hit the same millisecond (caught live 2026-08-07). Use a helper:
   `` `${prefix}-${Date.now()}-w${workerIndex}r${repeatEachIndex}` ``.
   Never assert global counts (`before + 1`) — assert your entity by name/id.
   The suite runs with ≥2 workers (AUTOMATION.md records the count and the
   isolation strategy) — tests touching the **shared-state features setup
   flagged** go in the dependent `global-state` project, never the parallel one.
5. **Clean up what you create, through public API.** Disposal context or
   `afterEach`/`afterAll` — never inline at the test body's end (skipped on
   failure), and never via test-env-only hooks (e.g., a reset endpoint):
   suites must survive on environments that don't have them.
6. **State-based waits only.** No `waitForTimeout`. Actions that trigger async
   fetches get two-stage waits: `waitForResponse` (promise created BEFORE the
   action) → then assert the rendered element. Response received ≠ rendered.
7. **Never race auto-disappearing UI.** Toasts and transient banners: assert
   the durable outcome (row exists / count via entity) instead, or catch the
   toast with a web-first assertion immediately after the triggering action —
   never after another wait.
8. **No red gate, no DONE.** Honest status is a gate of its own (Phase 5).

---

## Phase 1: Inputs

- Test cases (KB path or file) — the spec's source of truth
- `playwright/AUTOMATION.md` — missing → run `/e2e-setup` first, stop
- POM + inventory for every screen the TCs touch — missing/incomplete →
  invoke `/e2e-pom` build mode for the missing screens (Constraint 1)
- `playwright/api-capture.json` if `/e2e-pom` saved one; OpenAPI spec if
  AUTOMATION.md says one exists

## Phase 2: API Client

From the OpenAPI spec or the network capture, generate a thin client for the
operations the TCs need (seeding + cleanup + the mutations under test):

- One function per endpoint; asserts the status code internally
  (`expect(response.status()).toBe(expStatusCode)`), expected code is a
  parameter so negative tests can pass 4xx.
- Creation functions queue their own undo into the disposal context.

**Gate 2:** smoke-call each function once against the env — create → verify →
delete round-trip, **including the negative paths the suite will rely on**
(duplicate create, delete-nonexistent). Status conventions vary per app
(404 vs idempotent 204) — assert what the API actually returns, never the
convention you'd expect. A client function that has never executed is a guess.

## Phase 3: Fixtures

- Auth: already provided by setup's storageState — do not re-implement login
- `disposalContext` auto-fixture: LIFO undo queue, runs even when the test fails
- Option fixtures for suite parameters (name prefix, feature flags)

## Phase 4: Specs

One `describe` per feature area. Per test case:

- Test title carries the TC id: `test('TC-04: delete a project', …)`
- `test.step` per requirement-level step, named like the TC's steps
- Preconditions in `beforeEach`/fixtures via the API client (Constraint 3)
- Waits per Constraints 6–7; matcher choice: full-array order → `toEqual`,
  one element present → `toContainEqual`, partial object → `toMatchObject`
- Empty/edge states: seed the exact state via API (e.g., delete all owned
  entities), don't assume environment emptiness

## Phase 5: Gates — all four, in order

1. **Green:** `npx playwright test` exits 0
2. **Green again:** immediately re-run, exits 0 — leaked data (409s, name
   collisions) fails here; fix cleanup, not the assertion
3. **Flake gate:** `npx playwright test --repeat-each=3` exits 0. When the
   config has dependent projects, repeat-each does NOT repeat dependency
   projects — flake-gate each project explicitly (`--project={name} --repeat-each=3`).
   Deterministic negative-auth tests (wrong password, etc.) don't belong under
   `--repeat-each` — they can't reveal a timing flake, and if the app has
   brute-force lockout, repeating them risks tripping it and cascading
   failures into every other test on that account. Give them their own
   project, run once (caught live 2026-08-07 — see playwright-patterns.md).
4. **Mechanical lint** — grep the generated files; any hit is a failure:

| Pattern | Where banned |
|---|---|
| `waitForTimeout` | everywhere |
| `test.only` | everywhere |
| `page.locator(`, raw CSS/XPath | spec files |
| `page.route(` | spec files |
| hardcoded entity names (no `Date.now()` in data factory) | specs/fixtures |
| test-env-only endpoints (reset/seed hooks) | everywhere |

Gate failed after honest attempts to fix → report DONE_WITH_CONCERNS or
BLOCKED with the failing gate's output. Flaky ≠ done: a suite that passed
once but fails `--repeat-each` is reported as flaky, with the failing test
named — never as DONE.

## Phase 6: Report

- TC → spec traceability table (TC id, spec file, status)
- Coverage: automated / blocked (and why: fragile selector, missing API, flagged element)
- Debt: UI-seeded preconditions, fragile selectors in use
- KB pointer update if a features KB is configured: feature → suite location, covered TCs

## Self-evaluation before output

- [ ] Zero locators outside the POM; zero routes/requests in specs
- [ ] Every client function was smoke-executed
- [ ] All four gates ran; results reported honestly
- [ ] Every test title carries its TC id
- [ ] Cleanup proven by the second consecutive green run

**Status:** DONE | DONE_WITH_CONCERNS (name the concern) | BLOCKED (name the gate + output)
**Summary:** {n} TCs automated, {gates} gates green, {d} debt items
**Next steps:** {wire into CI | resolve debt items | /e2e-pom heal if verification drifts}
