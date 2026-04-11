# Locales

[English](README.md) · [한국어](ko/README.md)

Translations of QABuddy skills and methodology for non-English teams.

## Available Locales

| Code | Language | Status |
|------|----------|--------|
| `ko` | Korean (한국어) | Complete — 27 files translated with QA glossary |

## How It Works

The build system loads from `locales/<code>/` and falls back to `core/` for any untranslated file. This means you can partially translate — untranslated skills use English.

```bash
node build.js all --locale ko    # Build Korean version
```

Output goes to `dist/ko/<platform>/` instead of `dist/<platform>/`.

## Directory Structure

Each locale mirrors the `core/` structure:

```
locales/ko/
├── glossary.md              # Translation style guide + term standardization
├── preamble-base.md         # Tier 1 preamble
├── preamble-full.md         # Tier 2 additions
├── project-instructions.md  # CLAUDE.md / .mdc / copilot-instructions template
├── skills/                  # 11 skill translations
│   ├── qa/SKILL.md
│   ├── verify-fix/SKILL.md
│   └── ...
└── references/
    ├── playbook/            # 11 methodology file translations
    └── feature-knowledge-base-spec.md
```

## Adding a New Locale

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full guide. Key steps:

1. `mkdir -p locales/<code>/skills/ locales/<code>/references/playbook/`
2. Create a `glossary.md` — standardize which terms stay English vs target language
3. Translate preambles, project instructions, skills, and playbook files
4. Build and verify: `node build.js all --locale <code>`

## Translation Guidelines

- Translate all prose. Keep English for technical terms, code blocks, file paths, status codes.
- Create a glossary before translating — consistency is more important than perfection.
- Have a native-speaking QA professional review before production use.
- See `ko/glossary.md` as the reference example for a well-structured glossary.
