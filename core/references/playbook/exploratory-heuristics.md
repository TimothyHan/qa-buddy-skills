# Exploratory Testing Heuristics
<!-- qab: scope=exploratory tier=must -->

Techniques for systematic exploration. Used by `/qa-exploratory` when generating charters and executing sessions.

## Heuristic Categories
<!-- qab: id=heuristic-categories -->

Select relevant categories based on the feature type:

| Category | What to Explore |
|----------|----------------|
| **Input variation** | Boundaries, empty, null, special chars, unicode, max length, negative numbers, zero, very large values |
| **State transitions** | Forward/back, refresh mid-flow, abandon and return, session timeout, concurrent edits |
| **Error recovery** | Network failure mid-action, invalid server response, partial save, undo after error |
| **Data integrity** | Does saved data match input? Rounding? Truncation? Encoding? |
| **Cross-feature** | Does this feature break existing features? Check related features from feature-map.json |
| **User personas** | New user, power user, admin, read-only user, user with no data, user with lots of data |
| **Environment** | Different browsers, mobile viewport, slow network, javascript disabled |
| **Concurrency** | Two tabs, two users editing same thing, rapid repeated actions |
| **Accessibility** | Keyboard navigation, screen reader compatibility, focus management, color contrast |
| **Performance feel** | Perceived speed, loading indicators, responsiveness under interaction |

## Techniques Per Heuristic
<!-- qab: id=techniques-per-heuristic -->

**Input variation:** Empty submission, single character, max length + 1, special characters (`< > " ' & ; -- {} [] () / \`), unicode (emoji, CJK, RTL, zero-width), numbers (0, -1, 99999999, 0.001, NaN), paste vs type, browser autofill.

**State transitions:** Half-complete flow + browser back/refresh, two tabs (complete in one, try the other), start flow → wait 10+ min → try to complete, navigate away via link → come back.

**Error recovery:** Validation error → fix → resubmit, multi-step flow fail at step 3 → go back to step 2?, force network error (dev tools) → does UI recover?, invalid data → error → clear field → does error clear?

**Cross-feature:** After using new feature check related features, new feature's data correct in related views?, existing features still work? Check feature-map.json.

**User personas:** New user (no data, first-time), power user (lots of data), restricted permissions, empty → populated state transition.

## Finding Categories
<!-- qab: id=finding-categories -->

| Category | What it is | Example |
|----------|-----------|---------|
| **New test scenario** | Untested scenario needing a test case | "No test for invoice amount = 0" |
| **Bug** | Something is broken | "Error message not shown for duplicate email" |
| **UX concern** | Works but poor experience | "No loading indicator during save" |
| **Missing requirement** | ACs don't cover but should | "No way to cancel mid-flow" |
| **Question** | Needs team discussion | "Should deleted items be recoverable?" |
