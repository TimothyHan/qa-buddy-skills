#!/usr/bin/env node
/**
 * qab.js — QABuddy runtime helper (zero dependencies).
 *
 * Shipped to dist/<platform>/references/bin/qab.js so every platform can call it as
 *   node <REFERENCE_PATH>/bin/qab.js <subcommand> …
 * The model passes bare arguments; it never hand-writes JSON. Design: docs/rfc/0001-context-compiler.md §4.
 *
 * Subcommands:
 *   run-id  --skill <name> [--ticket <key>]      print a run id, create <runsDir>/<run>/ and remember it in .qa-reports/.qab-run
 *   compile --skill <name> [--ticket <key>]      (PR5) run-id if needed → profile v0 → candidate sources (scope + active LRNs)
 *                                                → pack (must first, unscored, no cap) → <run>/slice.md + profile.json + scratchpad.md
 *                                                → append `compiled` → print the slice path
 *                                                Project `.qabuddy.json` `compiler.scope` overrides apply after core scope
 *                                                resolution (RFC 0002 §2.1): tier=must is a floor, unknown ids are refused
 *                                                loudly, and the manifest records `via:`/`reason: project-override`.
 *                                                Project `compiler.references` files compile as PRJ-<stem>#<id> sections
 *                                                (RFC 0002 §2.2) — same qab: contract, cited and counted like REF-.
 *   log     <event> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]
 *                                                append one v1 line to <learningsPath dir>/learnings-log.jsonl (+ <run>/events.jsonl)
 *   fp      <kind> <key> [--run <id>] [--skill <name>]
 *                                                (PR6) append one failure fingerprint to <learningsPath dir>/fingerprints.jsonl:
 *                                                ffp = sha256(kind + "\n" + normalized key)[:12]; `active` = LRNs in this run's slice
 *                                                whose Fingerprint: equals ffp (automatic falsification evidence)
 *   fp      --list [--run <id>]                  print this run's fingerprints (for the capture rule: link Fingerprint: to the ffp)
 *   stats   [--since <YYYY-MM-DD>] [--json]      per-source counts (+ in_slice) + findings + fingerprint recurrence + compliance
 *   gate    [--json]                             (RFC 0002 §2.3) the RFC 0001 §9.3 gate evaluated on THIS project's logs:
 *                                                profiles×outcomes vs ≥2×≥8, dormant sources, slice size per skill, an explicit
 *                                                eligible/not-eligible line — evidence only; cause classification stays human
 *   scoreboard                                   (PR6) rebuild <learningsPath dir>/.cache/scoreboard.json from both logs (derived, gitignored)
 *
 * Log line (schema v1):
 *   {"v":1,"ts":"2026-08-20T09:12:04Z","run":"qa-PROJ-456-3f9a2c","skill":"qa","event":"applied","src":"LRN-20260808-03"}
 * Events: applied | contradicted (+note) | captured | outcome (+status) — compiled | escalated reserved for the compile step.
 * Fingerprint line (RFC 0001 §3.4):
 *   {"v":1,"ts":"…","run":"…","skill":"e2e-pom","pfp":"…","ffp":"a3f9c21b0e44","kind":"locator-not-found","key":"checkout/place-order-btn","active":["LRN-…"]}
 *
 * Environment overrides (mainly for tests): QAB_CWD (project root), QAB_RUN (run id), QAB_TS (fixed timestamp).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EVENTS = ['applied', 'contradicted', 'captured', 'outcome', 'compiled', 'escalated'];
const STATUSES = ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT'];
// Closed vocabulary of failure classes (RFC 0001 §3.4) — grown deliberately, never ad hoc.
const FP_KINDS = ['locator-not-found', 'ac-unmapped', 'spec-flaky', 'ci-step-failed', 'env-unreachable', 'auth-failed', 'fixture-missing', 'assertion-mismatch', 'tool-unavailable'];
// Dormancy (RFC decision 5): a source that was in the candidate set this often and never shaped output.
const NEVER_APPLIED_MIN_IN_SLICE = 10;
const CWD = process.env.QAB_CWD ? path.resolve(process.env.QAB_CWD) : process.cwd();
const MARKER = path.join(CWD, '.qa-reports', '.qab-run');

function die(msg) { process.stderr.write(`qab: ${msg}\n`); process.exit(1); }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    } else out._.push(a);
  }
  return out;
}

function readConfig() {
  const p = path.join(CWD, '.qabuddy.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function kbDir() {
  const cfg = readConfig();
  return path.join(CWD, path.dirname(cfg.learningsPath || 'features-kb/LEARNINGS.md'));
}
function logPath() { return path.join(kbDir(), 'learnings-log.jsonl'); }
function fpPath() { return path.join(kbDir(), 'fingerprints.jsonl'); }
function scoreboardPath() { return path.join(kbDir(), '.cache', 'scoreboard.json'); }

// Display-only relative path with forward slashes on every OS (tests and humans read these lines).
function rel(p) { return path.relative(CWD, p).split(path.sep).join('/'); }

function nowIso() {
  if (process.env.QAB_TS) return process.env.QAB_TS;
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function runsDir() {
  const cfg = readConfig();
  return path.join(CWD, cfg.runsDir || '.qa-reports/runs');
}

function readMarker() {
  if (!fs.existsSync(MARKER)) return null;
  try { return JSON.parse(fs.readFileSync(MARKER, 'utf8')); } catch { return null; }
}

function gitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: CWD, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40) || 'nobranch';
  } catch { return 'nobranch'; }
}

// ─── run-id ─────────────────────────────────────────────────────────────
function cmdRunId(args) {
  const skill = args.skill;
  if (!skill || skill === true) die('run-id requires --skill <name>');
  const scope = (args.ticket && args.ticket !== true) ? String(args.ticket) : gitBranch();
  const hex = crypto.createHash('sha256').update(`${nowIso()}|${process.pid}|${Math.random()}`).digest('hex').slice(0, 6);
  const run = `${skill}-${scope}-${hex}`;
  return startRun(run, skill, args.ticket && args.ticket !== true ? String(args.ticket) : null, true);
}

// Create the run directory (RFC 0001 §3.7) and remember the current run in the marker.
function startRun(run, skill, ticket, print) {
  const dir = path.join(runsDir(), run);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, JSON.stringify({ run, skill, ticket: ticket || undefined, dir, started: nowIso() }) + '\n');
  if (print) process.stdout.write(run + '\n');
  return { run, skill, ticket, dir };
}

// ─── reference index (shipped next to this helper: references/index.json) ──
function loadRefIndex() {
  const p = path.join(__dirname, '..', 'index.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// Cheap similarity for "did you mean": same file stem first, then token overlap.
function nearestRefIds(id, index, n = 3) {
  const ids = Object.keys(index);
  const stem = (id.split('#')[0] || '').replace(/^(REF|PRJ)-/, '');
  const frag = (id.split('#')[1] || '');
  const toks = s => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const t = toks(stem + ' ' + frag);
  const lev = (a, b) => { // small Levenshtein for the fragment tiebreak
    const m = a.length, l = b.length; if (!m) return l; if (!l) return m;
    let prev = Array.from({ length: l + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= l; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[l];
  };
  return ids.map(k => {
    const ks = k.replace(/^(REF|PRJ)-/, '').split('#')[0];
    const kf = k.split('#')[1] || '';
    const kt = toks(k);
    let score = 0;
    for (const x of t) if (kt.has(x)) score++;
    if (ks === stem) score += 3;
    return [score, lev(frag, kf), k];
  }).sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2].localeCompare(b[2])).slice(0, n).filter(x => x[0] > 0).map(x => x[2]);
}

// ─── project compiler config (RFC 0002) ─────────────────────────────────
function compilerConfig() {
  const c = readConfig().compiler;
  return (c && typeof c === 'object' && !Array.isArray(c)) ? c : {};
}

// Project-owned reference sections (RFC 0002 §2.2, PR B).
//   "compiler": { "references": ["features-kb/house/*.md"] }
// Team-authored methodology compiled exactly like shipped references — same `qab:` comment contract
// (id / scope / tier, H1 file defaults; mirrors build.js parseReferenceIndex). Ids are namespaced
// PRJ-<file-stem>#<id>, so collision with shipped REF- ids is impossible and a citation in the log
// is unambiguous about whose knowledge it was (decision 4). Parse errors are refused loudly: a
// project file the config names but the compiler silently skips would be a lie about the slice.
const PRJ_TIERS = new Set(['must', 'should', 'context']);

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

// Minimal glob (zero-dep): `*` matches within a path segment; no `**`. Patterns are CWD-relative.
function globFiles(pattern) {
  const segs = pattern.split('/').filter(Boolean);
  let dirs = [CWD];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    const re = seg.includes('*') ? new RegExp('^' + seg.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$') : null;
    const next = [];
    for (const d of dirs) {
      if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
      const names = re ? fs.readdirSync(d).filter(n => re.test(n)).sort() : [seg];
      for (const n of names) {
        const p = path.join(d, n);
        if (!fs.existsSync(p)) continue;
        if (last) { if (fs.statSync(p).isFile()) next.push(p); }
        else if (fs.statSync(p).isDirectory()) next.push(p);
      }
    }
    dirs = next;
  }
  return dirs;
}

// Parse one project reference file into PRJ- entries. Mirrors build.js parseReferenceIndex.
function parseProjectRefFile(abs, stem, index, errors) {
  const relFile = rel(abs);
  const lines = fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n').split('\n');
  let fence = false, fileScope = 'all', fileTier = 'should', seenH1 = false;
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { fence = !fence; continue; }
    if (fence) continue;
    const isH1 = l.startsWith('# ') && !seenH1;
    const isH2 = l.startsWith('## ');
    if (!isH1 && !isH2) continue;
    const heading = l.replace(/^#+\s*/, '').trim();
    const c = i + 1 < lines.length ? parseQabComment(lines[i + 1]) : null;
    if (c && c.error) { errors.push(`${relFile}:${i + 2}: ${c.error}`); continue; }
    if (isH1) {
      seenH1 = true;
      if (c) {
        if (c.scope) fileScope = c.scope;
        if (c.tier) { if (!PRJ_TIERS.has(c.tier)) errors.push(`${relFile}:${i + 2}: unknown tier "${c.tier}"`); else fileTier = c.tier; }
        if (c.id) sections.push({ id: c.id, heading, start: i, scope: c.scope || fileScope, tier: c.tier || fileTier, h1: true });
      }
      continue;
    }
    if (sections.length && sections[sections.length - 1].h1 && sections[sections.length - 1].end === undefined) sections[sections.length - 1].end = i;
    if (!c || !c.id) { errors.push(`${relFile}:${i + 1}: "## ${heading}" has no <!-- qab: id=… --> comment on the next line`); continue; }
    if (c.tier && !PRJ_TIERS.has(c.tier)) errors.push(`${relFile}:${i + 2}: unknown tier "${c.tier}"`);
    if (sections.length && !sections[sections.length - 1].h1) sections[sections.length - 1].end = i;
    sections.push({ id: c.id, heading, start: i, scope: c.scope || fileScope, tier: c.tier || fileTier });
  }
  for (const s of sections) {
    if (s.end === undefined) s.end = lines.length;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) { errors.push(`${relFile}: id "${s.id}" must be kebab-case`); continue; }
    const key = `PRJ-${stem}#${s.id}`;
    if (index[key]) { errors.push(`duplicate id ${key} (${relFile} and ${index[key].file})`); continue; }
    index[key] = {
      file: relFile, heading: s.heading,
      scope: s.scope === 'all' ? ['all'] : s.scope.split(',').map(x => x.trim()).filter(Boolean),
      tier: s.tier, lines: s.end - s.start, project: true,
    };
  }
}

