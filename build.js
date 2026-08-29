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

// ─── Reference index (RFC 0001 §3.1 / §3.6) ───────────────────────────────
//
// Every reference section is an addressable source: `REF-<stem>#<id>` (or
// `REF-playbook/<stem>#<id>` under playbook/). The id lives in an HTML comment on
// the line right after the heading — never in the heading text:
//
//   ## Selectors
//   <!-- qab: id=selectors tier=must -->
//
// Rules: `##` headings outside fenced code are addressable and MUST carry a comment.
// The H1 may carry a comment with file-level defaults (scope=, tier=) that sections
// inherit, and optionally id= for files whose knowledge sits directly under the H1
// (terminology, execution-sequence). scope defaults to `all`, tier to `should`.
// README.md and index.md are navigation, not knowledge — excluded. The build fails
// on a `##` without a comment, a duplicate id, or an en/ko id-set mismatch — the
// references *directory* is resolved per locale, so an untagged or missing ko
// section would otherwise silently diverge (RFC decision 14).

const REF_EXCLUDE = new Set(['README.md', 'index.md']);
const REF_TIERS = new Set(['must', 'should', 'context']);

function parseQabComment(line) {
  const m = line.match(/^<!--\s*qab:\s*(.*?)\s*-->\s*$/);
  if (!m) return null;
  const out = {};
  for (const tok of m[1].split(/\s+/).filter(Boolean)) {
    const kv = tok.match(/^([a-z_]+)=(.+)$/);
    if (!kv) return { error: `bad token "${tok}"` };
    out[kv[1]] = kv[2];
  }
  return out;
}

function listRefFiles(dir, prefix = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) { out.push(...listRefFiles(path.join(dir, entry.name), prefix + entry.name + '/')); continue; }
    if (!entry.name.endsWith('.md') || REF_EXCLUDE.has(entry.name)) continue;
    out.push(prefix + entry.name);
  }
  return out;
}

// Returns { index: { 'REF-…': {file, heading, scope, tier, lines} }, errors: [] }
function parseReferenceIndex(refsDir) {
  const index = {};
  const errors = [];
  for (const rel of listRefFiles(refsDir)) {
    const stem = rel.replace(/\.md$/, '');
    const lines = fs.readFileSync(path.join(refsDir, rel), 'utf8').replace(/\r\n/g, '\n').split('\n');
    let fence = false;
    let fileScope = 'all';
    let fileTier = 'should';
    let seenH1 = false;
    const sections = []; // {id, heading, start, scope, tier}
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('```')) { fence = !fence; continue; }
      if (fence) continue;
      const isH1 = l.startsWith('# ') && !seenH1;
      const isH2 = l.startsWith('## ');
      if (!isH1 && !isH2) continue;
      const heading = l.replace(/^#+\s*/, '').trim();
      const c = i + 1 < lines.length ? parseQabComment(lines[i + 1]) : null;
      if (c && c.error) { errors.push(`${rel}:${i + 2}: ${c.error}`); continue; }
      if (isH1) {
        seenH1 = true;
        if (c) {
          if (c.scope) fileScope = c.scope;
          if (c.tier) { if (!REF_TIERS.has(c.tier)) errors.push(`${rel}:${i + 2}: unknown tier "${c.tier}"`); else fileTier = c.tier; }
          if (c.id) sections.push({ id: c.id, heading, start: i, scope: c.scope || fileScope, tier: c.tier || fileTier, h1: true });
        }
        continue;
      }
      // close the H1 section at the first ## (its lines run from H1 to here)
      if (sections.length && sections[sections.length - 1].h1 && sections[sections.length - 1].end === undefined) sections[sections.length - 1].end = i;
      if (!c || !c.id) { errors.push(`${rel}:${i + 1}: "## ${heading}" has no <!-- qab: id=… --> comment on the next line`); continue; }
      if (c.tier && !REF_TIERS.has(c.tier)) errors.push(`${rel}:${i + 2}: unknown tier "${c.tier}"`);
      if (sections.length && !sections[sections.length - 1].h1) sections[sections.length - 1].end = i;
      sections.push({ id: c.id, heading, start: i, scope: c.scope || fileScope, tier: c.tier || fileTier });
    }
    for (const s of sections) {
      if (s.end === undefined) s.end = lines.length;
      if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) errors.push(`${rel}: id "${s.id}" must be kebab-case`);
      const key = `REF-${stem}#${s.id}`;
      if (index[key]) { errors.push(`duplicate id ${key} (${rel} and ${index[key].file})`); continue; }
      index[key] = {
        file: rel,
        heading: s.heading,
        scope: s.scope === 'all' ? ['all'] : s.scope.split(',').map(x => x.trim()).filter(Boolean),
        tier: s.tier,
        lines: s.end - s.start,
      };
    }
  }
  return { index, errors };
}

