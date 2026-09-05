# Changelog

All notable changes to QABuddy are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) — pre-1.0, so a minor bump
may remove a skill.

한국어: [CHANGELOG-ko.md](CHANGELOG-ko.md)

## [Unreleased] — POC branch `poc/cloud-service`

Proof of concept for PR-triggered runs ([RFC 0004](docs/rfc/0004-headless-pr-coverage.md)).
Not proposed for `main`.

### Added
- **Headless Mode** in the Tier 1 preamble: opt-in via `QABUDDY_HEADLESS=1` or
  `--headless`; every pause takes the stated recommendation and is logged as an
  Auto-decision; escalations close the run as `BLOCKED`; write scope limited to
  `features-kb/`, `playwright/`, `.qa-reports/`; machine-readable close file.
  Gate overrides in `/qa-start`, `/qa-test-plan`, `/qa-test-cases`,
  `/qa-exploratory`, `/qa-e2e-setup`, `/qa-e2e-pom`; six `headless` eval fixtures.
- `bin/pr-coverage.js` — deterministic diff→feature mapping (`touched`), a per-AC
  coverage heatmap over Unit / API / E2E / Manual / Exploratory where *covered*
  needs evidence on disk (`heatmap`), and a sticky PR comment (`comment`).
  48 structural checks.
- **Reusable workflow** `.github/workflows/pr-coverage.yml` (`workflow_call`): jobs
  `resolve → preflight → kb → (explore ∥ automate) → deliver`, one Claude session per
  phase with its own caps; consumers call it with a ~15-line workflow that
  `pr-coverage.js init` writes. `pr-coverage.js merge` (three-way union of phase trees),
  `preflight` (prerequisites before any spend), `init` (scaffolder). Prompts, `render.js`,
  `install.sh`, MCP config under `.github/pr-coverage/`.
- KB spec §6.8 `sources.json` (code and test globs per feature) and §6.9
  `exploratory/{date}.md` (persisted session with an AC-keyed results table).

### Changed
- `/qa-test-cases` writes the KB spec §6.5 mapping shape (`testCases[{id, layer,
  type, status}]`); the older `e2e_tests[]` files stay readable.
- `/qa-exploratory` Focus Area Results table gains `ACs` and `Result` columns.

## [0.8.0] — 2026-08-29

