# Self-Improve Protocol: The Project Learnings Layer
<!-- qab: scope=improve,setup tier=must -->

<!--
  Canonical copy: QABuddy core/references/self-improve.md (en).
  Korean twin: locales/ko/references/self-improve.md — keep in sync.
  The LEARNINGS.md file this protocol manages is user-project content:
  it is NOT dual-locale and NOT shipped with QABuddy.
-->

QABuddy is a foundation, not a finished tool. Every project teaches it something —
an app quirk, a team convention, a rule that failed against reality. This protocol
defines how every skill run **reads** those learnings and **captures** new ones, so
the same installed foundation diverges over time to fit each team.

Two layers, one direction of flow:

| Layer | Lives in | Contains | Changed by |
|---|---|---|---|
| **References** (canon) | QABuddy install (`references/`) | Broadly validated rules | QABuddy upgrades, `/qa-improve` promotion |
| **Learnings** (project) | Your repo (`features-kb/LEARNINGS.md`) | Project-specific deltas | Every skill run (capture), `/qa-improve` distill |

Flow: a learning proves itself repeatedly → `/qa-improve` distill promotes it into
references (and upstream via PR). Learnings are the staging area for canon.

## The learnings file
<!-- qab: id=learnings-file -->

Default `features-kb/LEARNINGS.md`; override with `learningsPath` in `.qabuddy.json`.
It is committed to the project repo — learnings are team knowledge, they travel via git.

Entry template (one `##` block per learning):

```markdown
## LRN-20260807-01: Cart preconditions must be seeded via API
- **Status:** active            <!-- active | promoted | retired -->
- **Scope:** test-cases, e2e-write   <!-- skills this applies to, or `all` -->
- **Statement:** Seed cart state via `POST /api/cart` with a session token.
  Never UI-click items into the cart in tests — flaky in this app.
- **Overrides:** REF-playwright-patterns#must-rules (extends: API-first, adds the endpoint)
- **Evidence:** 2026-08-07 /qa-test-cases run — SDT corrected draft; UI seeding
  had caused flaky checkout specs in sprint 14.
- **Fingerprint:** ffp-a3f9c21b0e44   <!-- optional: failure class this rule prevents (see Failure fingerprints) -->
- **Profile:** surface=web            <!-- optional: narrows beyond Scope; AND-ed -->
```

ID format `LRN-YYYYMMDD-NN` (date created, then sequence). IDs are permanent —
never reused, even after retirement. `Overrides:` names what the learning
extends or replaces: a reference section id (`REF-…`, below), a skill rule
(`SKILL:test-cases "…"`), or `none`. `Fingerprint:` and `Profile:` are optional
and machine-read: `Fingerprint:` is the `ffp` of the failure class the rule
claims to prevent (*Failure fingerprints* below); `Profile:` narrows the
learning to a run profile (`surface=web`, `pom=exists`, `ticket_kind=bug`).

## Source IDs
<!-- qab: id=source-ids -->

Every reference section is an addressable **source**, like a learning:

- **Id form:** `REF-<file-stem>#<id>`; under `playbook/` → `REF-playbook/<stem>#<id>`.
  Example: `REF-playwright-patterns#never`, `REF-playbook/risk-and-priority#severity-scale`.
- **Where it lives:** an HTML comment on the line right after the heading —
  `## Selectors` / `<!-- qab: id=selectors tier=must -->`. Never in the heading
  text. `##` headings outside code fences are addressable; the H1 comment may
  carry file-level defaults (`scope=`, `tier=`) that sections inherit, and an
  `id=` for files whose knowledge sits under the H1.
- **scope** = comma-separated skill names or `all` (default). **tier** =
  `must` (always in a scoped skill's slice — rails, NEVER lists, templates a
  skill structurally depends on) | `should` (default) | `context`.
- **Ids are permanent.** Rename the heading freely; never the id. Korean twins
  copy the `qab:` comment verbatim — the build fails on a duplicate id or an
  en/ko id-set mismatch, and ships `references/index.json` (id → file, heading,
  scope, tier, lines) for tools.
- **Cite them like learnings.** When a section shapes output, cite its id the
  way you cite `LRN-…` and run `qab.js log applied REF-…` — once per source per
  run. The helper rejects ids that aren't in `index.json` and suggests the nearest,
  so a mistyped id never enters the log. `applied ≠ read`: a section you read but
  that didn't shape anything is not cited — that gap is signal for distill.

## Read protocol (start of every skill run)
<!-- qab: id=read-protocol -->

1. After reading references, read the learnings file (skip silently if absent).
2. Apply entries whose **Scope** includes the current skill (or `all`) and whose
   **Status** is `active`. Ignore `retired` entries entirely; `promoted` entries
   are already in references — don't double-apply.
3. **On conflict, the learning wins.** It is newer and project-specific; the
   reference stays the default everywhere else.
