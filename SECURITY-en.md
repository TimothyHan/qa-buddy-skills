# Security Policy

[한국어](SECURITY.md) · [English](SECURITY-en.md)

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately:

**Email:** timothyh124@gmail.com

Do NOT open a public GitHub issue for security vulnerabilities. We will respond within 48 hours and work with you to address the issue before any public disclosure.

## Trust Model

QABuddy is a set of AI skill instructions (markdown files). When installed, these instructions tell the AI what to do — including running shell commands, reading/writing files, and interacting with external services (Jira, browsers).

**Skills are code.** Treat them with the same scrutiny as any executable you install. Review what they instruct the AI to do before using them.

### What Skills Can Do

| Capability | Risk | Mitigation |
|---|---|---|
| Read files in the workspace | Could access `.env`, credentials, private keys | Skills are scoped to project files. Review any skill that reads outside the project. |
| Write files | Could modify source code, configs, scripts | Self-evaluation phases verify output. SDT reviews before approving. |
| Run shell commands | Could execute anything the user can | Claude Code restricts via `allowed-tools`. Cursor/Copilot have no such restriction — review skill constraints carefully. |
| Query Jira / Confluence | Could read sensitive ticket data | Only accesses what the configured MCP token allows. |
| Open browser pages | Could navigate to any URL | Browser tools are limited to testing the target app. |
| Create git branches and PRs | Could push to remotes | Requires `gh` CLI auth. Only triggers in team mode with SDT approval. |

### What Skills Cannot Do

- Access files outside the workspace (no `~/.ssh/`, no `/etc/`)
- Run commands without the AI platform's permission system
- Send data to external servers (no outbound HTTP in skill instructions)
- Modify the AI platform's settings or other installed skills

## For Contributors

### Reviewing PRs

When reviewing PRs that modify skill files, check for:

1. **Command injection** — does any new bash command or instruction tell the AI to read sensitive files, access credentials, or run destructive operations?
2. **Data exfiltration** — does the skill instruct the AI to send data to an external URL, email, or API?
3. **Scope creep** — does the skill access files or tools beyond what it needs? Check `tool-groups` in frontmatter.
4. **Constraint bypass** — does the change weaken or remove existing constraints (e.g., removing "SDT approves before filing")?
5. **Eval fixture safety** — do new fixtures instruct the AI to do anything harmful during simulation?

### Safe Patterns

Skills should follow these patterns:

- **Ask before acting** — destructive or external operations require SDT approval (option A/B/C at pause points)
- **Minimal tool groups** — declare only the tools the skill actually uses
- **No hardcoded paths** — use `{{REFERENCE_PATH}}` and `features-kb/` relative paths
- **No secrets in output** — skills should never include API tokens, passwords, or credentials in reports or KB artifacts

## For Users

### Before Installing

1. **Read the skills** — each skill is a markdown file in `core/skills/`. Review what they instruct the AI to do.
2. **Check tool-groups** — these declare what tools each skill can use. A skill that only needs `read` and `jira` shouldn't have `bash` and `browser`.
3. **Review the setup script** — it creates symlinks and prints hook instructions. It does not modify your settings files automatically.

### Secrets to Protect

| Secret | Where it might appear | How to protect |
|---|---|---|
| Jira API token | MCP config in settings files | Never commit settings files with tokens. Use environment variables. |
| Screenshots with PII | `.qa-reports/screenshots/` | `.gitignore` excludes `.qa-reports/`. Don't manually commit. |
| Internal URLs | Bug reports, QA reports, KB artifacts | `.gitignore` excludes `features-kb/`. If using team mode, review KB content before committing. |
| `.qabuddy.json` | Project root | Contains project key — low sensitivity. `.gitignore` excludes it. |

### SessionStart Hooks

The setup script suggests adding a `SessionStart` hook that runs `cat .qabuddy.json`. This is safe — it reads a config file you control. If you modify the hook command, you are responsible for what it executes.

### Upstream Contributions

When `contributeUpstream: true` is set, `/improve` auto-creates PRs to the upstream QABuddy repo. These PRs:
- Only contain `core/` changes (not `.qabuddy.json`, `features-kb/`, or team-specific files)
- Are reviewed by maintainers before merging
- Require `gh` CLI authentication (your GitHub account)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x+ | Yes |
| < 0.3.0 | No |
