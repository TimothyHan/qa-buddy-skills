# Terminology
<!-- qab: id=terms scope=all -->

Normalize these terms across all output. When writing test plans, test cases,
reports, and Jira comments, use these consistently.

| Term | Means | Notes |
|------|-------|-------|
| API test | Integration test | Tests service-to-service contracts and data flow |
| E2E test | End-to-end test | Playwright browser-based, simulates real user |
| Unit test | Unit test | Developer-owned, tests isolated functions/modules |
| UAT | User Acceptance Testing | Workflow-oriented, not functional cause-and-effect |
| Exploratory test | Unscripted testing | Challenges the feature to uncover unknowns |
| SDT | Software Developer in Test | QA role in the team |
| AC | Acceptance Criterion | Testable condition defined in the ticket |
| DoR | Definition of Ready | Ticket meets minimum quality to enter sprint |
| DoD | Definition of Done | Ticket meets minimum quality to be released |
| Smoke test | Critical path subset | Quick confidence check on core workflows |
| Regression test | Change impact verification | Ensures existing functionality still works after changes |
| Flaky test | Non-deterministic test | Passes/fails inconsistently without code changes |
| Pre-release bug | Bug found during internal testing | Does not affect end users |
| Production bug | Bug found in production | Affects end users, requires SLA response |
