# Risk-Based Testing

Every test case must have **severity** and **priority** values. These two dimensions
together determine testing effort allocation.

## Severity Scale

Severity measures the **impact** of a failure on the user and the business.

| Severity | Definition | User Impact Example |
|----------|-----------|-------------------|
| **Blocker** | On failure, blocks critical user workflow or causes server shutdown | User cannot login, cannot CRUD core features, cannot perform daily tasks |
| **Critical** | On failure, blocks major workflow without workaround. Can result in revenue loss | User can login and use core features, but cannot perform critical operations |
| **Major** | On failure, blocks major workflow but workaround exists. Can result in revenue loss over longer period | User can complete tasks but through a longer/harder path |
| **Normal** | On failure, blocks non-major workflow without workaround. No significant business impact | Renaming entity fails, minor field values incorrect but not critical |
| **Minor** | Same impact as Normal but workaround exists. Noticeable visual defects | Feature works but is awkward to use, visual alignment off |
| **Trivial** | Minor visual defects or minor text errors | Typo in label, 1px alignment, cosmetic-only issues |

## Priority Scale

Priority measures **urgency** based on severity + blast radius (how many users affected).

| Priority | Criteria |
|----------|---------|
| **High** | Blocker or Critical severity with immediate user impact, OR Major severity with large blast radius |
| **Medium** | Major severity with smaller blast radius, OR Normal severity with immediate user impact |
| **Low** | Normal severity with infrequent impact, OR any Minor or Trivial severity |

## Effort Allocation

- **Create test cases** for all identified scenarios regardless of priority.
- **When time is limited,** deprioritize test cases with lower-tier priority and severity.
- **Smoke test suite** = all High priority test cases.
- **Regression test suite** = all High + Medium priority test cases.
- **Full test suite** = all test cases including Low priority.

## Priority-Severity Decision Matrix

```
                    High Priority    Medium Priority    Low Priority
Blocker severity    ALWAYS RUN       ALWAYS RUN         ALWAYS RUN
Critical severity   ALWAYS RUN       ALWAYS RUN         RUN IF TIME
Major severity      ALWAYS RUN       RUN IF TIME        RUN IF TIME
Normal severity     RUN IF TIME      RUN IF TIME        DEPRIORITIZE
Minor severity      DEPRIORITIZE     DEPRIORITIZE       SKIP IF SHORT
Trivial severity    SKIP IF SHORT    SKIP IF SHORT      SKIP IF SHORT
```
