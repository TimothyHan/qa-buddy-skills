# Test Cases — tags (Project tags)

**Source:** `docs/specs/tags.md`
**Epic:** tags

## Blocker: acceptance criteria are not usable as written

`docs/specs/tags.md` contains:

| AC | Statement |
|---|---|
| AC1 | As a <role> I want <feature> so that <benefit> |
| AC2 | TBD |

- **AC1** is the unfilled user-story template (`<role>`, `<feature>`, `<benefit>` placeholders), not an actual acceptance criterion.
- **AC2** is explicitly `TBD`.
- Notes: "Design not final. Tag colours to be decided with marketing."

The spec body describes intent in one sentence ("As a user I want to tag projects so that I can find them faster") but gives no testable detail: no field/control names, no tag data model (free text vs. fixed set vs. colored labels), no limits (max tags per project, max tag length, duplicate handling), no scope (who can create/apply/remove tags), and no UI location.

Per this skill's constraints — every test case must map to a requirement, and observations/labels must be verified or explicitly marked `(unverified)` — generating specific E2E steps or unit-test checklist items here would mean inventing the feature's behavior rather than testing it. No steps were fabricated.

**Live-app check:** skipped (`--headless`).

## Requirement traceability

```json
{
  "ticket": "tags",
  "epic": "tags",
  "mappings": [],
  "unmapped_requirements": [
    "AC1: unfilled template placeholder — no role/feature/benefit specified",
    "AC2: TBD — no content"
  ],
  "test_gaps": [
    "Entire feature: acceptance criteria contain no testable detail (data model, limits, scope, UI location all unspecified)",
    "Tag colours explicitly called out in spec as not yet decided with marketing"
  ]
}
```

## What's needed before test cases can be written

1. Fill in AC1 with a concrete role/feature/benefit statement.
2. Replace AC2 (`TBD`) with an actual acceptance criterion.
3. Specify at minimum: how a tag is created/applied/removed, whether tags are free-text or a fixed set, any length/count limits, and whether tags are per-user or shared across a project's collaborators.
4. Resolve the open design question on tag colours (or explicitly scope it out of this ticket).

---

**Status:** NEEDS_CONTEXT
**Summary:** `docs/specs/tags.md` has no usable acceptance criteria (AC1 is the unfilled template, AC2 is TBD) — test cases cannot be generated without inventing the feature's behavior.
**Next steps:**
- SDT/PM to fill in real acceptance criteria in `docs/specs/tags.md` (see checklist above), then re-run `/qa-test-cases tags`.
- Auto-decision (headless run, no interactive review pause available): rather than fabricating placeholder-driven test cases, this run stopped at the traceability gap and recorded it here per constraint "observation beats assumption."
