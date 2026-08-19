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
 *   fp      <kind> <key> [--run <id>] [--skill <name>]
 *                                                (PR6) append one failure fingerprint to <learningsPath dir>/fingerprints.jsonl:
 *                                                ffp = sha256(kind + "\n" + normalized key)[:12]; `active` = LRNs in this run's slice
 *                                                whose Fingerprint: equals ffp (automatic falsification evidence)
 *   fp      --list [--run <id>]                  print this run's fingerprints (for the capture rule: link Fingerprint: to the ffp)
 *   stats   [--since <YYYY-MM-DD>] [--json]      per-source counts (+ in_slice) + findings + fingerprint recurrence + compliance
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
  const index = loadRefIndex();
  if (!index) die('references/index.json not found next to this helper — run node build.js all (compile needs the shipped index)');

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
    'compiler: qab 0.6.0   scoring: off', `budget: {max: 0, used: ${used}}   # max 0 = uncapped (unscored compile, RFC 0001 PR5)`,
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
    return {
      src,
      kind: src.startsWith('REF-') ? 'REF' : 'LRN',
      applied: s.applied,
      contradicted: s.contradicted,
      captured: s.captured,
      in_slice: s.in_slice,
      runs: s.runs.size,
      last_applied: s.last_applied ? s.last_applied.slice(0, 10) : null,
      // RFC §6.2 computed findings (promotion is LRN-only: a REF section is already a reference)
      promotion_candidate: !src.startsWith('REF-') && s.applied >= 3 && s.runs.size >= 3 && s.contradicted === 0 && falsifiedFp === 0 && recurrenceSince(src) === 0,
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
    if (l.event === 'applied' && l.src) { if (l.src.startsWith('REF-') && l.src.includes('#')) r.ref = true; else r.lrn = true; }
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

// ─── scoreboard (RFC 0001 §3.5, PR6: derived cache, never a source of truth) ─
// per_source: in_slice (compiled events), applied, contradicted, last_applied, runs (distinct runs with applied —
// same meaning as `stats`). No wins/losses (decision 4). per_fingerprint: recurrence + the LRNs each class falsified.
// PR7's scored selection reads this file; until then it is a rebuildable summary of the two logs.
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
    case 'scoreboard': return cmdScoreboard(args);
    case undefined: case '--help': case '-h': case 'help':
      process.stdout.write([
        'usage: qab.js run-id --skill <name> [--ticket <key>]',
        '       qab.js compile --skill <name> [--ticket <key>]      → prints <runsDir>/<run>/slice.md',
        '       qab.js log <applied|contradicted|captured|outcome> [<src>] [--note <text>] [--status <S>] [--run <id>] [--skill <name>]',
        `       qab.js fp <kind> <key> [--run <id>] [--skill <name>]   kind ∈ ${FP_KINDS.join('|')}`,
        '       qab.js fp --list [--run <id>]                      → this run\'s fingerprints (ffp kind key active)',
        '       qab.js stats [--since <YYYY-MM-DD>] [--json]',
        '       qab.js scoreboard                                  → rebuilds <kb>/.cache/scoreboard.json',
      ].join('\n') + '\n');
      return;
    default: die(`unknown subcommand "${sub}" (run-id | compile | log | fp | stats | scoreboard)`);
  }
}

if (require.main === module) {
  // A closed stdout (`| head`, a consumer that exits early) must not crash the helper with a stack trace.
  process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') process.exit(0); throw e; });
  main();
}
module.exports = { parseArgs, computeStats, normalizeKey, fingerprintOf, EVENTS, STATUSES, FP_KINDS };