// Load every configured project reference file. Returns { configured, index }.
function loadProjectRefs() {
  const patterns = compilerConfig().references;
  if (patterns === undefined) return { configured: false, index: {} };
  if (!Array.isArray(patterns) || patterns.some(p => typeof p !== 'string' || !p.trim())) {
    die('compiler.references in .qabuddy.json must be an array of file patterns, e.g. ["features-kb/house/*.md"]');
  }
  const index = {};
  const errors = [];
  const stems = {}; // stem → file (PRJ ids must be unambiguous about their file)
  for (const pat of patterns) {
    const files = globFiles(pat);
    if (!files.length) { process.stderr.write(`qab: compiler.references: pattern "${pat}" matched no files\n`); continue; }
    for (const abs of files) {
      if (!abs.endsWith('.md')) { errors.push(`${rel(abs)}: project references must be .md files`); continue; }
      const stem = path.basename(abs, '.md');
      if (stems[stem] && stems[stem] !== abs) { errors.push(`two project reference files share the stem "${stem}" (${rel(stems[stem])} and ${rel(abs)}) — PRJ-<stem>#<id> must be unambiguous`); continue; }
      stems[stem] = abs;
      parseProjectRefFile(abs, stem, index, errors);
    }
  }
  if (errors.length) die(`compiler.references:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  return { configured: true, index };
}

// Scope overrides (RFC 0002 §2.1, PR A). A project edits the SELECTION layer from its own
// `.qabuddy.json` instead of editing shipped files that an update overwrites:
//   "compiler": { "scope": { "<section-id>": { "remove": ["qa"], "add": ["test-cases"] } } }
// Effective scope = (index scope − remove) ∪ add, applied AFTER core resolution so upstream
// changes to a section's default scope still flow through. Every refusal is loud by design
// (decisions 2–3): a silently ignored override leaves the project believing it is configured.
// Mutates `index` in place; returns the set of overridden ids (manifest causality).
function applyScopeOverrides(index) {
  const spec = compilerConfig().scope;
  const overridden = new Set();
  if (spec === undefined) return overridden;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    die('compiler.scope in .qabuddy.json must be an object: {"<section-id>": {"add": […], "remove": […]}}');
  }
  for (const [id, o] of Object.entries(spec)) {
    if (!index[id]) {
      const near = nearestRefIds(id, index);
      die(`compiler.scope: unknown section id "${id}"${near.length ? ` — did you mean: ${near.join(', ')}` : ''}\n`
        + '  An override that matches nothing is a config bug, not a no-op (RFC 0002 decision 3) — fix the id or delete the entry.');
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) die(`compiler.scope["${id}"] must be an object with "add" and/or "remove" arrays`);
    for (const k of Object.keys(o)) if (k !== 'add' && k !== 'remove') die(`compiler.scope["${id}"]: unknown key "${k}" — only "add" and "remove"`);
    for (const k of ['add', 'remove']) {
      if (o[k] !== undefined && (!Array.isArray(o[k]) || o[k].some(x => typeof x !== 'string' || !x.trim()))) {
        die(`compiler.scope["${id}"].${k} must be an array of skill names`);
      }
    }
    const remove = o.remove || [];
    if (remove.length && index[id].tier === 'must') {
      die(`compiler.scope: "${id}" is tier=must — a must section is a floor and cannot be removed (RFC 0002 decision 2).\n`
        + '  Rails stay rails: drop the "remove" for this section.');
    }
    const scope = index[id].scope.filter(s => !remove.includes(s));
    for (const s of (o.add || [])) if (!scope.includes(s)) scope.push(s);
    index[id] = { ...index[id], scope };
    overridden.add(id);
  }
  return overridden;
}

// LRN ids are project content (any well-formed id passes); REF ids must exist in the shipped index;
// PRJ ids must exist in the project's own configured reference files (RFC 0002 PR B).
function validateSrc(src) {
  if (/^LRN-\d{8}-\d{2}$/.test(src)) return;
  if (/^REF-/.test(src)) {
    if (!/^REF-[a-z0-9-]+(\/[a-z0-9-]+)?#[a-z0-9-]+$/.test(src)) die(`malformed REF id "${src}" — form is REF-<file-stem>#<id> or REF-playbook/<stem>#<id>`);
    const index = loadRefIndex();
    if (!index) return; // no index next to the helper (dev checkout) — accept
    if (!index[src]) {
      const near = nearestRefIds(src, index);
      die(`unknown REF id "${src}"${near.length ? ` — did you mean: ${near.join(', ')}` : ''} (see references/index.json)`);
    }
    return;
  }
  if (/^PRJ-/.test(src)) {
    if (!/^PRJ-[a-z0-9-]+#[a-z0-9-]+$/.test(src)) die(`malformed PRJ id "${src}" — form is PRJ-<file-stem>#<id> (RFC 0002 §2.2)`);
    const prj = loadProjectRefs(); // dies loudly on parse errors — same contract as compile
    if (!prj.configured) die(`"${src}" cited but .qabuddy.json declares no compiler.references — add the pattern that contains its file (RFC 0002 §2.2)`);
    if (!prj.index[src]) {
      const near = nearestRefIds(src, prj.index);
      die(`unknown PRJ id "${src}"${near.length ? ` — did you mean: ${near.join(', ')}` : ''} (parsed from compiler.references)`);
    }
    return;
  }
  die(`source id must be LRN-YYYYMMDD-NN, REF-<stem>#<id> or PRJ-<stem>#<id>, got "${src}"`);
}

// ─── log ────────────────────────────────────────────────────────────────
/**
 * A run reports its outcome last (self-improve.md, capture protocol). Anything appended afterwards
 * belongs to different work — in practice a stale `.qa-reports/.qab-run` marker picked up by
 * maintenance done outside a skill run. Appending anyway silently corrupts the per-run counts that
 * distill and the scoreboard read: the closed run gains a citation it never made.
 * (Observed 2026-08-19: a `log applied` landed on a run that had reported DONE hours earlier.)
 * `unknown` is exempt — it is the no-marker fallback and is shared by unrelated invocations.
 */
function outcomeOf(run) {
  if (!run || run === 'unknown') return null;
  const target = logPath();
  if (!fs.existsSync(target)) return null;
  for (const raw of fs.readFileSync(target, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    let l;
    try { l = JSON.parse(raw); } catch { continue; }
    if (l && l.run === run && l.event === 'outcome') return l;
  }
  return null;
}

function cmdLog(args) {
  const [event, src] = args._;
  if (!event) die(`log requires an event: ${EVENTS.join(' | ')}`);
  if (!EVENTS.includes(event)) die(`unknown event "${event}". Use: ${EVENTS.join(' | ')}`);

  const marker = readMarker();
  const run = (args.run && args.run !== true) ? String(args.run) : (process.env.QAB_RUN || (marker && marker.run) || 'unknown');
  const skill = (args.skill && args.skill !== true) ? String(args.skill) : ((marker && marker.skill) || 'unknown');

  const line = { v: 1, ts: nowIso(), run, skill, event };
  if (['applied', 'contradicted', 'captured'].includes(event)) {
    if (!src) die(`log ${event} requires a source id (LRN-… or REF-…)`);
    validateSrc(src);
    line.src = src;
  } else if (src) {
    line.src = src;
  }
  if (event === 'contradicted') {
    if (!args.note || args.note === true) die('log contradicted requires --note "<one line>"');
    line.note = String(args.note);
  } else if (args.note && args.note !== true) {
    line.note = String(args.note);
  }
  if (event === 'outcome') {
    const status = args.status && args.status !== true ? String(args.status) : null;
    if (!status || !STATUSES.includes(status)) die(`log outcome requires --status <${STATUSES.join('|')}>`);
    line.status = status;
  }
  // Checked after argument validation: a typo'd id should report the typo, not the run state.
  const closed = outcomeOf(run);
  if (closed) {
    die(`run "${run}" already reported an outcome (${closed.status} at ${closed.ts}) — refusing to append ${event}.\n`
      + '  A run is closed by its outcome; later events belong to a new run.\n'
      + '  Start one:  node qab.js run-id --skill <skill> [--ticket <KEY>]\n'
      + '  Or target an open run explicitly:  --run <id>');
  }

  if (args.pfp && args.pfp !== true) line.pfp = String(args.pfp);
  if (args.writer && args.writer !== true) line.writer = String(args.writer);

  appendEvent(line, marker);
  process.stdout.write(`${rel(logPath())} += ${event}${line.src ? ' ' + line.src : ''}${line.status ? ' ' + line.status : ''}\n`);
}

// Append to the project log and, if this run has a directory, mirror into <run>/events.jsonl.
function appendEvent(line, marker) {
  const target = logPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(line) + '\n');
  const dir = (marker && marker.run === line.run && marker.dir) ? marker.dir : path.join(runsDir(), line.run);
  if (fs.existsSync(dir)) fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify(line) + '\n');
}

