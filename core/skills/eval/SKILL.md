---
name: eval
version: 0.5.0
description: |
  Run eval fixtures against a skill to verify it produces correct output.
  Two modes per fixture: simulate (read SKILL.md, simulate the scenario, check
  assertions) and execute (run the skill's generated artifacts against the
  local fixture app and grade via exit codes and file checks). Use after
  /qa-improve to verify fixes didn't break anything.
  Use when: "eval", "run evals", "test skill", "check fixtures", "regression test".
  Do NOT use when: running actual QA on an app (use /qa-qa), improving a skill (use /qa-improve), checking sprint status.
tool-groups:
  - bash
  - read
  - write
  - glob
  - grep
  - ask
  - browser
preamble-tier: 1
---

# /qa-eval: Skill Eval Testing

You run eval fixtures against a skill to verify it produces correct output.
Each fixture declares its mode:

- **`simulate`** (default) — read the skill's instructions, simulate the
  scenario, check assertions against the hypothetical output. For skills whose
  output is prose (reports, verdicts, plans).
- **`execute`** — actually run the skill against the local fixture app, then
  grade the artifacts it produced by executing them (`npx playwright test`,
  greps, file checks). For skills whose output is code (`/qa-e2e-setup`,
  `/qa-e2e-pom`, `/qa-e2e-write`). A generated artifact passes only by running, never
  by looking right.
- **`--rubric`** (RFC 0005) — `/qa-eval <skill> --rubric` delegates to
  `node bin/eval.js run <skill>`: the skill runs headless on the target model,
  a separate Opus judge scores each artifact against `tests/rubric.json`, and
  controls are judged first. The summary is the generated `report.md`
  (per-criterion means, spread, floor breaches, verdict) — never re-grade its
  scores by hand. For a skill whose rubric is calibrated, simulate-mode
  fixtures are deprecated as a quality signal; they stay as the free
  structural gate.

## Constraints

1. **One skill at a time.** Don't run all skills in one session — context window.
2. **Follow the skill's instructions exactly.** When simulating or executing, you are that skill. Apply its constraints, phases, and methodology references.
3. **Grade honestly.** If an assertion fails, report it — don't rationalize a pass.
4. **Assertions are literal.** `contains "READY"` means the string "READY" appears in the output. Don't interpret loosely.
5. **Simulate mode never touches the real environment** — no browsers, no Jira, no file writes.
6. **Execute mode touches ONLY the local fixture app and a scratch workspace.** Never external systems: no Jira, no real staging URLs, no network beyond `localhost`. All generated artifacts go in a throwaway workspace directory, never the QABuddy repo.
7. **Never open `ANSWER-KEY.md` while acting as the skill under eval.** The answer key is for grading only. Discovery must happen against the running app. Reading the key mid-simulation invalidates the fixture — report it as a harness error, not a pass.
8. **Scripted user responses replace the user.** Execute fixtures include `user_responses` for the skill's interactive gates. Answer exactly as scripted. If the skill never asks at a gate where a response was scripted, that's a finding — several fixtures assert the skill *does* pause.

---

## Phase 1: Load Skill and Fixtures

**Input:** Skill name (e.g., `qa`, `review-ticket`, `test-plan`)

1. **Read the skill:** `core/skills/{skill}/SKILL.md`
2. **Read the fixtures:** `core/skills/{skill}/tests/fixtures.json`
3. **Read the preamble** that would be injected (based on `preamble-tier`)

If fixtures.json doesn't exist: "No fixtures found for {skill}. Create them at `core/skills/{skill}/tests/fixtures.json`."

Report: "{N} fixtures loaded for {skill} v{version}."

---

## Phase 2: Run Fixtures

For each fixture in order, branch on `mode` (`simulate` when absent → 2a–2d;
`execute` → 2E).

### 2a. Setup
- Read the fixture's `input` (scenario description, preconditions)
- Read the fixture's `assertions` (what to check)

### 2b. Simulate
- You ARE the skill. Given the input scenario, follow the SKILL.md instructions phase by phase.
- Produce the output the skill would generate (report, verdict, tables, status block).
- Keep it concise — you don't need the full output, just enough to check assertions.

### 2c. Grade
For each assertion, apply the operator:

