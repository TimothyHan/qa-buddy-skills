# Platforms

[English](README.md) · [한국어](README-ko.md)

Platform-specific configuration and setup scripts for Claude Code, Cursor, and GitHub Copilot.

## Files

| File | Purpose |
|------|---------|
| `claude.json` | Tool group → Claude Code tool name mappings, reference paths, project file config |
| `cursor.json` | Cursor-specific paths, `.mdc` wrapper for project rules |
| `copilot.json` | Copilot-specific paths, `.github/` project file location |
| `setup-claude` | Bash install script — symlinks skills to `~/.claude/skills/` |
| `setup-claude.ps1` | PowerShell install script for Windows |
| `setup-cursor` | Bash install — symlinks to `~/.cursor/skills/` or project copy |
| `setup-cursor.ps1` | PowerShell version |
| `setup-copilot` | Bash install — copies skills to `.github/skills/` in repo |
| `setup-copilot.ps1` | PowerShell version |

## How Platform Configs Work

Each `<platform>.json` defines:

- **`reference_path`** — where skills find methodology references at runtime
- **`skills_install_dir`** — where setup scripts install skills
- **`project_file`** — output file name (CLAUDE.md, qabuddy.mdc, copilot-instructions.md)
- **`tool_groups`** — maps abstract groups (e.g., `jira`, `browser`) to platform-specific tool names
- **`tool_priority`** — platform-specific browser/Jira tool guidance text

Claude Code uses `tool_groups` to generate `allowed-tools` in skill frontmatter. Cursor and Copilot have empty arrays — their agents auto-discover available tools.

## Setup Scripts

All setup scripts support these flags:

| Flag | Bash | PowerShell | Effect |
|------|------|------------|--------|
| Default | `setup` | `setup.ps1` | Install with `qa-` prefix |
| No prefix | `--no-prefix` | `-NoPrefix` | Install without prefix |
| Uninstall | `--uninstall` | `-Uninstall` | Remove all QABuddy symlinks |
| Status | `--status` | `-Status` | Show current installation |
| Project (Cursor) | `--project` | `-Project` | Copy to project instead of global |

Setup scripts also check for:
- Atlassian MCP configuration
- Playwright MCP configuration (Cursor only)
- SessionStart hook configuration (Claude Code + Cursor)
- Features knowledge base directory

## Adding a New Platform

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide.
