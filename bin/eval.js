#!/usr/bin/env node
'use strict';
// RFC 0005 PR2 — rubric-scored skill evals: local bench.
//
//   node bin/eval.js run <skill> [--cases a,b] [--runs 3] [--model claude-sonnet-5] [--out dir]
//                                [--turns 80] [--budget 5] [--eval-budget 15] [--skip-controls]
//   node bin/eval.js controls <skill> [--passes 3]
//   node bin/eval.js judge <workspace-dir> --skill <skill> --case <id> [--passes 1]
//   node bin/eval.js report <eval-dir | scores.json>
//
// Three roles in three contexts (RFC 0005 §2.1): the RUNNER is the installed skill executed by
// `claude -p` on the target model inside a scratch workspace; the JUDGE is a separate `claude -p`
// call to a different model (Opus, decision 15) with a tiny system prompt and no tools; CHECKS are
// deterministic over the produced files and the run directory. Controls are judged first — a
// control that scores at or above its floor stops the job before any runner money is spent.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const EVAL_DIR = path.join(ROOT, 'core', 'skills', 'eval');
const DEFAULT_RUNNER = 'claude-sonnet-5';

// ─── args ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

// ─── files ──────────────────────────────────────────────────────────────────
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
function walk(dir, acc = [], skip = /(^|\/)(node_modules|\.git)(\/|$)/) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (skip.test(p)) continue;
    if (e.isDirectory()) walk(p, acc, skip); else acc.push(p);
  }
  return acc;
}
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '.';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
function globFiles(root, glob) {
  const re = globToRe(glob);
  return walk(root).filter(f => re.test(path.relative(root, f).split(path.sep).join('/')));
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// ─── rubric / cases ─────────────────────────────────────────────────────────
function loadRubric(skill) {
  const p = path.join(ROOT, 'core', 'skills', skill, 'tests', 'rubric.json');
  if (!fs.existsSync(p)) die(`no rubric for ${skill} (${p})`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function caseDir(skill, id) { return path.join(ROOT, 'core', 'skills', skill, 'tests', 'cases', id); }
function loadCases(skill, only) {
  const base = path.join(ROOT, 'core', 'skills', skill, 'tests', 'cases');
  const ids = fs.readdirSync(base).filter(d => fs.statSync(path.join(base, d)).isDirectory());
  const pick = only ? String(only).split(',') : ids;
  return pick.map(id => {
    if (!ids.includes(id)) die(`unknown case ${id} for ${skill}`);
    return { ...JSON.parse(fs.readFileSync(path.join(base, id, 'case.json'), 'utf8')), dir: path.join(base, id) };
  });
}
function caseInputText(cdir, cap = 12000) {
  const files = walk(path.join(cdir, 'input')).sort();
  return files.map(f => `--- ${path.relative(path.join(cdir, 'input'), f)} ---\n${fs.readFileSync(f, 'utf8').slice(0, cap)}`).join('\n\n');
}

// ─── deterministic grading ──────────────────────────────────────────────────
function evalOp(text, op, value) {
  if (op === 'contains') return text.includes(value);
  if (op === 'not_contains') return !text.includes(value);
  if (op === 'matches') return new RegExp(value, 'm').test(text);
  if (op === 'count_gte') return (text.match(new RegExp(value.pattern, 'gm')) || []).length >= value.min;
  throw new Error(`unknown op ${op}`);
}
function latestRunDir(ws) {
  const runs = path.join(ws, '.qa-reports', 'runs');
  if (!fs.existsSync(runs)) return null;
  const dirs = fs.readdirSync(runs).map(d => path.join(runs, d)).filter(d => fs.statSync(d).isDirectory());
  dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}
function fieldText(field, ws, execFile) {
  if (field.startsWith('files:')) {
    const files = globFiles(ws, field.slice(6));
    return { text: files.map(f => fs.readFileSync(f, 'utf8')).join('\n'), where: files.map(f => path.relative(ws, f)).join(', ') || '(no files matched)' };
  }
  if (field.startsWith('file:')) { const p = path.join(ws, field.slice(5)); return { text: readIf(p) || '', where: fs.existsSync(p) ? field.slice(5) : '(missing)' }; }
  if (field.startsWith('run:')) { const d = latestRunDir(ws); const p = d ? path.join(d, field.slice(4)) : null; return { text: p ? (readIf(p) || '') : '', where: p ? path.relative(ws, p) : '(no run dir)' }; }
  if (field === 'exec:') return { text: readIf(execFile) || '', where: 'exec.jsonl' };
  if (field === 'log:') { const p = path.join(ws, 'features-kb', 'learnings-log.jsonl'); return { text: readIf(p) || '', where: 'features-kb/learnings-log.jsonl' }; }
  throw new Error(`unknown field ${field}`);
}
function gradeDeterministic(criterion, ws, execFile) {
  const { text, where } = fieldText(criterion.check.field, ws, execFile);
  const ok = text.length > 0 && evalOp(text, criterion.check.op, criterion.check.value);
  return { score: ok ? 3 : 0, evidence: `${criterion.check.op} ${JSON.stringify(criterion.check.value)} on ${where}: ${ok ? 'holds' : 'fails'}` };
}

// ─── judge ──────────────────────────────────────────────────────────────────
function judgePrompt({ inputText, notes, artifacts, criteria }) {
  const crit = criteria.map(c => ({ id: c.id, statement: c.statement, anchors: c.anchors }));
  return [
    '# Case input (what the skill was given)', inputText || '(none)',
    '# Judge notes (ground truth — never seen by the skill)', notes || '(none)',
    '# Artifact(s) produced by the skill', artifacts,
    '# Criteria', JSON.stringify(crit, null, 1),
    '# Output', 'JSON only, shape {"scores": {"<id>": {"score": 0-3, "evidence": "..."}}}, one entry per criterion id above.',
  ].join('\n\n');
}
function claudeJson(args, stdin, timeoutMs) {
  const r = spawnSync('claude', args, { input: stdin, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: { ...process.env } });
  if (r.error) throw r.error;
  const raw = (r.stdout || '').trim();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* fallthrough */ }
  if (!parsed) throw new Error(`claude returned non-JSON (exit ${r.status}): ${(raw || r.stderr || '').slice(0, 300)}`);
  return parsed;
}
// The judge is told "JSON only" but a model can still wrap it in fences or trail a sentence;
// take the first balanced {...} that parses, scanning string-aware.
function extractJsonObject(raw) {
  const t = raw.replace(/```(?:json)?/g, '');
  const start = t.indexOf('{');
  if (start < 0) return t.trim();
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return t.slice(start, i + 1); }
  }
  // Unbalanced: the model dropped trailing braces (seen live 2026-09-05, Opus omitting the last `}`).
  // Close an open string and append the missing braces — a repair, not an interpretation.
  return t.slice(start).trim() + (inStr ? '"' : '') + '}'.repeat(Math.max(0, depth));
}
function judgeOnce(rubric, prompt) {
  const sys = fs.readFileSync(path.join(ROOT, rubric.judge.prompt), 'utf8');
  const res = claudeJson(['-p', '--model', rubric.judge.model, '--max-turns', '1', '--tools', '', '--system-prompt', sys, '--output-format', 'json'], prompt, 5 * 60 * 1000);
  const text = extractJsonObject(String(res.result || ''));
  let scores;
  try { scores = JSON.parse(text).scores; } catch (e) {
    if (process.env.EVAL_DEBUG_DIR) { fs.mkdirSync(process.env.EVAL_DEBUG_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.EVAL_DEBUG_DIR, `judge-raw-${Date.now()}.txt`), String(res.result || '')); }
    throw new Error(`judge output was not the JSON shape (${e.message}): ${text.slice(0, 200)}`);
  }
  if (!scores || typeof scores !== 'object') throw new Error(`judge output has no scores object: ${text.slice(0, 200)}`);
  return { scores, cost: res.total_cost_usd || 0 };
}
function judgeWithRetry(rubric, prompt) {
  try { return judgeOnce(rubric, prompt); } catch (e) { console.error(`  judge retry: ${e.message}`); return judgeOnce(rubric, prompt); }
}
function judgeCriteria(rubric, criteria, { inputText, notes, artifacts }) {
  const { scores, cost } = judgeWithRetry(rubric, judgePrompt({ inputText, notes, artifacts, criteria }));
  const out = {};
  for (const c of criteria) {
    const s = scores && scores[c.id];
    const score = s && Number.isInteger(s.score) && s.score >= 0 && s.score <= 3 ? s.score : 0;
    const evidence = s && typeof s.evidence === 'string' && s.evidence.trim() ? s.evidence.trim() : '';
    out[c.id] = { score: evidence ? score : 0, evidence: evidence || '(no evidence quoted — scored 0 by rule)' };
  }
  return { results: out, cost };
}
function artifactsText(rubric, ws) {
  const files = [].concat(...(rubric.artifacts || []).map(g => globFiles(ws, g)));
  if (!files.length) return '(the skill produced no artifact matching ' + (rubric.artifacts || []).join(', ') + ')';
  return files.map(f => `--- ${path.relative(ws, f)} ---\n${fs.readFileSync(f, 'utf8').slice(0, 40000)}`).join('\n\n');
}

// ─── scoring ────────────────────────────────────────────────────────────────
function scoreRun(rubric, results) {
  let num = 0, den = 0; const breaches = [];
  for (const c of rubric.criteria) {
    const r = results[c.id] || { score: 0 };
    num += c.weight * (r.score / 3); den += c.weight;
    if (c.floor > 0 && r.score < c.floor) breaches.push(c.id);
  }
  return { total: den ? +(num / den).toFixed(3) : 0, floor_breaches: breaches };
}
function summarize(rubric, cases, costs) {
  const totals = cases.flatMap(c => c.runs.map(r => r.total));
  const breaches = cases.reduce((n, c) => n + c.runs.reduce((m, r) => m + r.floor_breaches.length, 0), 0);
  const mean = totals.length ? +(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(3) : 0;
  const min = totals.length ? Math.min(...totals) : 0, max = totals.length ? Math.max(...totals) : 0;
  let verdict = 'REPORT-ONLY (uncalibrated)';
  if (typeof rubric.threshold === 'number') verdict = breaches === 0 && mean >= rubric.threshold ? 'PASS' : 'FAIL';
  return { mean, min, max, spread: +(max - min).toFixed(3), floor_breaches: breaches, verdict, runs: totals.length, cost_usd: +costs.toFixed(2) };
}

// ─── fixture app ────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve) => { const req = http.get(url, res => { res.resume(); resolve(res.statusCode); }); req.on('error', () => resolve(0)); req.setTimeout(2000, () => { req.destroy(); resolve(0); }); });
}
function httpPost(url) {
  return new Promise((resolve) => { const req = http.request(url, { method: 'POST' }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', () => resolve(0)); req.end(); });
}
async function startApp(variant, port) {
  const server = path.join(EVAL_DIR, 'tests', 'fixture-app', 'server.js');
  const child = spawn(process.execPath, [server], { env: { ...process.env, APP_VARIANT: variant, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { if (await httpGet(`http://localhost:${port}/login`) === 200) return child; await new Promise(r => setTimeout(r, 200)); }
  child.kill(); throw new Error(`fixture app (${variant}) did not answer on :${port}`);
}

// ─── runner ─────────────────────────────────────────────────────────────────
function runnerTools() {
  return ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'Agent',
    'mcp__playwright__browser_navigate', 'mcp__playwright__browser_navigate_back', 'mcp__playwright__browser_snapshot', 'mcp__playwright__browser_take_screenshot',
    'mcp__playwright__browser_click', 'mcp__playwright__browser_type', 'mcp__playwright__browser_fill_form', 'mcp__playwright__browser_select_option',
    'mcp__playwright__browser_hover', 'mcp__playwright__browser_press_key', 'mcp__playwright__browser_evaluate', 'mcp__playwright__browser_console_messages',
    'mcp__playwright__browser_network_requests', 'mcp__playwright__browser_tabs', 'mcp__playwright__browser_resize', 'mcp__playwright__browser_handle_dialog',
    'mcp__playwright__browser_wait_for'].join(',');
}
function runSkill({ skill, caseDef, ws, model, turns, budget, execFile, log }) {
  const headless = fs.readFileSync(path.join(EVAL_DIR, 'eval-headless.md'), 'utf8');
  const prompt = `Run \`/qa-${skill} ${caseDef.runner_args}\`. When finished, print one line: \`qa-${skill}: <STATUS> — <one-line summary>\`.`;
  const args = ['-p', prompt, '--model', model, '--max-turns', String(turns), '--max-budget-usd', String(budget),
    '--permission-mode', 'bypassPermissions', '--disallowedTools', 'AskUserQuestion', '--allowedTools', runnerTools(),
    '--append-system-prompt', headless, '--output-format', 'stream-json', '--verbose', '--no-session-persistence'];
  if (caseDef.app) args.push('--mcp-config', path.join(EVAL_DIR, 'mcp.json'), '--strict-mcp-config');
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('claude', args, { cwd: ws, env: { ...process.env, QABUDDY_HEADLESS: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(execFile);
    let buf = '', result = null, tools = 0, questions = 0;
    const timer = setTimeout(() => { log('  runner wall-time cap hit — killing'); child.kill('SIGKILL'); }, 25 * 60 * 1000);
    child.stdout.on('data', d => {
      buf += d; const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        if (!l.trim()) continue; out.write(l + '\n');
        try {
          const e = JSON.parse(l);
          if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) for (const c of e.message.content) if (c.type === 'tool_use') { tools++; if (c.name === 'AskUserQuestion') questions++; }
          if (e.type === 'result') result = e;
        } catch { /* partial line */ }
      }
    });
    let err = ''; child.stderr.on('data', d => { err += d; });
    child.on('close', (code) => {
      clearTimeout(timer); if (buf.trim()) out.write(buf + '\n'); out.end();
      resolve({ exit: code, cost: result ? (result.total_cost_usd || 0) : 0, turns: result ? (result.num_turns || 0) : 0, tools, questions,
        status: result ? (result.subtype || 'unknown') : 'no-result', wall_s: Math.round((Date.now() - started) / 1000), stderr: err.slice(-2000), final: result ? String(result.result || '').slice(-600) : '' });
    });
  });
}

