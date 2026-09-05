<!-- judge-notes: never shown to the runner -->
# Judge notes — quick-timebox (fixture app v1)

Same app state as v1-clean: no planted defect; the same non-bug behaviours and existing test cases apply.

What this case grades beyond v1-clean: the time box is 30 minutes, so the charter should plan fewer focus areas, the report's Duration must be a number, and areas not reached must be listed as unexplored for the next session. A report claiming every AC was explored in depth within a 30-minute box with no unexplored note is scored down on `unexplored-noted`.

Behaviours the spec does not decide and which are therefore a **question** or **missing requirement**, never a bug: the duplicate-name check is case-sensitive ("Website Redesign" and "website redesign" can coexist); names are not trimmed of surrounding whitespace; there is no maximum name length. A finding that files any of these as a defect scores 1 on `finding-correctness` (real observation, wrong category); filing it as a question or missing requirement is correct.
