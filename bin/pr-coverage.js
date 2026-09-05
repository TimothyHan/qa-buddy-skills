#!/usr/bin/env node
'use strict';
/*
 * QABuddy pr-coverage (RFC 0004) — the deterministic half of a PR-triggered run.
 *
 * Zero dependencies. Three subcommands, each JSON on stdout unless told otherwise:
 *
 *   touched  --base <sha> --head <sha> | --files <list>   [--kb features-kb] [--fallback all|none]
 *            Maps a diff to knowledge-base features via features/<key>/sources.json.
 *
 *   heatmap  --touched touched.json [--root .] [--kb features-kb] [--results <playwright json>]
 *            [--phases kb,explore,automate] [--out heatmap.json] [--md heatmap.md]
 *            [--companion-url URL] [--run-url URL] [--pr N] [--now ISO]
 *            Rows are the ACs of every touched feature; columns are Unit / API / E2E /
 *            Manual / Exploratory. A cell is `covered` only with a resolved evidence path —
 *            the mapping states intent, the scanner supplies proof (test-plan's rule:
 *            never claim coverage without a file path).
 *
 *   comment  --repo owner/name --pr N --body-file heatmap.md [--marker "<!-- qabuddy:heatmap -->"] [--dry-run]
 *            Finds the comment carrying the marker and patches it; creates it otherwise.
 *
 * Exit codes: 0 ok · 2 usage · 3 knowledge base unreadable · 4 gh failure.
 * The model never runs this to decide anything — the workflow does, before and after the skills.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VERSION = '0.1.0';
const MARKER = '<!-- qabuddy:heatmap -->';
const COLUMNS = ['unit', 'api', 'e2e', 'manual', 'exploratory'];
const COLUMN_LABEL = { unit: 'Unit', api: 'API', e2e: 'E2E', manual: 'Manual', exploratory: 'Exploratory' };
const DEFAULT_TESTS = {
  unit: ['test/**', 'tests/**', 'src/**/*.test.*', 'src/**/*.spec.*'],
  api: ['playwright/tests/api/**', 'playwright/api/**'],
  e2e: ['playwright/**/*.spec.ts', 'playwright/**/*.spec.js', 'e2e/**/*.spec.ts', 'e2e/**/*.spec.js'],
};

// ─── CLI plumbing ──────────────────────────────────────────────────────────

function usage(msg) {
  if (msg) process.stderr.write(`pr-coverage: ${msg}\n`);
  process.stderr.write(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).map(l => l.replace(/^ \* ?/, '')).join('\n') + '\n');
  process.exit(2);
}
function die(code, msg) { process.stderr.write(`pr-coverage: ${msg}\n`); process.exit(code); }