// ─── report ─────────────────────────────────────────────────────────────────
function renderReport(s) {
  const L = [];
  L.push(`# Eval — ${s.skill} v${s.skill_version} (rubric v${s.rubric_version})`, '');
  L.push(`runner \`${s.models.runner}\` · judge \`${s.models.judge}\` · ref ${s.ref.name} (${String(s.ref.sha).slice(0, 7)}) · ${s.summary.runs} runs · $${s.summary.cost_usd}`, '');
  L.push(`**Verdict: ${s.summary.verdict}** — mean ${s.summary.mean}, min ${s.summary.min}, max ${s.summary.max}, spread ${s.summary.spread}, floor breaches ${s.summary.floor_breaches}`);
  L.push(`Three runs per case detect large effects only; differences inside the spread (${s.summary.spread}) are not distinguishable at this n.`, '');
  if (s.controls && Object.keys(s.controls).length) {
    L.push('## Controls (judged first — every floored criterion must score below its floor)', '', '| criterion | floor | control score | ok |', '|---|---|---|---|');
    for (const [id, c] of Object.entries(s.controls)) L.push(`| ${id} | ${c.floor} | ${c.scores.join('/')} | ${c.ok ? '✓' : '✗ VACUOUS'} |`);
    L.push('');
  }
  L.push('## Per criterion (mean over all runs)', '', '| criterion | kind | weight | floor | mean | min | max | breaches |', '|---|---|---|---|---|---|---|---|');
  for (const c of s.criteria) {
    const v = s.cases.flatMap(k => k.runs.map(r => (r.criteria[c.id] || { score: 0 }).score));
    const mean = v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '-';
    const br = v.filter(x => c.floor > 0 && x < c.floor).length;
    L.push(`| ${c.id} | ${c.kind} | ${c.weight} | ${c.floor} | ${mean} | ${v.length ? Math.min(...v) : '-'} | ${v.length ? Math.max(...v) : '-'} | ${br} |`);
  }
  L.push('', '## Runs', '', '| case | run | total | floor breaches | cost | turns | wall |', '|---|---|---|---|---|---|---|');
  for (const k of s.cases) for (const r of k.runs) L.push(`| ${k.id} | ${r.n} | ${r.total} | ${r.floor_breaches.join(', ') || '—'} | $${(r.cost_usd || 0).toFixed(2)} | ${r.turns || '-'} | ${r.wall_s || '-'}s |`);
  L.push('', '## Evidence', '');
  for (const k of s.cases) for (const r of k.runs) { L.push(`### ${k.id} · run ${r.n}`, ''); for (const [id, v] of Object.entries(r.criteria)) L.push(`- **${id}** = ${v.score}: ${String(v.evidence).replace(/\n/g, ' ').slice(0, 300)}`); L.push(''); }
  return L.join('\n');
}

