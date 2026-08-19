# Contributing to QABuddy

[한국어](CONTRIBUTING.md) · [English](CONTRIBUTING-en.md)

Thanks for your interest in contributing! This guide covers everything from adding skills to editing the playbook to submitting upstream improvements.

---

## Minimum Model Requirement

Skills are designed for **Claude Sonnet** as the minimum. Every skill must work reliably within Sonnet's context handling. Opus works too, but Sonnet is the baseline.

**Why:** Sonnet suffers instruction fatigue with verbose skills — skips late phases, ignores nuanced rules. Every line must earn its place.

| Component | Budget |
|-----------|--------|
| Preamble (Tier 1) | ~34 lines |
| Preamble (Tier 2) | ~78 lines |
| **Skill body** | **150-300 lines** |
| Reference files | 2-4 files, ~80-150 lines |
| **Total per invocation** | **~260-530 lines** |

**Rules:**
1. Don't explain what the AI already knows
2. Bullet points, not paragraphs
3. Templates show structure, not populated examples
4. Self-evaluation is a checklist (1 line per item)
5. One reference file = one topic
6. Test with Sonnet before submitting

---

## Quick Reference

| I want to... | Do this |
|---|---|
| **Add a new skill** | [Adding a New Skill](#adding-a-new-skill) |
| **Edit an existing skill** | Edit `core/skills/<skill>/SKILL.md`, run `node build.js all` |
| **Add playbook knowledge** | [SDT Playbook](#sdt-playbook-editing-and-adding-knowledge) |
| **Report a skill issue** | Run `/qa-improve` or [write a proposal manually](#reporting-skill-issues) |
| **Add a locale** | [Adding a New Locale](#adding-a-new-locale) |
| **Add a platform** | [Adding a New Platform](#adding-a-new-platform) |

---

## Project Structure

```
qa-buddy-skills/
├── build.js                     # Build script (node, zero deps)
├── test.js                      # 740 structural checks
├── core/                        # Edit here — single source of truth
│   ├── skills/ (14)             # Skill templates (procedure)
│   ├── references/              # Knowledge: playwright-patterns, self-improve, KB spec
│   │   └── playbook/            # 11 methodology files + index
│   ├── preamble-base.md         # Tier 1 (all skills)
│   └── preamble-full.md         # Tier 2 additions
├── platforms/                   # 3 configs + 6 setup scripts
├── locales/ko/                  # Korean translation
├── docs/rfc/                    # Design records (accepted RFCs)
└── dist/                        # Generated — never edit directly
```

**Key rule:** Edit `core/` and `platforms/`. Never edit `dist/`. Run `node build.js all` to regenerate.

**Roadmap:** the learnings layer is being moved from prose-judged to measured — per-run compiled knowledge slices, an append-only learnings log, computed distill, eval-gated promotion. The design and the phase-by-phase sequence are in [RFC 0001 — Context Compiler](docs/rfc/0001-context-compiler.md). Sections of this guide that change with a phase are updated in that phase's PR, not before.

---

## Adding a New Skill

### 1. Create the directory

```bash
mkdir -p core/skills/my-skill/tests
```

### 2. Write SKILL.md

Every skill follows this structure:

```markdown
---
name: my-skill
version: 0.3.0
description: |
  What the skill does.
  Use when: "trigger phrase 1", "trigger phrase 2".
  Do NOT use when: scenarios that should use a different skill.
tool-groups:
  - bash
  - read
  - jira
preamble-tier: 2
---

# /my-skill: Short Title

One paragraph describing the role.

## Constraints
1. **Most important rule.** Explanation.
2. **Second rule.** Explanation.

---

## Phase 1: ...
**Load methodology references** from `{{REFERENCE_PATH}}/playbook/`:
- `file.md` — what it covers
...

## Phase N: Self-Evaluation
1. Check item
2. Check item
3. **Format check** — verify output includes: {required sections}
Fix issues found. One pass.

---

## Phase N+1: Output
...
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** {one line}
**Next steps:** {next action}
```

### 3. Add eval fixtures

Create `core/skills/my-skill/tests/fixtures.json`:

```json
{
  "skill": "my-skill",
  "version": "0.3.0",
  "fixtures": [
    {
      "id": "fx-001",
      "description": "Happy path scenario",
      "input": { "context": "description of input" },
      "assertions": [
        { "field": "output", "op": "contains", "value": "expected string" }
      ],
      "tags": ["happy-path"]
    }
  ]
}
```

Assertion operators — simulate mode: `eq`, `contains`, `not_contains`, `matches`, `exists`, `length_eq`, `length_gte`; execute mode (`cmd:`/`files:`/`file:`/`count:` fields): `exit_code`, `output_contains`, `output_matches`, `json_valid`, `lte`.

### 4. Wire it up

- Add tool groups to `platforms/claude.json` if using new groups
- Add to `SKILLS` array in all 6 setup scripts
- Add to skills table + routing in `core/project-instructions.md`
- Add to playbook `index.md` "Used by" column if referencing playbook files
- Build: `node build.js all`
- Test: `node test.js`

---

## Skill Conventions

<details>
<summary><strong>Structure, Frontmatter, Tiers, Placeholders</strong></summary>

**Structure order:** Frontmatter → Title + description → Constraints → Phases → Self-evaluation → Output

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Kebab-case, matches directory name |
| `version` | Yes | Semver. Bump on changes |
| `description` | Yes | Multi-line. Include "Use when:" and "Do NOT use when:" |
| `tool-groups` | Yes | Abstract capabilities ([tool group list](#tool-groups)) |
| `preamble-tier` | Yes | `1` (minimal) or `2` (adds escalation + SDT question protocol) |

**Preamble tiers:**

| Tier | Injects | Use for |
|------|---------|---------|
| `1` | Context Recovery + Completion Status (34 lines) | Lightweight skills |
| `2` | Tier 1 + Severity tables + Escalation + Asking Questions (78 lines) | Interactive, classification-heavy skills |

**Placeholder:** `{{REFERENCE_PATH}}` → replaced with platform-specific reference path at build time.

</details>

<details>
<summary><strong>Tool Groups</strong></summary>

| Group | Claude Code tools | Purpose |
|-------|-------------------|---------|
| `bash` | Bash | Shell commands |
| `read` | Read | Read files |
| `write` | Write | Create files |
| `edit` | Edit | Modify files |
| `glob` | Glob | Find files |
| `grep` | Grep | Search content |
| `agent` | Agent | Sub-agents |
| `ask` | AskUserQuestion | Prompt user |
| `web-search` | WebSearch | Web search |
| `jira` | jira_get_issue, jira_search | Jira tickets |
| `jira-fields` | jira_list_fields | Jira fields |
| `confluence` | confluence_search, confluence_get_page | Read Confluence |
| `confluence-write` | confluence_create_page, confluence_update_page | Write Confluence |
| `browser` | Chrome ext + Preview + Playwright | Browser testing |

Cursor and Copilot ignore `tool-groups` — their agents auto-discover tools.

</details>

<details>
<summary><strong>Writing Style</strong></summary>

- **Be concise.** One line if the AI already knows how
- **Bullet points over paragraphs**
- **Constraints at the top** — AI sees limits before starting
- **Self-evaluation as a checklist** — numbered, one line each
- **Format checks in self-evaluation** — list required output sections
- **Completion status on every skill** — DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT

</details>

---

## Runtime Obligations (every skill)

The preamble enforces these on every skill run; skill authors must not contradict them and should not restate them. Design: [RFC 0001](docs/rfc/0001-context-compiler.md). Sections marked ▸ land with a later RFC phase.

| When | Obligation | Written to |
|---|---|---|
| Whenever a learning shapes output | Cite its ID; `qab.js log applied LRN-…` | `learnings-log.jsonl` |
| Live observation contradicts an active learning | Do not apply it; `qab.js log contradicted LRN-… --note`; flag in report | `learnings-log.jsonl` |
| Completion | Apply the three capture triggers; if one fires, write the LRN and `log captured`; then `log outcome --status <S>` | `LEARNINGS.md`, `learnings-log.jsonl` |
| Start | `qab.js compile --skill <name>` → read `slice.md` (replaces reading the learnings file + the reference sections it lists); fallback: references + `LEARNINGS.md` | `.qa-reports/runs/<run>/{slice.md,profile.json,scratchpad.md,events.jsonl}` |
| Mid-run | Anything noteworthy → `## Candidate learnings` (no evidence bar); tier-2 skills also keep `## Plan` / `## State` and re-read at pauses | `scratchpad.md` |
| Completion | The three capture triggers are applied to the **candidates** only | `LEARNINGS.md`, `learnings-log.jsonl` |
| Named failure class hit (`e2e-pom` heal → `locator-not-found`; `e2e-write` gates → `spec-flaky`, `fixture-missing`; `qa` → `ac-unmapped`, `env-unreachable`, `auth-failed`, `assertion-mismatch`; `verify-fix` → `ci-step-failed`) | `qab.js fp <kind> "<key>"` — one line per distinct class per run; if the helper lists a learning under `active`, flag it | `fingerprints.jsonl` |
| Capture after trigger 1 with a fingerprint this run | Set the new LRN's `Fingerprint:` to that ffp (`qab.js fp --list`) | `LEARNINGS.md` |

`bin/qab.js` is the only writer of `learnings-log.jsonl` and `fingerprints.jsonl` — the model passes bare arguments and never hand-writes JSON. It ships to `dist/<platform>/references/bin/` and is tested behaviourally in `test.js` (`testRuntimeHelper`, `testCompile`, `testFingerprints`). Schema: `self-improve.md` §Learnings log and §Failure fingerprints (`"v": 1`; readers accept every earlier version — logs are append-only and live in users' repos for years). The fingerprint `kind` vocabulary is closed (`FP_KINDS` in `qab.js`, mirrored in `self-improve.md`; `test.js` checks they match) — add a kind only with a detection point in a skill and its ko twin. `qab.js scoreboard` writes `features-kb/.cache/scoreboard.json`, a derived cache — never read it as truth, never commit it. Runtime files (`LEARNINGS.md`, `learnings-log.jsonl`, `fingerprints.jsonl`, `.qa-reports/`) are project content: never in this repo, never dual-locale.

---

## SDT Playbook: Editing and Adding Knowledge

The playbook lives in `core/references/playbook/` as focused files (~35-70 lines each). See `index.md` for the full map.

<details>
<summary><strong>Current Playbook Files</strong></summary>

| File | Covers |
|------|--------|
| `terminology.md` | Normalized terms (AC, SDT, DoR, DoD) |
| `risk-and-priority.md` | Severity/priority scales, effort allocation |
| `metrics-and-coverage.md` | Code coverage, requirements coverage, defect + test health metrics |
| `shift-left.md` | Challenge requirements early, verify alignment |
| `test-distribution.md` | Test pyramid/diamond, deduplication |
| `test-types.md` | Manual vs automation, UAT vs functional |
| `execution-sequence.md` | Testing order through the sprint |
| `defect-lifecycle.md` | Bug types, states, SLA, regression tests |
| `maintenance-and-ci.md` | Flaky tests, time budget, CI gates |
| `exploratory-heuristics.md` | 10 heuristic categories, technique checklists |

</details>

**Editing:** Stay within scope, keep under 70 lines, run `node build.js all`.

**Every `##` section is an addressable source** (RFC 0001 PR3). The id lives in an HTML comment on the line right after the heading — never in the heading text:

```markdown
## Selectors
<!-- qab: id=selectors tier=must -->
- rule
```

| Field | Values | Meaning |
|---|---|---|
| `id=` | kebab-case, **permanent** | Forms `REF-<file-stem>#<id>` (`REF-playbook/<stem>#<id>` under `playbook/`). Rename the heading freely; never the id |
| `scope=` | comma-separated skill names, or `all` (default) | Which skills may receive this section. Usually set once in the H1 comment as a file default; sections inherit it |
| `tier=` | `must` / `should` (default) / `context` | `must` = always in a scoped skill's slice, packed first — rails, NEVER lists, templates a skill structurally depends on. `must` is expensive; never scope it to `all` |

Rules: `##` headings outside code fences must carry a comment (`###` belong to their parent); the H1 comment holds file defaults and may carry `id=` for files whose knowledge sits directly under the H1 (`terminology.md`, `execution-sequence.md`); `README.md`/`index.md` are navigation and excluded. Korean twins copy the `qab:` comment **verbatim** — `node build.js all` fails on a duplicate id, an untagged `##`, an en/ko id-set mismatch, or a `core/references` file with no same-named ko twin (the references *directory* is resolved per locale, so an en-only file would silently never reach `dist/ko`). The build ships `references/index.json` (id → file, heading, scope, tier, lines) into every dist. `qab:` lines don't count against the 70-line playbook budget.

**Adding new knowledge:**
1. Fits an existing file? Add a section there. New topic? Create a file — **and its ko twin**.
2. Keep files under 70 lines and sections under ~25. Tables for data, bullets for rules. Write for the AI, not humans.
3. Add the `qab:` comment: choose a permanent id; set `scope=` to the skills that should receive it (or rely on the file default); choose `tier` honestly.
4. Update `index.md` with file name, description, "Used by" skills; until RFC 0001 PR5 lands, also wire the file into the skills' Phase 1 methodology references. Only skills that need it.
5. `node build.js all` (regenerates `index.json`, checks parity) → `node test.js`.

**Learnings point at sources by id.** A learning's `Overrides:` names a section id (`REF-playwright-patterns#must-rules`), a skill rule (`SKILL:test-cases "…"`), or `none` — `test.js` checks that this repo's `features-kb/LEARNINGS.md` resolves.

**What NOT to put in the playbook:** Tool-specific instructions, project config, skill workflow details, preamble duplicates.

---

## Reporting Skill Issues

### Automated (recommended)

Run `/qa-improve` or choose **(C) Tool feedback** at any review pause point. The AI:
1. Asks what happened and what was expected
2. Reads the skill + CONTRIBUTING.md
3. Classifies root cause → generates proposal → applies fix → runs eval → delivers

### Manual

<details>
<summary><strong>Improvement Proposal Template</strong></summary>

```markdown
# Skill Improvement Proposal: `<skill-name>`
**Version:** current → proposed
**Root cause:** [missing constraint | wrong phase order | instruction gap |
  self-eval gap | template issue | over-reliance on context | scope drift]

## Problem
[What went wrong and why]

## Root Cause
[Which phase/instruction/gap — quote the specific text]

## Proposed Changes
| # | Location | Change | Description |
|---|----------|--------|-------------|

## Expected Outcome
[How this fix prevents recurrence]

## Budget Check
Current / After / Within 300-line budget?
```

</details>

---

## Adding a New Locale

The build system loads from `locales/<code>/` and falls back to `core/` for untranslated files.

1. Create: `mkdir -p locales/<code>/skills/{qa,verify-fix,...}/` and `locales/<code>/references/playbook/`
2. Translate: preambles, project-instructions, all skills, all playbook files
3. Copy (don't translate): `feature-knowledge-base-spec.md`
4. Build: `node build.js all --locale <code>`

**Guidelines:** Translate prose. Keep English for technical terms, code blocks, file paths, status codes, `{{placeholders}}`.

---

## Adding a New Platform

1. Create `platforms/<platform>.json` (name, reference_path, tool_groups, project_file)
2. Create `platforms/setup-<platform>` (bash) and `.ps1` (PowerShell)
3. Add to `ALL_PLATFORMS` in `build.js`
4. Run `node build.js <platform>`

---

## KB Path Convention

All skills use `features-kb/features/{EPIC-KEY}/` as the base path. Never `features-kb/epics/` (legacy).

---

## Checklist Before Submitting

### Build
- [ ] Edited in `core/`, not `dist/`
- [ ] `node build.js all` passes
- [ ] All 3 platforms build (11 skills each)
- [ ] If locale exists: `node build.js all --locale <code>` passes

### Quality
- [ ] Skill body under 300 lines
- [ ] Total context under 530 lines
- [ ] Constraints at top, self-eval with format check, completion status at end
- [ ] Eval fixtures exist with at least 3 scenarios (happy path, error, edge case)
- [ ] `Do NOT use when:` in description

### Testing
- [ ] `node test.js` passes
- [ ] `/qa-eval {skill}` passes all fixtures
- [ ] Tested with Sonnet on a real task
- [ ] AI follows all phases without skipping

### Integration
- [ ] Added to setup scripts (all 6) and project-instructions
- [ ] Playbook index updated if methodology files changed
- [ ] No `features-kb/epics/` paths
