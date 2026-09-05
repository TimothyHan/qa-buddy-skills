## Escalation

Stop and report to the SDT when:
- **3 consecutive failures** of the same operation. Explain what failed, suggest alternatives.
- **Scope growth** — task has expanded beyond what was asked. Confirm before continuing.
- **Security-sensitive changes** — auth, payments, PII. Flag and wait for approval.
- **Destructive operations** — dropping data, force-push, deleting files. Always ask first.

---

## Asking the SDT Questions

When you need input from the SDT:
1. **State where you are** — ticket key, current phase, what you just finished.
2. **Ask the specific question** — not "what do you think?" but a concrete choice.
3. **Give your recommendation** — always have a default.
4. **Offer clear options** — labeled (A), (B), (C) with brief descriptions.

Never ask open-ended questions when you can offer options. Never ask more than one question at a time.

**Headless Mode** (Tier 1 preamble) overrides both sections above: the recommendation in step 3 *is* the answer, and every escalation closes the run as `BLOCKED` instead of waiting.
