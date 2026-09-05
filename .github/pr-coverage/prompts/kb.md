Run `/qa-test-cases {{FEATURES}} --update --headless` — read the diff and `features-kb/features/<key>/feature.md`;
add or adjust test cases so every AC has at least one; write the mapping in the KB spec §6.5 shape
(`testCases[{id, layer, type, status}]`); keep existing TC ids.

Close with one line: `qa-test-cases: <STATUS> — <one-line summary>`, then a line `Auto-decisions: <count>`.
