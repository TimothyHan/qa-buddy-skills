#!/usr/bin/env node
'use strict';
/*
 * QABuddy engine launcher (RFC 0003 PR C, v0.8.0).
 *
 * The engine is Akela (npm: akela), vendored by the build into
 * references/engine/akela/ next to this file's parent. This launcher:
 *   1. maps QAB_* env vars onto AKELA_* (existing skills and docs keep working)
 *   2. ensures the project has akela.json — generating it on first run from
 *      .qabuddy.json + the shipped qa domain pack (the RFC 0003 converter,
 *      previously `qab.js akela-init`; still available as the `akela-init`
 *      subcommand, with --force to regenerate)
 *   3. delegates everything else to the vendored engine, argv untouched
 *      (`--skill`/`--ticket` are engine-native aliases of --activity/--task)
 *
 * bin/qab.js remains as a deprecation shim that requires this file.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// akela ≥ 0.1.4 expands a leading `~/` — emit portable paths in generated
// config so a committed akela.json travels across teammates' machines
// (closes RFC 0003 §7).
function portable(p) {
  const home = os.homedir();
  return p.startsWith(home + path.sep) ? '~/' + path.relative(home, p) : p;
}

function die(msg) { process.stderr.write(`akela-launcher: ${msg}\n`); process.exit(1); }

// 1 · env mapping — QAB_* names survive one release for compatibility
for (const [from, to] of [['QAB_CWD', 'AKELA_CWD'], ['QAB_TS', 'AKELA_TS'], ['QAB_RUN', 'AKELA_RUN']]) {
  if (process.env[from] !== undefined && process.env[to] === undefined) process.env[to] = process.env[from];
}
const CWD = process.env.AKELA_CWD ? path.resolve(process.env.AKELA_CWD) : process.cwd();

// Engine resolution: the vendored copy first (self-contained installs), the
// npm copy second (running from the repo before a build).
function enginePath() {
  const vendored = path.join(__dirname, '..', 'engine', 'akela', 'bin', 'akela.js');
  if (fs.existsSync(vendored)) return vendored;
  try { return require.resolve('akela/bin/akela.js'); } catch { /* fall through */ }
  die('engine not found — expected references/engine/akela/ (run node build.js all) or node_modules/akela (run npm ci)');
}

function refsRoot() { return path.resolve(__dirname, '..'); }

function readQabuddyConfig() {
  const p = path.join(CWD, '.qabuddy.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) || {}; }
  catch (e) { die(`.qabuddy.json is not valid JSON: ${e.message}`); }
}

// 2 · the converter (RFC 0003 decision 2: akela.json is user-owned once written)
function generateConfig({ force, firstRun }) {
  const out = path.join(CWD, 'akela.json');
  if (fs.existsSync(out) && !force) {
    die('akela.json already exists — it is user-owned after generation (RFC 0003 decision 2); re-run with --force to regenerate');
  }
  // Shipped layout first (references/bin/ next to references/engine/); a repo
  // checkout (bin/ next to core/) is a supported dev fallback — Akela indexes
  // the knowledge root itself, so no built index.json is required there.
  let refs = refsRoot();
  let pack = path.join(refs, 'engine', 'qa.domain.json');
  if (!fs.existsSync(path.join(refs, 'index.json')) || !fs.existsSync(pack)) {
    const repoPack = path.join(__dirname, '..', 'core', 'engine', 'qa.domain.json');
    const repoRefs = path.join(__dirname, '..', 'core', 'references');
    if (fs.existsSync(repoPack) && fs.existsSync(repoRefs)) { pack = repoPack; refs = repoRefs; }
    else die('no shipped references/engine next to this launcher and no repo core/ beside it — run node build.js all');
  }
  const cfg = readQabuddyConfig();
  const comp = (cfg.compiler && typeof cfg.compiler === 'object' && !Array.isArray(cfg.compiler)) ? cfg.compiler : {};
  const knowledge = [{ path: portable(refs), namespace: 'REF' }];
  const prjDirs = [...new Set((Array.isArray(comp.references) ? comp.references : []).map(g => path.dirname(g)))];
  if (prjDirs.length > 1) {
    die(`compiler.references spans multiple directories (${prjDirs.join(', ')}) — Akela takes one root per namespace; consolidate house methodology under one directory, then re-run`);
  }
  for (const d of prjDirs) knowledge.push({ path: d, namespace: 'PRJ' });
  const akela = { domain: portable(pack), knowledge };
  if (cfg.learningsPath) akela.learnings = cfg.learningsPath;
  if (cfg.runsDir) akela.runs = cfg.runsDir;
  const carry = {};
  for (const k of ['scope', 'scoring', 'budget_lines', 'scoringOverride']) if (comp[k] !== undefined) carry[k] = comp[k];
  if (Object.keys(carry).length) akela.compiler = carry;
  fs.writeFileSync(out, JSON.stringify(akela, null, 2) + '\n');
  const detail = `domain: qa pack, knowledge roots: ${knowledge.length}` +
    (prjDirs.length ? ` (PRJ from compiler.references: ${prjDirs.join(', ')})` : '');
  if (firstRun) {
    process.stderr.write(`akela-launcher: akela.json generated from .qabuddy.json (first run) — ${detail}. Commit it; it is yours to edit now.\n`);
  } else {
    process.stdout.write(`akela.json written — ${detail}\n`);
    if (comp.references) process.stdout.write('  note: compiler.references file globs widened to their PRJ directories\n');
    process.stdout.write('  .qabuddy.json keeps workflow config; akela.json owns engine config from here\n');
  }
}

// 3 · dispatch
const sub = process.argv[2];
if (sub === 'akela-init') {
  generateConfig({ force: process.argv.includes('--force'), firstRun: false });
} else {
  const PROJECT_CMDS = new Set(['run-id', 'compile', 'log', 'fp', 'stats', 'gate', 'scoreboard']);
  if (PROJECT_CMDS.has(sub) && !fs.existsSync(path.join(CWD, 'akela.json'))) {
    generateConfig({ force: false, firstRun: true });
  }
  // akela ≥ 0.1.4 exports main() — run in-process (no second node startup on
  // the hot path). The child-process fallback covers an older vendored copy.
  const engine = require(enginePath());
  if (typeof engine.main === 'function') {
    process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); throw e; });
    engine.main(process.argv.slice(2));
  } else {
    const r = spawnSync(process.execPath, [enginePath(), ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(r.status === null ? 1 : r.status);
  }
}
