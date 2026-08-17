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
 *   log     <event> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]
 *                                                append one v1 line to <learningsPath dir>/learnings-log.jsonl (+ <run>/events.jsonl)
 *   stats   [--since <YYYY-MM-DD>] [--json]      per-source counts + citation compliance from the log
 *
 * Log line (schema v1):
 *   {"v":1,"ts":"2026-08-20T09:12:04Z","run":"qa-PROJ-456-3f9a2c","skill":"qa","event":"applied","src":"LRN-20260808-03"}
 * Events: applied | contradicted (+note) | captured | outcome (+status) — compiled | escalated reserved for the compile step.
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

function logPath() {
  const cfg = readConfig();
  const learnings = cfg.learningsPath || 'features-kb/LEARNINGS.md';
  return path.join(CWD, path.dirname(learnings), 'learnings-log.jsonl');
}

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
  const stem = (id.split('#')[0] || '').replace(/^REF-/, '');
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
    const ks = k.replace(/^REF-/, '').split('#')[0];
    const kf = k.split('#')[1] || '';
    const kt = toks(k);
    let score = 0;
    for (const x of t) if (kt.has(x)) score++;
    if (ks === stem) score += 3;
    return [score, lev(frag, kf), k];
  }).sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2].localeCompare(b[2])).slice(0, n).filter(x => x[0] > 0).map(x => x[2]);
}

// LRN ids are project content (any well-formed id passes); REF ids must exist in the shipped index.
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
  die(`source id must be LRN-YYYYMMDD-NN or REF-<stem>#<id>, got "${src}"`);
}

// ─── log ────────────────────────────────────────────────────────────────
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
  if (args.pfp && args.pfp !== true) line.pfp = String(args.pfp);
  if (args.writer && args.writer !== true) line.writer = String(args.writer);

  appendEvent(line, marker);
  process.stdout.write(`${path.relative(CWD, logPath())} += ${event}${line.src ? ' ' + line.src : ''}${line.status ? ' ' + line.status : ''}\n`);
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
// (set-equality acceptance); `budget.used` is still recorded so slice size flows into the metrics. Scoring/caps: PR7.
const TIER_RANK = { must: 0, should: 1, context: 2 };

function refsRoot() { return path.resolve(__dirname, '..'); }

