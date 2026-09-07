#!/usr/bin/env node
// Render the prompt for one phase: header + phase body (+ the consumer's extra-prompt file,
// if present), with {{PR}} {{PHASE}} {{FEATURES}} {{BASE_URL}} {{BASE_SHA}} filled from env.
// Usage: render.js <kb|explore|automate> [extra-prompt path]   → prompt on stdout
'use strict';
const fs = require('fs');
const path = require('path');
const phase = process.argv[2];
if (!['kb', 'explore', 'automate'].includes(phase)) { console.error('render.js: phase must be kb|explore|automate'); process.exit(2); }
const dir = path.join(__dirname, 'prompts');
let text = fs.readFileSync(path.join(dir, 'header.md'), 'utf8');
const extra = process.argv[3];
if (extra && fs.existsSync(extra)) text += '\n' + fs.readFileSync(extra, 'utf8').trim() + '\n\n';
text += fs.readFileSync(path.join(dir, `${phase}.md`), 'utf8');
const vars = { PHASE: phase, PR: process.env.PR, FEATURES: process.env.FEATURES, BASE_URL: process.env.BASE_URL, BASE_SHA: process.env.BASE_SHA };
for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v || '');
process.stdout.write(text);
