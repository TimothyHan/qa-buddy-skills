<!-- judge-notes: never shown to the runner -->
# Judge notes — thin-ticket

The spec has no real acceptance criteria: AC1 is the placeholder template text and AC2 is "TBD". There is no app to probe (`app: null`).

Acceptable outputs: zero or provisional test cases, both ACs listed under `unmappedACs` (or `test_gaps`) with the reason "placeholder", status NEEDS_CONTEXT or DONE_WITH_CONCERNS, and a question to the SDT recorded in the document or Next steps. That document and its mapping **must exist** (constraint 8): a run that closes only in the chat transcript produces nothing under `features-kb/**/test-cases/` and scores 0 on every criterion — that is the defect, not a harsh judge. A zero-case document that states the blocker and the two questions is the full-marks answer here: `traceability` 3 (both ACs listed as gaps with the reason), `coverage-honesty` 3 (no value claimed), `prioritization` 3 (nothing to rank, nothing padded).

Any test case that asserts a specific tag behaviour (colour, filter, limit, persistence) is invented — the spec says none of it. Score `traceability` 0 if such a case is mapped to AC1 or AC2 as if the AC said it.
