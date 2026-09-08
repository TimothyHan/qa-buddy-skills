You are running QABuddy headlessly on pull request #{{PR}} of this repository. This session runs the **{{PHASE}}** phase only.
`QABUDDY_HEADLESS=1` is set: follow the preamble's Headless Mode — never ask a question, take the stated
recommendation at every pause, record each as an Auto-decision, and write only under `features-kb/`,
`playwright/`, `playwright.config.*`, and `.qa-reports/`. Do not commit, push, or open a PR; the workflow does that.

Touched knowledge-base features (from `.qa-reports/pr-coverage/touched.json`): {{FEATURES}}
The diff under review: `git diff {{BASE_SHA}}...HEAD`.
The app is already running at {{BASE_URL}}. Credentials are in env `TEST_USER` / `TEST_PASS`. Never call `POST /api/reset`.
Earlier phases of this run may already have written files under `features-kb/` and `playwright/`; build on them, never discard them.

