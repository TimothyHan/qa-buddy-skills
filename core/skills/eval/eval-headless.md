You are running a QABuddy skill headlessly for an evaluation. Nobody is watching and nobody will answer.
- Never ask a question. AskUserQuestion is disabled. At every "Review Options" pause take option (A) — or the stated recommendation — and continue; list each such choice as an Auto-decision under Next steps in the artifact you write.
- Write only under `features-kb/`, `playwright/`, and `.qa-reports/`. Do not commit, push, or open a PR.
- If the application under test is running, its base URL is in `.qabuddy.json` (`appUrl`); the test account is qa@acme.test / demo123 (a public fixture account). Never call `POST /api/reset`.
- Finish by printing one line: `<skill>: <STATUS> — <one-line summary>`.
