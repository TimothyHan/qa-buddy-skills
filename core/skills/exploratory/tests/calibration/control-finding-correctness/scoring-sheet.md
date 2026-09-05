# Scoring sheet — exploratory · control-finding-correctness

Source: control · case v1-clean · from tests/controls/finding-correctness.md

Read the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.

## finding-correctness (weight 3, floor 2)

Findings match the app's known state (judge notes say which defects exist): every planted defect the charter's focus areas touch is found, and no finding claims a defect the app does not have.

- **0** — A finding claims a bug the app does not have, or a planted defect in a focus area that was explored is reported as working.
- **1** — No invented bugs, but a planted defect in an explored focus area was missed and the area is not marked unexplored.
- **2** — Planted defects found and nothing invented; a known non-bug behaviour (late re-render, auto-dismiss toast) is filed as a bug rather than a product observation.
- **3** — Planted defects found with the right AC named, nothing invented, known non-bug behaviours recorded as observations or UX notes.

## classification (weight 2, floor 1)

Every finding carries a severity and a priority from the playbook scales, and the values are consistent with the finding's impact.

- **0** — At least one finding has no severity or no priority.
- **1** — All findings are classified but at least one value is not from the scale, or a Blocker/Critical has no evidence.
- **2** — All findings classified from the scale; one classification is inconsistent with the described impact.
- **3** — All findings classified from the scale and consistent with impact; a deleted row that stays listed is Blocker or Critical, a cosmetic note is Minor or Trivial.

## evidence (weight 2, floor 1)

Every finding has concrete steps, a distinct expected and actual, evidence (screenshot path or described observation), and an action.

- **0** — A finding lacks steps, or expected and actual are the same sentence, or there is no evidence field.
- **1** — All fields present but at least one finding's steps cannot be followed (no starting page, no data named).
- **2** — All findings reproducible from their steps; one evidence entry is generic ("see screenshot") without a path or observation.
- **3** — Every finding reproducible, expected/actual distinct, evidence specific, action names the next skill or owner.

## charter-quality (weight 1, floor 0)

The charter names a mission, lists what is already tested, and ranks focus areas by risk with a heuristic and a time estimate each — direction, not scripted steps.

- **0** — No charter, or focus areas are scripted step lists rather than areas.
- **1** — Charter present but focus areas have no heuristic or no risk rationale.
- **2** — Focus areas ranked with heuristics and rationale; the "Already Tested" section ignores the KB test cases that exist.
- **3** — Ranked focus areas with heuristic, rationale and time; "Already Tested" reflects the KB and repo tests; out-of-scope named.

## no-duplicate-scenarios (weight 1, floor 1)

No finding categorized as a new test scenario duplicates a test case already in the KB or a test in the repo (judge notes list them).

- **0** — A "new test scenario" restates an existing KB test case.
- **1** — No duplicates, but a new scenario overlaps an existing case without saying how it differs.
- **2** — New scenarios are distinct; one could have referenced the existing case it extends.
- **3** — New scenarios are distinct and each says which existing case it extends or why none applies.

## unexplored-noted (weight 1, floor 0)

Every charter focus area either has findings or an explicit unexplored note, and the report lists what the next session should cover.

- **0** — A focus area has neither findings nor an unexplored note.
- **1** — All areas accounted for, but the next-session list is missing.
- **2** — All areas accounted for with a next-session list; one item is vague ("more testing").
- **3** — All areas accounted for; next-session items are specific enough to become a charter.
