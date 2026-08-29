# Equivalence fixture (RFC 0003)

A minimal project the equivalence harness (`testAkelaEquivalence` in `test.js`)
compiles with BOTH engines — the in-tree `qab.js` and the pinned `akela` from
node_modules — against the built dist references. The harness copies this
directory to two scratch dirs, writes `akela.json` (needs absolute knowledge
paths) into the akela copy, and diffs slices/manifests/log lines.

Exercises: learnings (active/retired/scoped), a PRJ knowledge file, a scope
override (add + remove), alias normalization, and the 0-source warning.
Ids referenced in `.qabuddy.json` must exist in the shipped references — if a
reference rename breaks this fixture, the harness fails loudly. That is intended.
