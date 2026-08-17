# Manual vs Automation and Test Types
<!-- qab: scope=test-plan,test-cases,exploratory,start -->

## Core Principle
<!-- qab: id=core-principle -->

**Do not aim for 100% automation.** This is unrealistic and does not challenge
whether quality can be improved through other means.

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

## UAT vs Functional Testing
<!-- qab: id=uat-vs-functional -->

| Aspect | Functional Test (E2E) | UAT |
|--------|----------------------|-----|
| Focus | Cause and effect (input -> expected output) | User workflow completion |
| Structure | Specific steps with specific assertions | Scenario-oriented, user goal-driven |
| Question | "Does this feature work correctly?" | "Can the user complete their task?" |
| Example | "Submit form with valid data -> success message" | "New employee can complete onboarding end-to-end" |

## Exploratory Testing
<!-- qab: id=exploratory-testing -->

Exploratory testing is NOT manual functional testing. It is:
- **Unscripted:** No predefined steps. Tester explores freely.
- **Purpose:** Uncover unknown user scenarios, challenge UX, assess look and feel.
- **Output:** New test scenarios to add to the test suite, UI/UX improvement suggestions.
- **Timing:** Conducted at feature-ready state, before UAT.

See `/exploratory` skill for the template and execution guide.

## Team-Specific Processes
<!-- qab: id=team-specific-processes -->

**Test data management:** See `features-kb/team-practices/test-data.md` if defined. Covers: seeding, cleanup, fixtures, isolation, shared vs personal test data.

**Accessibility requirements:** See `features-kb/team-practices/accessibility.md` if defined. Covers: WCAG compliance level, testing tools, which features require a11y testing.
