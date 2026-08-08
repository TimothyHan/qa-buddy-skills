---
name: e2e-pom
version: 0.1.2
description: |
  Build and maintain Page Object Models by live element discovery — never by
  guessing selectors. Build mode pairs with the user: derives the element
  inventory from test cases, proves every locator against the running app,
  and confirms with highlighted screenshots before anything enters the POM.
  Heal mode runs autonomously when the verification spec breaks: re-discovers,
  auto-fixes unambiguous renames, flags removed elements, touches nothing else.
  Use when: "build POM", "page objects", "map elements", "heal selectors", "verification spec failing".
  Do NOT use when: initial Playwright setup (use /qa-e2e-setup), writing test specs (use /qa-e2e-write), generating test cases (use /qa-test-cases).
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

# /qa-e2e-pom: Page Object Discovery & Healing

Two modes. **Build** is interactive — the user confirms what you discovered.
**Heal** is autonomous — it repairs what drifted and flags what it can't.
Both read `playwright/AUTOMATION.md` (from `/qa-e2e-setup`) for POM style,
auth, and white-box mode. No AUTOMATION.md → run `/qa-e2e-setup` first.

**Code standards:** read `{{REFERENCE_PATH}}/playwright-patterns.md` before
writing POM code — POM templates, selector rules, and the exact-match /
scoping traps live there. Then the project learnings file (per the preamble)
— active `LRN-` entries scoped here override those patterns.

## Constraints

1. **No locator without live proof.** A selector enters the POM only after it
   was executed against the running app: resolves, expected count (1, or
   scoped n), visible. App unreachable mid-discovery → the unproven elements
   stay OUT of the POM and status is BLOCKED. Never write a plausible guess.
2. **Demand-driven inventory.** Map only elements the given test cases touch.
   If asked to "map everything while you're there", decline and explain:
   unreferenced elements are unverifiable maintenance debt — they get mapped
   when a test case needs them.
3. **Selector priority:** `getByTestId` > `getByRole(name)` > label/placeholder
   > CSS (last resort, marked `fragile: true`). Never XPath.
4. **Duplicates must be scoped, not indexed.** If a locator matches >1 element
   (hidden-but-attached ones count!), scope it to a parent (`row.getByTestId`),
   don't `.nth()` it. Ambiguity the DOM can't resolve → ask the user (build)
   or flag (heal).
5. **Name lookups are exact-match.** `filter({ hasText: name })` is substring
   matching — "Pliers" also matches "Combination Pliers". Row/card-by-name
   locators use `filter({ has: page.getByText(name, { exact: true }) })`.
   (Caught live: wrong product clicked + strict-mode violation, 2026-08-07.)
6. **The verification spec is the gate.** `pom-verification.spec.ts` must be
   green before build/heal reports DONE. It is also the drift detector — keep
   it in the suite. It uses the same worker-indexed account fixtures as
   behavioral specs and self-seeds its own target data — never the config
   default storageState directly, which makes every worker authenticate as
   the same account and race under `--repeat-each` (caught live 2026-08-07).
7. **Heal never touches healthy entries.** Only entries whose verification
   failed may change. A "fix" to a passing locator is a defect.

---

## Build Mode

### Phase B1: Element inventory from test cases

Read the test cases (KB path or file the user provides). For each TC, list the
screens it visits and the elements its steps and expectations touch. Output a
table: element → screen → source TCs. This table IS the scope; nothing else
gets discovered (Constraint 2).

### Phase B2: Live discovery

Per screen: navigate (authed via the setup's storageState), read the DOM /
accessibility tree, and collect candidate selectors for each inventory
element, ranked by Constraint 3. Capture network traffic while walking —
save request/response pairs to `playwright/api-capture.json` (this feeds
`/qa-e2e-write`'s API client for free).

### Phase B3: Prove and confirm (the pairing moment)

For each element:
1. Execute the best candidate: count, visibility. Count >1 → scope per
   Constraint 4 and re-prove.
2. Screenshot the screen with numbered highlights on every proven element.
3. Show the user one screenshot per screen: "①–⑥ mapped as listed — confirm?"
   Apply corrections, re-prove, re-confirm. Ambiguous elements (e.g., two
   candidates for "the delete button") are presented as options, never
   silently chosen.

### Phase B4: Gaps

Elements with no testid AND no unique role/name/label:
- **White-box (per AUTOMATION.md):** grep the app repo for its testid naming
  convention, generate a `data-testid` patch (propose as diff, or apply on a
  branch — whichever AUTOMATION.md records). Until merged, use the best
  fallback selector with `fragile: true`.
- **Black-box:** add to the **testability gap report** — element, why it's a
  gap, suggested testid, affected TCs — and use the fallback, `fragile: true`.

The gap report lists exactly the in-scope gaps. Out-of-scope observations may
be noted separately but never enter the inventory.

### Phase B5: Write artifacts

Per AUTOMATION.md's POM style:

```
playwright/
  pom/{screen}.page.ts           # locators + interaction helpers
  pom/inventory/{screen}.json    # the discovery record (schema below)
  pom-verification.spec.ts       # visits each screen, asserts every locator
```

Inventory entry schema:

```json
{ "element": "project row", "selector": "getByTestId('project-row')",
  "strategy": "testid", "fragile": false, "screen": "/projects",
  "sourceTCs": ["TC-02", "TC-04"], "verified": "{ISO date}",
  "status": "verified" }
```

### Phase B6: Gate

Run `npx playwright test pom-verification`. Green + user confirmations
received → DONE. Report: elements mapped, gaps (with report), fragile count.

---

## Heal Mode

Input: failing verification results (or run the spec to get them).

### Phase H1: Scope the damage

Failing locators → affected screens only. Healthy screens are out of bounds.

### Phase H2: Re-discover and diff

Re-run discovery on affected screens. For each broken inventory entry, decide:

| Finding | Action |
|---|---|
| Same element, new testid/attributes (role, accessible name, position match) | **Auto-heal:** update selector + inventory (`verified` refreshed), note old → new |
| Element no longer in the DOM | **Flag, never "fix":** inventory `status: "missing"`, list affected TCs, exclude from verification via `test.fixme` with the flag reason. A human decides if the feature moved or died. |
| Ambiguous (multiple plausible matches) | **Flag** with the candidates — do not pick one silently |

### Phase H3: Gate and report

Re-run the verification spec → green (missing elements are fixme'd, not
deleted). Report as a diff: healed (old → new selector), flagged (with
affected TCs and the question for the human), untouched count. Any edit
outside the broken set = report it as an error, revert it.

---

## Self-evaluation before output

- [ ] Every POM locator has a proof run behind it (build) / only broken entries changed (heal)
- [ ] Inventory covers exactly the test-case demand — nothing extra
- [ ] Gap report matches the in-scope gap elements exactly
- [ ] Verification spec is green
- [ ] Build: user confirmed every screen's highlights

**Status:** DONE | DONE_WITH_CONCERNS (fragile/flagged entries — list them) | BLOCKED (app unreachable, unproven elements — list them)
**Summary:** {mode}: {n} elements proven, {g} gaps, {f} flagged
**Next steps:** {/qa-e2e-write for specs | merge testid patch | human review of flagged elements}
