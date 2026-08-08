---
name: e2e-setup
version: 0.1.2
description: |
  Set up Playwright e2e automation tailored to this team and app. Probes the
  running app (auth mechanism, API surface, spec availability), interviews with
  recommendations instead of open questions, scaffolds the playwright/ folder,
  and records every decision in playwright/AUTOMATION.md for the other e2e
  skills to read. Setup is not done until the scaffold has executed green.
  Use when: "e2e setup", "set up playwright", "configure test automation", "automation setup".
  Do NOT use when: building page objects (use /qa-e2e-pom), writing test scripts (use /qa-e2e-write), general QABuddy config (use /qa-setup).
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

# /qa-e2e-setup: Playwright Automation Setup

Configure Playwright for this team's app, once. Everything decided here is
recorded in `playwright/AUTOMATION.md` — `/qa-e2e-pom` and `/qa-e2e-write` read it
on every run instead of re-asking.

**Code standards:** read `{{REFERENCE_PATH}}/playwright-patterns.md` before
generating any config, fixture, or spec — it carries the decision tables,
templates, and pitfalls this skill's scaffold must follow. Then the project
learnings file (per the preamble) — active `LRN-` entries scoped here
override those patterns.

## Constraints

1. **Probe before asking.** Anything discoverable from the running app (auth
   mechanism, API spec, session storage) is probed, never asked.
2. **Recommend, don't open-question.** Every interview step presents a
   recommendation derived from the probe, marked "(Recommended)", with
   alternatives. Never ask "what authentication strategy would you like?"
   without a recommendation attached.
3. **Every decision lands in AUTOMATION.md.** If it isn't recorded, it will be
   re-asked later — that's a defect.
4. **Setup is done only when the scaffold has executed.** `npx playwright test
   --list` must exit 0 AND the generated smoke spec must pass against the app.
   Until then the status is BLOCKED, not DONE.
5. **Credentials go in `.env` (gitignored), never in committed files or chat.**

---

## Phase 1: Inputs

Collect from the user (or the invoking context):

- App base URL (local or pre-production)
- Test account credentials + **how many test accounts exist** (caps parallelism)
- Target repo/directory for the automation code

Check for an existing setup: `playwright/AUTOMATION.md` present → show it and
ask reconfigure-or-keep, like `/qa-setup` does with `.qabuddy.json`.

## Phase 2: Probe the App

Open the base URL in the browser and record, in this order:

1. **Auth mechanism.** Is there a login form? Perform one login with the test
   account while capturing network traffic. Determine:
   - Endpoint + method (e.g., `POST /api/auth/login`)
   - Session carrier: `Set-Cookie` (cookie session) vs token in response body
     stored to localStorage vs SSO redirect (domain changes to an IdP)
2. **API spec availability.** Try `/api/docs`, `/openapi.json`, `/swagger.json`,
   `/docs`. If none respond, note: API discovery will come from **network
   capture** during UI walks (no OpenAPI available).
3. **Test-attribute convention.** Inspect the DOM for `data-testid` vs
   `data-test` vs `data-cy`. If it isn't `data-testid`, the config MUST set
   `use.testIdAttribute` — and note that raw Playwright scripts (outside the
   runner) need `selectors.setTestIdAttribute(...)` separately.
4. **App shape.** SPA vs MPA (full page loads?), base path, obvious
   environment banner (staging/prod guard).

Report the probe result to the user in 3–5 lines before the interview.

## Phase 3: Interview (recommendation-first)

Walk these decisions. For each: state the probe evidence → recommendation →
alternatives. One decision at a time.

### 3a. Auth strategy

| Probe found | Recommend |
|---|---|
| Cookie session via login API | **storageState** via global setup; log in once, save state |
| Multiple test accounts | worker-indexed storageState files assigned by `parallelIndex` (see 3a-ii) |
| Token in localStorage | storageState still works (it captures localStorage) — global setup |
| SSO / IdP redirect | user logs in once manually, save long-lived storageState; flag renewal procedure |

### 3a-ii. Parallelism — parallel by default, never fewer than 2 workers

A suite that only passes serially is hiding ordering bugs. Recommend:

```
workers = clamp( floor(cpu_cores / 2), min = 2, max = usable accounts* )
```