4. **Cite what you apply — and log it.** When a learning shapes output, name its
   ID in the report (e.g., "using `data-test` per LRN-20260807-01") **and** run
   `qab.js log applied LRN-…` (see *Learnings log* below). Citation makes the
   layer auditable — silent application looks like drift; the log makes it
   countable.
5. If an active learning is **contradicted by what you observe live**, do not
   apply it. Run `qab.js log contradicted LRN-… --note "<what you saw>"`, flag it
   in your report as falsification evidence, and suggest `/qa-improve` distill.
   Observed reality outranks recorded learnings, same as it outranks references.

## Capture protocol (end of every skill run)
<!-- qab: id=capture-protocol -->

Ask — of the run's `## Candidate learnings` (scratchpad, see `run-protocol.md`) — did one of exactly three triggers occur?

1. **A documented rule failed against reality** — a reference or learning said X,
   the app/environment demonstrably did Y.
2. **An undocumented decision was made** — the run hit a fork no reference covers,
   and the choice matters beyond this run.
3. **The SDT corrected the output** — and the correction encodes project knowledge,
   not a one-off preference.

If none occurred: **write nothing, say nothing.** A clean run leaves no trace —
noise is what kills trust in this file.

If one occurred, append an entry:

- **Evidence is mandatory** — the failing command, observed behavior, or quoted
  correction, with date. A learning without evidence is a guess; don't record it.
- **Deltas only, never copies.** An entry states how this project *differs from or
  extends* canon (use the **Overrides** field). Never paste reference content into
  a learning — a stale fork silently shadowing updated canon is the exact failure
  this layer exists to avoid.
- **One fact per entry.** Two learnings from one run = two entries.
- **Link the fingerprint.** If trigger 1 fired and this run emitted a fingerprint
  for that failure (`qab.js fp --list` shows them), set the new entry's
  `Fingerprint:` to that `ffp` — the next run that hits the same class then
  falsifies the entry automatically, without anyone re-judging it.
- Mention the capture in your report: "Captured LRN-{id}: {one-line statement}."
  and run `qab.js log captured LRN-{id}`.

### Do NOT capture

- **Defects in QABuddy itself** — if the failing rule is wrong *everywhere*, not
  just in this project, that's a skill/reference bug, not a project delta.
  Suggest "run `/qa-improve`" with the evidence in **Next steps** instead.
- Anything already stated in references (that's a copy, not a delta)
- One-off environment hiccups without a reusable rule (a flaky network call)
- Session-scoped context (ticket details, sprint dates — that's the KB's job)
- Style preferences the SDT hasn't confirmed as team convention
- Secrets, credentials, tokens — in any form, even as evidence

## Learnings log (the read path is a write path)
<!-- qab: id=learnings-log -->

`LEARNINGS.md` records what a learning *says*; the log records what happened to
it. Path: `learnings-log.jsonl` next to the learnings file (so `features-kb/`
by default). Append-only, one JSON object per line, committed with the repo,
never edited in place — readers accept every earlier `v` forever.

Write it with the shipped helper, never by hand:

```bash
node <references>/bin/qab.js run-id --skill <this-skill> [--ticket <KEY>]   # once, at start; prints the run id
node <references>/bin/qab.js log applied LRN-20260807-01                    # a learning shaped output
node <references>/bin/qab.js log applied REF-playwright-patterns#never       # a reference section shaped output
node <references>/bin/qab.js log contradicted LRN-… --note "<what you saw>" # live reality disagreed
node <references>/bin/qab.js log captured LRN-…                             # you appended a new entry
node <references>/bin/qab.js fp locator-not-found "checkout/place-order-btn" # a named failure class hit (Failure fingerprints, below)
node <references>/bin/qab.js log outcome --status DONE                      # last thing before the status block
```

`<references>` is the platform's reference path (the preamble gives the exact
command). `run-id` remembers the current run in `.qa-reports/.qab-run`; when
running skills in parallel, pass `--run <id>` to each `log` call instead.
Schema v1: `{"v":1,"ts":"<UTC ISO>","run":"<skill>-<ticket|branch>-<6hex>","skill":"…","event":"…","src":"LRN-…"}`
plus `note` (contradicted) or `status` (outcome). `compiled` is written by `qab.js compile`
(`pfp`, `sources[]`, `used`, `dropped[]`); `escalated` is reserved. Every line is also mirrored
into the run's `events.jsonl` (`run-protocol.md`). If Node is unavailable, append the same
shape with `echo … >>` and add `"writer":"manual"` so distill can report the ratio.

`qab.js stats` turns the log into per-source counts (`in_slice`, `applied`,
`contradicted`, `runs`, `last_applied`, LRN and REF rows alike), the computed
findings below, the fingerprint recurrence table, and **citation compliance** —
of runs with an outcome, how many logged at least one REF `applied` (RFC 0001
PR4 gate: ≥ 4/5). `qab.js scoreboard` writes the same numbers to
`.cache/scoreboard.json` next to the learnings file — a derived cache (gitignore
`features-kb/.cache/`), rebuilt from the two logs whenever needed, never a
source of truth. A skill never reads the log or the scoreboard; only distill
(and, later, the scored compiler) does.

