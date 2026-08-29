# RFC 0003 — Akela Adoption: Replace the In-Tree Engine with the Extracted Compiler

| | |
|---|---|
| **Status** | Draft — pending review |
| **Author** | Timothy Han |
| **Created** | 2026-08-28 |
| **Supersedes** | the *implementation* of RFC 0001/0002 (`bin/qab.js`); their decisions remain binding |
| **Locale** | English normative; Korean twin to follow (decision 7 of RFC 0001 stands) |

## 1 · Problem

QABuddy's self-learning engine (`bin/qab.js`, 1,189 lines) was extracted and
generalized as **Akela** (npm `akela`, MIT, zero dependencies, own 120-test
suite): a deterministic context compiler for any markdown knowledge base, with
QABuddy explicitly supported (`qab:` comment marker accepted; log readers accept
`skill` as an alias of `activity`; `--skill`/`--ticket` alias `--activity`/`--task`).

Two implementations of one engine now exist. Every fix lands twice or drifts.
QABuddy should become what the extraction anticipated: a **domain-pack consumer**
of Akela — it contributes the QA-ness (activities, probes, fingerprint
vocabulary), Akela owns selection, evidence, and the gate.

## 2 · Equivalence evidence (recon, 2026-08-28)

Both engines run against a copy of the dogfood workspace (29 outcomes, 290 log
lines), same inputs:

- **Slice body: byte-identical** (28 sources · 2 must · 15 learnings · 268 lines).
- **pfp: identical** (`5408a28cb4ac`) once QABuddy's probes (surface/pom/
  ticket_kind, `buildProfile()` in qab.js) are translated to Akela's declarative
  rules — same canonicalization, same sha-256/12.
- **Gate: identical arithmetic** on identical logs (profiles, outcome counts,
  dormancy threshold). Wording differs only in RFC cross-references.
- Deltas confined to the manifest header (`skill:`→`activity:`, `compiler: akela
  <ver> domain: <pack>`), one scratchpad comment line, and — when PRJ knowledge
  is configured — **PRJ placement order**: qab merges PRJ into the id-sorted
  stream, Akela follows `knowledge[]` array order. Same set, same content, same
  `via:` causality; the harness set-compares where PRJ is configured and
  byte-compares where it is not.
- **Unknown activity names diverge deliberately** (found in PR B): qab compiles
  them (scope-`all` learnings still pack); Akela with the qa pack — which
  declares the 13 activities — refuses with exit 1 and names the vocabulary,
  writing no run. This ships at cutover as a strictness upgrade: it is the
  strongest form of the #54 guard (no junk runs, no log pollution), asserted
  as a divergence in the harness.
- **Further deltas adjudicated during the PR C red-walk** (each asserted in
  the suite): the run marker moved (`.qa-reports/.qab-run` → `.qa-reports/run`);
  log/fp lines carry `activity` (readers accept historical `skill`); rejection
  wording generalized ("unknown section id", "source id must be", did-you-mean
  lists); a **missing knowledge root refuses the compile** (was a warning);
  **one knowledge root per namespace** (the old stem-collision class is now
  refused at config time); stats labels absent ids "history — no longer in the
  knowledge base" instead of ever promoting them.
- **Open (§7): generated `akela.json` paths are absolute.** `qab.js akela-init`
  writes machine-specific `domain`/knowledge paths, so a committed akela.json
  does not travel across teammates' machines until Akela learns `~/` expansion
  (upstream candidate for 0.1.4); meanwhile each machine runs akela-init once.
- **Log compatibility is one-way**: Akela reads historical `skill`-keyed lines;
  qab.js does not read `activity`-keyed lines. Existing projects migrate with
  zero log changes; there is no engine rollback once new lines are written.

## 3 · Decisions

1. **npm dependency, dist stays self-contained.** QABuddy gains `package.json`
   with `akela` pinned. Quick Start gains `npm install`. `build.js` copies
   `node_modules/akela` into `dist/<platform>/references/engine/` so installed
   symlinks keep working without `node_modules` at runtime; `test.js` asserts
   the dist copy matches the pinned version.
2. **Split config ownership.** `akela.json` (committed, user-edited) owns the
   engine: knowledge roots (shipped references + `PRJ` project files), scope
   overrides, scoring, budget. `.qabuddy.json` keeps workflow config only
   (contextSource, teamMode, …). A converter migrates existing `compiler`
   blocks; a leftover `compiler` key in `.qabuddy.json` fails loudly with the
   converter's name.
3. **A `qa` domain pack ships in QABuddy** and carries: the 13 activities, the
   profile probes of §2 (pfp-stable — verified), the closed fingerprint
   vocabulary (`FP_KINDS`), statuses, and the scratchpad template.
4. **Preambles call `akela`;** `--skill`/`--ticket` aliases keep the QA wording.
   `bin/qab.js` becomes a thin deprecation shim delegating to the engine for one
   minor release, then is removed.
5. **Cutover is measurement-bound** (CONTRIBUTING "changing the compiler"): an
   equivalence harness in `test.js` re-proves §2 on a committed fixture before
   and during the switch. Behavioural deltas beyond §2's documented set block
   the cutover PR.
6. **No detection-power loss.** Engine behaviours covered by `test.js` but not
   by Akela's suite are ported upstream (PRs to `akela`) before qab.js retires.
   QABuddy keeps integration checks only: pack correctness, config contract,
   dist shipping, preamble references, the harness.
   *First instance closed before this RFC landed:* qab 0.7.1's silent-empty-slice
   fix (0-source stderr warning + alias normalization, generalized as
   `aliasPrefixes`) shipped upstream as **akela 0.1.3** (npm, 2026-08-28) and was
   verified against the published artifact — five behaviours, identical source
   sets aliased vs canonical. The dependency pin is therefore `>=0.1.3`.
7. **RFCs 0001/0002 are untouched** — historical records of decisions that now
   bind Akela's shape (its code cites them).

## 4 · Staged delivery

- **PR A — dependency + harness.** `package.json` (akela pinned), CI `npm ci`,
  equivalence harness + committed fixture. No behaviour change; qab.js still
  primary.
- **PR B — qa pack + config.** `domains/qa.json` (or equivalent path), akela.json
  contract in `/qa-setup`, `.qabuddy.json` converter + loud stale-key error.
  Upstream test ports open in parallel.
- **PR C — cutover (v0.8.0).** build.js ships the engine into dist; preambles
  (en+ko) and skill texts switch to `akela`; qab.js → shim; engine tests retire
  from test.js as their upstream ports land; docs sweep (READMEs, self-learning
  guides, CONTRIBUTING); upgrade note + converter instructions.

## 5 · Open questions

- Fate of build-time `references/index.json` (`akela index` subsumes runtime
  use; build-time en/ko id-parity validation stays in `build.js`).
- Whether the Cursor/Copilot dists ship the engine identically (they are
  unverified tiers; structural parity only).
- Upstream wishlist discovered during ports (e.g., qab's `gate` prints RFC 0002
  §-references Akela's doesn't; cosmetic).
