Automate the gaps, one skill at a time, each finishing with its status block:
1. `/qa-e2e-setup --headless` only if `playwright/AUTOMATION.md` does not exist.
2. `/qa-e2e-pom --headless` (build) for the screens the unautomated test cases touch.
3. `/qa-e2e-write --headless` for every test case that has no spec yet — test titles carry the TC id.
   Run the gates; never report DONE with a red gate.

Close with one line per skill run: `<skill>: <STATUS> — <one-line summary>`, then a line `Auto-decisions: <count>`.
