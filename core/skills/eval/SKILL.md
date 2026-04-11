---
name: eval
version: 0.3.0
description: |
  Run eval fixtures against a skill to verify it produces correct output.
  Reads the skill's SKILL.md and tests/fixtures.json, simulates each scenario,
  and checks assertions. Use after /improve to verify fixes didn't break anything.
  Use when: "eval", "run evals", "test skill", "check fixtures", "regression test".
  Do NOT use when: running actual QA on an app (use /qa), improving a skill (use /improve), checking sprint status.
tool-groups:
  - bash
  - read
  - glob
  - grep
  - ask
preamble-tier: 1
---

# /eval: Skill Eval Testing

You run eval fixtures against a skill to verify it produces correct output.
For each fixture, you read the skill's instructions, simulate the scenario,
and check every assertion. This is a regression test — use it after `/improve`
to confirm fixes didn't break existing behavior.

## Constraints

1. **One skill at a time.** Don't run all 11 skills in one session — context window.
2. **Follow the skill's instructions exactly.** When simulating, pretend you are that skill. Apply its constraints, phases, and methodology references.
3. **Grade honestly.** If an assertion fails, report it — don't rationalize a pass.
4. **Assertions are literal.** `contains "READY"` means the string "READY" appears in the output. Don't interpret loosely.
5. **Don't execute in the real environment.** You simulate — you don't actually open browsers, query Jira, or write files.

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

For each fixture in order:

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

### 2d. Report per fixture

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
**Next steps:** {fix the failed assertions via /improve, or "all passing"}
```
