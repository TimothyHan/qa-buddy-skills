# Self-Learning & the Context Compiler — User's Guide

한국어: [self-learning-guide.md](self-learning-guide.md)

QABuddy calls itself "a QA foundation that learns your project." This guide explains
what that sentence actually means: **what happens automatically** every time you run
a skill, **the files** that process leaves behind, and **the levers you own**.

This is for QA folks *using* QABuddy skills. To change QABuddy itself, see
[CONTRIBUTING-en.md](../CONTRIBUTING-en.md). For the design rationale, the primary
sources are [RFC 0001](rfc/0001-context-compiler.md) (the compiler) and
[RFC 0002](rfc/0002-project-owned-compiler.md) (project-owned configuration).

---

## 1. The loop at a glance

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
  ① compile ──► ② skill run ──► ③ cite & log ──► ④ capture ──► ⑤ distill
  (slice.md)    (normal QA)     (applied/          (LEARNINGS.md)  (retire ·
                                 contradicted)                      promote)
```

1. **Compile** — when a skill starts, `akela.js compile` selects only the knowledge
   scoped to *that* skill and packs it into one `slice.md`. The skill reads the
   slice instead of opening the whole reference library.
2. **Run** — the skill does its normal work (test plans, QA, reviews…).
3. **Cite & log** — when a piece of knowledge actually shapes the output, its ID is
   cited and logged as `applied`. When reality contradicts one, that is logged as
   `contradicted` instead.
4. **Capture** — at close, if a genuinely new project-specific fact surfaced, it is
   added to `LEARNINGS.md` as a learning.
5. **Distill** — with enough log evidence, `/qa-improve` distill merges duplicates,
   retires falsified learnings, and proposes promoting proven ones.

The whole loop is **evidence-based**: no judgment comes from vibes — every decision
reads counts from the log (how often `applied`, how often `contradicted`, how many
times a source rode in a slice).

---

## 2. The three layers of knowledge

| Layer | ID prefix | Owner | Lives in | Survives updates |
|---|---|---|---|---|
| Shipped references | `REF-` | QABuddy | installed `references/` | overwritten (upstream owns it) |
| **Project references** | `PRJ-` | **your team** | your repo (`akela.json` `PRJ` knowledge root) | ✅ |
| **Learnings** | `LRN-` | **your project** | `features-kb/LEARNINGS.md` | ✅ |

- **`REF-`** — methodology QABuddy ships (severity scales, Playwright patterns, the
  defect lifecycle…). Every section declares which skills receive it (`scope`) and
  how essential it is (`tier`).
- **`PRJ-`** — stable methodology your team authored ("we test payments this way").
  §6.2 shows how to create these.
- **`LRN-`** — facts observed during real runs ("this app's error banner has no role
  attribute"). They carry evidence and a lifecycle, and **when they conflict with a
  reference, the learning wins** — what was observed in your project beats the
  general rule.

The `PRJ-` / `LRN-` distinction matters: a learning is *accumulated evidence* with a
lifecycle (retire/promote); a team playbook is *authored* and stable. Force a
playbook into the learnings file and distill will keep proposing to retire it for
lack of `applied` counts.

---

## 3. What happens automatically on every skill run

You don't do any of this by hand — the skill preamble does. But knowing what lands
where lets you trace any run afterwards.

### 3.1 Compile and the slice

```bash
node $QAB compile --skill qa --ticket PROJ-123
```

That one line:

- creates a run directory (`.qa-reports/runs/<run>/`)
- selects candidates — `REF-`/`PRJ-` sections whose `scope` names this skill
  (+ `tier=must` sections scoped `all`) ∪ `active` learnings scoped to this skill
- packs them into `slice.md` — `must` first, each learning right after the section
  it overrides

What the run directory holds:

| File | Contents |
|---|---|
| `slice.md` | manifest + knowledge bodies (everything the skill actually read) |
| `profile.json` | the run profile (surface, pom, ticket_kind) and its hash `pfp` |
| `scratchpad.md` | the skill's working notes — `## Candidate learnings` collects capture candidates |
| `events.jsonl` | this run's copy of its log events |