| Operator | How to check |
|----------|-------------|
| `eq` | Output field exactly matches the value |
| `contains` | Output includes the string somewhere |
| `not_contains` | Output does NOT include the string — fails if found |
| `matches` | Output matches the regex pattern |
| `exists` | The field or section is present and non-empty |
| `length_eq` | Array/list has exactly N items |
| `length_gte` | Array/list has at least N items |

Record: PASS or FAIL with evidence (quote the relevant output).

### 2E. Execute-mode fixtures

Execute fixtures carry three extra blocks:

```json
{
  "id": "fx-101",
  "mode": "execute",
  "description": "Generated suite goes red on v3 (negative control)",
  "env": { "variant": "v3", "port": 4173 },
  "input": { "task": "…what to run the skill on…" },
  "user_responses": { "confirm-highlights": "confirm all", "auth-strategy": "accept recommendation" },
  "assertions": [ … ]
}
```

**Runner protocol:**

1. **Workspace.** Create (or reuse for the session) a scratch directory outside
   the QABuddy repo. All artifacts the skill generates live there.
2. **Fixture app up.** From `core/skills/eval/tests/fixture-app/`:
   `APP_VARIANT={env.variant} PORT={env.port} node server.js` in the background.
   `POST /api/reset` before the fixture (and between fixtures sharing a server).
3. **Run the skill for real.** Follow the target skill's SKILL.md phase by
   phase in the workspace, against `http://localhost:{port}`. At interactive
   gates, answer from `user_responses` — nothing else. Real browsing, real
   file writes (workspace only), real `npx playwright test`.
4. **Grade.** Apply the assertions (operators below). Quote command output as
   evidence.
5. **Teardown.** Kill the fixture app. Keep the workspace until the summary is
   written (evidence), then it's disposable.
6. **Workspace state across fixtures.** A fixture that mutates shared workspace
   artifacts (e.g., heal mode rewriting the POM) must not leak that state into
   fixtures expecting the original build. Snapshot before mutating (git commit
   in the workspace, or a copy) and restore afterward. Preserve the mutated
   snapshot as evidence.

**Execute-mode assertion operators** (in addition to the simulate table; the
`file:` prefix works in both modes):

| Field prefix / operator | How to check |
|----------|-------------|
| `cmd:{command}` + op `exit_code` | Run `{command}` in the workspace; exit code must equal value |
| `cmd:{command}` + op `output_contains` / `output_matches` | Run it; check stdout+stderr |
| `files:{glob}` + op `not_contains` | Grep every file matching the glob; FAIL if the pattern appears anywhere |
| `files:{glob}` + op `contains` | Pattern must appear in at least one matching file |
| `file:{path}` + op `exists` / `json_valid` | File exists / parses as JSON |
| `count:{files-glob or json-path}` + op `eq` / `lte` | Count matches / array length equals or is at most value |

Playwright runs use the workspace's own config; pass `--reporter=line` and
capture the exit code — that IS the grade for pass/fail assertions. For flake
gates use `--repeat-each=N` as specified in the fixture's command. If a
command needed by an assertion can't run at all (missing dependency, config
crash), every assertion depending on it FAILS with that evidence — a fixture
is never skipped silently.

### 2d. Report per fixture (both modes)

```
Fixture: {id} — {description}
  ✓ contains "READY" — found in verdict line
  ✓ contains "AC Assessment" — found in output section header
  ✗ contains "Given" — not found in missing scenarios table
  Result: 2/3 PASS
```

---

## Phase 3: Summary

After all fixtures:

```markdown
# Eval Results: {skill} v{version}

| Fixture | Description | Pass | Fail | Result |
|---------|-------------|------|------|--------|
| fx-001 | {description} | 3 | 0 | PASS |
| fx-002 | {description} | 2 | 1 | FAIL |

## Summary
- Fixtures: {N} total, {passed} passed, {failed} failed
- Assertions: {N} total, {passed} passed, {failed} failed
- **Pass rate: {%}**

## Failed Assertions
| Fixture | Assertion | Evidence |
|---------|-----------|----------|
| fx-002 | contains "Given" | Not found in output |

**Status:** DONE | DONE_WITH_CONCERNS
**Summary:** {skill} eval: {pass_rate}% ({passed}/{total} fixtures)
**Next steps:** {fix the failed assertions via /qa-improve, or "all passing"}

With `--rubric`, replace this summary with `eval.js`'s `report.md` verbatim and quote its verdict line as **Summary**.
```
