#!/usr/bin/env node
/**
 * QABuddy — Build
 *
 * Generates platform-specific skill sets from core templates.
 * Each platform (Claude Code, Cursor, GitHub Copilot) gets:
 *   - SKILL.md files with correct frontmatter and tool references
 *   - Reference docs (copied as-is)
 *   - Project instructions file (CLAUDE.md, .mdc, copilot-instructions.md)
 *   - Setup script
 *
 * Usage:
 *   node build.js claude              Build for Claude Code
 *   node build.js cursor              Build for Cursor
 *   node build.js copilot             Build for GitHub Copilot
 *   node build.js all                 Build for all platforms
 *   node build.js all --locale ko     Build Korean version for all platforms
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CORE_DIR = path.join(ROOT, 'core');
const LOCALES_DIR = path.join(ROOT, 'locales');
const PLATFORMS_DIR = path.join(ROOT, 'platforms');
const DIST_DIR = path.join(ROOT, 'dist');
const ALL_PLATFORMS = ['claude', 'cursor', 'copilot'];

// ─── Locale resolution ──────────────────────────────────────────────────

// Resolve a file path: check locale directory first, fall back to core.
// This allows partial translations — untranslated files use English.
function resolveFile(relativePath, locale) {
  if (locale) {
    const localePath = path.join(LOCALES_DIR, locale, relativePath);
    if (fs.existsSync(localePath)) return localePath;
  }
  return path.join(CORE_DIR, relativePath);
}

// Resolve a directory: if locale has it, use locale; otherwise use core.
function resolveDir(relativePath, locale) {
  if (locale) {
    const localePath = path.join(LOCALES_DIR, locale, relativePath);
    if (fs.existsSync(localePath)) return localePath;
  }
  return path.join(CORE_DIR, relativePath);
}

// ─── Frontmatter parsing (minimal, no dependencies) ───────────────────────

function parseFrontmatter(content) {
  // Normalize CRLF: with core.autocrlf=true (Windows git default) files check
  // out with \r\n, which would fail the match below and poison every
  // downstream split('\n') with trailing \r
  content = content.replace(/\r\n/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  return { meta: parseYaml(match[1]), body: match[2] };
}

function parseYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const kvMatch = line.match(/^([a-z][\w-]*):\s*(.*)$/);
    if (!kvMatch) { i++; continue; }

    const key = kvMatch[1];
    const rest = kvMatch[2].trim();

    if (rest === '|') {
      // Multiline block scalar
      let block = '';
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        block += lines[i].replace(/^  /, '') + '\n';
        i++;
      }
      result[key] = block.trimEnd();
    } else if (rest === '') {
      // List
      const items = [];
      i++;
      while (i < lines.length && lines[i].match(/^  - /)) {
        items.push(lines[i].replace(/^  - /, ''));
        i++;
      }
      result[key] = items;
    } else {
      result[key] = rest;
      i++;
    }
  }
  return result;
}

// ─── Frontmatter generation ───────────────────────────────────────────────

function generateFrontmatter(meta, skillName, config) {
  let fm = '';
  fm += `name: ${meta.name}\n`;
  fm += `version: ${meta.version}\n`;
  fm += `description: |\n`;
  for (const line of meta.description.split('\n')) {
    fm += `  ${line}\n`;
  }

  const groups = meta['tool-groups'] || [];

  // Claude: generate allowed-tools from tool-groups
  if (config.name === 'claude') {
    const tools = resolveToolGroups(groups, config.tool_groups);
    if (tools.length > 0) {
      fm += `allowed-tools:\n`;
      for (const t of tools) {
        fm += `  - ${t}\n`;
      }
    }
  }

  // Cursor: no extra frontmatter needed (skills use description for discovery)
  // Copilot: no extra frontmatter needed (skills use name + description)

  return fm;
}

function resolveToolGroups(groups, toolGroupDefs) {
  const tools = [];
  const seen = new Set();
  for (const group of groups) {
    const groupTools = toolGroupDefs[group];
    if (!groupTools) {
      console.warn(`    ⚠  Unknown tool group: ${group}`);
      continue;
    }
    for (const t of groupTools) {
      if (!seen.has(t)) {
        seen.add(t);
        tools.push(t);
      }
    }
  }
  return tools;
}

// ─── Build logic ──────────────────────────────────────────────────────────

function loadPreambles(locale) {
  const basePath = resolveFile('preamble-base.md', locale);
  const fullPath = resolveFile('preamble-full.md', locale);
  const base = fs.existsSync(basePath) ? fs.readFileSync(basePath, 'utf8') : '';
  const full = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
  return { base, full };
}

function buildSkill(skillName, config, preambles, locale) {
  const corePath = resolveFile(path.join('skills', skillName, 'SKILL.md'), locale);
  if (!fs.existsSync(corePath)) {
    console.warn(`    SKIP  ${skillName} (template not found)`);
    return null;
  }

  const content = fs.readFileSync(corePath, 'utf8');
  const { meta, body } = parseFrontmatter(content);

  const frontmatter = generateFrontmatter(meta, skillName, config);

  // Substitute placeholders in body
  let processedBody = body;
  processedBody = processedBody.replace(/\{\{REFERENCE_PATH\}\}/g, config.reference_path);

  // Inject tiered preamble between frontmatter and skill body
  const tier = parseInt(meta['preamble-tier'] || '2', 10);
  let preambleContent = preambles.base || '';
  if (tier >= 2 && preambles.full) {
    preambleContent += '\n' + preambles.full;
  }

  let processedPreamble = '';
  if (preambleContent) {
    processedPreamble = '\n' + preambleContent.replace(/\{\{REFERENCE_PATH\}\}/g, config.reference_path) + '\n';
  }

  return `---\n${frontmatter}---\n${processedPreamble}${processedBody}`;
}

function buildProjectFile(config, locale) {
  const templatePath = resolveFile('project-instructions.md', locale);
  if (!fs.existsSync(templatePath)) return null;

  let content = fs.readFileSync(templatePath, 'utf8');
  content = content.replace(/\{\{REFERENCE_PATH\}\}/g, config.reference_path);
  content = content.replace(/\{\{TOOL_PRIORITY\}\}/g, config.tool_priority || '');
  content = content.replace(/\{\{PLATFORM_HEADER\}\}/g, config.platform_header || '');
  content = content.replace(/\{\{KB_SKILLS_PATH\}\}/g, config.kb_skills_path || 'features-kb/');

  // For Cursor .mdc files, wrap with frontmatter
  if (config.project_file_wrapper) {
    content = config.project_file_wrapper + '\n' + content;
  }

  return content;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildPlatform(platform, locale) {
  const configPath = path.join(PLATFORMS_DIR, `${platform}.json`);
  if (!fs.existsSync(configPath)) {
    console.error(`  ERROR: Platform config not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // Locale output: dist/ko/claude/ etc. Default: dist/claude/
  const outDir = locale
    ? path.join(DIST_DIR, locale, platform)
    : path.join(DIST_DIR, platform);

  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }

  const label = locale ? `${platform} (${locale})` : platform;
  console.log(`\n  Building: ${label}`);
  console.log(`  ${'─'.repeat(36)}`);

  // Load tiered preambles (locale-aware)
  const preambles = loadPreambles(locale);

  // Build skills — use core directory for skill discovery (locale may not have all skills)
  const skillsDir = path.join(CORE_DIR, 'skills');
  const skills = fs.readdirSync(skillsDir)
    .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
    .sort();

  let built = 0;
  for (const skill of skills) {
    const output = buildSkill(skill, config, preambles, locale);
    if (output) {
      const outPath = path.join(outDir, 'skills', skill, 'SKILL.md');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, output);
      console.log(`    OK  skills/${skill}/SKILL.md`);
      built++;
    }
  }

  // Copy references (locale-aware)
  const refsDir = resolveDir('references', locale);
  if (fs.existsSync(refsDir)) {
    copyDirRecursive(refsDir, path.join(outDir, 'references'));
    const refCount = fs.readdirSync(refsDir).length;
    console.log(`    OK  references/ (${refCount} files)`);
  }

  // Build project instructions file (locale-aware)
  const projectContent = buildProjectFile(config, locale);
  if (projectContent && config.project_file) {
    const projPath = path.join(outDir, config.project_file);
    fs.mkdirSync(path.dirname(projPath), { recursive: true });
    fs.writeFileSync(projPath, projectContent);
    console.log(`    OK  ${config.project_file}`);
  }

  // Copy setup scripts (bash + PowerShell)
  const setupSrc = path.join(PLATFORMS_DIR, `setup-${platform}`);
  if (fs.existsSync(setupSrc)) {
    const setupDest = path.join(outDir, 'setup');
    fs.copyFileSync(setupSrc, setupDest);
    try { fs.chmodSync(setupDest, 0o755); } catch {}
    console.log(`    OK  setup`);
  }
  const setupPs1 = path.join(PLATFORMS_DIR, `setup-${platform}.ps1`);
  if (fs.existsSync(setupPs1)) {
    fs.copyFileSync(setupPs1, path.join(outDir, 'setup.ps1'));
    console.log(`    OK  setup.ps1`);
  }

  console.log(`\n  ✓ ${platform}: ${built} skills built`);
}

// ─── CLI ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('QABuddy — Build');
  console.log('');
  console.log('Generates platform-specific skill sets from core templates.');
  console.log('');
  console.log('Usage: node build.js <platform|all> [--locale <code>]');
  console.log('');
  console.log('Platforms:');
  console.log('  claude     Claude Code (~/.claude/skills/)');
  console.log('  cursor     Cursor IDE (~/.cursor/skills/)');
  console.log('  copilot    GitHub Copilot (.github/skills/)');
  console.log('  all        Build for all platforms');
  console.log('');
  console.log('Options:');
  console.log('  --locale <code>  Build from locales/<code>/ (e.g., --locale ko)');
  console.log('                   Falls back to core/ for untranslated files');
  console.log('');
  console.log('Output:');
  console.log('  dist/<platform>/              Default (English)');
  console.log('  dist/<locale>/<platform>/     With --locale');
  process.exit(0);
}

// Parse args: <platform|all> [--locale <code>]
let target = null;
let locale = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--locale' && args[i + 1]) {
    locale = args[i + 1];
    i++; // skip the locale value
  } else if (!target) {
    target = args[i];
  }
}

if (!target) {
  console.error('Missing platform argument. Use: node build.js <platform|all> [--locale <code>]');
  process.exit(1);
}

const platforms = target === 'all' ? ALL_PLATFORMS : [target];

for (const p of platforms) {
  if (!ALL_PLATFORMS.includes(p)) {
    console.error(`Unknown platform: ${p}. Use: ${ALL_PLATFORMS.join(', ')}, all`);
    process.exit(1);
  }
}

// Validate locale directory exists if specified
if (locale && !fs.existsSync(path.join(LOCALES_DIR, locale))) {
  console.error(`Locale not found: locales/${locale}/`);
  console.error(`Available locales: ${
    fs.existsSync(LOCALES_DIR)
      ? fs.readdirSync(LOCALES_DIR).filter(d => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory()).join(', ') || '(none)'
      : '(none — create locales/<code>/ first)'
  }`);
  process.exit(1);
}

console.log('QABuddy — Build');
console.log('==================');
console.log(`Platforms: ${platforms.join(', ')}${locale ? ` | Locale: ${locale}` : ''}`);

for (const p of platforms) {
  buildPlatform(p, locale);
}

const outPath = locale ? `dist/${locale}/` : 'dist/';
console.log('\n==================');
console.log(`Done. Output in ${outPath}`);