### 3.2 How to read a manifest

The manifest at the top of `slice.md` explains *why* each piece of knowledge is in
or out:

```yaml
---
manifest: 1
run: qa-PROJ-123-3f9a2c
activity: qa
pfp: 5408a28cb4ac
compiler: akela 0.1.4   domain: qa   scoring: off
sources:
  - id: REF-playbook/risk-and-priority#severity-scale   tier: must   lines: 18
  - id: PRJ-payments#seed-rules   tier: should   lines: 4   via: project-override
  - id: LRN-20260817-05   tier: lrn   lines: 3
dropped:
  - id: REF-feature-knowledge-base-spec#problem   reason: general-scope
  - id: LRN-20260801-03   reason: profile
  - id: REF-playbook/defect-lifecycle#not-reproducible   reason: project-override
---
```

| Marker | Meaning |
|---|---|
| `via: project-override` | packed **because of** your `compiler.scope` config |
| `reason: project-override` | removed by your config |
| `reason: general-scope` | scoped `all` but not `must` — general context, not packed |
| `reason: profile` | the learning's `Profile:` doesn't match this run (e.g. api-only learning, web run) |

A slice always explains itself — the answer to "why is this here?" is in the manifest.

### 3.3 Citing and logging — the loop's fuel

When a skill takes a severity from a scale or follows a selector rule, it cites the
section ID and records it:

```bash
node $QAB log applied REF-playbook/risk-and-priority#severity-scale
node $QAB log contradicted LRN-20260808-04 --note "observed: the script uses --prefix"
```

This log (`features-kb/learnings-log.jsonl`, append-only, committed) is the system's
**single source of evidence** — distill's retire/promote decisions and the gate in
§6.3 all read it. A mistyped ID is rejected with a nearest-match suggestion, so a
wrong citation never enters the log.

Failures leave **failure-class fingerprints** too:

```bash
node $QAB fp locator-not-found "checkout/place-order-btn"
```

The same class of failure hashes to the same fingerprint (`ffp`) across runs. If a
learning claimed to *prevent* that class and the fingerprint fires again — that is
automatic falsification evidence.

### 3.4 Capture — where learnings are born

Before closing a run, the skill applies three triggers to the scratchpad candidates:

1. a documented rule broke in the face of reality
2. an undocumented decision was made
3. the QA made a correction that carried project knowledge

If one fires, an evidence-backed `LRN-` entry is added to `LEARNINGS.md`. If none
fires, nothing is written — the learnings file is not a scratch pad.

---

## 4. Maintaining the layer — stats and distill

### 4.1 Seeing where you stand

```bash
node $QAB stats
```

Prints, per source, `in_slice` (how often it rode in a slice) · `applied` ·
`contradicted` · `runs` · `last_applied`, with computed findings as labels:

| Label | Computed from | Meaning |
|---|---|---|
| `promotion candidate` | applied ≥ 3, runs ≥ 3, zero contradictions, fingerprint silent | proven — candidate for canon |
| `falsified (contradiction)` | contradicted ≥ 2, nothing applied after | reality pushed back twice |
| `falsified (fingerprint …)` | the failure class it claimed to prevent recurred | automatic falsification |
| `never applied (in_slice N)` | packed ≥ 10 times, applied 0 | dormant — a candidate for §6.1 |
| `duplicate (fingerprint) of …` | same fingerprint ∧ same scope | duplicate |

### 4.2 Distill

When a skill flags a falsified learning, or active learnings pass ~30, it is time
for `/qa-improve` distill. Distill **proposes only** — based on the computed columns
above — and every application goes through your approval:

- **merge** — two entries stating the same fact
- **retire** — falsified or long-dormant learnings (a status change, never a
  deletion — history is permanent)
- **promote** — proven, generalizable learnings into reference canon (only if the
  eval gate passes)

`--dry-run` writes a proposal file and edits nothing.