// ─── commands ───────────────────────────────────────────────────────────────
function die(m) { console.error(`eval.js: ${m}`); process.exit(2); }
function gitSha() { const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }); return (r.stdout || 'unknown').trim(); }
function gitRef() { const r = spawnSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }); return (r.stdout || '').trim() || 'HEAD'; }

function cmdControls(skill, opts) {
  const rubric = loadRubric(skill);
  const passes = Number(opts.passes || 3);
  const controlsDir = path.join(ROOT, 'core', 'skills', skill, 'tests', 'controls');
  const out = {}; let cost = 0, vacuous = [];
  for (const c of rubric.criteria.filter(c => c.floor > 0 && c.kind === 'judge')) {
    const p = path.join(controlsDir, `${c.id}.md`);
    const text = fs.readFileSync(p, 'utf8');
    const h = text.match(/^<!--\s*rubric-control:\s*criterion=(\S+)\s+case=(\S+)/);
    const cdir = caseDir(skill, h[2]);
    const artifact = `--- control artifact ---\n${text.replace(/^<!--[^\n]*-->\n?/, '')}`;
    const scores = [];
    for (let i = 0; i < passes; i++) {
      const { results, cost: k } = judgeCriteria(rubric, [c], { inputText: caseInputText(cdir), notes: readIf(path.join(cdir, 'judge-notes.md')), artifacts: artifact });
      scores.push(results[c.id].score); cost += k;
    }
    const ok = scores.every(s => s < c.floor);
    out[c.id] = { floor: c.floor, scores, ok };
    if (!ok) vacuous.push(c.id);
    console.log(`  ${ok ? '✓' : '✗'} ${skill}/${c.id}: control scored ${scores.join('/')} (floor ${c.floor})`);
  }
  console.log(`controls: ${Object.keys(out).length} judged, ${vacuous.length} vacuous, $${cost.toFixed(2)}`);
  return { controls: out, vacuous, cost };
}

