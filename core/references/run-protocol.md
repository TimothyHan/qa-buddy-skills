# Run Protocol: compiled slice, run directory, scratchpad
<!-- qab: scope=improve,setup tier=must -->

Every skill run gets a directory, a compiled knowledge slice, and a scratchpad.
The compiler *selects* knowledge; it never rewrites it. Design: RFC 0001 (§3.7, §3.8, §5).

## The compile step
<!-- qab: id=compile-step -->

`node <references>/bin/qab.js compile --skill <skill> [--ticket <KEY>]` (the preamble gives the
exact command). It starts the run if none is current, then writes `<runsDir>/<run>/`:

| File | Contents |
|---|---|
| `slice.md` | manifest (front matter) + **verbatim** source text, each under `## <id> — <heading>` (REF) or `## LRN-…` |
| `profile.json` | `{schema: profile/1, skill, surface, pom, ticket_kind, pfp}` — deterministic, `unknown` is a value |
| `scratchpad.md` | `## Plan` · `## State` · `## Findings` · `## Candidate learnings` |
| `events.jsonl` | this run's log lines (also appended to the project `learnings-log.jsonl`) |

**Candidates** = reference sections whose `scope` names this skill (+ `tier=must` sections scoped
`all`) ∪ `active` learnings whose `Scope` includes the skill (or `all`) and whose `Profile:` matches.
**Packing (unscored, PR5):** `must` first, then sections in file order; each learning right after the
section it `Overrides`, else at the end. **No budget cap** — the slice equals what the skill read
before, by construction; `budget.used` is recorded so slice size becomes a metric. Sections scoped
`all` that are not `must` (KB spec, terminology) are listed under `dropped: general-scope`, not packed.
Scoring and caps arrive later, behind a flag.

## Reading the slice
<!-- qab: id=reading-the-slice -->

Read `slice.md` once at start; it **replaces** reading the learnings file and the reference sections it
lists. Only open a reference file the skill names if the manifest does not contain a section from it.
The manifest is provenance: cite the `## <id>` headers exactly as before (`qab.js log applied <id>`),
and use `dropped:` to see what nearly made it. **Fallback:** if the helper is unavailable, read the
skill's references and the learnings file directly (skill-scoped, `active`) — same set, no manifest.

## Scratchpad
<!-- qab: id=scratchpad -->

- `## Candidate learnings` (**every skill**): anything noteworthy mid-run, no evidence bar. At close the
  three capture triggers are applied to **these candidates only**; what passes becomes an evidence-backed
  `LRN-` entry, the rest stays in the run directory. This is what keeps entries to one fact each.
- `## Plan` / `## State` (**tier-2 multi-phase skills**): write the plan before Phase 1; update state at
  each phase boundary and at every Review Options pause, and re-read the scratchpad before continuing.
- `## Findings`: free-form working notes.

## Run directory retention
<!-- qab: id=retention -->

`runsDir` (default `.qa-reports/runs`) and `retainRuns` (`captured` — keep runs that captured or
contradicted; `all`; `none`) live in `.qabuddy.json`. Run directories are local (`.qa-reports/` is
gitignored); the log lines they mirror are the shared record. Pruning is manual until a project needs more.