---

## 5. Why all this exists — one paragraph

After building this loop, RFC 0001 asked itself: "now that we have logs, should we
turn on **scoring** that prioritizes frequently-applied knowledge?" The measurement
said **no** — of 18 sections never applied across 28 runs, **zero** were dormant
because selection chose badly, and the needed reduction was achieved
deterministically by scope hygiene. But that was a verdict on *one project's data*.
So RFC 0002 hands the measuring instruments to you: fix scopes yourself (§6.1), add
your team's knowledge (§6.2), and measure whether **your data** justifies scoring
(§6.3).

---

## 6. Owning the compiler — `akela.json`

This is RFC 0002 — delivered, since v0.8.0, through the extracted engine
[Akela](https://github.com/TimothyHan/akela) ([RFC 0003](rfc/0003-akela-adoption.md)).
Engine configuration lives in **`akela.json`**: generated on your first run from
`.qabuddy.json` + the shipped qa domain pack (or explicitly via
`node $QAB akela-init`), then **yours** — its paths are `~/`-portable, so commit
it; it is reviewable in a PR and survives QABuddy updates, which is exactly the
difference from editing shipped files. `.qabuddy.json` keeps workflow settings
only. All three capabilities below are **opt-in**: without configuration,
nothing changes.

### 6.1 Scope overrides — `compiler.scope`

Change, per project, which sections ride in which skills' slices:

```jsonc
// akela.json
{
  "compiler": {
    "scope": {
      "REF-playbook/maintenance-and-ci#ci-cd-pipeline": { "remove": ["qa"] },
      "REF-playbook/exploratory-heuristics#techniques-per-heuristic": { "add": ["test-cases"] }
    }
  }
}
```

Effective scope = (original scope − remove) ∪ add, applied **after** core
resolution — upstream changes to a section's default scope still flow through.

**The rules — every one fails loudly:**

- **`tier=must` is a floor.** A `remove` on a must section makes the compile refuse
  with a named error. Rails stay rails.
- **Unknown IDs are refused** with a nearest-match suggestion. A silently dead
  override ("I believe I configured this, but it's ignored") is worse than an error.
- **Every override is visible in the manifest** (`via:`/`reason: project-override`, §3.2).

**When to use it:** `stats` shows a section as `never applied`, and *your own
judgment* says it cannot fire in your domain. Or the reverse — a section scoped to
another skill is knowledge your team's workflow needs in this one: `add`.

### 6.2 Project reference sections — a `PRJ` knowledge root

Put your team's methodology files into the compile pipeline with the same standing
as shipped references — one directory, declared as a knowledge root (Akela takes
**one root per namespace**, which is what keeps `PRJ-` ids unambiguous):

```jsonc
// akela.json
{ "knowledge": [
    { "path": "~/.claude/skills/qa-references", "namespace": "REF" },
    { "path": "features-kb/house", "namespace": "PRJ" } ] }
```

Files use the **same contract** as shipped references — a `qab:` comment on the
line under each heading:

```markdown
# Payments testing
<!-- qab: scope=test-cases,qa -->

## Seed rules
<!-- qab: id=seed-rules -->

Payment tests use sandbox account P-77 only; never real cards.

## Refund checks
<!-- qab: id=refund-checks scope=qa tier=must -->

Refund verification is cross-checked against the ledger export.
```

- The H1 comment holds file defaults (`scope=`, `tier=`); section comments override
  per section.
- IDs are namespaced `PRJ-<file-stem>#<id>` (`PRJ-payments#seed-rules`) — collision
  with shipped `REF-` IDs is impossible, and a citation in the log is always
  unambiguous about whose knowledge it was.
- They participate fully: compiled, cited, counted by `stats`, reviewed by distill —
  exactly like `REF-` sections.
- Broken files (an untagged `##`, duplicate IDs) refuse the compile naming
  file:line; a knowledge directory that does not exist refuses too, naming the
  root — configuration errors are never a shrug.

**What belongs here rather than in learnings:** stable methodology your team
*decided*. Facts *observed* during runs are still learnings. When unsure, ask: "is
this a hypothesis that could retire or promote?" — if yes, it's a learning; if no,
it's a house section.

### 6.3 The gate report — `akela.js gate`

```bash
node $QAB gate          # human-readable
node $QAB gate --json   # machine-readable
```

Evaluates the RFC 0001 §9.3 scoring-eligibility gate **on your project's own logs**:

```
gate (RFC 0001 §9.3, evaluated on this project's logs — RFC 0002 §2.3):
  profiles with attributed outcomes (need ≥ 2, each ≥ 8):
    5408a28cb4ac  9 outcomes (DONE=8 DONE_WITH_CONCERNS=1)
    a80fefa0c1ba  8 outcomes (DONE=8)
  application:
    repeatedly applied (runs ≥ 3): 12 · dormant (in_slice ≥ 10 ∧ applied = 0): 3
    dormant: REF-playbook/metrics-and-coverage#code-coverage (REF)  in_slice 14
    …
  verdict: ELIGIBLE — 2 profiles carry ≥ 8 outcomes and application is uneven …
```

- **The threshold**: ≥ 2 distinct profiles (`pfp`), each with ≥ 8 outcomes — and
  application must be uneven (dormant sources coexisting with repeatedly-applied ones).
- Outcome runs without a profile are reported but never summed into any profile
  (a mechanical guard against a mis-attribution mistake that actually happened once).
- **The report assembles evidence; it does not classify causes.** Even on ELIGIBLE
  it ends by asking *you*: is each dormant source *unable to fire*, *duplicated
  elsewhere*, *waiting for work that hasn't happened*, or *a genuine selection
  failure*? On QABuddy's own data, 0 of 18 dormant sections were selection
  failures — a tool that guessed the cause would reproduce exactly the error that
  verdict warns about.

**QABuddy tells you the moment the gate opens.** When the exact outcome that tips
the threshold is logged, `log outcome` prints a 🔓 notice, and the skill relays it to
you and asks whether you want scoring — it fires exactly once, on the transition,
and the decision plus the `akela.json` edit always stay human.

### 6.4 Turning scoring on — `compiler.scoring` (PR D)

The trade-off in one breath: **gain** — leaner runs (knowledge proven useful in
*this* project packs first, the rest trims to a budget → more context left for the
ticket itself). **Risk** — knowledge that is correct but merely unused *so far* can
be trimmed too. In QABuddy's own measurement, most "unused" knowledge was exactly
that — which is why this decision belongs to a human, not the tool.

```jsonc
{ "compiler": { "scoring": true, "budget_lines": 220 } }
```

With it on, the compile scores candidates **per profile** and drops the tail past
the budget:

- **The floor never drops**: `tier=must` sections, sources applied in this
  profile's last 3 runs, and every learning (a project's own corrections are not
  subject to the budget). Even a budget smaller than the floor packs the whole floor.