async function cmdRun(skill, opts) {
  const rubric = loadRubric(skill);
  const runs = Number(opts.runs || 3), model = opts.model || DEFAULT_RUNNER;
  const turns = Number(opts.turns || 80), budget = Number(opts.budget || 5), evalBudget = Number(opts['eval-budget'] || 15);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(opts.out || path.join(ROOT, '.qa-reports', 'evals', skill, stamp));
  fs.mkdirSync(outDir, { recursive: true });
  const log = (m) => { console.log(m); fs.appendFileSync(path.join(outDir, 'eval.log'), m + '\n'); };
  log(`eval ${skill} v${rubric.skill_version} · runner ${model} · judge ${rubric.judge.model} · ${runs} run(s)/case · out ${outDir}`);
  let cost = 0; let controls = {};
  if (!opts['skip-controls']) {
    const c = cmdControls(skill, { passes: opts['control-passes'] || 3 }); controls = c.controls; cost += c.cost;
    if (c.vacuous.length) { log(`rubric vacuous: ${c.vacuous.join(', ')} — stopping before any runner spend`); process.exit(1); }
  }
  const cases = loadCases(skill, opts.cases);
  const scored = [];
  for (const cdef of cases) {
    const rec = { id: cdef.id, runs: [] };
    let app = null;
    if (cdef.app) app = await startApp(cdef.app, cdef.port);
    try {
      for (let n = 1; n <= runs; n++) {
        if (cost >= evalBudget) { log(`eval budget $${evalBudget} reached — stopping (partial)`); break; }
        if (app) await httpPost(`http://localhost:${cdef.port}/api/reset`);
        const runDir = path.join(outDir, cdef.id, `run-${n}`); fs.mkdirSync(runDir, { recursive: true });
        const ws = fs.mkdtempSync(path.join(os.tmpdir(), `qab-eval-${skill}-${cdef.id}-`));
        copyDir(path.join(cdef.dir, 'input'), ws);
        const execFile = path.join(runDir, 'exec.jsonl');
        log(`▶ ${cdef.id} run ${n} — workspace ${ws}`);
        const r = await runSkill({ skill, caseDef: cdef, ws, model, turns, budget, execFile, log });
        cost += r.cost;
        log(`  runner: ${r.status}, ${r.turns} turns, ${r.tools} tool calls, ${r.questions} questions, $${r.cost.toFixed(2)}, ${r.wall_s}s`);
        if (r.stderr && r.exit !== 0) log(`  stderr: ${r.stderr.slice(-400)}`);
        copyDir(ws, path.join(runDir, 'workspace'));
        const results = {};
        for (const c of rubric.criteria) if (c.kind !== 'judge') results[c.id] = gradeDeterministic(c, ws, execFile);
        const judged = rubric.criteria.filter(c => c.kind === 'judge');
        if (judged.length) {
          const j = judgeCriteria(rubric, judged, { inputText: caseInputText(cdef.dir), notes: readIf(path.join(cdef.dir, 'judge-notes.md')), artifacts: artifactsText(rubric, ws) });
          Object.assign(results, j.results); cost += j.cost;
        }
        const sc = scoreRun(rubric, results);
        rec.runs.push({ n, cost_usd: +r.cost.toFixed(3), turns: r.turns, wall_s: r.wall_s, tool_calls: r.tools, questions: r.questions, runner_status: r.status, run_dir: path.relative(ROOT, runDir), criteria: results, ...sc });
        log(`  total ${sc.total}${sc.floor_breaches.length ? ' — floor breaches: ' + sc.floor_breaches.join(', ') : ''}`);
        fs.rmSync(ws, { recursive: true, force: true });
      }
    } finally { if (app) app.kill(); }
    scored.push(rec);
  }
  const scores = { schema: 'eval-scores/1', skill, skill_version: rubric.skill_version, rubric_version: rubric.rubric_version,
    ref: { name: gitRef(), sha: gitSha() }, models: { runner: model, judge: rubric.judge.model }, generated: new Date().toISOString(),
    skills_path: (() => { try { return fs.readlinkSync(path.join(os.homedir(), '.claude', 'skills', 'qa-references')); } catch { return 'unknown'; } })(),
    controls, criteria: rubric.criteria.map(c => ({ id: c.id, kind: c.kind, weight: c.weight, floor: c.floor })), cases: scored, summary: summarize(rubric, scored, cost) };
  fs.writeFileSync(path.join(outDir, 'scores.json'), JSON.stringify(scores, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(scores));
  log(`verdict ${scores.summary.verdict} · mean ${scores.summary.mean} · $${scores.summary.cost_usd} · ${path.join(outDir, 'report.md')}`);
  return scores;
}

function cmdJudge(dir, opts) {
  const skill = opts.skill || die('--skill required'); const rubric = loadRubric(skill);
  const cdir = caseDir(skill, opts.case || die('--case required'));
  const passes = Number(opts.passes || 1);
  const judged = rubric.criteria.filter(c => c.kind === 'judge');
  const ws = path.resolve(dir);
  const results = {};
  for (const c of rubric.criteria) if (c.kind !== 'judge') results[c.id] = gradeDeterministic(c, ws, path.join(ws, 'exec.jsonl'));
  const all = [];
  for (let i = 0; i < passes; i++) {
    const j = judgeCriteria(rubric, judged, { inputText: caseInputText(cdir), notes: readIf(path.join(cdir, 'judge-notes.md')), artifacts: artifactsText(rubric, ws) });
    all.push({ pass: i + 1, cost: j.cost, criteria: { ...results, ...j.results }, ...scoreRun(rubric, { ...results, ...j.results }) });
  }
  console.log(JSON.stringify({ skill, case: opts.case, dir: ws, passes: all }, null, 2));
  return all;
}

function cmdReport(target) {
  const p = fs.statSync(target).isDirectory() ? path.join(target, 'scores.json') : target;
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  const md = renderReport(s);
  if (fs.statSync(target).isDirectory()) fs.writeFileSync(path.join(target, 'report.md'), md);
  process.stdout.write(md);
}

// ─── calibration (PR3) ──────────────────────────────────────────────────────
// tests/calibration/<id>/{artifact/, meta.json, human.json, scoring-sheet.md}. A human scores
// each artifact blind; the judge scores it N times; agreement, floor agreement and repeatability
// decide whether the rubric may gate, and the threshold is derived from the acceptable eval-run
// artifacts — never typed in (RFC 0005 §2.6, decisions 7 and 8).
function calibDir(skill) { return path.join(ROOT, 'core', 'skills', skill, 'tests', 'calibration'); }
function scoringSheet(rubric, entry) {
  const L = [`# Scoring sheet — ${rubric.skill} · ${entry.id}`, '', `Source: ${entry.source}${entry.case ? ` · case ${entry.case}` : ''}${entry.origin ? ` · from ${entry.origin}` : ''}`, '',
    'Read the artifact under `artifact/`, then fill `human.json`: one score 0–3 per judge criterion (pick the anchor), and `acceptable`: would you accept this artifact from a colleague as-is? Do not look at any judge output first.', ''];
  for (const c of rubric.criteria.filter(c => c.kind === 'judge')) {
    L.push(`## ${c.id} (weight ${c.weight}, floor ${c.floor})`, '', c.statement, '');
    for (const k of ['0', '1', '2', '3']) L.push(`- **${k}** — ${c.anchors[k]}`);
    L.push('');
  }
  return L.join('\n');
}
function addCalibEntry(skill, rubric, id, { source, caseId, origin, files }) {
  const dir = path.join(calibDir(skill), id);
  if (fs.existsSync(dir)) return false;
  fs.mkdirSync(path.join(dir, 'artifact'), { recursive: true });
  for (const [rel, content] of files) { const dst = path.join(dir, 'artifact', rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, content); }
  const entry = { id, source, case: caseId || null, origin: origin || null, added: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(entry, null, 2) + '\n');
  const human = { scored_by: null, date: null, acceptable: null, scores: Object.fromEntries(rubric.criteria.filter(c => c.kind === 'judge').map(c => [c.id, null])) };
  fs.writeFileSync(path.join(dir, 'human.json'), JSON.stringify(human, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'scoring-sheet.md'), scoringSheet(rubric, entry));
  return true;
}
function cmdCalibrateInit(skill, opts) {
  const rubric = loadRubric(skill);
  let added = 0;
  // 1. controls — every markdown control is a scored-by-construction artifact
  const controlsDir = path.join(ROOT, 'core', 'skills', skill, 'tests', 'controls');
  for (const f of fs.readdirSync(controlsDir).filter(f => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(controlsDir, f), 'utf8');
    const h = text.match(/^<!--\s*rubric-control:\s*criterion=(\S+)\s+case=(\S+)/);
    const rel = (rubric.artifacts[0] || 'artifact.md').replace(/\*\*\//g, '').replace(/\*/g, 'control');
    if (addCalibEntry(skill, rubric, `control-${f.replace(/\.md$/, '')}`, { source: 'control', caseId: h ? h[2] : null, origin: `tests/controls/${f}`, files: [[rel, text.replace(/^<!--[^\n]*-->\n?/, '')]] })) added++;
  }
  // 2. eval runs — every run workspace under .qa-reports/evals/<skill>/*/<case>/run-*/workspace
  const evalsRoot = path.join(ROOT, '.qa-reports', 'evals', skill);
  if (fs.existsSync(evalsRoot)) for (const ev of fs.readdirSync(evalsRoot)) {
    const evDir = path.join(evalsRoot, ev); if (!fs.statSync(evDir).isDirectory()) continue;
    for (const caseId of fs.readdirSync(evDir)) {
      const cDir = path.join(evDir, caseId); if (!fs.statSync(cDir).isDirectory()) continue;
      for (const run of fs.readdirSync(cDir).filter(r => /^run-\d+$/.test(r))) {
        const ws = path.join(cDir, run, 'workspace'); if (!fs.existsSync(ws)) continue;
        const files = [];
        for (const g of rubric.artifacts) for (const f of globFiles(ws, g)) files.push([path.relative(ws, f), fs.readFileSync(f, 'utf8')]);
        if (!files.length) continue;
        const rd = latestRunDir(ws); if (rd && fs.existsSync(path.join(rd, 'scratchpad.md'))) files.push([path.join('.qa-reports', 'runs', path.basename(rd), 'scratchpad.md'), fs.readFileSync(path.join(rd, 'scratchpad.md'), 'utf8')]);
        const lg = path.join(ws, 'features-kb', 'learnings-log.jsonl'); if (fs.existsSync(lg)) files.push(['features-kb/learnings-log.jsonl', fs.readFileSync(lg, 'utf8')]);
        const ex = path.join(cDir, run, 'exec.jsonl'); if (fs.existsSync(ex)) files.push(['exec.jsonl', fs.readFileSync(ex, 'utf8')]);
        if (addCalibEntry(skill, rubric, `run-${ev}-${caseId}-${run}`, { source: 'eval-run', caseId, origin: path.relative(ROOT, ws), files })) added++;
      }
    }
  }
  // 3. --extra <file>[,<file>] external artifacts (no case: judge gets no notes; agreement only)
  if (opts.extra) for (const f of String(opts.extra).split(',')) {
    const abs = path.resolve(f); const id = `extra-${path.basename(abs).replace(/\.md$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
    const rel = (rubric.artifacts[0] || 'artifact.md').replace(/\*\*\//g, '').replace(/\*/g, 'extra');
    if (addCalibEntry(skill, rubric, id, { source: 'external', caseId: opts['extra-case'] || null, origin: abs, files: [[rel, fs.readFileSync(abs, 'utf8')]] })) added++;
  }
  const total = fs.existsSync(calibDir(skill)) ? fs.readdirSync(calibDir(skill)).length : 0;
  console.log(`calibration set for ${skill}: ${added} added, ${total} entries (need ≥ 10). Fill each entry's human.json using its scoring-sheet.md, then run: node bin/eval.js calibrate ${skill}`);
}
function cmdCalibrate(skill, opts) {
  const rubric = loadRubric(skill);
  const passes = Number(opts.passes || 3);
  const dir = calibDir(skill);
  if (!fs.existsSync(dir)) die(`no calibration set — run: calibrate ${skill} --init`);
  const judgeCrit = rubric.criteria.filter(c => c.kind === 'judge');
  const entries = fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'meta.json'))).map(d => ({ dir: path.join(dir, d), ...JSON.parse(fs.readFileSync(path.join(dir, d, 'meta.json'), 'utf8')), human: JSON.parse(fs.readFileSync(path.join(dir, d, 'human.json'), 'utf8')) }));
  const rows = []; let cost = 0;
  for (const e of entries) {
    const ws = path.join(e.dir, 'artifact');
    const cdir = e.case ? caseDir(skill, e.case) : null;
    const results = {};
    for (const c of rubric.criteria) if (c.kind !== 'judge') results[c.id] = gradeDeterministic(c, ws, path.join(ws, 'exec.jsonl'));
    const passesOut = [];
    for (let i = 0; i < passes; i++) {
      const j = judgeCriteria(rubric, judgeCrit, { inputText: cdir ? caseInputText(cdir) : '(external artifact — no case input)', notes: cdir ? readIf(path.join(cdir, 'judge-notes.md')) : null, artifacts: artifactsText(rubric, ws) });
      cost += j.cost;
      const all = { ...results, ...j.results };
      passesOut.push({ criteria: all, ...scoreRun(rubric, all) });
    }
    const totals = passesOut.map(p => p.total);
    rows.push({ id: e.id, source: e.source, case: e.case, human: e.human, passes: passesOut, mean: +(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(3), spread: +(Math.max(...totals) - Math.min(...totals)).toFixed(3) });
    console.log(`  ${e.id}: judge totals ${totals.join('/')} (spread ${(Math.max(...totals) - Math.min(...totals)).toFixed(3)})${e.human.acceptable === null ? ' — human.json not filled' : ''}`);
  }
  // agreement (per judge criterion, over every (entry, pass) with a human score), floor agreement, repeatability
  const agreement = {}, floorAgree = {}; let scoredEntries = 0;
  for (const c of judgeCrit) {
    let n = 0, ok = 0, fn = 0, fok = 0;
    for (const r of rows) {
      const h = r.human.scores && r.human.scores[c.id]; if (!Number.isInteger(h)) continue;
      for (const p of r.passes) { n++; if (p.criteria[c.id].score === h) ok++; if (c.floor > 0) { fn++; if ((p.criteria[c.id].score < c.floor) === (h < c.floor)) fok++; } }
    }
    agreement[c.id] = n ? +(ok / n).toFixed(2) : null; floorAgree[c.id] = fn ? +(fok / fn).toFixed(2) : null;
  }
  scoredEntries = rows.filter(r => r.human.acceptable !== null).length;
  const repeatOk = rows.every(r => r.spread <= 0.1);
  const acceptable = rows.filter(r => r.human.acceptable === true && r.source === 'eval-run');
  const threshold = acceptable.length ? Math.min(...acceptable.map(r => r.mean)) : null;
  const gateB = judgeCrit.every(c => agreement[c.id] !== null && agreement[c.id] >= 0.8 && (floorAgree[c.id] === null || floorAgree[c.id] === 1));
  const report = [`# Calibration — ${skill} v${rubric.skill_version} (rubric v${rubric.rubric_version}) · judge ${rubric.judge.model} · ${passes} passes · $${cost.toFixed(2)}`, '',
    `entries ${rows.length} (human-scored ${scoredEntries}, need ≥ 10) · repeatability ${repeatOk ? 'OK (every spread ≤ 0.1)' : 'FAIL'} · agreement gate ${gateB ? 'OK' : 'not met'} · proposed threshold ${threshold === null ? '— (no acceptable eval-run artifact scored yet)' : threshold}`, '',
    '| criterion | floor | agreement | floor agreement |', '|---|---|---|---|', ...judgeCrit.map(c => `| ${c.id} | ${c.floor} | ${agreement[c.id] === null ? '—' : agreement[c.id]} | ${floorAgree[c.id] === null ? '—' : floorAgree[c.id]} |`), '',
    '| entry | source | case | judge mean | spread | human acceptable |', '|---|---|---|---|---|---|', ...rows.map(r => `| ${r.id} | ${r.source} | ${r.case || '—'} | ${r.mean} | ${r.spread} | ${r.human.acceptable === null ? 'unscored' : r.human.acceptable} |`), ''];
  const outDir = path.join(ROOT, '.qa-reports', 'evals', skill); fs.mkdirSync(outDir, { recursive: true });
  const rp = path.join(outDir, `calibration-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(rp, report.join('\n')); fs.writeFileSync(rp.replace(/\.md$/, '.json'), JSON.stringify({ skill, rows, agreement, floorAgree, repeatOk, threshold, cost }, null, 2));
  console.log(report.slice(0, 3).join('\n')); console.log(`report: ${rp}`);
  const canGate = scoredEntries >= 10 && gateB && repeatOk && threshold !== null;
  if (opts['dry-run'] || opts['judge-only']) { console.log(canGate ? 'gates would hold — rerun without --dry-run to write the calibration block' : 'gates not met — rubric stays report-only'); return; }
  if (!canGate) { console.log('gates not met — rubric stays report-only (revise anchors, score more artifacts, or check repeatability)'); process.exit(1); }
  const rp2 = path.join(ROOT, 'core', 'skills', skill, 'tests', 'rubric.json');
  const r = JSON.parse(fs.readFileSync(rp2, 'utf8'));
  r.threshold = threshold; r.calibration = { date: new Date().toISOString().slice(0, 10), artifacts: rows.length, human_scored: scoredEntries, passes, agreement, floor_agreement: floorAgree, judge: rubric.judge.model };
  fs.writeFileSync(rp2, JSON.stringify(r, null, 2) + '\n');
  console.log(`rubric calibrated: threshold ${threshold} written to ${path.relative(ROOT, rp2)}`);
}

function help() {
  console.log(`eval.js — rubric-scored skill evals (RFC 0005)

  run <skill> [--cases a,b] [--runs 3] [--model ${DEFAULT_RUNNER}] [--out dir] [--turns 80] [--budget 5] [--eval-budget 15] [--skip-controls]
  controls <skill> [--passes 3]           judge every floored judge-criterion's control; exit 1 if any is not below its floor
  judge <workspace> --skill s --case id [--passes 1]   grade an existing workspace (calibration / re-grading)
  report <eval-dir | scores.json>         re-render report.md
  calibrate <skill> --init [--extra f,g]  assemble tests/calibration/ from controls, eval runs and external files
  calibrate <skill> [--passes 3] [--dry-run|--judge-only]   judge the set, compare with human.json, derive the threshold
`);
}

(async () => {
  const a = parseArgs(process.argv.slice(2));
  const cmd = a._[0];
  try {
    if (!cmd || cmd === 'help' || a.help) { help(); process.exit(0); }
    if (cmd === 'controls') { const c = cmdControls(a._[1] || die('skill required'), a); process.exit(c.vacuous.length ? 1 : 0); }
    if (cmd === 'run') { await cmdRun(a._[1] || die('skill required'), a); process.exit(0); }
    if (cmd === 'judge') { cmdJudge(a._[1] || die('workspace dir required'), a); process.exit(0); }
    if (cmd === 'report') { cmdReport(a._[1] || die('eval dir required')); process.exit(0); }
    if (cmd === 'calibrate') { const sk = a._[1] || die('skill required'); if (a.init) cmdCalibrateInit(sk, a); else cmdCalibrate(sk, a); process.exit(0); }
    die(`unknown command ${cmd}`);
  } catch (e) { console.error(`eval.js: ${e.message}`); process.exit(1); }
})();