// ─── compile (RFC 0001 §5, PR5: unscored) ────────────────────────────────
//
// candidate = { section ∈ index : skill ∈ scope } ∪ { LRN ∈ learnings : Status active ∧ Scope ∋ skill|all ∧ Profile ⊆ profile }
// pack: tier=must first, then sections whose scope names this skill, then scope=all, each in file order; LRNs after
// the REF they Override (else after all REFs). NO budget cap in PR5 — the slice equals today's read set by construction
// (set-equality acceptance); `budget.used` is still recorded so slice size flows into the metrics.
// Scoring/caps are not a scheduled next step: they are opt-in per project, behind an eligibility gate (RFC 0002).
const TIER_RANK = { must: 0, should: 1, context: 2 };

function refsRoot() { return path.resolve(__dirname, '..'); }

function fileLines(relPath, project) {
  const p = project ? path.join(CWD, relPath) : path.join(refsRoot(), relPath);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n') : null;
}

// Extract a section's verbatim body (heading → next same-or-higher heading), skipping the qab metadata comment.
function sectionBody(entry) {
  const lines = fileLines(entry.file, entry.project);
  if (!lines) return null;
  let fence = false, start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { fence = !fence; continue; }
    if (fence) continue;
    const isHead = l.startsWith('# ') || l.startsWith('## ');
    if (!isHead) continue;
    const text = l.replace(/^#+\s*/, '').trim();
    if (start === -1) {
      if (text === entry.heading) { start = i; continue; }
    } else {
      // an H1 section (file-level id) ends at the first ##; a ## section ends at the next ## or H1
      break;
    }
  }
  if (start === -1) return null;
  const out = [];
  let f2 = false;
  for (let i = start + 1; i < lines.length; i++) {           // start+1: the heading is rendered by the slice as "## <id> — <heading>"
    const l = lines[i];
    if (l.startsWith('```')) f2 = !f2;
    if (!f2 && (l.startsWith('## ') || l.startsWith('# '))) break;
    if (/^<!--\s*qab:/.test(l)) continue; // metadata, not knowledge
    out.push(l);
  }
  return out.join('\n').trim() + '\n';
}

