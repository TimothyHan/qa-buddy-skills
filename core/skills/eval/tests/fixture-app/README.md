# Eval fixture app — "Acme Projects"

Target application for execute-mode evals of the e2e skills
(`/qa-e2e-setup`, `/qa-e2e-pom`, `/qa-e2e-write`). Zero dependencies, no build step.

```bash
node server.js                    # v1 — baseline build target      :4173
APP_VARIANT=v2 node server.js     # v2 — DOM mutated (heal exam)
APP_VARIANT=v3 node server.js     # v3 — delete silently broken (negative control)
```

- `ANSWER-KEY.md` — ground truth the eval fixtures grade against.
  **Never show it to a skill under eval.**
- `test-cases.md` — the fixture "feature KB" input handed to skills.

The traps in this app (late re-render, auto-dismiss toast, duplicate hidden
buttons, missing testids, 409 on duplicate names) are deliberate. Do not fix
them — they are the exam. Change `server.js` and `ANSWER-KEY.md` only together.
