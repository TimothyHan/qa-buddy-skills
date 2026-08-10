# Test Suite Verification

A test's value is its **detection power** — the probability it turns red when the
thing it guards breaks. A green run proves nothing until you have seen the suite
red for the right reason. Coverage says what the suite *touches*; only a
provoked failure says what it *catches*.

## Mutation smoke (prove detection power)

After building or significantly changing a suite, run at least one mutation smoke:

1. **Copy the system under test to a sandbox** — never mutate the real tree.
2. **Inject one realistic defect:** delete an artifact, invert a guard condition
   (`==` → `!=`), or make a function a no-op. Mimic defect classes that actually
   happened, not arbitrary typos.
3. **Confirm the mutation applied** before drawing any conclusion — diff the
   mutated file or observe the changed behavior directly. A substitution that
   silently matched nothing yields a green run that "proves" a false blind spot
   is absent (or present).
4. **Run the suite. Expect red.** A green suite over a broken system is a
   finding: record the blind spot and close it before trusting that suite.

## Vacuous assertion checklist

An assertion is vacuous when it passes regardless of behavior. Audit for:

- **Empty capture:** the assertion target can be an empty string/list — e.g.,
  output on a stream the capture misses (PowerShell 5.1 `Write-Host` → stream 6
  needs `6>&1`), a log file that was never written. `not-contains` checks on
  empty input always pass.
- **Fixture contains the evidence:** the negative fixture's own text includes
  the string the check greps for, so the check matches the fixture instead of
  the behavior.
- **Conditional assertions:** checks inside an `if`/loop that can execute zero
  times pass by never running. Assert the iteration count too.
- **Never-seen-red:** if a check has never failed in its life, deliberately
  break its subject once to prove it can.

## Self-derived expectations (anti-pattern)

A suite that builds its expectations by enumerating the system under test
(walking the same disk, listing the same registry) **deletes its checks along
with deleted content** — a removed module removes its own verification, and the
run stays green. Fix: anchor an explicit expected manifest (list of modules,
counts, names) maintained by hand. A stale test-side manifest **fails loudly**
and demands an edit; that is the opposite failure mode of a stale runtime-side
list, which silently does less work.

## Structural checks ≠ behavioral proof

Grepping that code/config *contains* the right fragment verifies shape, not
behavior — a no-op wrapper or inverted guard keeps every string in place. Pair
every structural check that guards a critical behavior with at least one
execution-level proof (run the script against a decoy/sandbox and assert the
observable outcome).

## When to run

- Right after building a new suite or check layer (before trusting first green).
- When a run is suspiciously fast or suspiciously green.
- After a large refactor of the suite itself.
- Match the form to the layer. **Unit:** automated mutation tools (Stryker,
  PIT, mutmut) are cheap against millisecond suites — recommend them in the
  developer unit-test checklist and run them systematically. **Above unit**
  (integration, e2e, CI scripts): no mainstream tooling exists and suite
  runtime forbids mutant farms — the manual one-mutation-per-defect-class
  smoke is the realistic form, and the vacuous-assertion risk is highest
  here (captured output, greps, exit codes sit far from the behavior).
