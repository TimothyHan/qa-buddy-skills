#!/usr/bin/env node
/**
 * qab.js — QABuddy runtime helper (zero dependencies).
 *
 * Shipped to dist/<platform>/references/bin/qab.js so every platform can call it as
 *   node <REFERENCE_PATH>/bin/qab.js <subcommand> …
 * The model passes bare arguments; it never hand-writes JSON. Design: docs/rfc/0001-context-compiler.md §4.
 *
 * Subcommands (PR1):
 *   run-id  --skill <name> [--ticket <key>]      print a run id and remember it in .qa-reports/.qab-run
 *   log     <event> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]
 *                                                append one v1 line to <learningsPath dir>/learnings-log.jsonl
 *   stats   [--since <YYYY-MM-DD>] [--json]      per-source counts from the log
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
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, JSON.stringify({ run, skill, started: nowIso() }) + '\n');
  process.stdout.write(run + '\n');
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

  const target = logPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, JSON.stringify(line) + '\n');
  process.stdout.write(`${path.relative(CWD, target)} += ${event}${line.src ? ' ' + line.src : ''}${line.status ? ' ' + line.status : ''}\n`);
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
    applied: s.applied,
    contradicted: s.contradicted,
    captured: s.captured,
    runs: s.runs.size,
    last_applied: s.last_applied ? s.last_applied.slice(0, 10) : null,
    // RFC §6.2 computed findings (LRN-scoped; REF rows are informational until PR4)
    promotion_candidate: s.applied >= 3 && s.runs.size >= 3 && s.contradicted === 0,
    falsified: s.contradicted >= 2 && (!s.last_applied || (s.last_contradicted && s.last_applied < s.last_contradicted)),
  })).sort((a, b) => b.applied - a.applied || a.src.localeCompare(b.src));
  return { rows, runs_with_outcome: runsWithOutcome.size, outcomes };
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
  out.push('| source | applied | contradicted | runs | last_applied | finding |');
  out.push('|---|---|---|---|---|---|');
  for (const r of stats.rows) {
    const finding = r.falsified ? 'falsified (contradiction)' : r.promotion_candidate ? 'promotion candidate' : '';
    out.push(`| ${r.src} | ${r.applied} | ${r.contradicted} | ${r.runs} | ${r.last_applied || '—'} | ${finding} |`);
  }
  if (!stats.rows.length) out.push('| (no source events yet) | | | | | |');
  process.stdout.write(out.join('\n') + '\n');
}

// ─── main ───────────────────────────────────────────────────────────────
function main() {
  const [sub, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (sub) {
    case 'run-id': return cmdRunId(args);
    case 'log': return cmdLog(args);
    case 'stats': return cmdStats(args);
    case undefined: case '--help': case '-h': case 'help':
      process.stdout.write([
        'usage: qab.js run-id --skill <name> [--ticket <key>]',
        '       qab.js log <applied|contradicted|captured|outcome> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]',
        '       qab.js stats [--since <YYYY-MM-DD>] [--json]',
      ].join('\n') + '\n');
      return;
    default: die(`unknown subcommand "${sub}" (run-id | log | stats)`);
  }
}

if (require.main === module) main();
module.exports = { parseArgs, computeStats, EVENTS, STATUSES };
