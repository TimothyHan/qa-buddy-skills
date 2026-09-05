# Scoring sheet — test-cases · control-traceability

Source: control · case projects-happy · from tests/controls/traceability.md

Read the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.

## traceability (weight 3, floor 2)

Every AC has at least one test case, every test case names its AC, and any AC without a case is listed as a gap (unmapped_requirements or test_gaps).

- **0** — At least one AC has no test case and is not listed as a gap anywhere.
- **1** — Every AC is either covered or listed as a gap, but at least one test case names no AC or names an AC that does not exist.
- **2** — Complete and every case names its AC; one inconsistency between the cases document and the mapping (e.g. a TC in the mapping that is not in the document).
- **3** — Complete, every case names its AC, the mapping and the document agree exactly, and gaps are listed by AC.

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