## Failure fingerprints
<!-- qab: id=fingerprints -->

A fingerprint names a failure **class**, not an incident, so the same failure
recurring in a later run is countable — and counts against the learning that
claimed to prevent it. When a skill hits one of the closed kinds, it runs:

```bash
node <references>/bin/qab.js fp <kind> "<key>"       # e.g. fp locator-not-found "checkout/place-order-btn"
node <references>/bin/qab.js fp --list               # this run's fingerprints (ffp · kind · key · active)
```

- **kind** — closed vocabulary, grown deliberately, never ad hoc:
  `locator-not-found` (e2e-pom heal) · `spec-flaky`, `fixture-missing` (e2e-write
  gates) · `ac-unmapped`, `env-unreachable`, `auth-failed`, `assertion-mismatch`
  (qa) · `ci-step-failed` (verify-fix) · `tool-unavailable` (any skill).
- **key** — names the class at the level a rule would address: `screen/element`,
  `TICKET/AC#`, `spec › TC-id`, `pipeline/step`. The helper normalizes it
  (lowercase; timestamps, UUIDs, hashes, ports, long digit runs removed) and
  hashes `ffp = sha256(kind + "\n" + key)[:12]`, so incidents that differ only
  in run id or entity entropy land on the same `ffp`.
- **active** — the learnings in this run's slice whose `Fingerprint:` equals the
  new `ffp`. Non-empty means a rule that claimed to prevent this class did not:
  the helper says so, you flag it in the report, and distill lists the entry as
  *falsified (fingerprint)* — no human re-judgment needed to detect it.
- Lines land in `fingerprints.jsonl` next to the learnings file (committed,
  append-only, `v: 1`) and are mirrored into the run directory. One line per
  distinct failure per run; the same class failing three times in one run is one
  fingerprint.
- Emit only at the skill's named detection points; a fingerprint is evidence,
  not a note. Anything else goes in `## Candidate learnings`.

## Lifecycle
<!-- qab: id=lifecycle -->

`active` → applied on every matching run.
`promoted` → distill moved it into references (and optionally upstream); kept for provenance with a pointer to where it landed and to the residue entry that keeps its project-specific values. A promoted entry is not compiled — never leave a live rule only inside it.
`retired` → falsified or obsolete; kept with a one-line reason, never deleted.
Entries are falsifiable statements: contradicting evidence retires them.

Distillation (dedupe, retirement, promotion) is `/qa-improve`'s job — trigger it
with "distill learnings", or when a skill flags a falsified entry, or when the
file exceeds ~30 active entries. Distill computes from the log, not from
`Evidence:` prose:

| Finding | Rule (from `qab.js stats`) |
|---|---|
| **Promotion candidate** | `applied ≥ 3` across `≥ 3` distinct runs ∧ `contradicted = 0` ∧ (if `Fingerprint:`) its `ffp` silent since the entry's date — then the human judgment: generalizable beyond this project? |
| **Falsified (contradiction)** | `contradicted ≥ 2` ∧ no `applied` after the last contradiction |
| **Falsified (fingerprint)** | any `fingerprints.jsonl` line naming the entry in `active` — the failure class it claimed to prevent recurred with the rule in force |
| **Never applied** | `in_slice ≥ 10` ∧ `applied = 0` — compiled into the slice ten times, never shaped output (candidate-count dormancy, not calendar age) |
| **Duplicate (fingerprint)** | two `active` entries with the same `Fingerprint:` ∧ the same `Scope:` — the newer duplicates the older id |

## Gates (what can change the library, and who)
<!-- qab: id=gates -->

1. **Human gate** — every status change and every reference edit is proposed,
   shown with its evidence, and applied only after the SDT says so.
2. **Eval gate on promotion** — a learning promoted into references must not
   regress any skill in that section's scope: run each scoped skill's
   `tests/fixtures.json` before and after the edit; merge only if
   `pass_after ≥ pass_before` for every skill. Otherwise the edit is reverted,
   the LRN stays `active`, and `features-kb/LEARNINGS.rejected.md` records
   `date · LRN · target · failing fixture ids · why`. Rejections are named, never silent.
3. **Critic (`--dry-run`)** — the full distill sweep written to
   `features-kb/distill-proposal-<date>.md` with **zero edits**. Detection and
   proposal are automatic; application is human. Suggested by any run that sees
   `active > 30` or a falsified flag; never self-launched.
4. **Never** — no LLM writes to `references/` outside gate 2; no auto status
   changes (a later opt-in, off by default, may retire fingerprint-falsified
   entries with an audit line — reference edits stay human forever).