- **Scores come from this profile's data only** (`applied_ratio × contradiction
  penalty × recency × freq`). Below 8 outcomes for this profile the compile falls
  back to **unscored** — never to a global ranking (the exact error §9.3 forbids).
- **Every 10th run auditions**: the best budget-dropped candidate rides along
  marked `(audition)`, so dormant knowledge keeps getting chances to earn `applied`.
- The manifest shows everything: `score:` and `n:` on packed sources,
  `reason: budget score: … n: …` on dropped ones.

**The enabling rule (RFC 0002 §2.4):** if the gate is not eligible, the compile
refuses with the reason. To proceed anyway, set `"scoringOverride": "<one-line
note>"` — the note is **recorded in the log as a decision** (exactly once per
distinct note). What's blocked is not scoring — it's turning it on *silently*.

### 6.5 The last piece, E — and the manual work that remains yours

The one unbuilt piece of RFC 0002 is **E (auto status changes)**. When built, it
would auto-apply the transitions the log has mechanically decided — retiring a
learning whose fingerprint-confirmed falsification recurred, promoting one past the
evidence threshold (applied ≥ 8, zero contradictions) — with an audit event each
time. Reference edits stay human even then.

**Without E, the entirety of your manual work:**

| Manual step | How often | Would E remove it? |
|---|---|---|
| The distill session — launch it when a skill suggests, read the plan, approve | ~once per sprint | **Partly** — only the mechanically-decided rows (fingerprint retirements, threshold promotions) get pre-checked. Merges, copy detection and generalizability judgment stay human+LLM even with E |
| Classifying dormant sections when the gate opens | once, when it opens | No — human by design (decision 6) |
| Editing `akela.json` (overrides, house files, scoring) | only when deciding | No — the signature stays human (§6 non-goal) |
| Authoring house reference files | when team methodology exists | No — only your team can write it |
| Approving reference (canon) edits on promotion | per promotion | No — human forever |

