#!/usr/bin/env node
/**
 * QABuddy eval fixture app — "Acme Projects"
 *
 * A deliberately-engineered target application for evaluating the e2e skills
 * (/e2e-setup, /e2e-pom, /e2e-write). Every element, trap, and bug in this app
 * is ground truth documented in ANSWER-KEY.md. Do not "fix" the traps — they
 * ARE the eval.
 *
 * Zero dependencies (node:http only). No build step.
 *
 * Usage:
 *   node server.js                        # v1 (baseline) on :4173
 *   APP_VARIANT=v2 node server.js         # v2 (DOM mutated — heal-mode exam)
 *   APP_VARIANT=v3 node server.js         # v3 (behavior bug — negative control)
 *   PORT=5000 node server.js
 *
 * Variants:
 *   v1  baseline build target
 *   v2  DOM mutations: project-row → project-list-row,
 *       project-delete-button → project-remove-button (accessible name kept),
 *       search input removed entirely. Everything else identical.
 *   v3  behavior bug: DELETE /api/projects/:id returns 204 but does NOT
 *       remove the project. DOM identical to v1.
 */

'use strict';
const http = require('node:http');
const crypto = require('node:crypto');

const PORT = parseInt(process.env.PORT || '4173', 10);
const VARIANT = process.env.APP_VARIANT || 'v1';
if (!['v1', 'v2', 'v3'].includes(VARIANT)) {
  console.error(`Unknown APP_VARIANT: ${VARIANT} (use v1|v2|v3)`);
  process.exit(1);
}

// ─── State (in-memory, reset via POST /api/reset) ─────────────────────────

const USER = { email: 'qa@acme.test', password: 'demo123', name: 'QA Buddy', role: 'admin' };
const sessions = new Set();
let projects, nextId;

function seed() {
  nextId = 3;
  projects = [
    { id: 1, name: 'Website Redesign', status: 'active', createdAt: '2026-07-01' },
    { id: 2, name: 'Mobile App', status: 'paused', createdAt: '2026-07-15' },
  ];
}
seed();

// ─── Variant knobs ─────────────────────────────────────────────────────────

const ROW_TESTID = VARIANT === 'v2' ? 'project-list-row' : 'project-row';
const DELETE_TESTID = VARIANT === 'v2' ? 'project-remove-button' : 'project-delete-button';
const HAS_SEARCH = VARIANT !== 'v2';
const DELETE_IS_BROKEN = VARIANT === 'v3';

// Artificial latency on list fetch — makes real waiting necessary.
const LIST_LATENCY_MS = 120;
// Delay between a successful mutation response and the list re-render.
// TRAP: response received ≠ row rendered.
const RERENDER_DELAY_MS = 350;
// TRAP: toasts auto-dismiss — asserting on them races.
const TOAST_DISMISS_MS = 1500;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

function authed(req) {
  return sessions.has(getCookies(req).sid);
}

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object';
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json' : 'text/html; charset=utf-8',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

