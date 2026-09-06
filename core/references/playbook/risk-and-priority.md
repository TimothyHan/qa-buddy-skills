# Risk-Based Testing
<!-- qab: scope=qa,test-plan,test-cases,review-ticket,exploratory -->

Every test case must have **severity** and **priority** values. These two dimensions
together determine testing effort allocation.

## Severity Scale
<!-- qab: id=severity-scale tier=must scope=qa,test-plan,test-cases,review-ticket,exploratory,verify-fix,start -->

Severity measures the **impact** of a failure on the user and the business.

| Severity | Definition | User Impact Example |
|----------|-----------|-------------------|
| **Blocker** | On failure, blocks critical user workflow or causes server shutdown | User cannot login, cannot CRUD core features, cannot perform daily tasks |
| **Critical** | On failure, blocks major workflow without workaround. Can result in revenue loss | User can login and use core features, but cannot perform critical operations |
| **Major** | On failure, blocks major workflow but workaround exists. Can result in revenue loss over longer period | User can complete tasks but through a longer/harder path |
| **Normal** | On failure, blocks non-major workflow without workaround. No significant business impact | Renaming entity fails, minor field values incorrect but not critical |
| **Minor** | Same impact as Normal but workaround exists. Noticeable visual defects | Feature works but is awkward to use, visual alignment off |
| **Trivial** | Minor visual defects or minor text errors | Typo in label, 1px alignment, cosmetic-only issues |

**Not everything that fails blocks something.** A defect that exposes data, or grants access that
should be denied, is rated on **what it exposes** — the user's workflow completing normally is
precisely the problem, so none of the rows above fire:

| Exposure | Severity |
|----------|----------|
| Credentials, or personal data (contact details, identity documents, message contents) readable by someone who should not see it | **Blocker** |
| Another user's non-personal data readable, or any write/delete reachable without authorization | **Critical** |
| Authorization holds but leaks: existence disclosed by status codes, enumerable ids, sensitive values in URLs or logs | **Major** |

Priority follows blast radius as usual, with one exception: a live exposure reachable from a public
path is **High** however few users it is known to affect — the count is what you have observed, not
what is at risk.

## Priority Scale
<!-- qab: id=priority-scale tier=must scope=qa,test-plan,test-cases,review-ticket,exploratory,verify-fix,start -->

Priority measures **urgency** based on severity + blast radius (how many users affected).

| Priority | Criteria |
|----------|---------|
| **High** | Blocker or Critical severity with immediate user impact, OR Major severity with large blast radius |
| **Medium** | Major severity with smaller blast radius, OR Normal severity with immediate user impact |
| **Low** | Normal severity with infrequent impact, OR any Minor or Trivial severity |

## Effort Allocation
<!-- qab: id=effort-allocation scope=qa,test-plan,test-cases,review-ticket,exploratory -->

- **Create test cases** for all identified scenarios regardless of priority.
- **When time is limited,** deprioritize test cases with lower-tier priority and severity.
- **Smoke test suite** = all High priority test cases.
- **Regression test suite** = all High + Medium priority test cases.
- **Full test suite** = all test cases including Low priority.
