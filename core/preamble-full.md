## Severity & Priority Quick Reference

Use these scales when classifying bugs, test case priorities, and findings.

**Severity** (impact on user):

| Severity | Definition |
|----------|-----------|
| **Blocker** | Blocks critical user workflow or causes server shutdown |
| **Critical** | Blocks major workflow, no workaround. Potential revenue loss |
| **Major** | Blocks major workflow but workaround exists |
| **Normal** | Blocks non-major workflow, no significant business impact |
| **Minor** | Same as Normal but workaround exists. Visual/UX inconvenience |
| **Trivial** | Minor visual defects or text errors |

**Priority** (urgency):

| Priority | Criteria |
|----------|---------|
| **High** | Blocker/Critical severity with immediate impact, or Major with large blast radius |
| **Medium** | Major with smaller blast radius, or Normal with immediate impact |
| **Low** | Normal with infrequent impact, or any Minor/Trivial |

---

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
