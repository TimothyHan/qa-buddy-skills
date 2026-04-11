---
name: test-cases
version: 0.3.0
description: |
  Generate test cases from a Jira ticket's acceptance criteria. Produces Playwright
  e2e test scenarios and a unit test checklist for developers. Test cases map back
  to requirements for traceability. Use when: "write test cases", "generate tests",
  "e2e tests for PROJ-789", "test cases for this ticket".
  Do NOT use when: reviewing ticket testability (use /review-ticket), executing tests (use /qa), exploring the app (use /exploratory).
tool-groups:
  - bash
  - read
  - write
  - edit
  - glob
  - grep
  - agent
  - ask
  - jira
  - confluence
preamble-tier: 2
---

# /test-cases: Generate Test Cases from ACs

You are an SDT partner generating test cases for a ticket. You pull the ticket's
ACs from Jira, cross-reference the epic test plan, and produce:
1. Playwright e2e test scenarios (ready to implement)
2. Unit test checklist (for developers)
3. Requirements-to-test mapping (for traceability)

## Constraints

1. **Match the project's test style.** Read existing Playwright tests first. Use the same patterns, imports, helpers, page objects.
2. **Playwright sketches are starting points,** not final code. Make them close enough to be useful but don't over-engineer.
3. **Every test case traces to a requirement.** No orphan tests. No untested ACs.
4. **Unit test checklist is for devs.** Keep it brief and actionable — describe what to test, not how.
5. **Don't duplicate existing tests.** If a scenario is already covered, reference it instead of creating a new one.
6. **Prioritize ruthlessly.** A ticket with 3 ACs doesn't need 30 test cases. Focus on what catches real bugs.

---

## Phase 1: Gather Context

**Input:** User provides a ticket key (e.g., `PROJ-789`) or pastes ticket details.

1. **Read `.qabuddy.json`** (if exists) for context source and team mode.
   - `contextSource: "spec"` → search workspace for spec files before asking
   - `contextSource: "chat"` → skip Jira, ask SDT for context directly
   - `contextSource: "jira"` or no config → current behavior

2. **Read methodology references** from `{{REFERENCE_PATH}}/playbook/`:
   - `test-distribution.md` — assign tests to lowest appropriate layer, deduplication rules
   - `test-types.md` — manual vs automation, UAT vs functional distinction
   - `maintenance-and-ci.md` — browser matrix (Playwright runs Chrome, Firefox, Safari, Edge)

3. **Pull ticket** (Jira MCP if available, otherwise ask the SDT to provide or point to a file):
   - Summary, description, ACs
   - Parent epic key
   - UI mockups or design links (from attachments or comments)
   - Linked Confluence pages (design specs, PRDs, API docs)

4. **Pull linked Confluence pages** (if any):
   - Read linked pages for detailed specs, data models, API contracts, UI flows
   - Extract testable requirements not in the ACs (validation rules, error codes, edge cases)

5. **Load the epic test plan** (if exists):
   - Read `features-kb/features/{EPIC-KEY}/test-plan.md`
   - Check which scenarios from the test plan map to this ticket

6. **Read existing tests in the repo:**
   - Scan the Playwright test directory for related tests
   - Learn naming conventions, page object patterns, test data setup, test style

7. **Check existing test cases for this ticket:**
   - `features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md`
   - If they exist, this is an update, not a fresh creation

---

## Phase 2: Design Test Cases

### E2E Test Cases (Playwright)

For each AC, generate one or more test cases:

```markdown
### TC-{NNN}: {Test case title}

**Requirement:** AC #{N} from {TICKET-KEY}
**Priority:** P0 | P1 | P2
**Type:** happy-path | negative | edge-case | boundary

**Preconditions:**
- {setup required}

**Steps:**
1. Navigate to {page}
2. {action}
3. {action}

**Expected Result:**
- {observable outcome}

**Playwright Sketch:**
```typescript
test('{test title}', async ({ page }) => {
  // Arrange
  await page.goto('{url}');

  // Act
  await page.getByRole('{role}', { name: '{name}' }).click();
  await page.getByLabel('{label}').fill('{value}');

  // Assert
  await expect(page.getByText('{expected}')).toBeVisible();
});
```
```

**Minimum coverage per AC:**
- 1 happy path, 1 negative case, boundary cases if applicable

**Priority rules:**
- **P0:** Core user flow — must pass before merge
- **P1:** Error handling, validation, edge cases — should pass before release
- **P2:** Polish, performance, uncommon paths

### Unit Test Checklist (for developers)

```markdown
## Unit Test Checklist

### {module/file}
- [ ] {function}: returns correct result for {typical input}
- [ ] {function}: handles {edge case} (null, empty, overflow)
- [ ] {function}: throws/returns error for {invalid input}
- [ ] {validation}: rejects {specific invalid data}
- [ ] {state transition}: moves from {state A} to {state B} correctly
```

---

## Phase 3: Requirements Traceability

Create a mapping from requirements to test cases:

```json
{
  "ticket": "PROJ-789",
  "epic": "PROJ-123",
  "mappings": [
    {
      "requirement": "AC #1: ...",
      "e2e_tests": ["TC-001"],
      "unit_tests": ["validate-form-data"],
      "coverage": "full"
    }
  ],
  "unmapped_requirements": [],
  "test_gaps": []
}
```

**Coverage values:** `full` (all aspects tested) | `partial` (gaps noted in `test_gaps`) | `none` (flag clearly)

---

## Phase 4: Self-Evaluation

Before saving, verify consistency across all three artifacts. Fix issues found. One pass — no looping.

1. Every AC in `mappings` has at least one test case; `unmapped_requirements` lists any AC with zero tests
2. `coverage: "full"` means happy path + negative + boundaries tested; downgrade to `"partial"` otherwise
3. No new test case duplicates an existing Playwright test — replace with a reference if so
4. Unit test checklist items checked against existing unit tests for overlap
5. P0/P1/P2 distribution: not >50% P0, and at least one P0 exists for the core happy path
6. Playwright sketches match project conventions (import style, page object pattern, assertion style)

---

## Phase 5: Output

### Save test cases document:
`features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}.md`

### Save traceability mapping:
`features-kb/features/{EPIC-KEY}/test-cases/{TICKET-KEY}-mapping.json`

### Present to SDT:
- "Any scenarios missing?"
- "Should any P1s be promoted to P0?"
- "Any test data concerns?"

### Update epic test plan (if exists):
Update status column in `features-kb/features/{EPIC-KEY}/test-plan.md` for scenarios that now have test cases.

**Suggest next step:** "Test cases ready. When the feature is ready, run `/qa {TICKET-KEY}` to execute them."

**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {what the SDT should do next, or "none"}

---

## Batch Mode

If user says "test cases for PROJ-1, PROJ-2, PROJ-3":
- Process each ticket, then show a summary:

```markdown
| Ticket | E2E Tests | Unit Tests | Coverage | Gaps |
|--------|-----------|------------|----------|------|
```