So **the distill session survives E** — E only pre-handles a few rows of its
agenda. Today those mechanical rows number one or two per session, so the
automation would not yet pay for its risk. **The signal to build it:** when your
distill plans start filling with rubber-stamp mechanical rows — at that point the
logs justify E, and they will also have answered its open design questions
(whether to introduce a `candidate` status, and where the transition triggers).

---

## 7. Recipes

**"A section keeps riding in slices but never applies"**
→ `node $QAB stats`, confirm `never applied` → classify the cause *yourself* → if
it can't fire in your domain, `remove` it via `compiler.scope` → verify
`reason: project-override` in the next run's manifest. If it's merely "that kind of
work hasn't happened yet," leave it — dormancy is not a crime.

**"Our team wiki has a testing-methodology doc"**
→ Move it under `features-kb/house/`, add `qab:` comments, declare the directory
as the `PRJ` knowledge root in `akela.json` (§6.2) → from the next run it rides in
the scoped skills' slices, and citations show up in `stats`.

**"We want to turn scoring on"**
→ `node $QAB gate`. NOT ELIGIBLE is the answer (usually: the data is still thin).
On ELIGIBLE, cause-classification of the dormant sources comes first — and if none
of them are selection failures, there is nothing for scoring to fix.

**Errors you'll actually see:**

| Message | Meaning | Do |
|---|---|---|
| `unknown section id … did you mean:` | typo'd override ID (or upstream rename) | use the suggested ID |
| `… is tier=must — a must section is a floor` | tried to remove a rail | delete the `remove` — rails can't go |
| `unknown activity "…" — this domain declares: …` | a skill name outside the 13 (typo, or an un-normalized alias) | use a listed name — the refusal prints the whole vocabulary |
| `knowledge root "…" does not exist` | a configured knowledge directory is missing (config error, not a warning) | create the directory, or remove the root from `akela.json` |
| `"## …" has no <!-- qab: id=… -->` | house-file section missing its ID | add the comment under the heading |
| `run "…" already reported an outcome` | logging onto a closed run (usually a stale marker) | start a new run with `run-id` |

---

## 8. Command summary

| Command | What it does |
|---|---|
| `akela.js compile --skill <s> [--ticket <k>]` | compile the slice (skills call this themselves) |
| `akela.js log applied\|contradicted\|captured\|outcome …` | evidence logging (skills call this) |
| `akela.js fp <kind> "<key>"` | failure-class fingerprint |
| `akela.js stats [--json]` | per-source counts + computed findings + compliance |
| `akela.js gate [--json]` | the scoring-eligibility gate — on your data |
| `akela.js scoreboard` | rebuild the derived cache (never a source of truth) |
| `akela.js akela-init [--force]` | (re)generate `akela.json` from `.qabuddy.json` + the qa domain pack |

File map: slices, profiles and scratchpads live in `.qa-reports/runs/<run>/`;
learnings, log and fingerprints in `features-kb/`; engine configuration in
`akela.json`, workflow configuration in `.qabuddy.json`
(see the [README configuration table](../README.md#configuration)).