// Compare id sets across locales; returns error strings (empty = parity)
function referenceParityErrors(enIndex, otherIndex, label) {
  const a = Object.keys(enIndex).sort();
  const b = Object.keys(otherIndex).sort();
  const errs = [];
  for (const k of a) if (!(k in otherIndex)) errs.push(`${label} is missing ${k}`);
  for (const k of b) if (!(k in enIndex)) errs.push(`${label} has extra ${k}`);
  return errs;
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

  // Emit the reference index for this locale (RFC 0001 §3.6). Ids are locale-
  // independent; heading text and line counts are per-locale.
  {
    const { index, errors } = parseReferenceIndex(refsDir);
    if (errors.length) {
      console.error('  ERROR: reference index');
      for (const e of errors) console.error(`    - ${e}`);
      process.exit(1);
    }
    const idxPath = path.join(outDir, 'references', 'index.json');
    fs.writeFileSync(idxPath, JSON.stringify(index, null, 1) + '\n');
    console.log(`    OK  references/index.json (${Object.keys(index).length} sections)`);
  }

  // Ship the runtime helper under references/bin/ — reachable on every platform as
  // {{REFERENCE_PATH}}/bin/qab.js via the existing references symlink, so setup
  // scripts need no change. Locale-independent (RFC 0001 §4).
  const binSrc = path.join(ROOT, 'bin');
  if (!fs.existsSync(path.join(binSrc, 'qab.js'))) {
    console.error('  ERROR: bin/qab.js missing — the runtime helper must ship with references');
    process.exit(1);
  }
  copyDirRecursive(binSrc, path.join(outDir, 'references', 'bin'));
  console.log('    OK  references/bin/qab.js');

  // Ship the engine under references/engine/ (RFC 0003). Two parts, both
  // locale-independent: the qa domain pack (core/engine/) and the vendored
  // Akela engine itself, copied from node_modules at exactly the pinned
  // version so installs stay self-contained (decision 1 — dist never depends
  // on node_modules at runtime).
  const engineSrc = path.join(ROOT, 'core', 'engine');
  if (fs.existsSync(engineSrc)) {
    copyDirRecursive(engineSrc, path.join(outDir, 'references', 'engine'));
    console.log('    OK  references/engine/ (qa domain pack)');
  }
  {
    const pin = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).dependencies.akela;
    const akelaSrc = path.join(ROOT, 'node_modules', 'akela');
    if (!fs.existsSync(path.join(akelaSrc, 'package.json'))) {
      console.error('  ERROR: node_modules/akela missing — the engine must be vendored into dist. Run: npm ci');
      process.exit(1);
    }
    const got = JSON.parse(fs.readFileSync(path.join(akelaSrc, 'package.json'), 'utf8')).version;
    if (got !== pin) {
      console.error(`  ERROR: node_modules/akela is ${got} but package.json pins ${pin} — run npm ci`);
      process.exit(1);
    }
    // Code only — the vendored copy lives INSIDE the references knowledge
    // root, and Akela indexes every .md under a root: its own README/docs
    // would be indexed as untagged knowledge and refuse the compile (caught
    // by the engine's own strictness during the cutover red-walk).
    const engineDst = path.join(outDir, 'references', 'engine', 'akela');
    for (const part of ['bin', 'lib', 'domains']) {
      copyDirRecursive(path.join(akelaSrc, part), path.join(engineDst, part));
    }
    for (const f of ['package.json', 'LICENSE']) {
      fs.copyFileSync(path.join(akelaSrc, f), path.join(engineDst, f));
    }
    const pruneMd = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) pruneMd(p);
        else if (e.name.endsWith('.md')) fs.unlinkSync(p);
      }
    };
    pruneMd(engineDst);
    console.log(`    OK  references/engine/akela/ (vendored engine ${got}, code only)`);
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

module.exports = { parseReferenceIndex, referenceParityErrors, listRefFiles, parseQabComment };

if (require.main === module) main();

function main() {
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

// Reference-id parity across every locale (RFC decision 14): fail loudly before
// writing anything, whichever locale is being built.
{
  const en = parseReferenceIndex(path.join(CORE_DIR, 'references'));
  const errs = [...en.errors];
  if (fs.existsSync(LOCALES_DIR)) {
    for (const loc of fs.readdirSync(LOCALES_DIR).filter(d => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory())) {
      const locRefs = path.join(LOCALES_DIR, loc, 'references');
      if (!fs.existsSync(locRefs)) continue;
      const other = parseReferenceIndex(locRefs);
      errs.push(...other.errors.map(e => `${loc}: ${e}`));
      errs.push(...referenceParityErrors(en.index, other.index, `locales/${loc}`));
      // the references *directory* is resolved per locale — an en-only file never reaches dist/<loc>
      const enFiles = listRefFiles(path.join(CORE_DIR, 'references'));
      const locFiles = new Set(listRefFiles(locRefs));
      for (const f of enFiles) if (!locFiles.has(f)) errs.push(`locales/${loc}/references is missing ${f} (dist/${loc} would silently drop it)`);
    }
  }
  if (errs.length) {
    console.error('\nERROR: reference ids / locale parity');
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`References: ${Object.keys(en.index).length} sections, locale parity OK`);
}

for (const p of platforms) {
  buildPlatform(p, locale);
}

const outPath = locale ? `dist/${locale}/` : 'dist/';
console.log('\n==================');
console.log(`Done. Output in ${outPath}`);
}
