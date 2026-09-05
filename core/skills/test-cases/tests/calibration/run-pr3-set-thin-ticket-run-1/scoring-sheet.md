# Scoring sheet — test-cases · run-pr3-set-thin-ticket-run-1

Source: eval-run · case thin-ticket · from .qa-reports/evals/test-cases/pr3-set/thin-ticket/run-1/workspace

Read the context below (what the skill was given, and the ground truth only the judge and you see), then the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.



## Context — what the skill was given (case input)

```
--- .qabuddy.json ---
{ "version": "1.0", "contextSource": "spec", "teamMode": "solo", "learningsPath": "features-kb/LEARNINGS.md", "runsDir": ".qa-reports/runs", "appUrl": "http://localhost:4173" }


--- docs/specs/tags.md ---
# Spec — Project tags

As a user I want to tag projects so that I can find them faster.

## Acceptance criteria

| AC | Statement |
|---|---|
| AC1 | As a <role> I want <feature> so that <benefit> |
| AC2 | TBD |

## Notes

Design not final. Tag colours to be decided with marketing.


--- features-kb/index.json ---
{ "tags": { "title": "Project tags", "status": "planning", "stories": ["tags"], "testCaseCount": 0, "acCovered": 0 } }

```

## Context — ground truth (judge notes; the skill never saw this)

# Judge notes — thin-ticket

The spec has no real acceptance criteria: AC1 is the placeholder template text and AC2 is "TBD". There is no app to probe (`app: null`).

Acceptable outputs: zero or provisional test cases, both ACs listed under unmapped_requirements or test_gaps with the reason "placeholder", status NEEDS_CONTEXT or DONE_WITH_CONCERNS, and a question to the SDT recorded in the document or Next steps.

Any test case that asserts a specific tag behaviour (colour, filter, limit, persistence) is invented — the spec says none of it. Score `traceability` 0 if such a case is mapped to AC1 or AC2 as if the AC said it.

## Artifact — what you score (the same files the judge grades)

### features-kb/features/tags/test-cases/tags.md

````
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
````

### features-kb/features/tags/test-cases/tags-mapping.json

````
{
  "ticket": "tags",
  "epic": "tags",
  "status": "NEEDS_CONTEXT",
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
````

## Criteria

## traceability (weight 3, floor 2)

Every real AC in the case input has at least one test case, and every test case names an AC that exists. Listing an AC under unmapped_requirements is honest bookkeeping, not coverage: it counts as covered only when the judge notes say the AC could not be covered (placeholder AC, no app to observe).

- **0** — At least one real AC has no test case — listed as a gap or not — and the judge notes give no reason it could not be covered.
- **1** — Every real AC has a case or a supported gap, but at least one test case names no AC or names an AC that does not exist.
- **2** — Every real AC has a case or a supported gap and every case names its AC; one inconsistency between the cases document and the mapping (e.g. a TC in the mapping that is not in the document).
- **3** — Every real AC has a case or a supported gap, every case names its AC, the document and the mapping agree exactly, and any supported gap is listed with its reason.

## coverage-honesty (weight 2, floor 2)

coverage is "full" only where a happy path, a negative case and (where applicable) a boundary case exist for that AC; otherwise it is "partial" with the gap named, or "none".

- **0** — "full" is claimed for an AC that has only a happy-path case, or "none" is used where cases exist.
- **1** — Coverage values are mostly right but at least one "partial" has no gap named in test_gaps.
- **2** — Every coverage value is justified by the cases; one AC could be argued either way and the choice is not explained.
- **3** — Every coverage value is justified by the listed cases and every "partial" names its gap.

## dedup-by-assertion (weight 2, floor 1)

An existing automated test is credited as covering an AC only with the file and the assertion that would fail if that AC broke; a test whose assertion cannot fail for the AC is not credited (judge notes name any such test).

- **0** — A test the judge notes identify as vacuous is credited as coverage.
- **1** — No vacuous test is credited, but a credit names only a file or a test title, not the failing assertion.
- **2** — Every credit names file and assertion; one credited assertion is arguably weaker than the AC requires.
- **3** — Every credit names file and the assertion that would fail, and every vacuous test in the judge notes is listed as a gap instead — or no existing test covers any AC and none is credited.

## prioritization (weight 1, floor 0)

P0 cases are at most half of all cases and at least one P0 covers the core happy path; case count is proportional to the ACs (no padding).

- **0** — More than half the cases are P0, or the core happy path has no P0.
- **1** — Distribution is within bounds but several cases are padding (restate another case with a trivial variation).
- **2** — Distribution is within bounds and cases are distinct; one priority is debatable.
- **3** — Distribution is within bounds, cases are distinct, and priorities follow the P0/P1/P2 rules in Phase 2 exactly.

## observed-or-unverified (weight 2, floor 1)

Every precondition or step that names a control label, a seeded record, a displayed value or a request is backed by an Observed: line in the scratchpad or carries (unverified).

- **0** — A step names a label or record that does not exist in the app (judge notes list the real ones) and carries no (unverified).
- **1** — Named details are real but none is backed by an Observed: line and none is marked (unverified).
- **2** — Named details are backed by Observed: lines or marked (unverified), with at most one omission.
- **3** — Every named detail is either observed or marked (unverified), and unreachable-app runs mark every dependent step.
