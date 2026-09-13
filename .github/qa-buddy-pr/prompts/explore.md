Run `/qa-exploratory {{FEATURES}} --quick --headless --url {{BASE_URL}}` — build the charter from the diff's
risk (changed handlers and endpoints first); persist the report to
`features-kb/features/<key>/exploratory/<YYYY-MM-DD>.md` with the AC-keyed Focus Area Results table
(`| Focus Area | ACs | Time | Findings | Result |`); save screenshots with `browser_take_screenshot`
under `.qa-reports/screenshots/`. Before exploring, re-check every finding of the earlier sessions in
`features-kb/features/<key>/exploratory/` and re-list each in this report under the same title with
`**Status:** still open | resolved | not reproduced` — an unlisted earlier finding stays open on the PR.

Close with one line: `qa-exploratory: <STATUS> — <one-line summary>`, then a line `Auto-decisions: <count>`.
