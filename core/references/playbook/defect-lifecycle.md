# Defect Lifecycle

## Defect Types

| Type | Definition | User Impact | Found By |
|------|-----------|-------------|----------|
| **Production bug** | Bug found in production environment | Affects end users | Users, monitoring, production testing |
| **Pre-release bug** | Bug found during internal testing | Does not affect end users | SDTs, developers, CI pipeline |

## Defect States

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
| **Testing** | SDT or Developer | Fix is verified via `/verify-fix` |
| **Final Review** | Bug Reporter | Original reporter confirms the fix |
| **Resolved** | Auto/Developer | Fix is merged |
| **Released** | Auto/Release Manager | Fix is deployed to production |
| **Closed** | Auto/Reporter | Confirmed working in production |

## SLA Expectations

| Severity | Response Time | Resolution Target |
|----------|-------------|-------------------|
| **Blocker** | Immediate | Fix today |
| **Critical** | Same day | Fix this sprint |
| **Major** | This sprint | Fix this sprint or next |
| **Normal** | Next sprint planning | Prioritize in backlog |
| **Minor** | Backlog | Address when convenient |
| **Trivial** | Backlog | Address when convenient |

## Regression Test Requirements

| Defect Type | Regression Test Required? | Rationale |
|-------------|--------------------------|-----------|
| **Production bug** | Yes, always | Bug escaped to production. Must prevent recurrence |
| **Pre-release bug** | No (but CI covers it) | CI pipeline runs regression suite, providing coverage |

## Team-Specific Processes

**Bug triage / intake:** See `features-kb/team-practices/bug-triage.md` if defined. Covers: initial assessment, reproduction steps, severity assignment, triage cadence.

**Hotfix testing:** See `features-kb/team-practices/hotfix-testing.md` if defined. Covers: abbreviated test process, what can be skipped, hotfix branch strategy.
