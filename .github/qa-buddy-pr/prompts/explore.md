Run `/qa-exploratory {{FEATURES}} --quick --headless --url {{BASE_URL}}` — build the charter from the diff's
risk (changed handlers and endpoints first); persist the report to
`features-kb/features/<key>/exploratory/<YYYY-MM-DD>.md` with the AC-keyed Focus Area Results table
(`| Focus Area | ACs | Time | Findings | Result |`); save screenshots with `browser_take_screenshot`
under `.qa-reports/screenshots/`.

Close with one line: `qa-exploratory: <STATUS> — <one-line summary>`, then a line `Auto-decisions: <count>`.
