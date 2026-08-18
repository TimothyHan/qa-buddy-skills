# Test Distribution (Test Pyramid)
<!-- qab: scope=test-plan,test-cases,review-ticket,exploratory,start -->

## Default Target: Test Pyramid
<!-- qab: id=test-pyramid -->

```
         /‾‾‾‾‾‾\
        / E2E 10% \
       /‾‾‾‾‾‾‾‾‾‾‾‾\
      /  API/Int  30%  \
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /    Unit tests  60%    \
   /________________________\
```

| Layer | Target % | Framework | Owner |
|-------|----------|-----------|-------|
| Unit | 60% | Project-specific | Developer |
| API / Integration | 30% | RestAssured | Developer + SDT |
| E2E | 10% | Playwright | SDT |

## Variant: Test Diamond
<!-- qab: id=test-diamond -->

Some projects have less unit-testable code (e.g., integration-heavy services, thin
UI over complex API). In that case, the diamond shape is acceptable:

```
         /‾‾‾‾‾‾\
        / E2E 10% \
       /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
      /                   \
     /    API/Int  70%     \
      \                   /
       \‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾/
        \ Unit  20% /
         \________/
```

## Deduplication Rules
<!-- qab: id=deduplication-rules -->

**No redundant tests across layers.**

1. If a scenario is covered by a **unit test**, do NOT create a dedicated API or E2E
   test for that same scenario.

2. If a scenario is covered by an **API test**, do NOT create a dedicated E2E test
   for that same scenario.

3. **Exception: Critical features.** When the feature is critical (Blocker/Critical severity),
   redundancy across layers is acceptable to increase release confidence.

## Applying This to Test Case Generation
<!-- qab: id=test-case-generation -->

When `/qa-test-cases` generates test cases, it should:
- Assign each test case to the **lowest appropriate layer** first.
- Only promote to a higher layer when the lower layer cannot adequately test it.
- Flag redundancies and explain why they exist.
- Show the distribution in the output so the SDT can verify the shape.
