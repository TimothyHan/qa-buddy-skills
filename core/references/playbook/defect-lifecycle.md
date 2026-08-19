# Defect Lifecycle
<!-- qab: scope=qa,test-plan,review-ticket,verify-fix,start -->

## Defect Types
<!-- qab: id=defect-types -->

| Type | Definition | User Impact | Found By |
|------|-----------|-------------|----------|
| **Production bug** | Bug found in production environment | Affects end users | Users, monitoring, production testing |
| **Pre-release bug** | Bug found during internal testing | Does not affect end users | SDTs, developers, CI pipeline |

## Defect States
<!-- qab: id=defect-states -->

Both production and pre-release bugs follow the same lifecycle in Jira:

```
New -> Issue Verified -> Investigation -> Development in Progress
  -> Code Review -> Testing -> Final Review -> Resolved -> Released -> Closed
```

| State | Who | What happens |
|-------|-----|-------------|
| **New** | Reporter | Bug is filed with repro steps, severity, priority |
| **Issue Verified** | Team (triage) | Team confirms the bug is valid and reproducible |
| **Investigation** | Developer | Developer investigates root cause |
| **Development in Progress** | Developer | Fix is being implemented |
| **Code Review** | Developer + Reviewer | Fix is reviewed via PR |
| **Testing** | SDT or Developer | Fix is verified via `/qa-verify-fix` |
| **Final Review** | Bug Reporter | Original reporter confirms the fix |
| **Resolved** | Auto/Developer | Fix is merged |
| **Released** | Auto/Release Manager | Fix is deployed to production |
| **Closed** | Auto/Reporter | Confirmed working in production |

## When a bug does not reproduce
<!-- qab: id=not-reproducible scope=qa,verify-fix,exploratory -->

"Cannot reproduce" is a hypothesis, not a verdict. Repro steps record what the reporter
*did*, not the **run conditions** that were also true — restore them one at a time and retry:

**time & timezone** (local date ≠ UTC date? UTC-converting date logic breaks only in those
hours) · **locale/format** (`dd/MM` vs `MM/dd`) · **viewport/device** · **account** (role,
tenant, fresh vs long-lived session) · **data state** (seeded, empty, at a limit, already-used)
· **browser session** (cache, cookies, storage, first visit) · **build** (version, deploy,
flags — may have been fixed upstream between the runs).

One at a time is what names the trigger. If it still will not reproduce, record **"not
reproduced under: {conditions tried}"** — a bare "cannot reproduce" hides the gap between what
was tried and what was true; the bug stays open until someone can name the deciding condition.
(Live 2026-08-19: a date bug seen at 23:07 EDT = next-day UTC vanished at 00:02 EDT.)
## SLA Expectations
<!-- qab: id=sla-expectations -->

| Severity | Response Time | Resolution Target |
|----------|-------------|-------------------|
| **Blocker** | Immediate | Fix today |
| **Critical** | Same day | Fix this sprint |
| **Major** | This sprint | Fix this sprint or next |
| **Normal** | Next sprint planning | Prioritize in backlog |
| **Minor** | Backlog | Address when convenient |
| **Trivial** | Backlog | Address when convenient |

## Regression Test Requirements
<!-- qab: id=regression-test-requirements -->

| Defect Type | Regression Test Required? | Rationale |
|-------------|--------------------------|-----------|
| **Production bug** | Yes, always | Bug escaped to production. Must prevent recurrence |
| **Pre-release bug** | No (but CI covers it) | CI pipeline runs regression suite, providing coverage |

## Team-Specific Processes
<!-- qab: id=team-specific-processes -->

**Bug triage / intake:** See `features-kb/team-practices/bug-triage.md` if defined. Covers: initial assessment, reproduction steps, severity assignment, triage cadence.

**Hotfix testing:** See `features-kb/team-practices/hotfix-testing.md` if defined. Covers: abbreviated test process, what can be skipped, hotfix branch strategy.