function parseArgs(argv) {
  const cmd = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) usage(`unexpected argument: ${a}`);
    const key = a.slice(2);
    if (key === 'dry-run') { opts.dryRun = true; continue; }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) usage(`--${key} needs a value`);
    opts[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
    i++;
  }
  return { cmd, opts };
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { if (fallback !== undefined) return fallback; die(3, `${p}: ${e.message}`); }
}
function readText(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null; }
function listDir(p) { return fs.existsSync(p) ? fs.readdirSync(p).sort() : []; }
function toPosix(p) { return p.split(path.sep).join('/').replace(/^\.\//, ''); }

// ─── Glob matcher (**, *, ?, {a,b}); anchored; exclude wins ────────────────

function globToRegExp(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) { re += '\\{'; continue; }
      re += '(?:' + glob.slice(i + 1, end).split(',').map(s => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
      i = end;
    } else if ('.+^$()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(re + '$');
}
function matchesAny(file, globs) { return (globs || []).some(g => globToRegExp(g).test(file)); }

// Walk the repo for files matching globs (skips node_modules, .git, dist by default).
function findFiles(root, globs) {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', '.qa-reports', 'playwright-report', 'test-results']);
  const walk = (dir, rel) => {
    for (const name of listDir(dir)) {
      if (skip.has(name)) continue;
      const abs = path.join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let st; try { st = fs.statSync(abs); } catch { continue; }
      if (st.isDirectory()) walk(abs, relPath);
      else if (matchesAny(relPath, globs)) out.push(relPath);
    }
  };
  if (globs && globs.length) walk(root, '');
  return out.sort();
}

// ─── Knowledge base readers ────────────────────────────────────────────────

const AC_RE = /\bAC[\s#]*(\d+(?:\.\d+)*)\b/;
const TC_RE = /\bTC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;
function normalizeAc(s) { const m = String(s).match(AC_RE); return m ? `AC${m[1]}` : null; }
function acSortKey(ac) { return ac.slice(2).split('.').map(n => String(n).padStart(6, '0')).join('.'); }

function featureTitles(kb) {
  const idx = readJson(path.join(kb, 'index.json'), {});
  const titles = {};
  const src = idx && idx.features && typeof idx.features === 'object' ? idx.features : idx;
  for (const [k, v] of Object.entries(src || {})) if (v && typeof v === 'object' && v.title) titles[k] = v.title;
  return titles;
}

function loadFeature(kb, key, titles) {
  const dir = path.join(kb, 'features', key);
  const md = readText(path.join(dir, 'feature.md')) || '';
  const h1 = md.match(/^#\s+(?:Feature:\s*)?(.+)$/m);
  const feature = {
    key, dir,
    title: titles[key] || (h1 ? h1[1].trim() : key),
    sources: fs.existsSync(path.join(dir, 'sources.json')) ? readJson(path.join(dir, 'sources.json')) : null,
    acs: new Map(),          // AC id → text
    mapping: new Map(),      // AC id → { tcs:[{id,layer}], unit:[], coverage }
    tcLayers: new Map(),     // TC id → layer declared in the TC doc
    definedTCs: new Set(),
  };
  // ACs from feature.md: table rows, bullets, sub-headings
  for (const line of md.split('\n')) {
    if (!/^\s*(?:[-*|]|#{3,})/.test(line)) continue;
    const m = line.match(AC_RE);
    if (!m) continue;
    const id = `AC${m[1]}`;
    let text = line.slice(m.index + m[0].length).replace(/^[\s:|—–-]+/, '').split('|')[0].trim();
    if (!feature.acs.has(id)) feature.acs.set(id, text);
  }
  // Test-case docs: TC ids defined, optional **Layer:** per TC
  const tcDir = path.join(dir, 'test-cases');
  for (const f of listDir(tcDir).filter(f => f.endsWith('.md'))) {
    const text = readText(path.join(tcDir, f)) || '';
    let current = null;
    for (const line of text.split('\n')) {
      const h = line.match(/^#{2,4}\s+(TC-[A-Z0-9-]+)/);
      if (h) { current = h[1]; feature.definedTCs.add(current); continue; }
      const layer = line.match(/\*\*Layer:\*\*\s*(unit|api|e2e|manual)/i);
      if (layer && current) feature.tcLayers.set(current, layer[1].toLowerCase());
    }
  }
  // Mapping files — three shapes, tolerated in order of preference
  for (const f of listDir(tcDir).filter(f => f.endsWith('-mapping.json'))) {
    const m = readJson(path.join(tcDir, f), null);
    if (!m || !Array.isArray(m.mappings)) continue;
    for (const row of m.mappings) {
      const id = normalizeAc(row.ac || row.requirement || '') || String(row.ac || row.requirement || '').trim();
      if (!id) continue;
      const entry = feature.mapping.get(id) || { tcs: [], unit: [], coverage: row.coverage || null };
      const push = (tc, layer) => { if (!entry.tcs.some(t => t.id === tc)) entry.tcs.push({ id: tc, layer }); };
      const meta = s => typeof s === 'string' && /^META\b/.test(s);
      if (Array.isArray(row.testCases)) {                       // KB spec §6.5 (canonical)
        for (const tc of row.testCases) if (tc && tc.id) push(tc.id, tc.layer || feature.tcLayers.get(tc.id) || 'e2e');
        for (const u of row.unitTests || []) entry.unit.push(u);
      } else if (Array.isArray(row.e2e_tests) || Array.isArray(row.unit_tests)) {   // /qa-test-cases legacy
        for (const tc of row.e2e_tests || []) meta(tc) ? entry.unit.push(tc) : push(tc, feature.tcLayers.get(tc) || 'e2e');
        for (const u of row.unit_tests || []) entry.unit.push(u);
      } else if (Array.isArray(row.tests)) {                    // on-disk legacy (`tests[]`)
        for (const tc of row.tests) meta(tc) ? entry.unit.push(tc) : push(tc, feature.tcLayers.get(tc) || 'e2e');
      }
      if (!feature.acs.has(id) && (row.ac || row.requirement)) {
        const raw = String(row.ac || row.requirement);
        feature.acs.set(id, raw.replace(AC_RE, '').replace(/^[\s:—–-]+/, '').trim());
      }
      feature.mapping.set(id, entry);
    }
    for (const u of m.unmappedACs || m.unmapped_requirements || []) {
      const id = normalizeAc(u); if (id && !feature.acs.has(id)) feature.acs.set(id, String(u).replace(AC_RE, '').replace(/^[\s:—–-]+/, '').trim());
    }
  }
  return feature;
}

// ─── touched ───────────────────────────────────────────────────────────────

function cmdTouched(o) {
  const kb = o.kb || 'features-kb';
  if (!fs.existsSync(path.join(kb, 'features'))) die(3, `${kb}/features not found`);
  let files;
  if (o.files) {
    const raw = o.files === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(o.files, 'utf8');
    files = raw.split('\n').map(s => s.trim()).filter(Boolean);
  } else if (o.base && o.head) {
    try { files = execFileSync('git', ['diff', '--name-only', `${o.base}...${o.head}`], { encoding: 'utf8' }).split('\n').filter(Boolean); }
    catch (e) { die(3, `git diff failed: ${e.message}`); }
  } else usage('touched needs --base/--head or --files');
  files = [...new Set(files.map(toPosix))].sort();

  const titles = featureTitles(kb);
  const features = [], featuresWithoutSources = [], matched = new Set();
  for (const key of listDir(path.join(kb, 'features'))) {
    if (!fs.statSync(path.join(kb, 'features', key)).isDirectory()) continue;
    const f = loadFeature(kb, key, titles);
    if (!f.sources) { featuresWithoutSources.push(key); continue; }
    const hit = files.filter(file => matchesAny(file, f.sources.sources || []) && !matchesAny(file, f.sources.exclude || []));
    if (hit.length) { features.push({ key, title: f.title, matchedFiles: hit }); hit.forEach(h => matched.add(h)); }
  }
  let fallback = false;
  if (!features.length && (o.fallback || 'none') === 'all') {
    fallback = true;
    for (const key of listDir(path.join(kb, 'features'))) {
      if (!fs.statSync(path.join(kb, 'features', key)).isDirectory()) continue;
      features.push({ key, title: loadFeature(kb, key, titles).title, matchedFiles: [] });
    }
  }
  const out = {
    schema: 'pr-touched/1', base: o.base || null, head: o.head || null, files,
    features, unmapped: { files: files.filter(f => !matched.has(f)), featuresWithoutSources }, fallback,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

// ─── heatmap ───────────────────────────────────────────────────────────────

function specTitles(root, files) {
  // TC id → [file]; titles of test()/it() calls, any quote style
  const map = new Map();
  for (const rel of files) {
    const text = readText(path.join(root, rel)) || '';
    const re = /\b(?:test|it)(?:\.\w+)?\(\s*(['"`])([^'"`]*?)\1/g;
    let m;
    while ((m = re.exec(text))) for (const tc of m[2].match(TC_RE) || []) {
      if (!map.has(tc)) map.set(tc, []);
      if (!map.get(tc).includes(rel)) map.get(tc).push(rel);
    }
  }
  return map;
}

function playwrightResults(p) {
  // Playwright `--reporter=json`: suites[].specs[].tests[].results[].status, nested suites
  const out = new Map();
  if (!p || !fs.existsSync(p)) return out;
  const data = readJson(p, null);
  if (!data) return out;
  const walk = suite => {
    for (const spec of suite.specs || []) {
      const statuses = (spec.tests || []).flatMap(t => (t.results || []).map(r => r.status));
      const status = statuses.includes('failed') || statuses.includes('timedOut') ? 'failed'
        : statuses.includes('passed') ? 'passed' : (spec.ok === false ? 'failed' : 'skipped');
      for (const tc of (spec.title || '').match(TC_RE) || []) out.set(tc, status);
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of data.suites || []) walk(s);
  return out;
}

function inventoryTCs(root) {
  const out = new Map();  // TC id → [inventory file]
  const dir = path.join(root, 'playwright', 'pom', 'inventory');
  for (const f of listDir(dir).filter(f => f.endsWith('.json'))) {
    const data = readJson(path.join(dir, f), null);
    const entries = Array.isArray(data) ? data : (data && Array.isArray(data.elements) ? data.elements : []);
    for (const e of entries) for (const tc of e.sourceTCs || []) {
      if (!out.has(tc)) out.set(tc, []);
      const rel = toPosix(path.relative(root, path.join(dir, f)));
      if (!out.get(tc).includes(rel)) out.get(tc).push(rel);
    }
  }
  return out;
}

function manualResults(feature, root) {
  const out = new Map();  // TC id → { status, file }
  const dir = path.join(feature.dir, 'qa-reports');
  for (const f of listDir(dir).filter(f => f.endsWith('.md'))) {
    for (const line of (readText(path.join(dir, f)) || '').split('\n')) {
      const status = line.match(/\b(PASS|FAIL|BLOCKED|SKIPPED)\b/);
      if (!status) continue;
      for (const tc of line.match(TC_RE) || []) out.set(tc, { status: status[1], file: toPosix(path.relative(root, path.join(dir, f))) });
    }
  }
  return out;
}

function exploratorySessions(feature, root) {
  // Focus Area Results table with an ACs column: AC → { result, evidence }
  const out = new Map();
  const dir = path.join(feature.dir, 'exploratory');
  for (const f of listDir(dir).filter(f => f.endsWith('.md'))) {
    const rel = toPosix(path.relative(root, path.join(dir, f)));
    const lines = (readText(path.join(dir, f)) || '').split('\n');
    let cols = null;
    for (const line of lines) {
      if (!line.trim().startsWith('|')) { cols = null; continue; }
      const cells = line.split('|').slice(1, -1).map(s => s.trim());
      if (!cols) {
        const lower = cells.map(c => c.toLowerCase());
        if (lower.some(c => c.startsWith('focus area')) && lower.some(c => c === 'acs' || c === 'ac')) {
          cols = { acs: lower.findIndex(c => c === 'acs' || c === 'ac'), findings: lower.indexOf('findings'), result: lower.indexOf('result') };
        }
        continue;
      }
      if (/^:?-+:?$/.test(cells[0] || '')) continue;
      const result = (cells[cols.result] || '').toLowerCase().match(/clean|finding|unexplored/);
      if (!result) continue;
      const findings = cells[cols.findings] || '';
      const refs = findings.match(/Finding \d+/g) || [];
      for (const raw of (cells[cols.acs] || '').split(/[,\s]+/)) {
        const ac = normalizeAc(raw); if (!ac) continue;
        const evidence = refs.length ? refs.map(r => `${rel}#${r}`) : [rel];
        const prev = out.get(ac);
        if (!prev || result[0] === 'finding' || (prev.result === 'unexplored' && result[0] === 'clean')) out.set(ac, { result: result[0], evidence });
      }
    }
  }
  return out;
}

function buildHeatmap(o) {
  const root = path.resolve(o.root || '.');
  const kb = path.resolve(root, o.kb || 'features-kb');
  const touched = readJson(o.touched);
  const phases = (o.phases || 'kb').split(',').map(s => s.trim()).filter(Boolean);
  const titles = featureTitles(kb);
  const results = playwrightResults(o.results);
  const inventory = inventoryTCs(root);
  const features = [];
  const summary = { covered: 0, partial: 0, gap: 0, notRun: 0, atRisk: 0 };

  for (const t of touched.features || []) {
    const f = loadFeature(kb, t.key, titles);
    const tests = Object.assign({}, DEFAULT_TESTS, (f.sources && f.sources.tests) || {});
    const e2eSpecs = specTitles(root, findFiles(root, tests.e2e));
    const apiSpecs = specTitles(root, findFiles(root, tests.api));
    const unitFiles = findFiles(root, tests.unit).map(rel => ({ rel, text: readText(path.join(root, rel)) || '' }));
    const manual = manualResults(f, root);
    const explored = exploratorySessions(f, root);
    const acIds = [...new Set([...f.acs.keys(), ...f.mapping.keys()])].sort((a, b) => acSortKey(a).localeCompare(acSortKey(b)));
    const rows = [];

    for (const ac of acIds) {
      const map = f.mapping.get(ac) || { tcs: [], unit: [], coverage: null };
      const cells = {};
      let atRisk = false;
      const cell = (state, evidence, extra) => Object.assign({ state, evidence: evidence || [] }, extra || {});

      // Unit — a unit file that mentions the AC or one of its TCs, or a META row
      {
        const meta = map.unit.filter(u => /^META\b/.test(u));
        const hits = unitFiles.filter(u => u.text.includes(ac + ':') || u.text.includes(ac + ' ') || map.tcs.some(tc => u.text.includes(tc.id)) || map.unit.some(name => !/^META\b/.test(name) && u.text.includes(name)));
        if (hits.length) cells.unit = cell('covered', hits.map(h => h.rel));
        else if (meta.length) cells.unit = cell('covered', ['META'], { note: meta[0] });
        else if (map.unit.length || map.tcs.some(tc => tc.layer === 'unit')) cells.unit = cell('partial', [], { note: 'declared, no file found' });
        else cells.unit = cell('gap');
      }
      // API / E2E — a spec whose test title carries the TC id; result from --results
      for (const [col, specs, layers] of [['api', apiSpecs, ['api']], ['e2e', e2eSpecs, ['e2e', 'manual', undefined]]]) {
        const tcs = map.tcs.filter(tc => layers.includes(tc.layer));
        const proven = tcs.filter(tc => specs.has(tc.id));
        if (proven.length) {
          const statuses = proven.map(tc => results.get(tc.id) || 'not-run');
          const result = statuses.includes('failed') ? 'failed' : statuses.every(s => s === 'passed') ? 'passed' : statuses.includes('passed') ? 'partial-pass' : 'not-run';
          if (result === 'failed') atRisk = true;
          cells[col] = cell('covered', proven.flatMap(tc => specs.get(tc.id)), { tcs: proven.map(tc => tc.id), result });
        } else if (tcs.length) {
          const inv = tcs.flatMap(tc => inventory.get(tc.id) || []);
          cells[col] = cell('partial', inv, { tcs: tcs.map(tc => tc.id), note: inv.length ? 'in POM inventory, no spec' : 'test case designed, no spec' });
        } else cells[col] = cell('gap');
      }
      // Manual — the TC was executed in a saved QA report
      {
        const tcs = map.tcs.filter(tc => tc.layer !== 'unit' && tc.layer !== 'api');
        const ran = tcs.filter(tc => manual.has(tc.id));
        if (ran.length) {
          const failed = ran.some(tc => manual.get(tc.id).status === 'FAIL');
          if (failed) atRisk = true;
          cells.manual = cell('covered', [...new Set(ran.map(tc => manual.get(tc.id).file))], { tcs: ran.map(tc => tc.id), result: failed ? 'failed' : 'passed' });
        } else if (tcs.length) cells.manual = cell('partial', [], { tcs: tcs.map(tc => tc.id), note: 'designed, never executed' });
        else cells.manual = cell('gap');
      }
      // Exploratory — an AC-keyed row in a persisted session
      {
        const x = explored.get(ac);
        if (x && x.result !== 'unexplored') { if (x.result === 'finding') atRisk = true; cells.exploratory = cell('covered', x.evidence, { result: x.result }); }
        else if (x) cells.exploratory = cell('partial', x.evidence, { note: 'listed, unexplored' });
        else if (phases.includes('explore')) cells.exploratory = cell('gap');
        else cells.exploratory = cell('not-run');
      }
      for (const c of Object.values(cells)) summary[c.state === 'not-run' ? 'notRun' : c.state]++;
      if (atRisk) summary.atRisk++;
      rows.push({ ac, text: f.acs.get(ac) || '', coverage: map.coverage, cells, atRisk });
    }
    features.push({ key: f.key, title: f.title, matchedFiles: t.matchedFiles || [], rows });
  }

  return {
    schema: 'pr-coverage/1', version: VERSION,
    generatedAt: o.now || (process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString()),
    pr: o.pr ? Number(o.pr) : null, phases, fallback: !!touched.fallback,
    features, summary,
    unmapped: touched.unmapped || { files: [], featuresWithoutSources: [] },
    links: { companion: o.companionUrl || null, run: o.runUrl || null },
  };
}

const ICON = { covered: '✅', partial: '🟡', gap: '🔴', 'not-run': '⚪' };
function renderCell(c) {
  let s = ICON[c.state];
  if (c.result === 'failed') s = `⚠️ ${s}`;
  if (c.result === 'finding') s = `⚠️ ${s}`;
  const bits = [];
  if (c.tcs && c.tcs.length) bits.push(c.tcs.join(', '));
  if (c.result && c.result !== 'passed' && c.result !== 'clean') bits.push(c.result === 'failed' ? 'FAIL' : c.result === 'finding' ? 'finding' : c.result === 'not-run' ? 'not run' : c.result);
  if (c.result === 'passed') bits.push('PASS');
  if (c.result === 'clean') bits.push('clean');
  if (!c.tcs && c.evidence && c.evidence.length && c.evidence[0] !== 'META') bits.push(path.basename(c.evidence[0]).replace(/#.*$/, ''));
  if (c.evidence && c.evidence[0] === 'META') bits.push('META');
  return bits.length ? `${s} ${bits.join(' · ')}` : s;
}

function renderMarkdown(h) {
  const L = [MARKER, ''];
  L.push(`## QABuddy coverage heatmap${h.pr ? ` — PR #${h.pr}` : ''}`, '');
  const feats = h.features.map(f => f.matchedFiles.length ? `**${f.key}** (${f.matchedFiles.join(', ')})` : `**${f.key}**`).join(', ');
  L.push(`Phases run: ${h.phases.join(', ')} · Features touched: ${feats || '_none_'}${h.fallback ? ' · ⚠️ no `sources.json` matched — showing every feature' : ''}`, '');
  if (!h.features.length) L.push('_No knowledge-base feature owns the changed files. Add `features-kb/features/<key>/sources.json` to map them._', '');
  for (const f of h.features) {
    L.push(`### ${f.title} (\`${f.key}\`)`, '');
    L.push(`| AC | ${COLUMNS.map(c => COLUMN_LABEL[c]).join(' | ')} |`);
    L.push(`|---|${COLUMNS.map(() => '---').join('|')}|`);
    for (const r of f.rows) {
      const label = `${r.atRisk ? '⚠️ ' : ''}**${r.ac}**${r.text ? ` — ${r.text.replace(/\|/g, '\\|')}` : ''}`;
      L.push(`| ${label} | ${COLUMNS.map(c => renderCell(r.cells[c])).join(' | ')} |`);
    }
    L.push('');
  }
  const s = h.summary;
  L.push(`**${s.covered}** covered · **${s.partial}** partial · **${s.gap}** gap · **${s.notRun}** not run · **${s.atRisk}** AC${s.atRisk === 1 ? '' : 's'} at risk`, '');
  L.push('Legend: ✅ covered (evidence on disk) · 🟡 partial (designed, not proven) · 🔴 gap · ⚪ not run this time · ⚠️ failing or a finding', '');
  const evidence = [];
  for (const f of h.features) for (const r of f.rows) for (const c of COLUMNS) {
    const cell = r.cells[c];
    if (cell.evidence && cell.evidence.length) evidence.push(`- ${r.ac} / ${COLUMN_LABEL[c]}: ${cell.evidence.map(e => `\`${e}\``).join(', ')}${cell.note ? ` — ${cell.note}` : ''}`);
    else if (cell.note) evidence.push(`- ${r.ac} / ${COLUMN_LABEL[c]}: ${cell.note}`);
  }
  if (evidence.length) L.push('<details><summary>Evidence</summary>', '', ...evidence, '', '</details>', '');
  const u = h.unmapped || {};
  if ((u.files || []).length) L.push(`**Unmapped changed files** (no feature claims them): ${u.files.map(f => `\`${f}\``).join(', ')}`, '');
  if ((u.featuresWithoutSources || []).length) L.push(`**Features without \`sources.json\`:** ${u.featuresWithoutSources.map(f => `\`${f}\``).join(', ')}`, '');
  const links = [];
  if (h.links.companion) links.push(`Companion PR: ${h.links.companion}`);
  if (h.links.run) links.push(`Run: ${h.links.run}`);
  if (links.length) L.push(links.join(' · '), '');
  L.push(`<sub>Generated by QABuddy pr-coverage ${h.version} at ${h.generatedAt}</sub>`);
  return L.join('\n') + '\n';
}

function cmdHeatmap(o) {
  if (!o.touched) usage('heatmap needs --touched');
  const h = buildHeatmap(o);
  const json = JSON.stringify(h, null, 2) + '\n';
  if (o.out) { fs.mkdirSync(path.dirname(o.out), { recursive: true }); fs.writeFileSync(o.out, json); }
  if (o.md) { fs.mkdirSync(path.dirname(o.md), { recursive: true }); fs.writeFileSync(o.md, renderMarkdown(h)); }
  if (!o.out && !o.md) process.stdout.write(json);
  else process.stdout.write(JSON.stringify({ out: o.out || null, md: o.md || null, summary: h.summary }) + '\n');
}

// ─── comment ───────────────────────────────────────────────────────────────

function gh(args) {
  try { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { die(4, `gh ${args.slice(0, 3).join(' ')} failed: ${(e.stderr || e.message || '').toString().trim()}`); }
}

function cmdComment(o) {
  if (!o.repo || !o.pr || !o.bodyFile) usage('comment needs --repo, --pr, --body-file');
  const marker = o.marker || MARKER;
  const body = readText(o.bodyFile);
  if (body === null) die(3, `${o.bodyFile} not found`);
  if (!body.includes(marker)) die(3, `${o.bodyFile} does not contain the marker ${marker}`);
  const listUrl = `repos/${o.repo}/issues/${o.pr}/comments`;
  if (o.dryRun) {
    process.stdout.write(JSON.stringify({ dryRun: true, method: 'PATCH-or-POST', url: listUrl, marker }) + '\n');
    return;
  }
  const raw = gh(['api', listUrl, '--paginate', '--jq', '.[] | {id: .id, body: .body}']);
  let existing = null;
  for (const line of raw.split('\n').filter(Boolean)) {
    try { const c = JSON.parse(line); if (c.body && c.body.includes(marker)) { existing = c; break; } } catch { /* skip */ }
  }
  let result;
  if (existing) result = gh(['api', '-X', 'PATCH', `repos/${o.repo}/issues/comments/${existing.id}`, '-F', `body=@${o.bodyFile}`]);
  else result = gh(['api', '-X', 'POST', listUrl, '-F', `body=@${o.bodyFile}`]);
  let id = existing ? existing.id : null, url = null;
  try { const r = JSON.parse(result); id = r.id || id; url = r.html_url || null; } catch { /* gh printed nothing parseable */ }
  process.stdout.write(JSON.stringify({ action: existing ? 'patched' : 'created', id, url }) + '\n');
}

// ─── main ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (cmd === 'touched') cmdTouched(opts);
  else if (cmd === 'heatmap') cmdHeatmap(opts);
  else if (cmd === 'comment') cmdComment(opts);
  else if (cmd === '--version' || cmd === 'version') process.stdout.write(`pr-coverage ${VERSION}\n`);
  else usage(cmd ? `unknown subcommand: ${cmd}` : undefined);
}

module.exports = { globToRegExp, matchesAny, loadFeature, buildHeatmap, renderMarkdown, MARKER, VERSION };
