# Skills

QABuddy's AI skills. Each skill is a `SKILL.md` file with YAML frontmatter and markdown instructions that the AI follows.

## Skill Structure

Every skill follows this structure:

```
skill-name/
├── SKILL.md              # Skill instructions (under 300 lines)
└── tests/
    └── fixtures.json     # Eval fixtures (input scenarios + assertions)
```

Inside `SKILL.md`:
1. **Frontmatter** — name, version, description, tool-groups, preamble-tier
2. **Constraints** — rules the AI must follow (at the top, before phases)
3. **Phases** — numbered, sequential workflow
4. **Self-evaluation** — checklist before output
5. **Output** — what gets produced, where it's saved
6. **Completion status** — DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT

## Adding a New Skill

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full guide.