function fileLines(rel) {
  const p = path.join(refsRoot(), rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n') : null;
}

// Extract a section's verbatim body (heading → next same-or-higher heading), skipping the qab metadata comment.
function sectionBody(entry) {
  const lines = fileLines(entry.file);
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
    const overridesRef = (overrides.match(/REF-[a-z0-9-]+(?:\/[a-z0-9-]+)?#[a-z0-9-]+/) || [])[0] || null;
    return { id, status, scope, profile, overridesRef, statement: field('Statement'), overrides, block: b.trim() };
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
  const index = loadRefIndex();
  if (!index) die('references/index.json not found next to this helper — run node build.js all (compile needs the shipped index)');

  // run: reuse the current marker if it is this skill's run, else start one
  let marker = readMarker();
  let run;
  if (marker && marker.skill === skill && marker.dir && fs.existsSync(marker.dir)) run = { run: marker.run, skill, ticket: marker.ticket || ticket, dir: marker.dir };
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
  const allRefs = Object.entries(index).map(([id, e]) => ({ id, ...e, kind: 'REF', explicit: e.scope.includes(skill) }));
  const dropped = allRefs.filter(r => !r.explicit && r.scope.includes('all') && r.tier !== 'must').map(r => ({ id: r.id, reason: 'general-scope' }));
  const refs = allRefs
    .filter(r => r.explicit || (r.scope.includes('all') && r.tier === 'must'))
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
    sources.push(s.kind === 'REF' ? { id: s.id, tier: s.tier, lines: n } : { id: s.id, tier: 'lrn', lines: n });
    bodyParts.push(s.kind === 'REF' ? `## ${s.id} — ${s.heading}\n${text}` : `## ${s.id}\n${text}`);
  }

  const manifest = [
    '---', 'manifest: 1', `run: ${run.run}`, `skill: ${skill}`, `pfp: ${pfp}`,
    `profile: {surface: ${profile.surface}, pom: ${profile.pom}, ticket_kind: ${profile.ticket_kind}}`,
    'compiler: qab 0.5.0   scoring: off', `budget: {max: 0, used: ${used}}   # max 0 = uncapped (unscored compile, RFC 0001 PR5)`,
    'sources:', ...sources.map(x => `  - id: ${x.id}   tier: ${x.tier}   lines: ${x.lines}`),
    'dropped:', ...(dropped.length ? dropped.map(d => `  - id: ${d.id}   reason: ${d.reason}`) : ['  []']),
    '---', '',
  ].join('\n');
  const slicePath = path.join(run.dir, 'slice.md');
  fs.writeFileSync(slicePath, manifest + bodyParts.join('\n'));
  fs.writeFileSync(path.join(run.dir, 'profile.json'), JSON.stringify({ ...profile, pfp }, null, 2) + '\n');
  const scratch = path.join(run.dir, 'scratchpad.md');
  if (!fs.existsSync(scratch)) fs.writeFileSync(scratch, `# ${run.run}\n\n## Plan\n\n## State\n\n## Findings\n\n## Candidate learnings\n<!-- anything noteworthy, no evidence bar; the three capture triggers are applied to THESE at close -->\n`);

  appendEvent({ v: 1, ts: nowIso(), run: run.run, skill, pfp, event: 'compiled', sources: sources.map(x => x.id), used, max: 0, dropped: dropped.map(d => d.id) }, marker);
  process.stdout.write(`${path.relative(CWD, slicePath)}\n`);
  process.stdout.write(`  run ${run.run} · ${sources.length} sources (${sources.filter(x => x.tier === 'must').length} must, ${sources.filter(x => x.tier === 'lrn').length} learnings) · ${used} lines · scratchpad ${path.relative(CWD, scratch)}\n`);
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

function computeStats(lines) {
  const per = {};
  const runsWithOutcome = new Set();
  const outcomes = {};
  for (const l of lines) {
    if (l.event === 'outcome') {
      runsWithOutcome.add(l.run);
      outcomes[l.status] = (outcomes[l.status] || 0) + 1;
      continue;
    }
    if (!l.src) continue;
    const s = per[l.src] || (per[l.src] = { applied: 0, contradicted: 0, captured: 0, last_applied: null, last_contradicted: null, runs: new Set() });
    if (l.event === 'applied') { s.applied++; s.runs.add(l.run); if (!s.last_applied || l.ts > s.last_applied) s.last_applied = l.ts; }
    else if (l.event === 'contradicted') { s.contradicted++; if (!s.last_contradicted || l.ts > s.last_contradicted) s.last_contradicted = l.ts; }
    else if (l.event === 'captured') { s.captured++; }
  }
  const rows = Object.entries(per).map(([src, s]) => ({
    src,
    kind: src.startsWith('REF-') ? 'REF' : 'LRN',
    applied: s.applied,
    contradicted: s.contradicted,
    captured: s.captured,
    runs: s.runs.size,
    last_applied: s.last_applied ? s.last_applied.slice(0, 10) : null,
    // RFC §6.2 computed findings (LRN-scoped; REF rows are informational until PR4)
    promotion_candidate: s.applied >= 3 && s.runs.size >= 3 && s.contradicted === 0,
    falsified: s.contradicted >= 2 && (!s.last_applied || (s.last_contradicted && s.last_applied < s.last_contradicted)),
  })).sort((a, b) => b.applied - a.applied || a.src.localeCompare(b.src));
  // Compliance (RFC 0001 PR4 acceptance): of runs that logged an outcome, how many
  // logged at least one REF `applied` at section granularity? Per skill and overall.
  const runsBySkill = {};
  for (const l of lines) {
    if (!l.run) continue;
    const r = runsBySkill[l.run] || (runsBySkill[l.run] = { skill: l.skill || 'unknown', outcome: false, ref: false, lrn: false });
    if (l.event === 'outcome') r.outcome = true;
    if (l.event === 'applied' && l.src) { if (l.src.startsWith('REF-') && l.src.includes('#')) r.ref = true; else r.lrn = true; }
  }
  const compliance = {};
  for (const r of Object.values(runsBySkill)) {
    if (!r.outcome) continue;
    const c = compliance[r.skill] || (compliance[r.skill] = { runs: 0, with_ref: 0, with_lrn: 0 });
    c.runs++; if (r.ref) c.with_ref++; if (r.lrn) c.with_lrn++;
  }
  return { rows, runs_with_outcome: runsWithOutcome.size, outcomes, compliance };
}

function cmdStats(args) {
  const since = args.since && args.since !== true ? String(args.since) : null;
  const { lines, malformed, manual } = readLog(since);
  const stats = computeStats(lines);
  const summary = { ...stats, events: lines.length, malformed, manual_writer: manual, log: path.relative(CWD, logPath()) };
  if (args.json) { process.stdout.write(JSON.stringify(summary, null, 2) + '\n'); return; }

  const out = [];
  out.push(`log: ${summary.log} — ${lines.length} events, ${stats.runs_with_outcome} runs with outcome${malformed ? `, ${malformed} malformed (skipped)` : ''}${manual ? `, ${manual} manual-writer` : ''}`);
  if (Object.keys(stats.outcomes).length) out.push('outcomes: ' + Object.entries(stats.outcomes).map(([k, v]) => `${k}=${v}`).join(' '));
  out.push('');
  out.push('| source | kind | applied | contradicted | runs | last_applied | finding |');
  out.push('|---|---|---|---|---|---|---|');
  for (const r of stats.rows) {
    const finding = r.falsified ? 'falsified (contradiction)' : r.promotion_candidate ? 'promotion candidate' : '';
    out.push(`| ${r.src} | ${r.kind} | ${r.applied} | ${r.contradicted} | ${r.runs} | ${r.last_applied || '—'} | ${finding} |`);
  }
  if (!stats.rows.length) out.push('| (no source events yet) | | | | | | |');
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

// ─── main ───────────────────────────────────────────────────────────────
function main() {
  const [sub, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (sub) {
    case 'run-id': return cmdRunId(args);
    case 'compile': return cmdCompile(args);
    case 'log': return cmdLog(args);
    case 'stats': return cmdStats(args);
    case undefined: case '--help': case '-h': case 'help':
      process.stdout.write([
        'usage: qab.js run-id --skill <name> [--ticket <key>]',
        '       qab.js compile --skill <name> [--ticket <key>]      → prints <runsDir>/<run>/slice.md',
        '       qab.js log <applied|contradicted|captured|outcome> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]',
        '       qab.js stats [--since <YYYY-MM-DD>] [--json]',
      ].join('\n') + '\n');
      return;
    default: die(`unknown subcommand "${sub}" (run-id | compile | log | stats)`);
  }
}

if (require.main === module) main();
module.exports = { parseArgs, computeStats, EVENTS, STATUSES };
