<div align="center">

# QABuddy

**Your AI-powered QA partner for Scrum teams**

[English](README.md) · [한국어](README-ko.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Skills: 11](https://img.shields.io/badge/Skills-11-green.svg)](#skills)
[![Platforms: 3](https://img.shields.io/badge/Platforms-Claude_|_Cursor_|_Copilot-purple.svg)](#how-it-works)
[![Locales: en, ko](https://img.shields.io/badge/Locales-en_|_ko-orange.svg)](#locales)
[![Tests: 475](https://img.shields.io/badge/Tests-475_passing-brightgreen.svg)](#testing)

An AI partner for Software Developers in Test (SDTs) working in Scrum teams.<br>
Covers the full workflow — from epic test planning through sprint execution to release verification.<br>
Works with **Claude Code**, **Cursor**, and **GitHub Copilot**. No Jira required.

Built on the native **skills system** of your AI coding assistant.<br>
QABuddy is a collection of `SKILL.md` files that your AI discovers and invokes automatically —<br>
no separate app, no daemon, no dependencies beyond Node.js.

[Quick Start](#quick-start) · [Skills](#skills) · [Guided Workflow](#the-guided-workflow) · [Contributing](CONTRIBUTING.md)

</div>

---

## Why QABuddy?

| Without QABuddy | With QABuddy |
|---|---|
| Manually write test plans from scratch | `/qa-start` generates test plans from epic context |
| Review tickets by memory during grooming | `/review-ticket` audits ACs with structured checklists |
| Track test coverage in spreadsheets | Knowledge base tracks coverage with traceability mappings |
| File bugs via copy-paste into Jira | `/qa` files bugs automatically with repro steps + screenshots |
| "Is the sprint on track?" — guesswork | `/sprint-status` dashboard with 6 quality metrics |
| Fix a skill issue? Rewrite from scratch | `/improve` analyzes the failure, fixes it, runs regression tests |

---

## Quick Start

```bash
git clone <repo-url> && cd agents
node build.js all              # Build for all platforms
dist/claude/setup              # Install (or dist/cursor/setup, dist/copilot/setup)
```

Then:
```
/qa-setup                      # Configure your project (first time only)
/qa-start EPIC-123             # Begin the guided workflow
```

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

```powershell
git clone <repo-url>
cd agents
node build.js all
.\dist\claude\setup.ps1        # or .\dist\cursor\setup.ps1
```

> Symlinks require Developer Mode enabled or running as Administrator.
> Falls back to directory junctions automatically if symlinks fail.

</details>

---

## Skills

### Guided Workflow

| Skill | Command | What it does |
|-------|---------|-------------|
| **Setup** | `/setup` | First-run wizard: context source, team mode, project preferences |
| **Start** | `/start` | Guided end-to-end workflow: setup → test plan → reviews → test cases |

### QA Skills

| Skill | Command | Sprint Phase | What it does |
|-------|---------|-------------|-------------|
| **Test Plan** | `/test-plan` | Epic created | Test strategy, automation gaps, success criteria, risks |
| **Review Ticket** | `/review-ticket` | Grooming | Audit ACs, testability, missing edge cases, blockers |
| **Test Cases** | `/test-cases` | Sprint execution | Playwright e2e + unit test checklist from ACs |
| **QA** | `/qa` | Feature ready | Execute test cases, verify ACs, file bugs |
| **Verify Fix** | `/verify-fix` | Bug fixed | Re-test fix, check regressions, update bug status |
| **Sprint Status** | `/sprint-status` | Mid-sprint | Testing dashboard with quality metrics |
| **Exploratory** | `/exploratory` | Feature ready | Charter-driven exploratory testing session |

### Meta Skills

| Skill | Command | What it does |
|-------|---------|-------------|
| **Improve** | `/improve` | Analyze skill failure, propose fix, apply, run eval, create PR |
| **Eval** | `/eval` | Run eval fixtures against a skill to verify correctness |

---

## The Guided Workflow

Instead of invoking skills individually, `/qa-start` walks you through the full QA planning workflow:

```
/qa-start EPIC-123

  Phase 1: Setup ─────── reads config, loads context
       ↓ pause
  Phase 2: Test Plan ─── drafts strategy, initializes KB
       ↓ pause
  Phase 3: Reviews ───── audits each story (Jira mode)
       ↓ pause
  Phase 4: Test Cases ── generates tests + traceability
       ↓ pause
  Phase 5: Summary ───── "Planning complete. Ready for QA."
```

At every pause, you choose:

| Option | What happens |
|--------|-------------|
| **(A) Approve** | Continue to next phase |
| **(B) Content feedback** | Iterate on the output |
| **(C) Tool feedback** | AI reads skill source, proposes fix, rebuilds, runs eval, resumes |

---

## Configuration

Run `/qa-setup` to configure. Settings saved to `.qabuddy.json`:

| Setting | Options | What it controls |
|---------|---------|-----------------|
| **Context source** | Jira, spec docs, chat, custom | Where skills pull feature context |
| **Team mode** | Solo, team | Solo = local. Team = PRs via `gh` CLI |
| **Upstream contributions** | Yes, no | Auto-PR improvements to QABuddy repo |

> **No Jira? No problem.** Set context source to "spec" or "chat". Bugs are written
> to `features-kb/` as markdown. Works with any project management tool.

<details>
<summary><strong>Team Practices (optional)</strong></summary>

During setup, QABuddy asks if your team has documented processes for:

| Practice | Saved to |
|----------|----------|
| Bug triage / intake | `features-kb/team-practices/bug-triage.md` |
| Hotfix testing | `features-kb/team-practices/hotfix-testing.md` |
| Test data management | `features-kb/team-practices/test-data.md` |
| Release workflow | `features-kb/team-practices/release-workflow.md` |
| Accessibility requirements | `features-kb/team-practices/accessibility.md` |
| CI/CD pipeline | `features-kb/team-practices/ci-cd-pipeline.md` |

If defined, skills follow them automatically. If not, skills ask case-by-case.

</details>

---

## Prerequisites

- **Node.js** — for the build script (zero npm dependencies)
- **Atlassian MCP** — optional, only for Jira mode
- **Playwright MCP** — for browser testing (Cursor/Copilot; Claude Code can use Chrome extension)

<details>
<summary><strong>MCP Configuration</strong></summary>

**Atlassian:**
```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-atlassian"],
      "env": {
        "JIRA_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

**Playwright:**
```json
{
  "mcpServers": {
    "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
  }
}
```

Add to: `~/.claude/settings.json` (Claude) · `.cursor/mcp.json` (Cursor) · `.vscode/mcp.json` (Copilot)

</details>

---

## Feature Knowledge Base

Skills produce and consume test artifacts from `features-kb/` — this is how they stay connected:

```
features-kb/
├── index.json                        # Feature index + workflow state
├── team-practices/                   # Team-specific processes
└── features/{EPIC-KEY}/
    ├── feature.md                    # Epic summary, capabilities, ACs
    ├── test-plan.md                  # Test strategy
    ├── test-cases/{TICKET}.md        # Test cases + traceability mappings
    ├── reviews/{TICKET}-review.md    # Ticket reviews
    ├── qa-reports/{TICKET}-{DATE}.md # QA results
    └── bugs/BUG-{NNN}.md            # Bugs (when no Jira)
```

| Context source | Naming convention | Example |
|---|---|---|
| Jira | Jira keys | `features/PROJ-123/test-cases/PROJ-456.md` |
| GitHub Issues | `GH-42` or slug | `features/GH-42/test-cases/GH-55.md` |
| Spec / Chat | Descriptive slugs | `features/auth-system/test-cases/login-page.md` |

---

## Self-Improvement

QABuddy improves itself from real usage. Four mechanisms:

**1. Inline at every review point** — choose **(C) Tool feedback** at any pause. AI reads skill source, proposes fix, rebuilds, runs eval, resumes.

**2. `/improve`** — dedicated skill for detailed failure analysis. Generates structured proposal, applies fix, runs eval fixtures, creates PR.

**3. `/eval`** — run eval fixtures against any skill. 43 fixtures across 11 skills with 7 assertion operators (`contains`, `not_contains`, `matches`, `exists`, `eq`, `length_eq`, `length_gte`).

**4. Upstream contributions** — opt in during `/qa-setup`. After `/improve` fixes a skill, the fix auto-PRs to the QABuddy repo so everyone benefits.

---

## Sprint Quality Metrics

`/sprint-status` computes these automatically:

| Metric | Target |
|--------|--------|
| Defect escape rate | <10% |
| Severity distribution | Mostly Normal/Minor |
| MTTR (mean time to resolve) | Blocker: <1 day |
| Requirements coverage | Increasing per sprint |
| Test pass rate | >95% |
| Flaky test rate | <2% |

---

## How It Works

Skills are authored once in `core/skills/`. The build script generates platform-specific output:

| | Claude Code | Cursor | Copilot |
|---|---|---|---|
| **Frontmatter** | `allowed-tools` | `name` + `description` | `name` + `description` |
| **Browser** | Chrome ext > Preview > Playwright | Playwright MCP | Playwright MCP |
| **Project file** | `CLAUDE.md` | `.cursor/rules/qabuddy.mdc` | `.github/copilot-instructions.md` |
| **Install** | Global symlinks | Symlinks or project copy | Repo copy |
| **Hooks** | SessionStart | SessionStart | Preamble reads config |

```bash
node build.js all                  # Build for all platforms
node build.js all --locale ko      # Build Korean version
node test.js                       # Run 475 structural tests
```

<details>
<summary><strong>Project Structure</strong></summary>

```
agents/
├── build.js                     # Build script (node, zero deps)
├── test.js                      # Structural test suite (475 checks)
├── core/                        # Single source of truth — edit here
│   ├── skills/ (11)             # Skill templates with {{placeholders}}
│   ├── references/playbook/     # 10 methodology files
│   ├── preamble-base.md         # Tier 1 preamble (all skills)
│   ├── preamble-full.md         # Tier 2 additions
│   └── project-instructions.md
├── platforms/                   # 3 platform configs + 6 setup scripts
├── locales/ko/                  # Korean translation
└── dist/                        # Generated (gitignored)
```

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. Key points:

- **Sonnet is the minimum model** — skills must work on Sonnet, not just Opus
- **300-line budget** per skill, 530-line total context per invocation
- **Constraints at top**, self-evaluation on every skill, completion status block
- **Test with `node test.js`** after every change
- **Korean locale** — new skills need a translation in `locales/ko/`

## License

[Apache 2.0](LICENSE) — free to use, modify, and redistribute with attribution.

## Code of Conduct

[Contributor Covenant 2.1](CODE_OF_CONDUCT.md)
