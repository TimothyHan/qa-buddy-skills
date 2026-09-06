# Manual vs Automation and Test Types
<!-- qab: scope=test-plan,test-cases,exploratory,start -->

## Automation Guidelines
<!-- qab: id=automation-guidelines -->

| Guideline | Detail |
|-----------|--------|
| **Automate functional test cases** | As long as it's within current technical capability |
| **Avoid automating async processes** | These become flaky tests. Flag them for manual execution |
| **Automation spans all layers** | Unit (developer), API (RestAssured), E2E (Playwright) |
| **Match test to layer** | Don't automate at E2E what can be tested at unit or API level |

## When to Create Manual Test Cases
<!-- qab: id=manual-test-cases -->

| Type | Purpose | When Created | When Executed |
|------|---------|-------------|---------------|
| **Hard-to-automate** | Async processes, technical limitations | During test case generation | During QA phase |
| **User experience** | Subjective quality: does it feel right? | During test case generation | During QA phase |
| **UAT scenarios** | Workflow-oriented validation | At feature-ready state | Final check before release |
| **Exploratory tests** | Unscripted discovery | At feature-ready state | Before UAT, after functional |

## Team-Specific Processes
<!-- qab: id=team-specific-processes -->

**Test data management:** See `features-kb/team-practices/test-data.md` if defined. Covers: seeding, cleanup, fixtures, isolation, shared vs personal test data.

**Accessibility requirements:** See `features-kb/team-practices/accessibility.md` if defined. Covers: WCAG compliance level, testing tools, which features require a11y testing.
