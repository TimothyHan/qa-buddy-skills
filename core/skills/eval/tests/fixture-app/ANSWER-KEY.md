# Fixture App Answer Key — ground truth for e2e skill evals

This file is the grading oracle for `/e2e-setup`, `/e2e-pom`, and `/e2e-write`
eval fixtures. Every assertion in those suites derives from a fact recorded here.
If you change `server.js`, update this file in the same commit.

**⚠️ Skills under eval must never read this file.** It exists for the eval
harness only. A skill that greps the answer key instead of discovering the app
live has cheated the eval.

---

## App facts

- URL: `http://localhost:4173` (override with `PORT`)
- Auth: **cookie session** (`sid`, HttpOnly) via `POST /api/auth/login`
  → correct `/e2e-setup` recommendation: **storageState** (global setup or
  worker-scoped). Token-in-localStorage strategies are wrong for this app.
- Credentials: `qa@acme.test` / `demo123` (single account → workers=1 unless
  the setup skill flags the single-account constraint)
- No OpenAPI spec is served → API discovery must come from network capture.
- Seed data: 2 projects — "Website Redesign" (active), "Mobile App" (paused).
- `POST /api/reset` reseeds state. **Eval-harness hook only** — generated
  suites must not depend on it (real apps don't have one); cleanup must go
  through `DELETE /api/projects/:id`.

## API surface (discoverable via network capture during UI walk)

| Endpoint | Method | Success | Errors |
|---|---|---|---|
| `/api/auth/login` | POST | 200 + Set-Cookie | 401 bad creds |
| `/api/me` | GET | 200 `{email,name,role}` | 401 |
| `/api/projects` | GET | 200 `{projects:[…]}` (~120ms latency) | 401 |
| `/api/projects` | POST | 201 project | 400 empty name, 409 duplicate name |
| `/api/projects/:id` | DELETE | 204 | 404, 401 |

The 409-on-duplicate makes hardcoded test data names fail on re-runs —
parallel-safe unique naming (`` `${prefix}-${Date.now()}` ``) is required, not
stylistic.

## Element inventory (v1)

### Elements WITH stable hooks

| Element | Selector (expected strategy) | Page |
|---|---|---|
| Email input | `getByTestId('login-email')` | /login |
| Password input | `getByTestId('login-password')` | /login |
| Sign-in button | `getByTestId('login-submit')` | /login |
| Login error message | `getByTestId('login-error')` | /login |
| New project button | `getByTestId('new-project-button')` | /projects |
| Project row | `getByTestId('project-row')` | /projects |
| Row delete button | `getByTestId('project-delete-button')` (must be **row-scoped** — see traps) | /projects |
| Name input (modal) | `getByTestId('project-name-input')` | /projects |
| Create submit (modal) | `getByTestId('project-create-submit')` | /projects |
| Cancel (modal) | `getByRole('button', { name: 'Cancel' })` — no testid but unique role+name, **not a gap** | /projects |
| Keep (confirm dialog) | `getByRole('button', { name: 'Keep' })` — not a gap | /projects |

### Testability gaps (no testid AND no unique role/name) — the gap set

| # | Element | Why it's a gap | Referenced by test case? |
|---|---|---|---|
| G1 | Search input (`input.s`) | no testid, no label, no placeholder | yes — TC-05 |
| G2 | Status filter dropdown (`div.dd`) | div soup: no role, no testid | **no** |
| G3 | Empty state (`p.empty`) | bare `<p>`, text match only | yes — TC-06 |
| G4 | Toast (`div.toast`) | no testid + auto-dismisses | yes — TC-02/TC-03 |

**Expected `/e2e-pom` gap report for TC-01…TC-06: exactly {G1, G3, G4}.**
G2 must NOT appear in the inventory or gap report (no test case touches it) —
its presence means the skill over-scraped. Listing G2 in a "seen but out of
scope" note is acceptable; putting it in the inventory is a fail.

## Planted traps (v1) — which rule each one examines

| Trap | Mechanism | Rule under exam |
|---|---|---|
| Late re-render | list refreshes **350ms after** POST/DELETE response resolves | two-stage wait: `waitForResponse` ≠ rendered |
| Auto-dismiss toast | removed from DOM after 1500ms | don't race auto-disappearing components |
| Duplicate "Delete" | every row's delete + the always-attached hidden confirm-dialog "Delete" share one accessible name | locator uniqueness proof; row-scoping; hidden-but-attached counts in `toHaveCount` |
| List latency | GET /api/projects takes ~120ms | no `waitForTimeout`, state-based waits |
| 409 on duplicate name | server rejects reused names | unique test data names; cleanup discipline |
| Empty-state swap | table is **removed** (not hidden) when list is empty | assert presence/absence correctly |

## v2 mutations (heal-mode exam) — `APP_VARIANT=v2`

| Change | Expected heal outcome |
|---|---|
| `project-row` → `project-list-row` | **auto-heal** (same element: role/structure/position unchanged) |
| `project-delete-button` → `project-remove-button` (accessible name still "Delete") | **auto-heal** |
| Search input removed from DOM | **flag, do not "fix"** — report: element gone, TC-05 affected |
| Everything else | **zero changes** — any edit to a healthy inventory entry is a precision failure |

Heal score: 2 auto-heals + 1 flag + 0 false edits = pass.

## v3 behavior bug (negative control) — `APP_VARIANT=v3`

`DELETE /api/projects/:id` returns 204 but does **not** remove the project.
DOM is identical to v1.

A generated suite for TC-01…TC-06 run against v3 must go **red on every
delete-dependent test and stay green on the rest**. Empirically (first green
suite, 2026-08-07) that is 3 failures: TC-04 (UI delete), the API-client
delete round-trip smoke, and TC-06 (its delete-all precondition silently
fails) — with all non-delete tests passing. More detections of the same bug
are fine; a red non-delete test is not. A suite that passes fully against v3
cannot detect this bug and fails the eval regardless of its v1 results.

## Correct `/e2e-setup` decisions for this app

| Decision | Correct answer |
|---|---|
| Auth strategy | cookie storageState via global setup (probe must find `POST /api/auth/login` + Set-Cookie) |
| Accounts / parallelism | 1 account, no registration API, projects are a **global single tenant** → `workers ≥ 2` (min-2 policy) with a dependent `global-state` Playwright project for tests that mutate shared state (delete-all/empty-state); entity-scoped tests run in the parallel phase. `workers: 1` is a FAIL. |
| Test-attribute convention | `data-testid` (Playwright default — no `testIdAttribute` override needed) |
| API discovery source | network capture (no OpenAPI served) |
| Config sanity | `npx playwright test --list` exits 0 against the scaffold |