The engine release. QABuddy's in-tree compiler/learning engine (`qab.js`,
1,189 lines) is replaced by [Akela](https://github.com/TimothyHan/akela) —
the same engine, extracted and generalized, now maintained upstream (npm
`akela`, pinned 0.1.4, vendored into dist at build time so installs stay
self-contained). [RFC 0003](docs/rfc/0003-akela-adoption.md) records every
decision and every behavioral delta.

### ⚠️ Upgrade notes

- **Building now needs one `npm ci`** before `node build.js all` — the build
  vendors the pinned engine and refuses to run without it. Installs are still
  symlinked; no reinstall.
- **Existing projects: zero manual steps.** The first skill run generates
  `akela.json` from your `.qabuddy.json` + the shipped qa domain pack and
  announces it on stderr. From then on the file is yours — engine settings
  (scope overrides, PRJ knowledge, scoring) live there; `.qabuddy.json`
  keeps workflow settings. Paths are `~/`-portable, so commit it.
- **Logs are one-way.** Akela reads historical `skill`-keyed lines, but new
  lines are `activity`-keyed — once new runs are logged there is no engine
  rollback to 0.7.x.
- **`bin/qab.js` is now a deprecation shim** (same arguments, prints a
  notice) and survives one release; point scripts at `bin/akela.js`.
- **Two configurations stop working, loudly** (each refusal names its fix):
  `compiler.references` globs spanning **multiple directories** (Akela takes
  one knowledge root per namespace — consolidate house methodology under one
  directory), and a configured knowledge directory that **does not exist**
  (was a zero-match warning; now a config error). Everything else migrated
  in our upgrade simulation with zero manual steps — scope overrides, PRJ
  files, learnings, mixed old/new logs, and a stale run marker included.

### Changed

- **The engine is Akela.** `bin/akela.js` (91 lines) maps `QAB_*` env onto
  `AKELA_*`, auto-generates `akela.json` on first run, and runs the engine
  in-process. The **qa domain pack** (`references/engine/qa.domain.json`)
  carries QABuddy's QA-ness: 13 activities, the profile probes as declarative
  rules (pfp proven identical), the closed fingerprint vocabulary, statuses,
  scratchpad sections, `qa-` alias prefixes.
- **Stricter by design** (each asserted in the suite): unknown skill names
  are refused with the full activity vocabulary (exit 1, no junk run — the
  final form of the #54 guard); a missing knowledge root refuses the compile
  (was a warning); one knowledge root per namespace (the old stem-collision
  class is refused at config time).
- **Detection power kept the strong way:** nothing was retired — all 1,275
  structural checks now run against Akela through the shim, every divergence
  adjudicated and recorded in RFC 0003 §2.
- This file is now English-primary (`CHANGELOG.md`), Korean in
  [CHANGELOG-ko.md](CHANGELOG-ko.md) — matching the repo's README convention.

### Upstreamed

Three first-consumer findings shipped as **akela 0.1.4** and were consumed
the same day: an exported `main()` (in-process embedding), `~/` path
expansion (portable committed config), and knowledge-root `exclude` patterns.

## [0.7.1] — 2026-08-28

Patch release: one compiler bugfix (#54, already on main) and the repo's switch
to English-default.

### Fixed

**Compiler returned an empty slice for installed skill names** (#54)
An installed name like `compile --skill qa-exploratory` (`qa-` prefix) matched
no scope, producing a 0-source slice **silently** — the model proceeded with no
knowledge and nothing said so (observed live 4 runs in a row, 2026-08-27). The
`qa-` prefix is now normalized (printed as `skill alias: qa-x → x`), and any
0-source compile warns loudly on stderr with the list of known scope tokens.
4 structural checks added (1,243). The fix is also generalized upstream in the
extracted engine [Akela](https://github.com/TimothyHan/akela) 0.1.3
(`aliasPrefixes`).

### Changed

- **English-default README** — the root now matches the subdirectory
  convention: `README.md` = English, `README-ko.md` = Korean. The content delta
  is a light revision, not just a swap (+27/−11 per file).
- **New "How It Learns" section** (both languages) — the 5-step evidence loop
  (compile → cite → capture → falsify → distill) and the `REF-`/`PRJ-`/`LRN-`
  contract, above the fold.
- **SDT → QA terminology** (visitor surfaces: READMEs, self-learning guides) —
  reflecting that this applies to anyone testing software. Skill-internal text
  is a follow-up.
- Clone URLs updated to the renamed repo (`qa-buddy-skills`) — the old URLs
  were riding on a redirect.

### Upgrade note

No breaking changes. `git pull` then re-run `node build.js all` (Korean:
`--locale ko`) — qab.js changed, so a rebuild is needed.

## [0.7.0] — 2026-08-21

The release that ships RFC 0002. v0.6.0's verdict was "the selection layer isn't
user-owned" — this release hands that layer to the project. Fixing scopes yourself,
adding team knowledge, measuring scoring eligibility on your own data, and being told
the moment the gate opens: all four land as **opt-in** capabilities behind `.qabuddy.json`.

### ⚠️ Upgrade note

No breaking changes — none of the new capabilities change behaviour unless configured.
`git pull` then re-run `node build.js all` (Korean: `--locale ko`); installs are
symlinked, so no reinstall needed. One thing got stricter: unknown keys under
`compiler` in `.qabuddy.json` are now refused loudly — so a typo can't silently
disable a capability.

### Added
- **Scope overrides — `compiler.scope`** (#46). Add/remove which skills receive a
  shipped reference section, from project config. `tier=must` is a floor (removal
  refused), unknown ids are refused with a nearest-match suggestion, and every
  override is visible in the manifest as `via:`/`reason: project-override`.
- **Project-owned reference sections — `compiler.references`** (#47). Team-authored
  methodology files compile under the same `qab:` contract as shipped references.
  Ids are namespaced `PRJ-<stem>#<id>` — no collision with shipped ids, and a
  citation is always unambiguous about provenance.
- **Gate report — `qab.js gate`** (#48). Evaluates the RFC 0001 §9.3 scoring
  eligibility gate on this project's own logs. It assembles evidence and never
  classifies causes — judging why a section is dormant stays human (decision 6).
- **Scoring — `compiler.scoring` + the gate-opened notification** (#50). Per-profile
  scored selection with a floor (`tier=must` ∪ recently applied ∪ all learnings) —
  a global ranking is forbidden by design (§9.3). Refuses to enable without gate
  eligibility; the only exception is a `scoringOverride` note recorded in the log as
  a decision. On the exact outcome that tips the gate, `log outcome` prints a 🔓
  notice and the skill explains the gain and the risk in plain language before
  asking the SDT — the decision and the config edit always stay human.
- **The Self-Learning & Context Compiler user's guide** (#49) —
  [docs/self-learning-guide-en.md](docs/self-learning-guide-en.md) (en+ko): the
  automatic per-run loop, how to read a manifest, the three knowledge layers,
  recipes for all four capabilities above, and what the unbuilt E (auto status
  changes) would do — and why it waits until the data asks for it.

### Changed
- RFC 0002 status Draft → **Accepted, A–D built** — decisions 8–13 recorded (gate
  lives in qab.js, knobs are constants, learnings are floor, audition is
  deterministic, thin profile data compiles unscored).
- Structural check suite 1,164 → **1,239** — behavioural tests plus mutation smokes
  for every new capability (17 mutations in total, each detected by a named check).
- The manifest's compiler stamp moves to 0.7.0, and a scored compile shows
  `scoring: on` with `score`/`n`/`(audition)` and `reason: budget` evidence.

## [0.6.0] — 2026-08-20

Closes the RFC 0001 arc. v0.5.0 shipped it mid-flight (PR0–PR6 out, PR7/PR8 pending);
this release ships the conclusion — the gate opened, the measurement was taken, and it
argued against building PR7.

### ⚠️ Upgrade note

`/qa-sprint-status` was removed. If you installed v0.5.0 or earlier, its entry is left
behind pointing at a skill that no longer exists. **Re-run your installer and it is pruned
automatically** — `dist/claude/setup` (or `setup.ps1`). `--status` reports leftovers as
`ORPHAN`; install and uninstall remove them. Skills belonging to other tools are never
touched.

### Removed
- **`/qa-sprint-status`** (#29). Its reference sections were rehomed to the skills that
  actually used them; nothing else lost knowledge.
- `test-behavioral.md` (#36) — a manual test plan untouched since v0.1.0, covering 9 of
  13 skills. Its job is done by eval fixtures (all 13 skills, 67 fixtures) and by CI's
  install/adopt smokes.

### Added
- **Reproduction conditions before "cannot reproduce"** (#24). A rule that repro steps
  record what the reporter *did*, not the run conditions that were also true — time and
  timezone, locale, viewport, account, data state, build. Restore them one at a time; if
  it still will not reproduce, record *"not reproduced under: {conditions tried}"*.
  Scoped to `/qa-qa`, `/qa-verify-fix`, `/qa-exploratory`, `/qa-review-ticket`,
  `/qa-test-cases`.
- **A data-exposure axis in the severity scale** (#27). Severity was graded by what a bug
  blocks; it now also grades by what it exposes — credentials or personal data readable by
  the wrong person is a Blocker, another user's data or an unauthenticated write is
  Critical, and leaks that survive correct authorization (existence disclosed by status
  code, enumerable ids, sensitive values in URLs or logs) are Major.
- **Two patterns promoted into `playwright-patterns.md`** (#28), both from measured
  failures: the Next.js route-announcer pitfall, and queueing an entity's cleanup
  **before** asserting on it — a negative test that expected a 4xx but got a 201 must
  still clean up, and asserting first means the throw skips the queueing.
- **Orphaned-skill pruning** in all six installers (#40), with CI smokes on bash and
  PowerShell 5.1.
- **Doc claims verified against the repo** (#34, #37). Skill counts, `/qa-*` command
  references, playbook file counts, preamble sizes and relative links are now derived
  rather than hand-maintained — as is the playbook index's "Used by" column, which had
  drifted on 5 of 11 rows.

### Fixed
- `qab.js compile` no longer reuses a run marker when `--ticket` differs (#19) — bug-key
  runs were inheriting a story run's profile.
- `qab.js` no longer dies with an EPIPE stack trace when stdout closes, e.g.
  `qab.js stats | head` (#22).
- `qab.js` refuses to append events to a run that already reported its outcome (#30).
- The severity and priority scales were duplicated in the preamble; the references are now
  the single source (#26). This is why `#severity-scale` looked dormant in the logs.
- Reference files now name skills with the installed `qa-` prefix (#20, 66 places).

### Changed
- **RFC 0001 closes at PR0–PR6** (#31). Its §9.3 gate opened — two profiles with 9 and 8
  attributed outcomes, application measurably uneven — so the measurement it authorized was
  taken, and it argued against scoring: of 18 sections never applied across 28 runs, **0
  were selection failures**. Scope hygiene achieved the reduction scoring was meant to
  earn, deterministically. This is a verdict on one project's data, not on scoring as an
  idea.
- **PR7/PR8 re-framed** as capabilities a project opens with its own measurements, rather
  than phases QABuddy ships once — [RFC 0002](docs/rfc/0002-project-owned-compiler.md)
  (Draft, #32).
- README and CONTRIBUTING realigned with the shipped tool (#33, #34, #35, #38): the
  context compiler is now named and diagrammed, the `features-kb/` tree shows the learnings
  layer, and stale counts are corrected.

## Earlier releases

Predate this file. See the release notes:
[v0.5.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.5.0) — context
compiler (RFC 0001 PR0–PR6) ·
[v0.4.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.4.0) — test-suite
verification methodology ·
[v0.3.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.3.0) — support
policy, `--adopt` migration, self-dogfooding ·
[v0.2.3](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.3) — installer
ownership verification ·
[v0.2.2](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.2) ·
[v0.2.1](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.1) — Windows
fixes ·
[v0.2.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.2.0) — the
self-evolving QA foundation ·
[v0.1.0](https://github.com/TimothyHan/qa-buddy-skills/releases/tag/v0.1.0) — first
release