Detect cores (`os.cpus().length` / `sysctl -n hw.ncpu`), present the derived
number, let the user override — but **never below 2**. Record the derivation
in AUTOMATION.md.

*Account math decides the isolation strategy:*

| Situation | Strategy |
|---|---|
| Accounts ≥ workers | **Worker-indexed accounts**: global setup logs in each account → `.auth/worker-{i}.json`; a `storageState` option fixture assigns by `parallelIndex`. Full user-state isolation. |
| Accounts < workers, registration API exists | Offer to **provision** more test accounts via the API (ask first) |
| One account / global shared state (single tenant) | Workers stay ≥2 for entity-scoped tests; tests that mutate **global or per-user shared state** go in a dependent Playwright project (`dependencies: ['parallel'], workers: 1`) that runs after the parallel phase. The per-project `workers: 1` is mandatory — `--repeat-each` spreads instances of the same file across workers, so file grouping alone does not serialize. |

Warn explicitly which features are shared state (probe: is data per-user or
global?) so `/qa-e2e-write` groups their tests accordingly.

### 3b. White-box mode

Ask once: "Is the app's source repo available to me? (path or 'no')"
- **Available** → follow-up: when elements lack stable selectors, should I
  **(A) propose** `data-testid` patches as a diff for devs (Recommended), or
  **(B) apply** them on a branch in the app repo?
- **Not available** → black-box mode: `/qa-e2e-pom` emits testability gap reports
  instead of patches.

### 3c. POM style

| Team shape | Recommend |
|---|---|
| Multiple teams share the framework | stateless functional POM (module + `page` arg) |
| Small team, long flows | class-based POM (shallow BasePage max) |
| Many page objects, construction noise | fixture-injected POM |

### 3d. Layout, CI, hygiene

- All Playwright files under a single `playwright/` folder — never mixed into `src/`
- CI system → `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`
- Reporter: `html` locally; add custom reporter only when post-processing is needed

## Phase 4: Scaffold

Generate in the target repo:

```
playwright.config.ts       # repo root, so bare `npx playwright test` works
playwright/
  AUTOMATION.md            # the decisions file (Phase 5 template)
  .auth/                   # storageState output (gitignored)
  global-setup.ts          # login via probed endpoint → save storageState
  tests/smoke.spec.ts      # goto baseURL (authed) + one visible-element assert
  .env.example             # BASE_URL, TEST_USER, TEST_PASS (real values → .env, gitignored)
```

The config lives at the repo root (test discovery ergonomics); everything
else stays under `playwright/`. Config must set `baseURL`, `testDir:
'./playwright/tests'`, wire `globalSetup`, and default `storageState` to the
saved file. The smoke spec uses only user-facing locators (`getByRole`/
`getByTestId`) — it is subject to the same spec lint as every other spec.
Install deps: `npm i -D @playwright/test` (+ browsers if missing:
`npx playwright install chromium`).

## Phase 5: Execute Gate

1. `npx playwright test --list` → exit 0 (config parses, specs discovered)
2. `npx playwright test` → smoke spec green (auth + baseURL + selector all real)

Any failure: fix and re-run. Do not report DONE with a red gate.

## Phase 6: Record Decisions

Write `playwright/AUTOMATION.md`:

```markdown
# Automation Decisions — {app name}
- Base URL: {url} | Env: {local|pre-prod}
- Auth: {mechanism probed} → {strategy}
- Parallelism: workers = {n} (cores {c} → {c/2}, min 2, capped by {accounts} accounts);
  isolation: {worker-indexed accounts | dependent global-state project for: {features}}
- API discovery: {openapi url | network capture (no OpenAPI)}
- White-box: {repo path + propose|apply | black-box}
- POM style: {functional|class|fixture-injected}
- CI: {system}; retries/forbidOnly configured
- Data hygiene: unique names required (`${prefix}-${Date.now()}`), cleanup via API
```

## Self-evaluation before output

- [ ] Every probeable fact was probed, not asked
- [ ] Every question carried a recommendation
- [ ] AUTOMATION.md records all decisions incl. parallelism constraint
- [ ] Both execute gates ran and passed
- [ ] No credentials in committed files

**Status:** DONE | BLOCKED (gate red — say which command failed and why)
**Summary:** Playwright configured for {app}: {auth strategy}, {n} workers, {POM style}
**Next steps:** Run /qa-e2e-pom to build the first page objects