// ─── Pages ─────────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { font: 15px/1.5 system-ui, sans-serif; background: #f5f6f8; color: #1a1d21; }
  .page { max-width: 720px; margin: 40px auto; padding: 0 16px; }
  h1 { font-size: 22px; margin-bottom: 16px; }
  input, button { font: inherit; padding: 8px 12px; border-radius: 6px; border: 1px solid #c9ced6; }
  button { background: #2b5fd9; color: #fff; border: 0; cursor: pointer; }
  button.ghost { background: #fff; color: #1a1d21; border: 1px solid #c9ced6; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eceef1; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
  .toolbar .spacer { flex: 1; }
  .dd { position: relative; padding: 8px 12px; background: #fff; border: 1px solid #c9ced6;
        border-radius: 6px; cursor: pointer; user-select: none; }
  .dd .opts { display: none; position: absolute; top: 110%; left: 0; background: #fff;
        border: 1px solid #c9ced6; border-radius: 6px; min-width: 120px; z-index: 5; }
  .dd.open .opts { display: block; }
  .dd .opts div { padding: 8px 12px; }
  .dd .opts div:hover { background: #eef2fb; }
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #1a1d21; color: #fff; padding: 10px 18px; border-radius: 8px; }
  .toast.error { background: #c0392b; }
  .empty { color: #6b7280; padding: 24px; text-align: center; background: #fff; border-radius: 8px; }
  .backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.35); }
  .backdrop.open { display: flex; align-items: center; justify-content: center; }
  .modal { background: #fff; border-radius: 10px; padding: 24px; width: 340px; }
  .modal h2 { font-size: 17px; margin-bottom: 12px; }
  .modal .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .err { color: #c0392b; margin-top: 8px; }
`;

function loginPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Acme Projects — Sign in</title>
<style>${CSS}</style></head><body>
<div class="page" style="max-width:360px">
  <h1>Sign in</h1>
  <form id="f" style="display:flex;flex-direction:column;gap:10px">
    <input data-testid="login-email" type="email" placeholder="Email" autocomplete="username">
    <input data-testid="login-password" type="password" placeholder="Password" autocomplete="current-password">
    <button data-testid="login-submit" type="submit">Sign in</button>
    <p class="err" data-testid="login-error" hidden>Invalid email or password</p>
  </form>
</div>
<script>
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.querySelector('[data-testid="login-email"]').value;
    const password = document.querySelector('[data-testid="login-password"]').value;
    const r = await fetch('/api/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }) });
    if (r.ok) location.href = '/projects';
    else document.querySelector('[data-testid="login-error"]').hidden = false;
  });
</script></body></html>`;
}

function projectsPage() {
  // NOTE (intentional testability gaps — see ANSWER-KEY.md):
  //  - search input: no data-testid, no label, no placeholder → no stable hook
  //  - status filter: div-based dropdown, no role, no testid
  //  - empty state: bare <p>, text match only
  //  - toast: no testid, auto-dismisses
  const searchHtml = HAS_SEARCH ? `<input class="s" type="text">` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Acme Projects</title>
<style>${CSS}</style></head><body>
<div class="page">
  <h1>Projects</h1>
  <div class="toolbar">
    ${searchHtml}
    <div class="dd" id="filter"><span id="filter-label">All</span>
      <div class="opts">
        <div data-v="all">All</div><div data-v="active">Active</div><div data-v="paused">Paused</div>
      </div>
    </div>
    <div class="spacer"></div>
    <button data-testid="new-project-button">New project</button>
  </div>
  <div id="list"></div>
</div>

<div class="backdrop" id="create-backdrop">
  <div class="modal">
    <h2>New project</h2>
    <input data-testid="project-name-input" type="text" placeholder="Project name" style="width:100%">
    <div class="row">
      <button class="ghost" id="create-cancel" type="button">Cancel</button>
      <button data-testid="project-create-submit" type="button">Create</button>
    </div>
  </div>
</div>

<!-- Confirm dialog: always attached, hidden until a row delete is clicked.
     TRAP: its "Delete" button shares an accessible name with every row's
     delete button — and it counts as a hidden-but-attached duplicate. -->
<div class="backdrop" id="confirm-backdrop">
  <div class="modal">
    <h2>Delete this project?</h2>
    <p id="confirm-name" style="color:#6b7280"></p>
    <div class="row">
      <button class="ghost" id="confirm-cancel" type="button">Keep</button>
      <button id="confirm-yes" type="button">Delete</button>
    </div>
  </div>
</div>

<script>
  const listEl = document.getElementById('list');
  let all = [];
  let search = '';
  let statusFilter = 'all';
  let pendingDeleteId = null;

  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function render() {
    const rows = all
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .filter((p) => statusFilter === 'all' || p.status === statusFilter);
    if (rows.length === 0) {
      listEl.innerHTML = '<p class="empty">No projects yet</p>';
      return;
    }
    listEl.innerHTML = '<table><thead><tr><th>Name</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>'
      + rows.map((p) => '<tr data-testid="${ROW_TESTID}" data-id="' + p.id + '">'
        + '<td>' + esc(p.name) + '</td><td>' + p.status + '</td><td>' + p.createdAt + '</td>'
        + '<td><button class="ghost" data-testid="${DELETE_TESTID}">Delete</button></td></tr>').join('')
      + '</tbody></table>';
  }

  async function load() {
    const r = await fetch('/api/projects');
    if (r.status === 401) { location.href = '/login'; return; }
    all = (await r.json()).projects;
    render();
  }

  function toast(msg, isError) {
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ${TOAST_DISMISS_MS});
  }

  ${HAS_SEARCH ? `document.querySelector('.s').addEventListener('input', (e) => { search = e.target.value; render(); });` : ''}

  const dd = document.getElementById('filter');
  dd.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-v]');
    if (opt) {
      statusFilter = opt.dataset.v;
      document.getElementById('filter-label').textContent = opt.textContent;
      dd.classList.remove('open');
      render();
      e.stopPropagation();
      return;
    }
    dd.classList.toggle('open');
  });

  document.querySelector('[data-testid="new-project-button"]').addEventListener('click', () => {
    document.getElementById('create-backdrop').classList.add('open');
    document.querySelector('[data-testid="project-name-input"]').value = '';
  });
  document.getElementById('create-cancel').addEventListener('click', () => {
    document.getElementById('create-backdrop').classList.remove('open');
  });

  document.querySelector('[data-testid="project-create-submit"]').addEventListener('click', async () => {
    const name = document.querySelector('[data-testid="project-name-input"]').value;
    const r = await fetch('/api/projects', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (r.status === 201) {
      document.getElementById('create-backdrop').classList.remove('open');
      toast('Project created');
      // TRAP: the list re-renders well after the POST response resolves.
      setTimeout(load, ${RERENDER_DELAY_MS});
    } else {
      const body = await r.json();
      toast(body.error || 'Something went wrong', true);
    }
  });

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-testid="${DELETE_TESTID}"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    pendingDeleteId = parseInt(tr.dataset.id, 10);
    document.getElementById('confirm-name').textContent = tr.children[0].textContent;
    document.getElementById('confirm-backdrop').classList.add('open');
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-backdrop').classList.remove('open');
  });
  document.getElementById('confirm-yes').addEventListener('click', async () => {
    const r = await fetch('/api/projects/' + pendingDeleteId, { method: 'DELETE' });
    document.getElementById('confirm-backdrop').classList.remove('open');
    if (r.status === 204) {
      toast('Project deleted');
      setTimeout(load, ${RERENDER_DELAY_MS});
    } else {
      toast('Delete failed', true);
    }
  });

  load();
</script></body></html>`;
}

// ─── Server ────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // API
  if (p === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await readBody(req);
    if (email === USER.email && password === USER.password) {
      const sid = crypto.randomBytes(16).toString('hex');
      sessions.add(sid);
      return send(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; Path=/; HttpOnly` });
    }
    return send(res, 401, { error: 'Invalid credentials' });
  }

  if (p === '/api/reset' && req.method === 'POST') {
    // Eval-harness hook: deterministic state between fixtures. Not part of the
    // "real app" surface — skills must not depend on it existing elsewhere.
    seed();
    return send(res, 200, { ok: true, variant: VARIANT });
  }

  if (p.startsWith('/api/')) {
    if (!authed(req)) return send(res, 401, { error: 'Not authenticated' });

    if (p === '/api/me' && req.method === 'GET') {
      return send(res, 200, { email: USER.email, name: USER.name, role: USER.role });
    }

    if (p === '/api/projects' && req.method === 'GET') {
      return setTimeout(() => send(res, 200, { projects }), LIST_LATENCY_MS);
    }

    if (p === '/api/projects' && req.method === 'POST') {
      const { name } = await readBody(req);
      if (!name || !name.trim()) return send(res, 400, { error: 'Name is required' });
      if (projects.some((x) => x.name === name.trim())) {
        return send(res, 409, { error: 'Name already exists' });
      }
      const proj = {
        id: nextId++,
        name: name.trim(),
        status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      projects.push(proj);
      return send(res, 201, proj);
    }

    const del = p.match(/^\/api\/projects\/(\d+)$/);
    if (del && req.method === 'DELETE') {
      const id = parseInt(del[1], 10);
      const idx = projects.findIndex((x) => x.id === id);
      if (idx === -1) return send(res, 404, { error: 'Not found' });
      if (!DELETE_IS_BROKEN) projects.splice(idx, 1); // v3: lies with a 204
      return send(res, 204, '');
    }

    return send(res, 404, { error: 'Not found' });
  }

  // Pages
  if (p === '/login') return send(res, 200, loginPage());
  if (p === '/' || p === '/projects') {
    if (!authed(req)) return send(res, 302, '', { Location: '/login' });
    return send(res, 200, projectsPage());
  }

  return send(res, 404, '<h1>404</h1>');
});

server.listen(PORT, () => {
  console.log(`Acme Projects (fixture app) — variant ${VARIANT} — http://localhost:${PORT}`);
});