function parseLearnings() {
  const cfg = readConfig();
  const p = path.join(CWD, cfg.learningsPath || 'features-kb/LEARNINGS.md');
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const blocks = text.split(/\n(?=## LRN-)/).filter(b => b.startsWith('## LRN-'));
  return blocks.map(b => {
    const id = (b.match(/^## (LRN-\d{8}-\d{2})/) || [])[1];
    const field = (name) => { const m = b.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([\\s\\S]*?)(?=\\n- \\*\\*|\\n## |$)`)); return m ? m[1].trim() : ''; };
    const status = (field('Status').split(/\s/)[0] || '').toLowerCase();
    const scope = field('Scope').split('<!--')[0].split(',').map(x => x.trim()).filter(Boolean);
    const profile = {};
    for (const tok of field('Profile').split('<!--')[0].split(/\s+/)) { const kv = tok.match(/^([a-z_]+)=([A-Za-z0-9_-]+)$/); if (kv) profile[kv[1]] = kv[2]; }
    const overrides = field('Overrides');
    const overridesRef = (overrides.match(/(?:REF|PRJ)-[a-z0-9-]+(?:\/[a-z0-9-]+)?#[a-z0-9-]+/) || [])[0] || null;
    // Fingerprint: optional; written as `ffp-<12hex>` or bare `<12hex>`; anything else (none/없음/blank) = unlinked
    const fpRaw = field('Fingerprint').split('<!--')[0].trim().toLowerCase().replace(/^ffp-/, '');
    const fingerprint = /^[0-9a-f]{12}$/.test(fpRaw) ? fpRaw : null;
    return { id, status, scope, profile, overridesRef, fingerprint, statement: field('Statement'), overrides, block: b.trim() };
  }).filter(l => l.id);
}

// Profile v0 (RFC §3.2): deterministic only. Unknown is a first-class value.
function buildProfile(skill, ticket) {
  const automation = fs.existsSync(path.join(CWD, 'playwright', 'AUTOMATION.md'));
  const pw = fs.existsSync(path.join(CWD, 'playwright'));
  const pom = fs.existsSync(path.join(CWD, 'playwright', 'pom')) ? (fs.readdirSync(path.join(CWD, 'playwright', 'pom')).some(f => f.endsWith('.page.ts')) ? 'exists' : 'partial') : (pw ? 'none' : 'n/a');
  let ticket_kind = 'unknown';
  if (ticket && /^(BUG|DEFECT)-/i.test(ticket)) ticket_kind = 'bug';
  const profile = { schema: 'profile/1', skill, surface: automation ? 'web' : 'unknown', pom, ticket_kind };
  const canon = JSON.stringify({ surface: profile.surface, pom: profile.pom, ticket_kind: profile.ticket_kind });
  const pfp = crypto.createHash('sha256').update(canon).digest('hex').slice(0, 12);
  return { profile, pfp };
}

function cmdCompile(args) {
  const skill = args.skill;
  if (!skill || skill === true) die('compile requires --skill <name>');
  const ticket = args.ticket && args.ticket !== true ? String(args.ticket) : null;
  const shippedIndex = loadRefIndex();
  if (!shippedIndex) die('references/index.json not found next to this helper — run node build.js all (compile needs the shipped index)');
  // one namespace: shipped REF- ∪ project PRJ- (RFC 0002 PR B) — overrides and packing see both
  const index = { ...shippedIndex, ...loadProjectRefs().index };

  // run: reuse the current marker if it is this skill's run, else start one
  let marker = readMarker();
  let run;
  // reuse only if it is the same skill AND the same ticket (a bug-keyed run must not inherit a story-keyed run's profile — caught live 2026-08-17)
  const sameTicket = !ticket || !marker || !marker.ticket || marker.ticket === ticket;
  if (marker && marker.skill === skill && sameTicket && marker.dir && fs.existsSync(marker.dir)) run = { run: marker.run, skill, ticket: marker.ticket || ticket, dir: marker.dir };
  else {
    const scope = ticket || gitBranch();
    const hex = crypto.createHash('sha256').update(`${nowIso()}|${process.pid}|${Math.random()}`).digest('hex').slice(0, 6);
    run = startRun(`${skill}-${scope}-${hex}`, skill, ticket, false);
    marker = readMarker();
  }

  const { profile, pfp } = buildProfile(skill, run.ticket);

  // candidate REF sections
  // scope=all sections are general context no skill reads per run today (KB spec, terminology) — packed only if
  // tier=must; otherwise listed under dropped so distill's never-selected column can raise them (RFC decision, PR5).
  // Project scope overrides (RFC 0002 PR A) apply after core resolution; the manifest records causality:
  // a section packed only because of an override carries `via: project-override`, one unpacked by an
  // override is listed under dropped with `reason: project-override` — the slice stays self-explaining.
  const baseScope = {};
  for (const [id, e] of Object.entries(index)) baseScope[id] = e.scope;
  const overridden = applyScopeOverrides(index);
  const packs = (scope, tier) => scope.includes(skill) || (scope.includes('all') && tier === 'must');
  const allRefs = Object.entries(index).map(([id, e]) => ({
    id, ...e, kind: 'REF', explicit: e.scope.includes(skill),
    via: overridden.has(id) && packs(e.scope, e.tier) && !packs(baseScope[id], e.tier) ? 'project-override' : undefined,
  }));
  const dropped = [];
  for (const r of allRefs) {
    if (packs(r.scope, r.tier)) continue;
    if (overridden.has(r.id) && packs(baseScope[r.id], r.tier)) dropped.push({ id: r.id, reason: 'project-override' });
    else if (r.scope.includes('all') && r.tier !== 'must') dropped.push({ id: r.id, reason: 'general-scope' });
  }
  const refs = allRefs
    .filter(r => packs(r.scope, r.tier))
    .sort((a, b) => (TIER_RANK[a.tier] ?? 1) - (TIER_RANK[b.tier] ?? 1) || (a.explicit === b.explicit ? 0 : a.explicit ? -1 : 1) || a.file.localeCompare(b.file) || 0);
  // candidate LRNs (active, scoped, profile-compatible); profile-narrowed ones that don't match are dropped, visibly
  const scopedLrns = parseLearnings().filter(l => l.status === 'active' && (l.scope.includes('all') || l.scope.includes(skill)));
  const profileOk = (l) => Object.entries(l.profile).every(([k, v]) => profile[k] === undefined || profile[k] === v);
  const lrns = scopedLrns.filter(profileOk);
  for (const l of scopedLrns) if (!profileOk(l)) dropped.push({ id: l.id, reason: 'profile' });

  // pack: REFs in rank order; each LRN right after the REF it overrides, else at the end
  const ordered = [];
  const placed = new Set();
  for (const r of refs) {
    ordered.push(r);
    for (const l of lrns) if (l.overridesRef === r.id && !placed.has(l.id)) { ordered.push({ kind: 'LRN', ...l }); placed.add(l.id); }
  }
  for (const l of lrns) if (!placed.has(l.id)) ordered.push({ kind: 'LRN', ...l });

  // render
  const bodyParts = [];
  let used = 0;
  const sources = [];
  for (const s of ordered) {
    let text;
    if (s.kind === 'REF') { text = sectionBody(s); if (text == null) { dropped.push({ id: s.id, reason: 'section text not found' }); continue; } }
    else text = `**Statement:** ${s.statement}\n**Overrides:** ${s.overrides || 'none'}\n`;
    const n = text.split('\n').length;
    used += n;
    sources.push(s.kind === 'REF' ? { id: s.id, tier: s.tier, lines: n, via: s.via } : { id: s.id, tier: 'lrn', lines: n });
    bodyParts.push(s.kind === 'REF' ? `## ${s.id} — ${s.heading}\n${text}` : `## ${s.id}\n${text}`);
  }

  const manifest = [
    '---', 'manifest: 1', `run: ${run.run}`, `skill: ${skill}`, `pfp: ${pfp}`,
    `profile: {surface: ${profile.surface}, pom: ${profile.pom}, ticket_kind: ${profile.ticket_kind}}`,
    'compiler: qab 0.6.0   scoring: off', `budget: {max: 0, used: ${used}}   # max 0 = uncapped (unscored compile, RFC 0001 PR5)`,
    'sources:', ...sources.map(x => `  - id: ${x.id}   tier: ${x.tier}   lines: ${x.lines}${x.via ? `   via: ${x.via}` : ''}`),
    'dropped:', ...(dropped.length ? dropped.map(d => `  - id: ${d.id}   reason: ${d.reason}`) : ['  []']),
    '---', '',
  ].join('\n');
  const slicePath = path.join(run.dir, 'slice.md');
  fs.writeFileSync(slicePath, manifest + bodyParts.join('\n'));
  fs.writeFileSync(path.join(run.dir, 'profile.json'), JSON.stringify({ ...profile, pfp }, null, 2) + '\n');
  const scratch = path.join(run.dir, 'scratchpad.md');
  if (!fs.existsSync(scratch)) fs.writeFileSync(scratch, `# ${run.run}\n\n## Plan\n\n## State\n\n## Findings\n\n## Candidate learnings\n<!-- anything noteworthy, no evidence bar; the three capture triggers are applied to THESE at close -->\n`);

  appendEvent({ v: 1, ts: nowIso(), run: run.run, skill, pfp, event: 'compiled', sources: sources.map(x => x.id), used, max: 0, dropped: dropped.map(d => d.id) }, marker);
  process.stdout.write(`${rel(slicePath)}\n`);
  process.stdout.write(`  run ${run.run} · ${sources.length} sources (${sources.filter(x => x.tier === 'must').length} must, ${sources.filter(x => x.tier === 'lrn').length} learnings) · ${used} lines · scratchpad ${rel(scratch)}\n`);
}

// ─── fp (RFC 0001 §3.4, PR6: failure fingerprints) ───────────────────────
//
// A fingerprint names a failure CLASS, not an incident: the same locator missing on the same screen
// hashes the same across runs even though the run id, timestamps and entity entropy differ. That is
// what lets a later run's failure count as evidence against the learning that claimed to prevent it.
//
// Normalization strips the parts of a key that vary per incident: ISO timestamps/dates, UUIDs, hex
// hashes (≥7, must contain a digit), :ports, digit runs ≥5 (epoch ms, entropy suffixes); lowercases and
// collapses whitespace / repeated separators. Keys should already be class-level ("checkout/place-order-btn",
// "PROJ-12/AC3", "smoke.spec.ts › TC-04") — this is the safety net, not a parser.
function normalizeKey(key) {
  return String(key).toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?z?)?/g, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/g, '')
    .replace(/:\d{2,5}\b/g, '')
    .replace(/\d{5,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([-_/.:# ])\1+/g, '$1')       // repeated separators left behind by a removal
    .replace(/[-_.:#]+(?=[\s/)]|$)/g, '')    // dangling separators before a space, slash, paren or the end
    .replace(/(^|[\s/(])[-_.:#]+/g, '$1')    // …and after
    .replace(/\(\s*\)/g, '')                 // empty parens left by "(run 5f5c55ab)"
    .replace(/\s*\/\s*/g, '/')               // "checkout / btn" == "checkout/btn"
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprintOf(kind, key) {
  return crypto.createHash('sha256').update(`${kind}\n${normalizeKey(key)}`).digest('hex').slice(0, 12);
}

// LRN ids the current run's slice packed (manifest `sources:` block) — null when the run has no slice.
function sliceLrnIds(dir) {
  const p = path.join(dir, 'slice.md');
  if (!fs.existsSync(p)) return null;
  const fm = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n---\n')[0];
  const block = (fm.split('\nsources:\n')[1] || '').split('\ndropped:')[0];
  return [...block.matchAll(/^  - id: (LRN-\d{8}-\d{2})/gm)].map(m => m[1]);
}

function readFps() {
  const target = fpPath();
  if (!fs.existsSync(target)) return { lines: [], malformed: 0 };
  const lines = []; let malformed = 0;
  for (const raw of fs.readFileSync(target, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try { const o = JSON.parse(raw); if (o && typeof o === 'object' && o.ffp && o.kind) lines.push(o); else malformed++; } catch { malformed++; }
  }
  return { lines, malformed };
}

function cmdFp(args) {
  const marker = readMarker();
  const run = (args.run && args.run !== true) ? String(args.run) : (process.env.QAB_RUN || (marker && marker.run) || 'unknown');
  const skill = (args.skill && args.skill !== true) ? String(args.skill) : ((marker && marker.skill) || 'unknown');

  if (args.list) {
    const mine = readFps().lines.filter(l => l.run === run);
    if (!mine.length) { process.stdout.write(`no fingerprints for run ${run}\n`); return; }
    for (const l of mine) process.stdout.write(`${l.ffp}  ${l.kind}  ${l.key}${l.active && l.active.length ? `  active: ${l.active.join(', ')}` : ''}\n`);
    return;
  }

  const [kind, ...keyParts] = args._;
  if (!kind) die(`fp requires a kind: ${FP_KINDS.join(' | ')}`);
  if (!FP_KINDS.includes(kind)) die(`unknown fingerprint kind "${kind}". Closed vocabulary: ${FP_KINDS.join(' | ')}`);
  const key = keyParts.join(' ').trim();
  if (!key) die(`fp ${kind} requires a key naming the failure class (e.g. "checkout/place-order-btn", "PROJ-12/AC3", "smoke.spec.ts › TC-04")`);
  const ffp = fingerprintOf(kind, key);

  // active = learnings in this run's slice (fallback: the skill's active read set) whose Fingerprint: is this ffp
  const dir = (marker && marker.run === run && marker.dir) ? marker.dir : path.join(runsDir(), run);
  const learnings = parseLearnings();
  const inSlice = sliceLrnIds(dir);
  const candidates = inSlice !== null ? inSlice
    : learnings.filter(l => l.status === 'active' && (l.scope.includes('all') || l.scope.includes(skill))).map(l => l.id);
  const active = learnings.filter(l => candidates.includes(l.id) && l.fingerprint === ffp).map(l => l.id);

  let pfp;
  const profileFile = path.join(dir, 'profile.json');
  if (fs.existsSync(profileFile)) { try { pfp = JSON.parse(fs.readFileSync(profileFile, 'utf8')).pfp; } catch { /* derived field only */ } }

  const line = { v: 1, ts: nowIso(), run, skill, ...(pfp ? { pfp } : {}), ffp, kind, key, active };
  const target = fpPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(line) + '\n');
  if (fs.existsSync(dir)) fs.appendFileSync(path.join(dir, 'fingerprints.jsonl'), JSON.stringify(line) + '\n');
  process.stdout.write(`${rel(target)} += ${kind} ffp=${ffp}${active.length ? ` active=[${active.join(', ')}]` : ''}\n`);
  if (active.length) process.stdout.write(`  ↳ falsification evidence for ${active.join(', ')} — flag it in the report; distill lists it as falsified (fingerprint)\n`);
}

// ─── stats ──────────────────────────────────────────────────────────────
function readLog(since) {
  const target = logPath();
  if (!fs.existsSync(target)) return { lines: [], malformed: 0, manual: 0 };
  const lines = []; let malformed = 0; let manual = 0;
  for (const raw of fs.readFileSync(target, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    let obj;
    try { obj = JSON.parse(raw); } catch { malformed++; continue; }
    if (!obj || typeof obj !== 'object' || !obj.event) { malformed++; continue; }
    if (since && obj.ts && obj.ts.slice(0, 10) < since) continue;
    if (obj.writer === 'manual') manual++;
    lines.push(obj);
  }
  return { lines, malformed, manual };
}

// lines: learnings-log events; fps: fingerprints.jsonl lines; learnings: parsed LEARNINGS.md entries
// (the last two are optional so PR1-era callers keep working; findings that need them stay empty).
function computeStats(lines, fps = [], learnings = []) {
  const per = {};
  const runsWithOutcome = new Set();
  const outcomes = {};
  const mk = () => ({ applied: 0, contradicted: 0, captured: 0, in_slice: 0, last_applied: null, last_contradicted: null, runs: new Set() });
  for (const l of lines) {
    if (l.event === 'outcome') {
      runsWithOutcome.add(l.run);
      outcomes[l.status] = (outcomes[l.status] || 0) + 1;
      continue;
    }
    // in_slice: how often the compile step put this source in front of the model (RFC §3.5 / decision 5)
    if (l.event === 'compiled' && Array.isArray(l.sources)) { for (const id of l.sources) (per[id] || (per[id] = mk())).in_slice++; continue; }
    if (!l.src) continue;
    const s = per[l.src] || (per[l.src] = mk());
    if (l.event === 'applied') { s.applied++; s.runs.add(l.run); if (!s.last_applied || l.ts > s.last_applied) s.last_applied = l.ts; }
    else if (l.event === 'contradicted') { s.contradicted++; if (!s.last_contradicted || l.ts > s.last_contradicted) s.last_contradicted = l.ts; }
    else if (l.event === 'captured') { s.captured++; }
  }
  // every active learning gets a row even with zero events — distill shows computed columns next to each entry
  const byId = {};
  for (const l of learnings) { byId[l.id] = l; if (l.status === 'active' && !per[l.id]) per[l.id] = mk(); }

  // fingerprint recurrence: per ffp — kind, key (last seen), count, distinct runs, LRNs it falsified
  const fpr = {};
  for (const f of fps) {
    const r = fpr[f.ffp] || (fpr[f.ffp] = { ffp: f.ffp, kind: f.kind, key: f.key, count: 0, runs: new Set(), active: new Set(), first: f.ts, last: f.ts });
    r.count++; r.key = f.key; if (f.run) r.runs.add(f.run);
    for (const id of (f.active || [])) r.active.add(id);
    if (f.ts && f.ts < r.first) r.first = f.ts; if (f.ts && f.ts > r.last) r.last = f.ts;
  }
  const fingerprints = Object.values(fpr).map(r => ({ ...r, runs: r.runs.size, active: [...r.active].sort() })).sort((a, b) => b.count - a.count || a.ffp.localeCompare(b.ffp));
  // falsified (fingerprint): any fp line naming the LRN in `active`
  const fpHits = {};
  for (const f of fps) for (const id of (f.active || [])) { const h = fpHits[id] || (fpHits[id] = { count: 0, ffps: new Set() }); h.count++; h.ffps.add(f.ffp); }
  // duplicate (fingerprint): active LRNs sharing Fingerprint ∧ Scope → the newer ones duplicate the oldest id
  const dupOf = {};
  const groups = {};
  for (const l of learnings) if (l.status === 'active' && l.fingerprint) (groups[`${l.fingerprint}|${[...l.scope].map(x => x.toLowerCase()).sort().join(',')}`] ||= []).push(l.id);
  for (const ids of Object.values(groups)) { if (ids.length < 2) continue; const sorted = [...ids].sort(); for (const id of sorted.slice(1)) dupOf[id] = sorted[0]; }
  // "ffp silent since activation" (§6.2 promotion column): no fp line with the LRN's own ffp dated on/after the LRN's date
  const lrnDate = id => { const m = id.match(/^LRN-(\d{4})(\d{2})(\d{2})-/); return m ? `${m[1]}-${m[2]}-${m[3]}` : '0000-00-00'; };
  const recurrenceSince = (id) => { const l = byId[id]; if (!l || !l.fingerprint) return 0; const d = lrnDate(id); return fps.filter(f => f.ffp === l.fingerprint && (f.ts || '').slice(0, 10) >= d).length; };

  const rows = Object.entries(per).map(([src, s]) => {
    const hit = fpHits[src];
    const falsifiedFp = hit ? hit.count : 0;
    const falsified = s.contradicted >= 2 && (!s.last_applied || (s.last_contradicted && s.last_applied < s.last_contradicted));
    const kind = src.startsWith('REF-') ? 'REF' : src.startsWith('PRJ-') ? 'PRJ' : 'LRN';
    return {
      src,
      kind,
      applied: s.applied,
      contradicted: s.contradicted,
      captured: s.captured,
      in_slice: s.in_slice,
      runs: s.runs.size,
      last_applied: s.last_applied ? s.last_applied.slice(0, 10) : null,
      // RFC §6.2 computed findings (promotion is LRN-only: a REF/PRJ section is already a reference)
      promotion_candidate: kind === 'LRN' && s.applied >= 3 && s.runs.size >= 3 && s.contradicted === 0 && falsifiedFp === 0 && recurrenceSince(src) === 0,
      falsified,
      falsified_by_fingerprint: falsifiedFp,
      fingerprint_ffps: hit ? [...hit.ffps].sort() : [],
      never_applied: s.in_slice >= NEVER_APPLIED_MIN_IN_SLICE && s.applied === 0,
      duplicate_of: dupOf[src] || null,
    };
  }).sort((a, b) => b.applied - a.applied || a.src.localeCompare(b.src));
  // Compliance (RFC 0001 PR4 acceptance): of runs that logged an outcome, how many
  // logged at least one REF `applied` at section granularity? Per skill and overall.
  const runsBySkill = {};
  for (const l of lines) {
    if (!l.run) continue;
    const r = runsBySkill[l.run] || (runsBySkill[l.run] = { skill: l.skill || 'unknown', outcome: false, ref: false, lrn: false });
    if (l.event === 'outcome') r.outcome = true;
    // PRJ sections are reference citations too (RFC 0002 PR B) — a run citing house methodology complies
    if (l.event === 'applied' && l.src) { if (/^(REF|PRJ)-/.test(l.src) && l.src.includes('#')) r.ref = true; else r.lrn = true; }
  }
  const compliance = {};
  for (const r of Object.values(runsBySkill)) {
    if (!r.outcome) continue;
    const c = compliance[r.skill] || (compliance[r.skill] = { runs: 0, with_ref: 0, with_lrn: 0 });
    c.runs++; if (r.ref) c.with_ref++; if (r.lrn) c.with_lrn++;
  }
  return { rows, fingerprints, runs_with_outcome: runsWithOutcome.size, outcomes, compliance };
}

function findingLabel(r) {
  const f = [];
  if (r.falsified) f.push('falsified (contradiction)');
  if (r.falsified_by_fingerprint) f.push(`falsified (fingerprint ${r.fingerprint_ffps.join(',')} ×${r.falsified_by_fingerprint})`);
  if (r.duplicate_of) f.push(`duplicate (fingerprint) of ${r.duplicate_of}`);
  if (r.never_applied) f.push(`never applied (in_slice ${r.in_slice})`);
  if (r.promotion_candidate) f.push('promotion candidate');
  return f.join('; ');
}

function cmdStats(args) {
  const since = args.since && args.since !== true ? String(args.since) : null;
  const { lines, malformed, manual } = readLog(since);
  const fpsAll = readFps();
  const fps = since ? fpsAll.lines.filter(f => !f.ts || f.ts.slice(0, 10) >= since) : fpsAll.lines;
  const stats = computeStats(lines, fps, parseLearnings());
  const summary = { ...stats, events: lines.length, malformed, manual_writer: manual, log: rel(logPath()), fingerprint_lines: fps.length, fingerprints_file: rel(fpPath()) };
  if (args.json) { process.stdout.write(JSON.stringify(summary, null, 2) + '\n'); return; }

  const out = [];
  out.push(`log: ${summary.log} — ${lines.length} events, ${stats.runs_with_outcome} runs with outcome${malformed ? `, ${malformed} malformed (skipped)` : ''}${manual ? `, ${manual} manual-writer` : ''}`);
  if (Object.keys(stats.outcomes).length) out.push('outcomes: ' + Object.entries(stats.outcomes).map(([k, v]) => `${k}=${v}`).join(' '));
  out.push(`fingerprints: ${summary.fingerprints_file} — ${fps.length} lines, ${stats.fingerprints.length} distinct classes${fpsAll.malformed ? `, ${fpsAll.malformed} malformed (skipped)` : ''}`);
  out.push('');
  out.push('| source | kind | in_slice | applied | contradicted | runs | last_applied | finding |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const r of stats.rows) out.push(`| ${r.src} | ${r.kind} | ${r.in_slice} | ${r.applied} | ${r.contradicted} | ${r.runs} | ${r.last_applied || '—'} | ${findingLabel(r)} |`);
  if (!stats.rows.length) out.push('| (no source events yet) | | | | | | | |');
  if (stats.fingerprints.length) {
    out.push('');
    out.push('fingerprint recurrence (same class across runs; `active` = learnings it falsified):');
    out.push('| ffp | kind | key (last) | count | runs | active |');
    out.push('|---|---|---|---|---|---|');
    for (const f of stats.fingerprints) out.push(`| ${f.ffp} | ${f.kind} | ${f.key} | ${f.count} | ${f.runs} | ${f.active.join(', ') || '—'} |`);
  }
  const comp = Object.entries(stats.compliance || {});
  if (comp.length) {
    out.push('');
    out.push('citation compliance (runs with outcome → with ≥1 REF applied / with ≥1 LRN applied):');
    let tr = 0, tref = 0;
    for (const [skill, c] of comp) { tr += c.runs; tref += c.with_ref; out.push(`  ${skill}: ${c.with_ref}/${c.runs} REF, ${c.with_lrn}/${c.runs} LRN`); }
    out.push(`  overall: ${tref}/${tr} REF (RFC 0001 PR4 gate: ≥ 4/5 before PR5 packs by section)`);
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ─── gate (RFC 0002 §2.3, PR C: the §9.3 gate, evaluated on THIS project's logs) ─
//
// RFC 0001 §9.3: proceed toward scored selection only if application is uneven AND ≥ 2 distinct
// profiles each carry ≥ 8 attributed outcomes. QABuddy passed that gate once on its own repo and
// the measurement argued no (decision 16). This command makes the gate a capability each project
// evaluates for itself — read-only, deterministic, over learnings-log.jsonl + fingerprints.jsonl.
//
// The report assembles evidence; it does NOT classify causes (RFC 0002 decision 6). Whether a
// dormant source "cannot fire", "is duplicated elsewhere" or "is waiting for work that hasn't
// happened" needed human judgement in the 0001 verdict and still does — a tool that guessed would
// reproduce exactly the error that verdict warns about. Eligibility here is necessary, never
// sufficient: scoring stays off until a human answers the classification ask at the end.
const GATE_MIN_PROFILES = 2;
const GATE_MIN_OUTCOMES = 8;
const GATE_APPLIED_RUNS = 3; // unevenness floor: ≥1 source applied in this many distinct runs while others sit dormant

function computeGate(lines, fps, learnings) {
  const stats = computeStats(lines, fps, learnings);
  // run → pfp from compiled events. A run with an outcome but no compiled pfp predates the compile
  // step or never compiled — it is reported, never summed into a profile (mis-attribution was
  // caught live once: RFC 0001 §9.3 status correction, PR #23).
  const runPfp = {};
  for (const l of lines) if (l.event === 'compiled' && l.run && l.pfp) runPfp[l.run] = l.pfp;
  const perPfp = {};
  let noProfileRuns = 0;
  for (const l of lines) {
    if (l.event !== 'outcome' || !l.run) continue;
    const pfp = runPfp[l.run];
    if (!pfp) { noProfileRuns++; continue; }
    const p = perPfp[pfp] || (perPfp[pfp] = { outcomes: 0, statuses: {} });
    p.outcomes++;
    if (l.status) p.statuses[l.status] = (p.statuses[l.status] || 0) + 1;
  }
  const profiles = Object.entries(perPfp).map(([pfp, p]) => ({ pfp, ...p }))
    .sort((a, b) => b.outcomes - a.outcomes || a.pfp.localeCompare(b.pfp));
  const qualified = profiles.filter(p => p.outcomes >= GATE_MIN_OUTCOMES);
  const thresholdMet = qualified.length >= GATE_MIN_PROFILES;

  const dormant = stats.rows.filter(r => r.never_applied).map(r => ({ src: r.src, kind: r.kind, in_slice: r.in_slice }));
  const appliedRepeatedly = stats.rows.filter(r => r.runs >= GATE_APPLIED_RUNS).map(r => ({ src: r.src, runs: r.runs }));
  const uneven = dormant.length > 0 && appliedRepeatedly.length > 0;

  const slices = {};
  for (const l of lines) {
    if (l.event !== 'compiled' || typeof l.used !== 'number') continue;
    const key = l.skill || 'unknown';
    const s = slices[key] || (slices[key] = { compiles: 0, total: 0, last: 0 });
    s.compiles++; s.total += l.used; s.last = l.used;
  }
  const slice_by_skill = {};
  for (const [skill, s] of Object.entries(slices)) slice_by_skill[skill] = { compiles: s.compiles, last: s.last, mean: Math.round(s.total / s.compiles) };

  const eligible = thresholdMet && uneven;
  const reason = !thresholdMet
    ? `needs ≥ ${GATE_MIN_PROFILES} profiles with ≥ ${GATE_MIN_OUTCOMES} outcomes each — have ${qualified.length} (${profiles.length} profile${profiles.length === 1 ? '' : 's'} seen${noProfileRuns ? `, ${noProfileRuns} outcome run${noProfileRuns === 1 ? '' : 's'} without a profile not counted` : ''})`
    : !uneven
      ? (dormant.length === 0
        ? `application is not uneven: no dormant source (in_slice ≥ ${NEVER_APPLIED_MIN_IN_SLICE} ∧ applied = 0) — there is nothing for scoring to demote`
        : `application is not uneven: no source applied in ≥ ${GATE_APPLIED_RUNS} distinct runs yet — the applied side of the contrast is missing`)
      : `${qualified.length} profiles carry ≥ ${GATE_MIN_OUTCOMES} outcomes and application is uneven (${dormant.length} dormant vs ${appliedRepeatedly.length} repeatedly-applied sources)`;

  return {
    thresholds: { min_profiles: GATE_MIN_PROFILES, min_outcomes: GATE_MIN_OUTCOMES, dormant_min_in_slice: NEVER_APPLIED_MIN_IN_SLICE, applied_min_runs: GATE_APPLIED_RUNS },
    profiles, no_profile_runs: noProfileRuns, threshold_met: thresholdMet,
    dormant, applied_repeatedly: appliedRepeatedly, uneven,
    slice_by_skill, eligible, reason,
  };
}

function cmdGate(args) {
  const { lines } = readLog(null);
  const { lines: fps } = readFps();
  const gate = computeGate(lines, fps, parseLearnings());
  if (args.json) { process.stdout.write(JSON.stringify(gate, null, 2) + '\n'); return; }

  const out = [];
  out.push(`gate (RFC 0001 §9.3, evaluated on this project's logs — RFC 0002 §2.3):`);
  out.push(`  profiles with attributed outcomes (need ≥ ${GATE_MIN_PROFILES}, each ≥ ${GATE_MIN_OUTCOMES}):`);
  if (!gate.profiles.length) out.push('    (none — no run has both a compiled profile and an outcome yet)');
  for (const p of gate.profiles) out.push(`    ${p.pfp}  ${p.outcomes} outcome${p.outcomes === 1 ? '' : 's'}${Object.keys(p.statuses).length ? ` (${Object.entries(p.statuses).map(([k, v]) => `${k}=${v}`).join(' ')})` : ''}`);
  if (gate.no_profile_runs) out.push(`    (${gate.no_profile_runs} outcome run${gate.no_profile_runs === 1 ? '' : 's'} without a compiled profile — reported, never summed into a profile)`);
  out.push('  application:');
  out.push(`    repeatedly applied (runs ≥ ${GATE_APPLIED_RUNS}): ${gate.applied_repeatedly.length} · dormant (in_slice ≥ ${NEVER_APPLIED_MIN_IN_SLICE} ∧ applied = 0): ${gate.dormant.length}`);
  for (const d of gate.dormant) out.push(`    dormant: ${d.src} (${d.kind})  in_slice ${d.in_slice}`);
  if (Object.keys(gate.slice_by_skill).length) {
    out.push('  slice size per skill (compiled events):');
    for (const [skill, s] of Object.entries(gate.slice_by_skill).sort((a, b) => a[0].localeCompare(b[0]))) {
      out.push(`    ${skill}: last ${s.last} lines · mean ${s.mean} · ${s.compiles} compile${s.compiles === 1 ? '' : 's'}`);
    }
  }
  out.push(`  verdict: ${gate.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} — ${gate.reason}`);
  if (gate.eligible) {
    out.push('');
    out.push('  This report assembles evidence; it does not classify causes (RFC 0002 decision 6).');
    out.push('  Before scoring may be enabled, a human classifies each dormant source:');
    out.push('    cannot fire / duplicated elsewhere / the matching work has not happened / selection failure.');
    out.push('  RFC 0001 §9.3 reached its verdict only through that classification — 0 of 18 dormant');
    out.push('  sections were selection failures. A tool that guessed the cause would repeat the error.');
  }
  process.stdout.write(out.join('\n') + '\n');
}

// ─── scoreboard (RFC 0001 §3.5, PR6: derived cache, never a source of truth) ─
// per_source: in_slice (compiled events), applied, contradicted, last_applied, runs (distinct runs with applied —
// same meaning as `stats`). No wins/losses (decision 4). per_fingerprint: recurrence + the LRNs each class falsified.
// A rebuildable summary of the two logs. Scored selection would read it, but scoring is opt-in per project (RFC 0002),
// so nothing today consumes this as an input — only humans and distill read it.
function cmdScoreboard() {
  const { lines } = readLog(null);
  const { lines: fps } = readFps();
  const stats = computeStats(lines, fps, parseLearnings());
  const per_source = {};
  for (const r of stats.rows) per_source[r.src] = { in_slice: r.in_slice, applied: r.applied, contradicted: r.contradicted, last_applied: r.last_applied, runs: r.runs };
  const per_fingerprint = {};
  for (const f of stats.fingerprints) per_fingerprint[f.ffp] = { kind: f.kind, key: f.key, count: f.count, runs: f.runs, active: f.active, first: f.first, last: f.last };
  const board = { v: 1, rebuilt_at: nowIso(), events: lines.length, fingerprint_lines: fps.length, per_source, per_fingerprint };
  const target = scoreboardPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(board, null, 2) + '\n');
  process.stdout.write(`${rel(target)} rebuilt — ${Object.keys(per_source).length} sources, ${Object.keys(per_fingerprint).length} fingerprint classes (derived from ${lines.length} log events + ${fps.length} fingerprint lines; gitignore ${rel(path.dirname(target))}/)\n`);
}

// ─── main ───────────────────────────────────────────────────────────────
function main() {
  const [sub, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (sub) {
    case 'run-id': return cmdRunId(args);
    case 'compile': return cmdCompile(args);
    case 'log': return cmdLog(args);
    case 'fp': return cmdFp(args);
    case 'stats': return cmdStats(args);
    case 'gate': return cmdGate(args);
    case 'scoreboard': return cmdScoreboard(args);
    case undefined: case '--help': case '-h': case 'help':
      process.stdout.write([
        'usage: qab.js run-id --skill <name> [--ticket <key>]',
        '       qab.js compile --skill <name> [--ticket <key>]      → prints <runsDir>/<run>/slice.md',
        '       qab.js log <applied|contradicted|captured|outcome> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]',
        `       qab.js fp <kind> <key> [--run <id>] [--skill <name>]   kind ∈ ${FP_KINDS.join('|')}`,
        '       qab.js fp --list [--run <id>]                      → this run\'s fingerprints (ffp kind key active)',
        '       qab.js stats [--since <YYYY-MM-DD>] [--json]',
        '       qab.js gate [--json]                               → RFC 0001 §9.3 gate on this project\'s logs (read-only)',
        '       qab.js scoreboard                                  → rebuilds <kb>/.cache/scoreboard.json',
      ].join('\n') + '\n');
      return;
    default: die(`unknown subcommand "${sub}" (run-id | compile | log | fp | stats | gate | scoreboard)`);
  }
}

if (require.main === module) {
  // A closed stdout (`| head`, a consumer that exits early) must not crash the helper with a stack trace.
  process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); throw e; });
  main();
}
module.exports = { parseArgs, computeStats, computeGate, normalizeKey, fingerprintOf, EVENTS, STATUSES, FP_KINDS };
