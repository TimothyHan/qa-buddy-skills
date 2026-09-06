#!/usr/bin/env node
/**
 * QABuddy — Test
 *
 * Structural validation for skills, playbook, and build output.
 * Zero dependencies. Run after `node build.js all`.
 *
 * Usage:
 *   node test.js              Run all checks
 *   node test.js --verbose    Show passing checks too
 */

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CORE_DIR = path.join(ROOT, 'core');
const DIST_DIR = path.join(ROOT, 'dist');
const LOCALES_DIR = path.join(ROOT, 'locales');
const PLATFORMS = ['claude', 'cursor', 'copilot'];
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;
const failures = [];

function pass(msg) {
  passed++;
  if (VERBOSE) console.log(`  ✓ ${msg}`);
}

function fail(msg, detail) {
  failed++;
  failures.push({ msg, detail });
  console.log(`  ✗ ${msg}`);
  if (detail) console.log(`    → ${detail}`);
}

function check(condition, msg, detail) {
  if (condition) pass(msg);
  else fail(msg, detail || '');
}

// ─── Helpers ────────────────────────────────────────────────────────────

function readFile(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function getSkillDirs() {
  const skillsDir = path.join(CORE_DIR, 'skills');
  return fs.readdirSync(skillsDir)
    .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
    .sort();
}

function parseFrontmatter(content) {
  // Keep in sync with build.js: normalize CRLF checkouts (Windows autocrlf)
  content = content.replace(/\r\n/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { raw: '', body: content, fields: {} };
  const raw = match[1];
  const body = match[2];
  const fields = {};
  for (const line of raw.split('\n')) {
    const kv = line.match(/^([a-z][\w-]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return { raw, body, fields };
}

// ─── Test Suites ────────────────────────────────────────────────────────

// A build may live at dist/<platform>/ (en) or dist/<locale>/<platform>/
// (e.g. `node build.js all --locale ko`). Either satisfies the build checks.
function resolvePlatformDir(platform) {
  const direct = path.join(DIST_DIR, platform);
  if (fs.existsSync(direct)) return direct;
  if (fs.existsSync(DIST_DIR)) {
    for (const entry of fs.readdirSync(DIST_DIR)) {
      const candidate = path.join(DIST_DIR, entry, platform);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return direct;
}

function testBuildOutput() {
  console.log('\n📦 Build Output');

  for (const platform of PLATFORMS) {
    const platformDir = resolvePlatformDir(platform);
    check(
      fs.existsSync(platformDir),
      `dist/${platform}/ exists (any locale)`,
      `Run "node build.js all" (or --locale ko) first`
    );

    if (!fs.existsSync(platformDir)) continue;

    const skillsDir = path.join(platformDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir);
      check(
        skills.length >= 11,
        `dist/${platform}/skills/ has ${skills.length} skills (≥11)`,
        `Expected 11+, got ${skills.length}`
      );
    }
  }
}

function testSkillStructure() {
  console.log('\n📋 Skill Structure');

  const skills = getSkillDirs();
  const requiredFrontmatter = ['name', 'version', 'description'];

  for (const skill of skills) {
    const filePath = path.join(CORE_DIR, 'skills', skill, 'SKILL.md');
    const content = readFile(filePath);

    if (!content) {
      fail(`${skill}/SKILL.md exists`, 'File not found');
      continue;
    }

    const lines = content.split('\n').length;
    const { raw, body, fields } = parseFrontmatter(content);

    // Line budget
    if (skill === 'exploratory') {
      // Known over-budget — warn instead of fail
      if (lines > 300) {
        check(false, `${skill}: ${lines} lines (known over-budget, needs trim)`);
      }
    } else {
      check(lines <= 300, `${skill}: ${lines} lines (≤300)`, `${lines} lines — over budget`);
    }

    // Required frontmatter
    for (const field of requiredFrontmatter) {
      check(
        fields[field] !== undefined || raw.includes(`${field}:`),
        `${skill}: has frontmatter "${field}"`,
        `Missing "${field}" in frontmatter`
      );
    }

    // tool-groups
    check(
      raw.includes('tool-groups:'),
      `${skill}: has tool-groups`,
      'Missing tool-groups in frontmatter'
    );

    // preamble-tier
    check(
      raw.includes('preamble-tier:'),
      `${skill}: has preamble-tier`,
      'Missing preamble-tier in frontmatter'
    );

    // Constraints at top (before Phase 1)
    const constraintsPos = body.indexOf('## Constraints');
    const phase1Pos = body.indexOf('## Phase 1');
    if (constraintsPos >= 0 && phase1Pos >= 0) {
      check(
        constraintsPos < phase1Pos,
        `${skill}: Constraints before Phase 1`,
        'Constraints section should be before Phase 1'
      );
    } else if (skill !== 'setup' && skill !== 'start') {
      // setup and start may not have Phase 1 labeled the same way
      check(
        constraintsPos >= 0,
        `${skill}: has Constraints section`,
        'Missing ## Constraints section'
      );
    }

    // Self-evaluation (setup and start are wizard-style, not traditional phases)
    const selfEvalExempt = ['setup', 'start', 'eval'];
    if (!selfEvalExempt.includes(skill)) {
      const hasSelfEval = body.includes('Self-Evaluation') || body.includes('Self-evaluation');
      check(
        hasSelfEval,
        `${skill}: has self-evaluation`,
        'Missing self-evaluation phase'
      );
    }

    // Completion status
    const hasCompletionStatus = body.includes('**Status:** DONE');
    check(
      hasCompletionStatus,
      `${skill}: has completion status block`,
      'Missing **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT'
    );
  }
}

function testNoStalePaths() {
  console.log('\n🔍 Stale Paths');

  const skills = getSkillDirs();
  for (const skill of skills) {
    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md'));
    if (!content) continue;

    check(
      !content.includes('features-kb/epics/'),
      `${skill}: no features-kb/epics/ (legacy)`,
      'Found features-kb/epics/ — use features-kb/features/'
    );
  }

  // Check preamble
  const preamble = readFile(path.join(CORE_DIR, 'preamble-base.md')) || '';
  check(
    !preamble.includes('features-kb/epics/'),
    'preamble-base: no features-kb/epics/',
    'Found features-kb/epics/ in preamble'
  );
}

function testNoRawPlaceholders() {
  console.log('\n🔗 Placeholder Substitution');

  for (const platform of PLATFORMS) {
    const skillsDir = path.join(resolvePlatformDir(platform), 'skills');
    if (!fs.existsSync(skillsDir)) continue;

    const skills = fs.readdirSync(skillsDir);
    for (const skill of skills) {
      const content = readFile(path.join(skillsDir, skill, 'SKILL.md'));
      if (!content) continue;

      check(
        !content.includes('{{REFERENCE_PATH}}'),
        `dist/${platform}/${skill}: no raw {{REFERENCE_PATH}}`,
        'Placeholder not substituted — check build.js'
      );
    }
  }
}

function testCrossPlatformConsistency() {
  console.log('\n🔄 Cross-Platform Consistency');

  const skillsDir = path.join(CORE_DIR, 'skills');
  const skills = getSkillDirs();

  for (const skill of skills) {
    const bodies = {};
    for (const platform of PLATFORMS) {
      const content = readFile(path.join(DIST_DIR, platform, 'skills', skill, 'SKILL.md'));
      if (!content) continue;

      const { body } = parseFrontmatter(content);
      // Normalize reference paths for comparison
      const normalized = body
        .replace(/~\/\.claude\/skills\/qa-references/g, 'REF')
        .replace(/~\/\.cursor\/skills\/qa-references/g, 'REF')
        .replace(/\.github\/skills\/qa-references/g, 'REF');
      bodies[platform] = normalized;
    }

    const platforms = Object.keys(bodies);
    if (platforms.length < 2) continue;

    const first = bodies[platforms[0]];
    for (let i = 1; i < platforms.length; i++) {
      check(
        bodies[platforms[i]] === first,
        `${skill}: ${platforms[0]} = ${platforms[i]}`,
        `Body content differs between platforms`
      );
    }
  }
}

function testKoreanCompleteness() {
  console.log('\n🇰🇷 Korean Locale');

  const koDir = path.join(LOCALES_DIR, 'ko');
  if (!fs.existsSync(koDir)) {
    fail('locales/ko/ exists', 'Korean locale directory not found');
    return;
  }

  const skills = getSkillDirs();
  for (const skill of skills) {
    const koPath = path.join(koDir, 'skills', skill, 'SKILL.md');
    check(
      fs.existsSync(koPath),
      `ko/${skill}/SKILL.md exists`,
      'Missing Korean translation'
    );
  }

  // Check preambles
  check(
    fs.existsSync(path.join(koDir, 'preamble-base.md')),
    'ko/preamble-base.md exists',
    'Missing Korean preamble-base'
  );
  check(
    fs.existsSync(path.join(koDir, 'preamble-full.md')),
    'ko/preamble-full.md exists',
    'Missing Korean preamble-full'
  );
  check(
    fs.existsSync(path.join(koDir, 'project-instructions.md')),
    'ko/project-instructions.md exists',
    'Missing Korean project-instructions'
  );
}

function testPlaybookBudget() {
  console.log('\n📖 Playbook');

  const playbookDir = path.join(CORE_DIR, 'references', 'playbook');
  if (!fs.existsSync(playbookDir)) {
    fail('playbook/ exists', 'Playbook directory not found');
    return;
  }

  const files = fs.readdirSync(playbookDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = readFile(path.join(playbookDir, file));
    if (!content) continue;
    // `<!-- qab: … -->` lines are section metadata (RFC 0001 §3.1), not model-facing
    // knowledge — the compiler strips them from slices — so they don't count against the budget.
    const lines = content.split('\n').filter(l => !/^<!--\s*qab:/.test(l)).length;
    check(
      lines <= 70,
      `playbook/${file}: ${lines} lines (≤70, excluding qab metadata)`,
      `${lines} lines — over budget`
    );
  }

  // index.md's "Used by" column is hand-maintained (CONTRIBUTING "Adding new knowledge" step 4)
  // while the real routing lives in `qab: scope=`. Nothing used to compare them, so the column
  // silently went stale every time a section was rehomed or its scope widened. It is navigation —
  // excluded from qab tagging — so this is the only thing that can catch the drift.
  const { parseReferenceIndex } = require('./build.js');
  for (const [label, refDir] of [['core', path.join(CORE_DIR, 'references')],
                                 ['locales/ko', path.join(LOCALES_DIR, 'ko', 'references')]]) {
    const indexPath = path.join(refDir, 'playbook', 'index.md');
    const indexMd = readFile(indexPath);
    if (!indexMd) { fail(`${label}/references/playbook/index.md exists`, 'not found'); continue; }

    const scopeByFile = {};
    const parsed = parseReferenceIndex(refDir).index;
    for (const entry of Object.values(parsed)) {
      if (!entry.file.startsWith('playbook/')) continue;
      const stem = entry.file.slice('playbook/'.length);
      (scopeByFile[stem] = scopeByFile[stem] || new Set());
      for (const s of entry.scope) scopeByFile[stem].add(s);
    }

    // "All skills" / "모든 스킬" is how scope=all is spelled in the two locales.
    const ALL = ['All skills', '모든 스킬'];
    // The file also carries a team-practices table (project-specific files that live in
    // features-kb/, not here) — stop before it so those rows aren't judged against the index.
    const playbookTable = indexMd.split(/^##\s+(?:Team Practices|팀 프랙티스)/m)[0];
    for (const row of playbookTable.split('\n')) {
      const m = row.match(/^\|\s*`([a-z0-9-]+\.md)`\s*\|[^|]*\|([^|]*)\|\s*$/);
      if (!m) continue;
      const [, stem, cellRaw] = m;
      const scope = scopeByFile[stem];
      if (!scope) { fail(`${label} index.md row \`${stem}\` names a real playbook file`, 'no such file in the reference index'); continue; }
      const cell = cellRaw.trim();
      const expected = scope.has('all') ? null : [...scope].sort().join(', ');
      const ok = expected === null ? ALL.includes(cell) : cell === expected;
      check(ok, `${label} index.md "Used by" for ${stem} matches qab scope`,
            `index.md says "${cell}", qab scope is "${expected === null ? ALL.join('" / "') : expected}"`);
    }
  }
}

// Documentation states facts about this repo — how many skills there are, how big the
// preamble is, which commands exist. Every one of those was hand-maintained, and by #34
// every one had gone stale: `skills/ (14)` against 13, "11 skills each" against 13, a
// preamble budget of ~34 lines against an actual 89, a playbook count of 10 against 11,
// and a whole manual scenario for `/qa-sprint-status` two releases after #29 deleted it.
// The only numbers that were still right were the two a test enforced (≤300, ≤70).
// So: a documented fact that can be derived from the repo gets derived here.
// docs/rfc/ is deliberately out of scope — it is a historical record, and its claims are
// meant to describe the moment they were written, not today's tree.
function testDocClaims() {
  console.log('\n📄 Doc claims vs repo');

  const DOCS = ['README.md', 'README-ko.md', 'CONTRIBUTING.md', 'CONTRIBUTING-en.md'];
  const docs = DOCS.map(f => [f, readFile(path.join(ROOT, f))]).filter(([, s]) => s);
  check(docs.length === DOCS.length, `all ${DOCS.length} top-level docs present`,
        `missing: ${DOCS.filter(f => !readFile(path.join(ROOT, f))).join(', ')}`);

  const skills = getSkillDirs();
  const skillSet = new Set(skills);

  // ── 1. Every `/qa-<name>` command named in a doc or skill is a skill that exists.
  // Command form only: a `/qa-` preceded by a path character, or followed by `/`, is a
  // directory (`features-kb/…/qa-reports/`), not a command.
  const CMD = /(?<![.\w/}-])\/qa-([a-z0-9-]+)(?!\/)/g;
  const mdFiles = [...DOCS.map(f => path.join(ROOT, f)),
                   ...listMarkdown(path.join(ROOT, 'core')),
                   ...listMarkdown(path.join(ROOT, 'locales'))];
  const dangling = new Map();
  let cmdRefs = 0;
  for (const file of mdFiles) {
    const src = readFile(file);
    if (!src) continue;
    for (const m of src.matchAll(CMD)) {
      cmdRefs++;
      if (!skillSet.has(m[1])) {
        const rel = path.relative(ROOT, file);
        if (!dangling.has(rel)) dangling.set(rel, new Set());
        dangling.get(rel).add(`/qa-${m[1]}`);
      }
    }
  }
  check(cmdRefs > 0, `scanned ${cmdRefs} /qa-* command references across ${mdFiles.length} files`,
        'no command references found — the pattern probably stopped matching');
  check(dangling.size === 0, 'every /qa-* command named in docs and skills is a real skill',
        [...dangling].map(([f, s]) => `${f}: ${[...s].join(', ')}`).join(' | '));

  // ── 2-4. Counts that docs state and the repo can prove.
  const playbookDir = path.join(CORE_DIR, 'references', 'playbook');
  const playbookFiles = fs.existsSync(playbookDir)
    ? fs.readdirSync(playbookDir).filter(f => f.endsWith('.md') && !['index.md', 'README.md'].includes(f)).length
    : 0;
  // Count the way `wc -l` does — a trailing newline is a terminator, not an extra line —
  // so the number here is the number a contributor would read off their terminal.
  const countLines = f => {
    const src = readFile(path.join(CORE_DIR, f)) || '';
    const parts = src.split('\n');
    if (parts[parts.length - 1] === '') parts.pop();
    return parts.length;
  };
  const baseLines = countLines('preamble-base.md');
  const fullLines = countLines('preamble-full.md');

  const CLAIMS = [
    { label: 'skill count', expected: skills.length,
      patterns: [/skills\/ \((\d+)\)/g, /\((\d+) skills each\)/g, /각 (\d+)개 스킬/g,
                 /Skills-(\d+)-green/g, /Skills: (\d+)/g] },
    { label: 'playbook methodology file count', expected: playbookFiles,
      patterns: [/(\d+) methodology files/g, /(\d+)개 방법론 파일/g] },
    // Tier 1 = preamble-base; Tier 2 = base + full (build.js buildSkill concatenates them).
    { label: 'Tier 1 preamble size', expected: baseLines,
      patterns: [/Preamble \(Tier 1\) \| ~(\d+) (?:lines|줄)/g, /\| `1` \|[^|]*\((\d+) (?:lines|줄)\)/g] },
    { label: 'Tier 2 preamble size', expected: baseLines + fullLines,
      patterns: [/Preamble \(Tier 2\) \| ~(\d+) ?(?:lines|줄)/g, /\| `2` \|[^|]*\((\d+) (?:lines|줄)\)/g] },
  ];

  for (const claim of CLAIMS) {
    const found = [];
    for (const [file, src] of docs)
      for (const re of claim.patterns)
        for (const m of src.matchAll(re)) found.push({ file, value: Number(m[1]) });
    // A claim nobody states any more is a check that silently stopped working — fail loudly
    // rather than pass on zero matches.
    check(found.length > 0, `${claim.label}: stated in the docs (pattern still matches)`,
          'no occurrence found — reword or drop the check, do not leave it passing on nothing');
    const wrong = found.filter(f => f.value !== claim.expected);
    check(wrong.length === 0,
          `${claim.label}: all ${found.length} doc claims say ${claim.expected}`,
          wrong.map(f => `${f.file} says ${f.value}, repo has ${claim.expected}`).join(' | '));
  }

  // ── 5. Relative links resolve from the linking file's own directory.
  // Changelogs are link-checked but deliberately excluded from the command check above:
  // they name skills that were removed, on purpose — the same reason docs/rfc/ is excluded.
  const linkFiles = [...DOCS.map(f => path.join(ROOT, f)),
                     ...['CHANGELOG.md', 'CHANGELOG-en.md'].map(f => path.join(ROOT, f)),
                     ...listMarkdown(path.join(CORE_DIR, 'references'))];
  const broken = [];
  let links = 0;
  for (const file of linkFiles) {
    const src = readFile(file);
    if (!src) continue;
    for (const m of src.matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^https?:/.test(target)) continue;
      links++;
      if (!fs.existsSync(path.resolve(path.dirname(file), target)))
        broken.push(`${path.relative(ROOT, file)} → ${target}`);
    }
  }
  check(links > 0, `resolved ${links} relative .md links`, 'no links found — pattern broken');
  check(broken.length === 0, 'every relative .md link resolves', broken.join(' | '));
}

function listMarkdown(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listMarkdown(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function testPreambleTiers() {
  console.log('\n📐 Preamble Tiers');

  const skills = getSkillDirs();
  for (const skill of skills) {
    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md'));
    if (!content) continue;

    const { fields } = parseFrontmatter(content);
    const tier = fields['preamble-tier'];
    if (!tier) continue;

    // Check that tier 2 skills get severity tables in dist
    for (const platform of PLATFORMS) {
      const distContent = readFile(path.join(DIST_DIR, platform, 'skills', skill, 'SKILL.md'));
      if (!distContent) continue;

      // The severity/priority scales live in references/playbook/risk-and-priority.md ONLY and reach a
      // skill through the compiled slice. They used to be duplicated into the tier-2 preamble, where they
      // had no section id — so a skill read the copy, cited nothing, and #severity-scale looked dormant
      // (1/10) while setting the severity on every bug filed. No tier may inline them again.
      const hasSeverity = distContent.includes('Severity & Priority');
      check(!hasSeverity, `${skill} (tier ${tier}) on ${platform}: no inlined severity tables`);
    }
  }
}

function testConfigAwareness() {
  console.log('\n⚙️  Config Awareness');

  const skills = getSkillDirs();
  const skipSkills = ['setup', 'start', 'improve', 'eval']; // These handle config differently
  // e2e-pom/e2e-write read playwright/AUTOMATION.md — /e2e-setup owns their config
  skipSkills.push('e2e-pom', 'e2e-write');

  for (const skill of skills) {
    if (skipSkills.includes(skill)) continue;

    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md'));
    if (!content) continue;

    check(
      content.includes('.qabuddy.json') || content.includes('qabuddy'),
      `${skill}: reads .qabuddy.json`,
      'Missing config awareness — should read .qabuddy.json in Phase 1'
    );
  }
}

function testExcludeConditions() {
  console.log('\n🚫 Exclude Conditions');

  const skills = getSkillDirs();
  for (const skill of skills) {
    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md'));
    if (!content) continue;

    check(
      content.includes('Do NOT use when:'),
      `${skill}: has exclude conditions`,
      'Missing "Do NOT use when:" in description'
    );
  }
}

function testEvalFixtures() {
  console.log('\n🧪 Eval Fixtures');

  const VALID_OPS = [
    // simulate-mode ops
    'eq', 'contains', 'not_contains', 'length_eq', 'length_gte', 'matches', 'exists',
    // execute-mode ops (eval SKILL.md §2E: cmd:/files:/file:/count: fields)
    'exit_code', 'output_contains', 'output_matches', 'json_valid', 'lte',
  ];
  const skills = getSkillDirs();
  let totalFixtures = 0;

  for (const skill of skills) {
    const fixturePath = path.join(CORE_DIR, 'skills', skill, 'tests', 'fixtures.json');
    if (!fs.existsSync(fixturePath)) continue;

    let data;
    try {
      data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    } catch (e) {
      fail(`${skill}/tests/fixtures.json: valid JSON`, e.message);
      continue;
    }

    check(
      data.skill === skill,
      `${skill}: fixture skill field matches directory`,
      `Expected "${skill}", got "${data.skill}"`
    );

    check(
      Array.isArray(data.fixtures) && data.fixtures.length >= 1,
      `${skill}: has ${(data.fixtures || []).length} fixtures (≥1)`,
      'No fixtures defined'
    );

    for (const fx of (data.fixtures || [])) {
      check(
        fx.id && fx.description,
        `${skill}/${fx.id || '?'}: has id and description`,
        'Missing id or description'
      );

      check(
        Array.isArray(fx.assertions) && fx.assertions.length >= 1,
        `${skill}/${fx.id}: has assertions (≥1)`,
        'No assertions defined'
      );

      for (const a of (fx.assertions || [])) {
        check(
          VALID_OPS.includes(a.op),
          `${skill}/${fx.id}: op "${a.op}" is valid`,
          `Invalid operator. Use: ${VALID_OPS.join(', ')}`
        );
      }

      totalFixtures++;
    }
  }

  if (VERBOSE || totalFixtures > 0) {
    console.log(`  Total: ${totalFixtures} fixtures across all skills`);
  }
}

// ─── Rubrics (RFC 0005 PR1): schema, citations, controls, cases ─────────────
// A rubric is the contract a skill is graded against (docs/rfc/0005-rubric-scored-evals.md).
// Everything here is free and deterministic: shape, citation resolution against SKILL.md,
// one control per floored criterion, and — for check/process criteria — proof that the
// control actually fails its check (the eval's own mutation smoke). Judge criteria are
// graded by `eval.js` (PR2); here only their structure is checked.
function testRubrics() {
  console.log('\n📏 Rubrics (RFC 0005)');
  const KINDS = ['judge', 'check', 'process'];
  const OPS = ['contains', 'not_contains', 'matches', 'count_gte'];
  const FIELD_BY_KIND = { check: /^(files|file):/, process: /^(run|exec|log):/ };
  const stripHeader = (t) => t.replace(/^<!--\s*rubric-control:[^\n]*-->\n?/, '');
  const evalOp = (text, op, value) => {
    if (op === 'contains') return text.includes(value);
    if (op === 'not_contains') return !text.includes(value);
    if (op === 'matches') return new RegExp(value, 'm').test(text);
    if (op === 'count_gte') return (text.match(new RegExp(value.pattern, 'gm')) || []).length >= value.min;
    return false;
  };
  const controlFile = (dir, field) => {
    if (/^run:/.test(field)) return path.join(dir, field.slice(4));
    if (/^exec:/.test(field)) return path.join(dir, 'exec.jsonl');
    if (/^log:/.test(field)) return path.join(dir, 'learnings-log.jsonl');
    return null;
  };
  // Items under a heading until the next `## ` or `---`; numbered lists keep their number,
  // `- [ ]` lists are counted in order.
  const sectionItems = (md, headingRe) => {
    const lines = md.split('\n');
    const start = lines.findIndex(l => headingRe.test(l));
    if (start < 0) return null;
    const items = {}; let n = 0;
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^## /.test(l) || /^---\s*$/.test(l)) break;
      const num = l.match(/^(\d+)\.\s+(.*)/);
      const box = l.match(/^-\s*\[ \]\s+(.*)/);
      if (num) items[Number(num[1])] = num[2];
      else if (box) items[++n] = box[1];
    }
    return items;
  };
  let rubrics = 0;
  for (const skill of getSkillDirs()) {
    const tests = path.join(CORE_DIR, 'skills', skill, 'tests');
    const rp = path.join(tests, 'rubric.json');
    if (!fs.existsSync(rp)) continue;
    rubrics++;
    let r;
    try { r = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch (e) { fail(`${skill}: rubric.json parses`, e.message); continue; }
    const skillMd = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md')) || '';
    const { fields } = parseFrontmatter(skillMd);
    check(r.skill === skill, `${skill}: rubric skill field matches directory`);
    check(r.skill_version === fields.version, `${skill}: rubric skill_version ${r.skill_version} equals SKILL.md ${fields.version}`, 'bump the rubric when the skill changes');
    check(Number.isInteger(r.rubric_version) && r.rubric_version >= 1, `${skill}: rubric_version is an integer ≥ 1`);
    check(r.judge && /^claude-opus-/.test(String(r.judge.model)), `${skill}: judge.model is an Opus id, never the runner's model (RFC 0005 decision 15)`, String(r.judge && r.judge.model));
    check(r.judge && typeof r.judge.prompt === 'string' && r.judge.temperature === 0, `${skill}: judge has a prompt path and temperature 0`);
    check(r.threshold === null || (r.calibration && typeof r.threshold === 'number'), `${skill}: threshold is null unless calibration is present`);
    check(Array.isArray(r.artifacts) && r.artifacts.length > 0 && r.artifacts.every(g => typeof g === 'string' && g.length > 0), `${skill}: artifacts lists the globs the judge grades`);
    const constraints = sectionItems(skillMd, /^## Constraints/) || {};
    const selfChecks = sectionItems(skillMd, /^## .*Self-[Ee]valuation/) || {};
    check(Object.keys(constraints).length > 0 && Object.keys(selfChecks).length > 0, `${skill}: SKILL.md has numbered constraints (${Object.keys(constraints).length}) and self-checks (${Object.keys(selfChecks).length})`);
    const ids = new Set();
    const floored = [];
    for (const c of (r.criteria || [])) {
      const tag = `${skill}/${c.id || '?'}`;
      check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(c.id)) && !ids.has(c.id), `${tag}: id is kebab-case and unique`);
      ids.add(c.id);
      check(KINDS.includes(c.kind), `${tag}: kind is judge|check|process`, String(c.kind));
      check(Number.isInteger(c.weight) && c.weight >= 1 && c.weight <= 3, `${tag}: weight 1–3`);
      check(Number.isInteger(c.floor) && c.floor >= 0 && c.floor <= 3, `${tag}: floor 0–3`);
      check(typeof c.statement === 'string' && c.statement.length > 20, `${tag}: has a statement`);
      const cites = c.cites || {};
      const citesOk = (cites.constraint !== undefined || cites.self_check !== undefined)
        && (cites.constraint === undefined || constraints[cites.constraint] !== undefined)
        && (cites.self_check === undefined || selfChecks[cites.self_check] !== undefined);
      check(citesOk, `${tag}: cites resolve (constraint ${cites.constraint ?? '-'}, self_check ${cites.self_check ?? '-'})`, 'every criterion must cite a numbered constraint or self-check that exists in SKILL.md');
      if (c.kind === 'judge') {
        check(c.anchors && ['0', '1', '2', '3'].every(k => typeof c.anchors[k] === 'string' && c.anchors[k].length > 10), `${tag}: judge criterion has four anchors`);
        check(c.check === undefined, `${tag}: judge criterion has no check block`);
      } else {
        const ck = c.check || {};
        check(typeof ck.field === 'string' && FIELD_BY_KIND[c.kind].test(ck.field), `${tag}: ${c.kind} field prefix valid`, String(ck.field));
        check(OPS.includes(ck.op), `${tag}: op "${ck.op}" is valid`);
        check(ck.op === 'count_gte' ? (ck.value && ck.value.pattern && Number.isInteger(ck.value.min)) : typeof ck.value === 'string', `${tag}: check value shape matches op`);
        check(c.anchors === undefined, `${tag}: ${c.kind} criterion has no anchors`);
      }
      if (c.floor > 0) floored.push(c);
    }
    // cases
    const casesDir = path.join(tests, 'cases');
    const caseIds = fs.existsSync(casesDir) ? fs.readdirSync(casesDir).filter(d => fs.statSync(path.join(casesDir, d)).isDirectory()) : [];
    check(caseIds.length >= 3, `${skill}: has ${caseIds.length} cases (≥ 3)`);
    for (const id of caseIds) {
      const cd = path.join(casesDir, id);
      let cj = null;
      try { cj = JSON.parse(fs.readFileSync(path.join(cd, 'case.json'), 'utf8')); } catch (e) { fail(`${skill}/cases/${id}: case.json parses`, e.message); continue; }
      check(cj.id === id, `${skill}/cases/${id}: id matches directory`);
      check([null, 'v1', 'v2', 'v3'].includes(cj.app) && Number.isInteger(cj.port) && typeof cj.runner_args === 'string' && cj.runner_args.length > 0, `${skill}/cases/${id}: app/port/runner_args valid`);
      const inputs = listMarkdown(path.join(cd, 'input')).concat(walkAll(path.join(cd, 'input')));
      check(inputs.length > 0, `${skill}/cases/${id}: input/ is non-empty`);
      const notes = readFile(path.join(cd, 'judge-notes.md'));
      if (notes) {
        const secrets = notes.split('\n').map(l => l.trim()).filter(l => l.length >= 24 && !/^(#|<!--)/.test(l));
        const inputText = inputs.map(f => readFile(f) || '').join('\n');
        const leaked = secrets.filter(l => inputText.includes(l));
        check(leaked.length === 0, `${skill}/cases/${id}: judge-notes never appear in input/ (ANSWER-KEY rule)`, leaked[0]);
      }
    }
    // controls
    const controlsDir = path.join(tests, 'controls');
    const controlNames = fs.existsSync(controlsDir) ? fs.readdirSync(controlsDir) : [];
    for (const c of floored) {
      const md = path.join(controlsDir, `${c.id}.md`);
      const dir = path.join(controlsDir, c.id);
      const isDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
      check(fs.existsSync(md) || isDir, `${skill}/${c.id}: floored criterion has a control`, `add tests/controls/${c.id}.md or tests/controls/${c.id}/`);
      if (fs.existsSync(md)) {
        const text = fs.readFileSync(md, 'utf8');
        const h = text.match(/^<!--\s*rubric-control:\s*criterion=(\S+)\s+case=(\S+)\s+expect=below-floor\s*-->/);
        check(h && h[1] === c.id && caseIds.includes(h[2]), `${skill}/${c.id}: control header names the criterion and an existing case`, h ? `${h[1]} / ${h[2]}` : 'missing header');
        if (c.kind === 'check') check(!evalOp(stripHeader(text), c.check.op, c.check.value), `${skill}/${c.id}: control fails its check (detection power)`, 'the control passed — it does not break the graded thing');
      }
      if (c.kind === 'process') {
        const f = isDir ? controlFile(dir, c.check.field) : null;
        check(f && fs.existsSync(f), `${skill}/${c.id}: process control holds ${c.check.field}`);
        if (f && fs.existsSync(f)) check(!evalOp(stripHeader(fs.readFileSync(f, 'utf8')), c.check.op, c.check.value), `${skill}/${c.id}: process control fails its check (detection power)`);
      }
    }
    for (const name of controlNames) {
      const id = name.replace(/\.md$/, '');
      check(ids.has(id), `${skill}: control "${name}" belongs to a criterion`, 'stale control');
    }
    // calibration set (PR3): entries are well-formed; a calibrated rubric carries the evidence it gated on
    const calDir = path.join(tests, 'calibration');
    const judgeIds = (r.criteria || []).filter(c => c.kind === 'judge').map(c => c.id);
    if (fs.existsSync(calDir)) {
      const entries = fs.readdirSync(calDir).filter(d => fs.statSync(path.join(calDir, d)).isDirectory());
      for (const id of entries) {
        const ed = path.join(calDir, id);
        let meta = null, human = null;
        try { meta = JSON.parse(fs.readFileSync(path.join(ed, 'meta.json'), 'utf8')); human = JSON.parse(fs.readFileSync(path.join(ed, 'human.json'), 'utf8')); } catch (e) { fail(`${skill}/calibration/${id}: meta.json and human.json parse`, e.message); continue; }
        check(meta.id === id && ['control', 'eval-run', 'external'].includes(meta.source) && (meta.case === null || caseIds.includes(meta.case)), `${skill}/calibration/${id}: meta names a source and an existing case`);
        check(walkAll(path.join(ed, 'artifact')).length + listMarkdown(path.join(ed, 'artifact')).length > 0, `${skill}/calibration/${id}: artifact/ is non-empty`);
        const hs = human.scores || {};
        check(judgeIds.every(k => k in hs) && Object.keys(hs).every(k => judgeIds.includes(k)), `${skill}/calibration/${id}: human.json scores keyed by the judge criteria`);
        check(Object.values(hs).every(v => v === null || (Number.isInteger(v) && v >= 0 && v <= 3)) && [null, true, false].includes(human.acceptable), `${skill}/calibration/${id}: human scores are null or 0–3, acceptable is null or boolean`);
        check(fs.existsSync(path.join(ed, 'scoring-sheet.md')), `${skill}/calibration/${id}: scoring-sheet.md present`);
      }
    }
    if (r.calibration) {
      const c = r.calibration;
      check(typeof r.threshold === 'number' && r.threshold > 0 && r.threshold <= 1, `${skill}: calibrated threshold is a number in (0, 1]`);
      check(Number.isInteger(c.human_scored) && c.human_scored >= 10, `${skill}: calibration has ≥ 10 human-scored artifacts (${c.human_scored})`);
      check(judgeIds.every(id => typeof c.agreement[id] === 'number' && c.agreement[id] >= 0.8), `${skill}: calibration agreement ≥ 0.8 on every judge criterion`);
      check(judgeIds.filter(id => (r.criteria.find(x => x.id === id) || {}).floor > 0).every(id => c.floor_agreement[id] === 1), `${skill}: calibration floor agreement is 1.0 on every floored judge criterion`);
      check(c.judge === r.judge.model, `${skill}: calibration was done with the rubric's pinned judge`);
    }
  }
  // eval.js (PR2): help exits 0; report renders the per-criterion table and the spread line from a sample scores.json. No model calls.
  {
    const { spawnSync } = require('child_process');
    const help = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'eval.js'), '--help'], { encoding: 'utf8' });
    check(help.status === 0 && /controls <skill>/.test(help.stdout) && /ab <skill> --a/.test(help.stdout) && /calibrate <skill>/.test(help.stdout), 'eval.js --help exits 0 and lists run/controls/judge/report/calibrate/ab');
    check(fs.existsSync(path.join(ROOT, '.github', 'workflows', 'skill-eval.yml')) && /workflow_dispatch/.test(readFile(path.join(ROOT, '.github', 'workflows', 'skill-eval.yml')) || '') && /eval\.js ab/.test(readFile(path.join(ROOT, '.github', 'workflows', 'skill-eval.yml')) || ''), 'skill-eval.yml is a manual-dispatch workflow that runs eval.js ab');
    const rep = spawnSync(process.execPath, [path.join(ROOT, 'bin', 'eval.js'), 'report', path.join(CORE_DIR, 'skills', 'eval', 'tests', 'sample-scores.json')], { encoding: 'utf8' });
    check(rep.status === 0 && /\| alpha \| judge \| 3 \| 2 \| 2\.00 \| 1 \| 3 \| 1 \|/.test(rep.stdout), 'eval.js report renders the per-criterion table (mean/min/max/breaches)', (rep.stdout || rep.stderr).slice(0, 200));
    check(/spread 0\.5/.test(rep.stdout) && /REPORT-ONLY/.test(rep.stdout) && /VACUOUS|✓/.test(rep.stdout), 'eval.js report carries the spread line, the verdict and the controls table');
    for (const f of ['judge.md', 'eval-headless.md', 'mcp.json']) check(fs.existsSync(path.join(CORE_DIR, 'skills', 'eval', f)), `core/skills/eval/${f} shipped for eval.js`);
    check(/JSON only/.test(readFile(path.join(CORE_DIR, 'skills', 'eval', 'judge.md')) || '') && !/SKILL\.md/.test(readFile(path.join(CORE_DIR, 'skills', 'eval', 'judge.md')) || ''), 'judge prompt demands JSON and never mentions SKILL.md (judge never sees the procedure)');
  }
  console.log(`  Total: ${rubrics} rubrics`);
}

function walkAll(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walkAll(p, acc);
    else if (!/\.md$/.test(e)) acc.push(p);
  }
  return acc;
}

// The README badge states the size of this suite. It is the one documented number that
// cannot be derived up front — the total is only known once every check has run — so it
// used to be the number most likely to rot silently (CONTRIBUTING sat at 1137 while the
// suite was at 1105). Running it last makes it exact: everything counted so far, plus this
// check itself. It still takes a human edit when you add a check, but now CI names the new
// number instead of letting the old one drift for five releases.
function testBadgeCount() {
  console.log('\n🔢 Suite size badge');
  // The total is only meaningful for a full run. CI also runs this suite against a ko-only
  // dist (before the en build), where every dist-dependent check is skipped and the count is
  // ~74 lower — asserting the badge there would compare the README against a partial run.
  // Emit nothing at all in that state: a check here would itself change the number.
  if (!fs.existsSync(path.join(DIST_DIR, 'claude'))) {
    console.log('  – skipped: partial dist (en build not present), suite size not comparable');
    return;
  }
  // Exactly one check, so the total it asserts is unambiguous: everything counted before
  // this function, plus this single check.
  const total = passed + failed + 1;
  const BADGE = /Structural_checks-(\d+)-brightgreen/;
  const problems = [];
  for (const f of ['README.md', 'README-ko.md']) {
    const src = readFile(path.join(ROOT, f));
    if (!src) { problems.push(`${f}: not found`); continue; }
    const badge = src.match(BADGE);
    if (!badge) { problems.push(`${f}: badge pattern no longer matches`); continue; }
    if (Number(badge[1]) !== total) problems.push(`${f}: badge says ${badge[1]}`);
    // The number also appears twice in prose; keep all three in step.
    const stale = [...src.matchAll(/(\d+)(?= structural checks| checks\)|개 구조 검사)/g)]
      .map(m => Number(m[1])).filter(n => n !== total);
    if (stale.length) problems.push(`${f}: prose says ${[...new Set(stale)].join(', ')}`);
  }
  check(problems.length === 0, `README check-count badge and prose say ${total}`,
        `${problems.join(' | ')} — suite runs ${total}`);
}


// ─── Akela equivalence harness (RFC 0003, PR A) ──────────────────────────
//
// Proves the in-tree engine (shipped qab.js) and the pinned npm engine (akela)
// make the SAME selection on the committed fixture (test-fixtures/equivalence).
// Documented deltas (RFC 0003 §2) are stripped before comparison: the manifest
// header lines (run/skill/activity/pfp/profile/compiler), the budget comment
// wording, and PRJ placement order (set-compared where PRJ is configured).
// This harness is the measurement that CONTRIBUTING's "changing the compiler"
// rule demands for the migration: it must stay green through PR B and the
// cutover, and it dies loudly — never skips — when the engine is missing.
function testAkelaEquivalence() {
  console.log('\n⚖️  Akela equivalence (RFC 0003)');
  const { execFileSync, spawnSync } = require('child_process');
  const os = require('os');

  // 1 · dependency contract
  const pkg = JSON.parse(readFile(path.join(ROOT, 'package.json')) || '{}');
  const pin = pkg.dependencies && pkg.dependencies.akela;
  check(/^\d+\.\d+\.\d+$/.test(pin || ''), 'package.json pins akela to an exact version', `got: ${pin}`);
  const akelaPkgPath = path.join(ROOT, 'node_modules', 'akela', 'package.json');
  check(fs.existsSync(akelaPkgPath), 'node_modules/akela is installed (run: npm ci)',
        'the equivalence harness needs the pinned engine — npm ci, then rerun');
  if (!fs.existsSync(akelaPkgPath)) return;
  const akelaVer = JSON.parse(fs.readFileSync(akelaPkgPath, 'utf8')).version;
  check(akelaVer === pin, `installed akela ${akelaVer} matches the pin`, `pin says ${pin}`);
  const akelaBin = path.join(ROOT, 'node_modules', 'akela', 'bin', 'akela.js');

  const refsDir = path.join(resolvePlatformDir('claude'), 'references');
  const qabBin = path.join(refsDir, 'bin', 'qab.js');
  if (!fs.existsSync(qabBin) || !fs.existsSync(path.join(refsDir, 'index.json'))) {
    fail('shipped references present for the harness', 'run node build.js all'); return;
  }

  // 2 · two scratch copies of the committed fixture, one config each
  const FIX = path.join(ROOT, 'test-fixtures', 'equivalence');
  const tmpQ = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv-qab-'));
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv-akela-'));
  fs.cpSync(FIX, tmpQ, { recursive: true });
  fs.cpSync(FIX, tmpA, { recursive: true });
  // akela.json is generated by the converter itself (qab.js akela-init) — so
  // the harness proves converter + domain pack + engine as one unit (PR B).
  const initEnv = { ...process.env, QAB_CWD: tmpA };
  const init1 = spawnSync(process.execPath, [qabBin, 'akela-init'], { env: initEnv, encoding: 'utf8' });
  check(init1.status === 0 && fs.existsSync(path.join(tmpA, 'akela.json')),
        'akela-init generates akela.json from .qabuddy.json', init1.stderr);
  const gen = JSON.parse(fs.readFileSync(path.join(tmpA, 'akela.json'), 'utf8'));
  // akela-init emits ~-portable paths (akela ≥ 0.1.4 expands them) — the
  // harness expands the same way before checking existence.
  const expandHome = (p) => p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
  check(fs.existsSync(expandHome(gen.domain)) && /qa\.domain\.json$/.test(gen.domain),
        'generated config points at the shipped qa domain pack (portable ~ path)');
  check(gen.knowledge.length === 2 && gen.knowledge[0].namespace === 'REF'
        && gen.knowledge[1].namespace === 'PRJ' && gen.knowledge[1].path === 'features-kb/house',
        'generated knowledge roots: shipped REF + PRJ dir widened from the compiler.references glob',
        JSON.stringify(gen.knowledge));
  check(JSON.stringify(gen.compiler.scope) === JSON.stringify(JSON.parse(fs.readFileSync(path.join(FIX, '.qabuddy.json'), 'utf8')).compiler.scope),
        'generated config carries compiler.scope verbatim');
  const init2 = spawnSync(process.execPath, [qabBin, 'akela-init'], { env: initEnv, encoding: 'utf8' });
  check(init2.status !== 0 && /already exists/.test(init2.stderr), 'akela-init refuses to overwrite without --force');
  const init3 = spawnSync(process.execPath, [qabBin, 'akela-init', '--force'], { env: initEnv, encoding: 'utf8' });
  check(init3.status === 0, 'akela-init --force regenerates');
  fs.rmSync(path.join(tmpA, '.qabuddy.json'));

  const TS = '2026-08-28T00:00:00Z';
  const envQ = { ...process.env, QAB_CWD: tmpQ, QAB_TS: TS };
  const envA = { ...process.env, AKELA_CWD: tmpA, AKELA_TS: TS };
  const runQ = (args) => execFileSync(process.execPath, [qabBin, ...args], { env: envQ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const runA = (args) => execFileSync(process.execPath, [akelaBin, ...args], { env: envA, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const slice = (root, out) => fs.readFileSync(path.join(root, out.split('\n')[0].trim()), 'utf8');
  const HEADER = /^(run|skill|activity|pfp|profile|compiler): /;
  const normalize = (s) => s.split('\n').filter(l => !HEADER.test(l))
    .map(l => l.replace(/# max 0 = uncapped.*/, '# uncapped')).join('\n');
  // sources: and dropped: entries share the "  - id:" shape — compare them separately
  const section = (s, from, to) => {
    const lines = s.split('\n'); const i = lines.indexOf(from);
    const j = to ? lines.indexOf(to) : lines.length;
    return lines.slice(i + 1, j === -1 ? lines.length : j).filter(l => /^  - id: /.test(l));
  };
  const srcSet = (s) => section(s, 'sources:', 'dropped:').sort().join('\n');
  const droppedSet = (s) => section(s, 'dropped:', null).sort().join('\n');
  const bodySet = (s) => s.split('\n').filter(l => /^## /.test(l)).sort().join('\n');

  try {
    // 3 · REF+LRN only (no PRJ, no override touches `improve`) → byte-identical
    const q1 = normalize(slice(tmpQ, runQ(['compile', '--skill', 'improve'])));
    const a1 = normalize(slice(tmpA, runA(['compile', '--skill', 'improve'])));
    check(q1 === a1, 'REF+LRN slice: byte-identical modulo documented header deltas',
          'engines disagree on packing — diff the two slice.md files under equiv-* in tmpdir');
    check(q1.includes('LRN-20260801-02') && !q1.includes('LRN-20260801-03') && /  - id: REF-/.test(q1),
          'normalization is not vacuous: slice keeps REF + active LRN, excludes retired',
          'over-broad normalization would compare empty strings as equal');
    // anti-vacuous guard: an injected source line must be detected
    check(normalize(q1 + '\n  - id: REF-fake#x   tier: should   lines: 1') !== a1,
          'harness detects an injected source line (diff is not over-normalized)');

    // 4 · PRJ + scope overrides (skill `qa`) → same set; order may differ (RFC 0003 §2)
    const q2 = slice(tmpQ, runQ(['compile', '--skill', 'qa']));
    const a2 = slice(tmpA, runA(['compile', '--skill', 'qa']));
    check(srcSet(q2) === srcSet(a2), 'PRJ+override slice: identical source set (ids · tiers · lines · via)',
          'set difference — an RFC 0002 capability diverged between engines');
    check(bodySet(q2) === bodySet(a2), 'PRJ+override slice: identical body sections');
    check(droppedSet(q2) === droppedSet(a2), 'PRJ+override slice: identical dropped set (ids · reasons)');
    for (const [name, s] of [['qab', q2], ['akela', a2]]) {
      check(s.includes('PRJ-payments#refund-double-check'), `${name}: PRJ section compiled under the PRJ- namespace`);
      check(/REF-playbook\/terminology#terms.*via: project-override/.test(s), `${name}: scope add lands with via: project-override`);
      check(!srcSet(s).includes('defect-lifecycle#not-reproducible')
            && /defect-lifecycle#not-reproducible\s+reason: project-override/.test(s),
            `${name}: scope remove is honored (dropped with reason, never packed)`);
    }

    // 5 · profile probes: the pack's declarative rules reproduce buildProfile()
    // exactly — same values, same canonicalization, same pfp (RFC 0003 §2).
    const p2q = slice(tmpQ, runQ(['compile', '--skill', 'qa', '--ticket', 'BUG-7']));
    const p2a = slice(tmpA, runA(['compile', '--skill', 'qa', '--ticket', 'BUG-7']));
    const pfpOf = (s) => (s.match(/^pfp: ([0-9a-f]+)$/m) || [])[1];
    const profOf = (s) => (s.match(/^profile: (.*)$/m) || [])[1];
    check(profOf(p2q) === '{surface: web, pom: exists, ticket_kind: bug}'
          && profOf(p2a) === profOf(p2q),
          'probed profile identical: {surface: web, pom: exists, ticket_kind: bug}',
          `qab=${profOf(p2q)} akela=${profOf(p2a)}`);
    check(pfpOf(p2q) && pfpOf(p2q) === pfpOf(p2a), 'pfp identical across engines',
          `qab=${pfpOf(p2q)} akela=${pfpOf(p2a)}`);

    // 6 · alias normalization (installed `qa-` names) — same selection as canonical
    const outQ = runQ(['compile', '--skill', 'qa-improve']);
    const outA = runA(['compile', '--skill', 'qa-improve']);
    check(/activity alias: qa-improve → improve/.test(outQ), 'shim path: prints the alias notice (delegation fidelity)');
    check(/activity alias: qa-improve → improve/.test(outA), 'direct path: prints the alias notice');
    check(srcSet(slice(tmpQ, outQ)) === srcSet(q1 + '\n'), 'qab: aliased compile selects the canonical set');
    check(srcSet(slice(tmpA, outA)) === srcSet(a1 + '\n'), 'akela: aliased compile selects the canonical set');

    // 7 · a genuinely empty compile warns loudly on both engines (the #54 / akela 0.1.3 fix).
    // Bare dirs: no learnings file, so nothing at all can pack for an unknown name.
    const bareQ = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv-bare-q-'));
    const bareA = fs.mkdtempSync(path.join(os.tmpdir(), 'equiv-bare-a-'));
    fs.writeFileSync(path.join(bareA, 'akela.json'), JSON.stringify({ domain: path.join(refsDir, 'engine', 'qa.domain.json'), knowledge: [{ path: refsDir, namespace: 'REF' }] }));
    const wQ = spawnSync(process.execPath, [qabBin, 'compile', '--skill', 'no-such-skill'], { env: { ...process.env, QAB_CWD: bareQ, QAB_TS: TS }, encoding: 'utf8' });
    const wA = spawnSync(process.execPath, [akelaBin, 'compile', '--activity', 'no-such-skill'], { env: { ...process.env, AKELA_CWD: bareA, AKELA_TS: TS }, encoding: 'utf8' });
    fs.rmSync(bareQ, { recursive: true, force: true });
    fs.rmSync(bareA, { recursive: true, force: true });
    // Post-cutover both entry points carry the qa pack (the shim auto-inits
    // one), so an unknown name is REFUSED identically — delegation fidelity
    // on the strict path replaces the old warn-vs-warn comparison.
    check(wQ.status === 1 && /unknown activity/.test(wQ.stderr), 'shim path: unknown name refused (auto-initialized pack)');
    check(wA.status === 1 && /unknown activity/.test(wA.stderr), 'direct path: unknown name refused identically');

    // 8 · the log contract: same event, same src, activity/skill key alias
    runQ(['log', 'applied', 'LRN-20260801-01']);
    runA(['log', 'applied', 'LRN-20260801-01']);
    const last = (root) => JSON.parse(fs.readFileSync(path.join(root, 'features-kb', 'learnings-log.jsonl'), 'utf8').trim().split('\n').pop());
    const lq = last(tmpQ), la = last(tmpA);
    check(lq.event === 'applied' && la.event === 'applied' && lq.src === la.src && (lq.skill || lq.activity) === (la.activity || la.skill),
          'log applied: equivalent line from both engines (skill/activity key aliased)',
          `qab=${JSON.stringify(lq)} akela=${JSON.stringify(la)}`);
    const badQ = spawnSync(process.execPath, [qabBin, 'log', 'applied', 'REF-nope#nothing'], { env: envQ, encoding: 'utf8' });
    const badA = spawnSync(process.execPath, [akelaBin, 'log', 'applied', 'REF-nope#nothing'], { env: envA, encoding: 'utf8' });
    check(badQ.status !== 0 && badA.status !== 0, 'both engines refuse an unknown source id in log applied');

    // 9 · unknown names, fixture projects: cutover-strict on BOTH entry
    // points (RFC 0003 §2) — refused with the vocabulary, exit 1, and the
    // refusal is byte-equal modulo the shim's deprecation prefix.
    const uQ = spawnSync(process.execPath, [qabBin, 'compile', '--skill', 'unknown-name'], { env: envQ, encoding: 'utf8' });
    const uA = spawnSync(process.execPath, [akelaBin, 'compile', '--activity', 'unknown-name'], { env: envA, encoding: 'utf8' });
    const refusal = (s) => (s.split('\n').find(l => l.startsWith('akela: unknown activity')) || '');
    check(uQ.status === 1 && uA.status === 1 && refusal(uQ.stderr) && refusal(uQ.stderr) === refusal(uA.stderr)
          && /declares: .*test-cases/.test(uA.stderr),
          'unknown name refused identically via shim and direct paths, vocabulary named (strictness upgrade)');

  } finally {
    fs.rmSync(tmpQ, { recursive: true, force: true });
    fs.rmSync(tmpA, { recursive: true, force: true });
  }
}

// ─── Run ────────────────────────────────────────────────────────────────

console.log('QABuddy — Test');
console.log('================');

function testCrlfTolerance() {
  console.log('\n🪟 CRLF Tolerance (Windows autocrlf)');

  // v0.2.0 regression: CRLF checkouts made the frontmatter regex miss,
  // crashing build.js on meta.description. Parsers must accept both endings.
  const sample = '---\r\nname: demo\r\nversion: 0.0.1\r\n---\r\nBody line\r\n';
  const parsed = parseFrontmatter(sample);
  check(
    parsed.fields.name === 'demo' && parsed.fields.version === '0.0.1',
    'parseFrontmatter handles CRLF frontmatter',
    `Got fields: ${JSON.stringify(parsed.fields)}`
  );
  check(
    !parsed.body.includes('\r'),
    'parseFrontmatter normalizes CRLF out of the body',
    'Body still contains \\r — downstream split("\\n") would keep trailing \\r'
  );
  check(
    fs.existsSync(path.join(__dirname, '.gitattributes')),
    '.gitattributes exists (eol=lf normalization)',
    'Without it, Windows git (autocrlf=true) checks out CRLF'
  );
}

function testInstallerSkillSync() {
  console.log('\n🔧 Installer/Skill Sync');

  // Every installer must be able to clean up a skill QABuddy no longer ships. Without this
  // the entry is invisible: uninstall and status iterate the skills that exist now, so a
  // removed skill's link is never reported and never deleted (it dangles). A new platform
  // script that forgets this reintroduces the bug silently — the CI smoke covers claude only.
  // Counted, not merely present: the three call sites are install, uninstall and status, and
  // a substring test passes on any one of them (found the hard way — deleting the install
  // call still matched the uninstall call).
  // Single-arg parsing (`case "${1:-}"`) silently drops every flag after the first —
  // `setup --no-prefix --status` installed instead of reporting. Loop over "$@" instead.
  for (const script of ['setup-claude', 'setup-cursor', 'setup-copilot']) {
    const src = readFile(path.join(ROOT, 'platforms', script));
    if (!src) { fail(`platforms/${script} exists`, 'not found'); continue; }
    check(src.includes('while [ $# -gt 0 ]') && !src.includes('case "${1:-}"'),
      `platforms/${script}: parses every argument, not just $1`,
      src.includes('case "${1:-}"') ? 'still switches on $1 alone' : 'no argument loop found');
  }

  for (const script of ['setup-claude', 'setup-cursor', 'setup-copilot']) {
    for (const [file, defn, removeCall, reportCall] of [
      [script, 'qabuddy_orphans()', 'qabuddy_prune_orphans remove', 'qabuddy_prune_orphans report'],
      [`${script}.ps1`, 'function Get-Orphans', "Invoke-Prune $SkillsDir $SdtSkills 'remove'", "Invoke-Prune $SkillsDir $SdtSkills 'report'"],
    ]) {
      const src = readFile(path.join(ROOT, 'platforms', file));
      if (!src) { fail(`platforms/${file} exists`, 'not found'); continue; }
      const count = needle => src.split(needle).length - 1;
      const removes = count(removeCall), reports = count(reportCall);
      check(src.includes(defn) && removes === 2 && reports === 1,
        `platforms/${file}: prunes orphaned skills at all three call sites`,
        `helper ${src.includes(defn) ? 'ok' : 'MISSING'}; prune-remove ×${removes} (want 2: install + uninstall), prune-report ×${reports} (want 1: status)`);
    }
  }

  // v0.2.0 regression: hardcoded skill arrays in 6 setup scripts silently
  // dropped the 3 new e2e skills. Scripts must enumerate the skills dir.
  const scripts = [
    ['platforms/setup-claude',      /for _skill_dir in "\$SDT_SKILLS"\/\*\//],
    ['platforms/setup-cursor',      /for _skill_dir in "\$SDT_SKILLS"\/\*\//],
    ['platforms/setup-copilot',     /for _skill_dir in "\$SDT_SKILLS"\/\*\//],
    ['platforms/setup-claude.ps1',  /Get-ChildItem \$SdtSkills -Directory/],
    ['platforms/setup-cursor.ps1',  /Get-ChildItem \$SdtSkills -Directory/],
    ['platforms/setup-copilot.ps1', /Get-ChildItem \$SdtSkills -Directory/],
  ];
  for (const [file, pattern] of scripts) {
    const content = readFile(path.join(__dirname, file)) || '';
    check(
      pattern.test(content),
      `${file}: enumerates skills dynamically`,
      'Hardcoded skill list drifts from core/skills/ — enumerate the directory'
    );
    check(
      !/SKILLS=\(\s*\n\s*"/.test(content) && !/\$Skills = @\(/.test(content),
      `${file}: no hardcoded skill array`,
      'Found a literal skill array — new skills would be silently skipped'
    );
  }

  // v0.2.2 regression (reported live): uninstall deleted ANOTHER tool's skill.
  // ~/.claude/skills is a shared namespace and bare names (setup, start, qa…)
  // collide. Every script must verify ownership before deleting or counting:
  // links → target resolves under our dist; copies → .qabuddy-owned marker.
  const ownership = [
    ['platforms/setup-claude',      [/readlink/, /FOREIGN/]],
    ['platforms/setup-cursor',      [/readlink/, /\.qabuddy-owned/, /FOREIGN/]],
    ['platforms/setup-copilot',     [/\.qabuddy-owned/, /FOREIGN/]],
    ['platforms/setup-claude.ps1',  [/function Test-Owned/, /FOREIGN/]],
    ['platforms/setup-cursor.ps1',  [/function Test-Owned/, /\.qabuddy-owned/, /FOREIGN/]],
    ['platforms/setup-copilot.ps1', [/function Test-Owned/, /\.qabuddy-owned/, /FOREIGN/]],
  ];
  for (const [file, patterns] of ownership) {
    const content = readFile(path.join(__dirname, file)) || '';
    for (const pattern of patterns) {
      check(
        pattern.test(content),
        `${file}: ownership verification (${pattern.source})`,
        'Deleting/counting by name alone destroys other tools\' skills — verify ownership'
      );
    }
  }

  // --adopt migration (pre-v0.2.3 copies lack markers): the copy-model
  // scripts must offer guarded adoption — evidence-checked (SKILL.md must
  // mention QABuddy), marker-stamping, never silent
  const adopt = [
    ['platforms/setup-cursor',      [/--adopt\)/, /ADOPTED/, /grep -q "QABuddy" "\$d\/SKILL\.md"/]],
    ['platforms/setup-copilot',     [/--adopt\)/, /ADOPTED/, /grep -q "QABuddy" "\$d\/SKILL\.md"/]],
    ['platforms/setup-cursor.ps1',  [/\[switch\]\$Adopt/, /ADOPTED/, /Select-String -Path \$skillMd -Pattern 'QABuddy'/]],
    ['platforms/setup-copilot.ps1', [/\[switch\]\$Adopt/, /ADOPTED/, /Select-String -Path \$skillMd -Pattern 'QABuddy'/]],
  ];
  for (const [file, patterns] of adopt) {
    const content = readFile(path.join(__dirname, file)) || '';
    for (const pattern of patterns) {
      check(
        pattern.test(content),
        `${file}: guarded adopt migration (${pattern.source.slice(0, 30)}…)`,
        'Copy-model upgrades need evidence-checked --adopt, not manual rm -rf'
      );
    }
  }
}

testBuildOutput();
testSkillStructure();
testNoStalePaths();
testNoRawPlaceholders();
testCrossPlatformConsistency();
testKoreanCompleteness();
testPlaybookBudget();
testPreambleTiers();
testDocClaims();
testConfigAwareness();
function testDistBom() {
  console.log('\n🔤 dist BOM (Gap G3)');

  // PS 5.1 reads BOM-less UTF-8 as ANSI: a mangled em-dash ends in a smart
  // quote PowerShell treats as a string delimiter — code silently vanishes
  // (caught live in v0.2.2: the qa-references block evaporated).
  for (const platform of PLATFORMS) {
    const ps1 = path.join(resolvePlatformDir(platform), 'setup.ps1');
    if (!fs.existsSync(ps1)) continue;
    const head = fs.readFileSync(ps1).subarray(0, 3);
    check(
      head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF,
      `dist/${platform}/setup.ps1 starts with UTF-8 BOM`,
      'BOM missing — PS 5.1 will misparse string boundaries'
    );
  }
}

function testKbPathHygiene() {
  console.log('\n🧹 KB Path Hygiene');

  // Regression guard for the qa- prefix sweep (caught live 2026-08-08):
  // command-reference replacements must never leak into KB paths like
  // {EPIC-KEY}/test-cases/. Only qa-reports/ legitimately carries the prefix.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8');
        const hits = content.match(/\}\/qa-(?!reports)[a-z-]+/g);
        if (hits) offenders.push(`${full}: ${[...new Set(hits)].join(', ')}`);
      }
    }
  };
  walk(path.join(__dirname, 'core'));
  walk(path.join(__dirname, 'locales'));
  check(
    offenders.length === 0,
    'no qa- prefix leaked into KB paths (}/qa-* except qa-reports)',
    offenders.join(' | ')
  );
}

// Every suite above derives its expectations from whatever is on disk, so a
// deleted skill deletes its own checks along with it (proven: removing
// core/skills/test-plan/ left the run green at 669/0, and removing it from
// dist/ left it green at 707/0). EXPECTED_SKILLS is the fixed point — unlike
// the installer arrays this replaced in v0.2.1, a stale list here fails loudly
// instead of silently skipping work, so adding a skill must be a deliberate
// edit in this file.
const EXPECTED_SKILLS = [
  'e2e-pom', 'e2e-setup', 'e2e-write', 'eval', 'exploratory', 'improve',
  'qa', 'review-ticket', 'setup', 'start', 'test-cases',
  'test-plan', 'verify-fix',
];

function testSkillManifest() {
  console.log('\n🧾 Skill Manifest');

  const found = getSkillDirs();
  check(
    found.length === EXPECTED_SKILLS.length,
    `core/skills has ${EXPECTED_SKILLS.length} skills`,
    `Found ${found.length}: ${found.join(', ')}`
  );
  for (const skill of EXPECTED_SKILLS) {
    check(found.includes(skill), `core: ${skill} present`, 'Skill directory is missing');
  }
  for (const extra of found.filter(f => !EXPECTED_SKILLS.includes(f))) {
    check(false, `core: ${extra} is unexpected`, 'Add it to EXPECTED_SKILLS in test.js');
  }

  // Every skill must survive the build into every platform dir that exists,
  // including locale builds (dist/ko/<platform>) — a build that silently drops
  // a skill ships an installer that happily installs one fewer skill.
  const platformDirs = [];
  if (fs.existsSync(DIST_DIR)) {
    for (const platform of PLATFORMS) {
      const direct = path.join(DIST_DIR, platform);
      if (fs.existsSync(direct)) platformDirs.push([platform, direct]);
      for (const entry of fs.readdirSync(DIST_DIR)) {
        const nested = path.join(DIST_DIR, entry, platform);
        if (fs.existsSync(nested)) platformDirs.push([`${entry}/${platform}`, nested]);
      }
    }
  }
  for (const [label, dir] of platformDirs) {
    const skillsDir = path.join(dir, 'skills');
    if (!fs.existsSync(skillsDir)) {
      check(false, `${label}: has a skills/ directory`, `Missing ${skillsDir}`);
      continue;
    }
    const shipped = fs.readdirSync(skillsDir);
    const missing = EXPECTED_SKILLS.filter(s => !shipped.includes(s) && !shipped.includes(`qa-${s}`));
    check(
      missing.length === 0,
      `${label}: ships all ${EXPECTED_SKILLS.length} skills`,
      `Missing from build: ${missing.join(', ')}`
    );
  }
}

async function testRuntimeHelper() {
  console.log('\n🧾 Runtime helper (bin/qab.js — RFC 0001 PR1)');
  const { execFileSync } = require('child_process');
  const os = require('os');

  const src = path.join(ROOT, 'bin', 'qab.js');
  check(fs.existsSync(src), 'bin/qab.js exists in repo');

  // Shipped under references/bin/ on every platform (reachable via {{REFERENCE_PATH}}/bin)
  for (const platform of PLATFORMS) {
    const shipped = path.join(resolvePlatformDir(platform), 'references', 'bin', 'qab.js');
    check(fs.existsSync(shipped), `dist/${platform}/references/bin/qab.js shipped`, 'build.js must copy bin/ into references/bin/');
    if (fs.existsSync(shipped) && fs.existsSync(src)) {
      check(fs.readFileSync(shipped, 'utf8') === fs.readFileSync(src, 'utf8'), `dist/${platform}/references/bin/qab.js matches source`);
    }
  }
  // Preamble wiring: the helper path must be assigned unquoted (QAB=~/… expands; QAB="node ~/…" hands
  // Node a literal "~" — caught live while building PR1), and every call goes through `node $QAB`.
  for (const platform of PLATFORMS) {
    const distSkill = readFile(path.join(resolvePlatformDir(platform), 'skills', 'qa', 'SKILL.md')) || '';
    check(/`QAB=[^"'`\s]+\/bin\/akela\.js`/.test(distSkill), `dist/${platform}: preamble assigns QAB=<path>/bin/akela.js unquoted (the engine launcher)`);
    check(!/QAB="node/.test(distSkill), `dist/${platform}: preamble does not quote "node ~/…" (tilde would not expand)`);
    check((distSkill.match(/node \$QAB (run-id|log)/g) || []).length >= 4, `dist/${platform}: preamble calls node $QAB for run-id/log (≥4 sites)`);
    check(/REF-<file-stem>#<id>/.test(distSkill) && /REF-playbook\/<stem>#<id>/.test(distSkill), `dist/${platform}: preamble item 2 tells the model the REF id form (PR4 citation obligation)`);
  }
  if (!fs.existsSync(src)) return;

  // Behavioural: run the helper against a scratch project and read back what it wrote.
  // This is a real detection-power test — break the JSON writer and these go red.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-test-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-17T00:00:00Z' };
  const run = (args, extraEnv) => execFileSync(process.execPath, [src, ...args], { env: { ...env, ...(extraEnv || {}) }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const runFails = (args) => { try { run(args); return false; } catch (e) { return e.status !== 0; } };

  try {
    // .qabuddy.json with a custom learningsPath → log lands next to it
    fs.mkdirSync(path.join(tmp, 'kb'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.qabuddy.json'), JSON.stringify({ learningsPath: 'kb/LEARNINGS.md' }));
    // The logged ids must exist in the knowledge base: akela's stats cross-
    // references it and labels absent ids "history — no longer in the
    // knowledge base" instead of ever calling them promotion candidates.
    fs.writeFileSync(path.join(tmp, 'kb', 'LEARNINGS.md'), ['# Project Learnings', '',
      ...['03', '04', '07', '08', '09'].map(n => [
        `## LRN-20260808-${n}: fixture entry ${n}`, '- **Status:** active', '- **Scope:** all',
        `- **Statement:** statement ${n}`, '- **Overrides:** none', '- **Evidence:** fixture', ''].join('\n')),
    ].join('\n'));

    const runId = run(['run-id', '--skill', 'qa', '--ticket', 'PROJ-1']).trim();
    check(/^qa-PROJ-1-[0-9a-f]{6}$/.test(runId), `run-id prints <skill>-<ticket>-<6hex> (${runId})`);
    check(fs.existsSync(path.join(tmp, '.qa-reports', 'run')), 'run-id writes the .qa-reports/run marker (akela layout)');

    // Each run logs its events and is CLOSED BY ITS OUTCOME last — the helper refuses events on a
    // run that already reported one, so this ordering is also what real runs look like.
    // Run 1 (marker/default). Boundary data: LRN-08 contradicted twice with nothing applied after
    // (falsified); LRN-09 contradicted twice but applied again later, in run 3 (NOT falsified).
    run(['log', 'applied', 'LRN-20260808-03']);
    run(['log', 'contradicted', 'LRN-20260808-04', '--note', 'script uses --prefix']);
    run(['log', 'applied', 'LRN-20260808-08'], { QAB_TS: '2026-08-10T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-08', '--note', 'first'], { QAB_TS: '2026-08-11T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-09', '--note', 'a'], { QAB_TS: '2026-08-11T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-09', '--note', 'b'], { QAB_TS: '2026-08-12T00:00:00Z' });
    run(['log', 'outcome', '--status', 'DONE']);
    // Run 2, id via env — must append, not rewrite. LRN-07 applied here and in run 3 = 2 runs
    // (NOT a promotion candidate: the threshold is 3).
    run(['log', 'applied', 'LRN-20260808-03', '--skill', 'test-cases'], { QAB_RUN: 'test-cases-x-abcdef' });
    run(['log', 'applied', 'LRN-20260808-07'], { QAB_RUN: 'test-cases-x-abcdef' });
    run(['log', 'outcome', '--status', 'DONE'], { QAB_RUN: 'test-cases-x-abcdef' });
    // Run 3
    run(['log', 'applied', 'LRN-20260808-03'], { QAB_RUN: 'third-run-000001' });
    run(['log', 'applied', 'LRN-20260808-07'], { QAB_RUN: 'third-run-000001' });
    run(['log', 'contradicted', 'LRN-20260808-08', '--note', 'second'], { QAB_RUN: 'third-run-000001', QAB_TS: '2026-08-12T00:00:00Z' });
    run(['log', 'applied', 'LRN-20260808-09'], { QAB_RUN: 'third-run-000001', QAB_TS: '2026-08-13T00:00:00Z' });
    run(['log', 'outcome', '--status', 'DONE_WITH_CONCERNS'], { QAB_RUN: 'third-run-000001' });

    const logFile = path.join(tmp, 'kb', 'learnings-log.jsonl');
    check(fs.existsSync(logFile), 'log writes learnings-log.jsonl next to learningsPath');
    const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
    check(lines.length === 15, `log appends one line per event (${lines.length}/15)`);
    let parsed = [];
    let allJson = true;
    for (const l of lines) { try { parsed.push(JSON.parse(l)); } catch { allJson = false; } }
    check(allJson, 'every log line is valid JSON');
    const first = parsed[0] || {};
    check(first.v === 1 && first.ts === '2026-08-17T00:00:00Z' && first.run === runId && (first.activity || first.skill) === 'qa' && first.event === 'applied' && first.src === 'LRN-20260808-03',
      'first line has v/ts/run/activity/event/src from marker + args', JSON.stringify(first));
    check(parsed[1] && parsed[1].note === 'script uses --prefix', 'contradicted line carries --note');
    // Found by content, not by index: these assertions are about the line's shape, and a fixture
    // reorder should not be able to break them (it did, when runs were made to close last).
    const outcomeLine = parsed.find(l => l.event === 'outcome' && l.run === runId) || {};
    check(outcomeLine.status === 'DONE', 'outcome line carries --status', JSON.stringify(outcomeLine));
    const overrideLine = parsed.find(l => l.run === 'test-cases-x-abcdef' && l.src === 'LRN-20260808-03') || {};
    check((overrideLine.activity || overrideLine.skill) === 'test-cases', 'QAB_RUN / --skill override the marker', JSON.stringify(overrideLine));

    // Validation: bad input exits non-zero and writes nothing
    const before = fs.readFileSync(logFile, 'utf8');
    check(runFails(['log', 'applied']), 'log applied without src exits non-zero');
    check(runFails(['log', 'outcome']), 'log outcome without --status exits non-zero');
    check(runFails(['log', 'outcome', '--status', 'FINISHED']), 'log outcome with unknown status exits non-zero');
    check(runFails(['log', 'contradicted', 'LRN-1']), 'log contradicted without --note exits non-zero');
    check(runFails(['log', 'bogus', 'LRN-1']), 'log with unknown event exits non-zero');
    check(fs.readFileSync(logFile, 'utf8') === before, 'rejected log calls append nothing');

    // stats: computed columns + RFC §6.2 findings
    const stats = JSON.parse(run(['stats', '--json']));
    const row03 = (stats.rows || []).find(r => r.src === 'LRN-20260808-03') || {};
    const row04 = (stats.rows || []).find(r => r.src === 'LRN-20260808-04') || {};
    check(row03.applied === 3 && row03.runs === 3 && row03.contradicted === 0, `stats: LRN-03 applied=3 runs=3 contradicted=0 (${JSON.stringify(row03)})`);
    check(row03.promotion_candidate === true, 'stats: applied>=3 across >=3 runs, contradicted=0 → promotion candidate');
    check(row04.contradicted === 1 && row04.promotion_candidate === false && row04.falsified === false, 'stats: single contradiction is neither candidate nor falsified');
    const row07 = (stats.rows || []).find(r => r.src === 'LRN-20260808-07') || {};
    const row08 = (stats.rows || []).find(r => r.src === 'LRN-20260808-08') || {};
    check(row07.applied === 2 && row07.runs === 2 && row07.promotion_candidate === false, 'stats: applied=2 across 2 runs is NOT a promotion candidate (threshold is 3 — mutation M2 guard)');
    check(row08.contradicted === 2 && row08.applied === 1 && row08.falsified === true, 'stats: contradicted≥2 with no applied afterwards → falsified');
    check(row08.promotion_candidate === false, 'stats: a falsified source is never a promotion candidate');
    const row09 = (stats.rows || []).find(r => r.src === 'LRN-20260808-09') || {};
    check(row09.contradicted === 2 && row09.falsified === false, 'stats: contradicted≥2 but applied afterwards → NOT falsified (mutation M4 guard)');
    check(stats.runs_with_outcome === 3 && stats.outcomes.DONE === 2 && stats.outcomes.DONE_WITH_CONCERNS === 1, 'stats: outcome counts per status');
    const table = run(['stats']);
    check(/\| source \| kind \| in_slice \| applied \| contradicted \| runs \| last_applied \|/.test(table), 'stats prints the computed-columns table (with kind, in_slice)');
    check(/LRN-20260808-03[^\n]*promotion candidate/.test(table) && /LRN-20260808-08[^\n]*falsified/.test(table), 'stats table labels findings per row', table);

    // ── PR4: REF citation. Validation needs index.json next to the helper, so exercise the SHIPPED copy.
    const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js'); // en or ko-only dist
    const runS = (args, extraEnv) => execFileSync(process.execPath, [shipped, ...args], { env: { ...env, ...(extraEnv || {}) }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const failsS = (args, extraEnv) => { try { runS(args, extraEnv); return null; } catch (e) { return e.status !== 0 ? String(e.stderr || '') : null; } };
    if (fs.existsSync(shipped) && fs.existsSync(path.join(resolvePlatformDir('claude'), 'references', 'index.json'))) {
      const beforeRef = fs.readFileSync(logFile, 'utf8');
      runS(['log', 'applied', 'REF-playwright-patterns#never'], { QAB_RUN: 'ref-run-000001' });
      runS(['log', 'applied', 'REF-playbook/test-types#automation-guidelines'], { QAB_RUN: 'ref-run-000001' });
      runS(['log', 'outcome', '--status', 'DONE'], { QAB_RUN: 'ref-run-000001' });
      const afterRef = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      const refLine = JSON.parse(afterRef[afterRef.length - 3]);
      check(refLine.event === 'applied' && refLine.src === 'REF-playwright-patterns#never', 'log applied accepts a REF id that exists in index.json');
      const e1 = failsS(['log', 'applied', 'REF-playwright-patterns#nevr']);
      check(e1 !== null && /unknown (REF id|section id)/.test(e1) && /REF-playwright-patterns#never/.test(e1), 'unknown REF id is rejected with the nearest suggestion (nevr → never)', e1 || 'accepted');
      const e2 = failsS(['log', 'applied', 'REF-test-types#automation-guidelines']);
      check(e2 !== null && /REF-playbook\/test-types#automation-guidelines/.test(e2), 'missing playbook/ prefix is rejected and the playbook id is suggested', e2 || 'accepted');
      const e3 = failsS(['log', 'applied', 'REF-Bad']);
      check(e3 !== null && /malformed REF id|source id must be/.test(e3), 'malformed REF id is rejected');
      const e4 = failsS(['log', 'applied', 'not-an-id']);
      check(e4 !== null, 'non LRN/REF source id is rejected');
      check(fs.readFileSync(logFile, 'utf8').split('\n').length === beforeRef.split('\n').length + 3, 'rejected REF ids append nothing');
      const st = JSON.parse(runS(['stats', '--json']));
      const refRow = (st.rows || []).find(r => r.src === 'REF-playwright-patterns#never') || {};
      check(refRow.kind === 'REF' && refRow.applied === 1, 'stats: REF rows carry kind=REF and counts');
      // compliance: runs with outcome so far — qa (marker run, LRN only), test-cases-x (LRN only), third-run (LRN only), ref-run (REF)
      const comp = st.compliance || {};
      const total = Object.values(comp).reduce((a, c) => a + c.runs, 0);
      const withRef = Object.values(comp).reduce((a, c) => a + c.with_ref, 0);
      check(total === 4 && withRef === 1, `stats: citation compliance counts runs with outcome and those with a REF applied (${withRef}/${total}, expected 1/4)`, JSON.stringify(comp));

      // ── Closed-run guard. A run is closed by its outcome; events appended afterwards belong to
      // different work (in practice: a stale .qab-run marker picked up by maintenance outside a run)
      // and silently corrupt the per-run counts distill and the scoreboard read.
      // 'ref-run-000001' reported DONE three lines above, so it is closed.
      const linesBeforeGuard = fs.readFileSync(logFile, 'utf8').trim().split('\n').length;
      const guardErr = failsS(['log', 'applied', 'REF-playwright-patterns#never'], { QAB_RUN: 'ref-run-000001' });
      check(guardErr !== null, 'log on a run that already reported an outcome is refused');
      check(/already reported an outcome/.test(guardErr || ''), 'closed-run refusal names the reason', guardErr || '(no stderr)');
      check(/run-id --(skill|activity)/.test(guardErr || ''), 'closed-run refusal says how to open a new run', guardErr || '(no stderr)');
      check(fs.readFileSync(logFile, 'utf8').trim().split('\n').length === linesBeforeGuard,
        'a refused append writes nothing to the log');
      check(failsS(['log', 'outcome', '--status', 'DONE'], { QAB_RUN: 'ref-run-000001' }) !== null,
        'a second outcome on the same run is refused too (no double counting)');
      // A malformed id on a closed run must still report the id, not the run state (validation first).
      const closedBadId = failsS(['log', 'applied', 'REF-Bad'], { QAB_RUN: 'ref-run-000001' });
      check(/malformed REF id|source id must be/.test(closedBadId || ''), 'argument validation still wins over the closed-run check', closedBadId || '(accepted)');
      // An open run is unaffected.
      runS(['log', 'applied', 'REF-playwright-patterns#never'], { QAB_RUN: 'ref-run-000002' });
      check(fs.readFileSync(logFile, 'utf8').trim().split('\n').length === linesBeforeGuard + 1,
        'an open run still accepts events after a different run closed');
      const table2 = runS(['stats']);
      check(/citation compliance/.test(table2) && /overall: 1\/4/.test(table2), 'stats prints the compliance readout with the PR4 gate');
    } else {
      fail('shipped qab.js + index.json present for REF validation test', 'run node build.js all');
    }

    // A consumer that closes stdout early (`| head`) must not crash the helper (EPIPE) — cross-platform check
    const { spawn } = require('child_process');
    const epipeCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [src, 'stats'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.destroy();                       // the reader goes away mid-write
      let err = '';
      child.stderr.on('data', (d) => { err += d; });
      child.on('close', (code) => resolve({ code, err }));
    });
    check(epipeCode.code === 0 && !/EPIPE/.test(epipeCode.err), `stats survives a closed stdout (exit ${epipeCode.code}, no EPIPE trace)`, epipeCode.err.split('\n')[0]);

    // Malformed line tolerance: skipped and counted, never crashes
    const eventsBefore = JSON.parse(run(['stats', '--json'])).events;
    fs.appendFileSync(logFile, '{not json\n');
    const stats2 = JSON.parse(run(['stats', '--json']));
    check(stats2.malformed === 1 && stats2.events === eventsBefore, `stats skips and counts malformed lines (${stats2.events} events, 1 malformed)`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testLearningsGates() {
  console.log('\n🚧 Learnings gates (RFC 0001 PR2 — eval-gated promotion + dry-run critic)');
  // These are procedure obligations in improve/SKILL.md and the protocol; simulate fixtures
  // (fx-008/009) exercise them at eval time, this guards the text itself in both locales.
  const files = {
    'core/skills/improve/SKILL.md': [
      [/`pass_after ≥ pass_before`/, 'promotion eval gate rule (exact: `pass_after ≥ pass_before`)'],
      [/LEARNINGS\.rejected\.md/, 'rejection file named'],
      [/distill-proposal-<YYYY-MM-DD>\.md/, 'dry-run proposal file named'],
      [/--dry-run/, 'dry-run entry point'],
    ],
    'locales/ko/skills/improve/SKILL.md': [
      [/`pass_after ≥ pass_before`/, 'promotion eval gate rule (ko, exact)'],
      [/LEARNINGS\.rejected\.md/, 'rejection file named (ko)'],
      [/distill-proposal-<YYYY-MM-DD>\.md/, 'dry-run proposal file named (ko)'],
      [/--dry-run/, 'dry-run entry point (ko)'],
    ],
    'core/references/self-improve.md': [
      [/^## Gates/m, '§Gates section'],
      [/`pass_after ≥ pass_before`/, 'gate rule in protocol (exact)'],
      [/zero edits/, 'critic writes zero edits'],
    ],
    'locales/ko/references/self-improve.md': [
      [/^## 게이트/m, '§게이트 section (ko)'],
      [/`pass_after ≥ pass_before`/, 'gate rule in protocol (ko, exact)'],
      [/편집 0건/, 'critic writes zero edits (ko)'],
    ],
  };
  for (const [rel, checks] of Object.entries(files)) {
    const content = readFile(path.join(ROOT, rel)) || '';
    for (const [re, label] of checks) {
      check(re.test(content), `${rel}: ${label}`, `Pattern not found: ${re}`);
    }
  }
  // The gate must be a numbered rule of Distill Mode, after the promotion rule and before the report line
  const en = readFile(path.join(CORE_DIR, 'skills', 'improve', 'SKILL.md')) || '';
  const distill = en.slice(en.indexOf('## Distill Mode'));
  const iPromo = distill.indexOf('**Promotion is a reference edit**');
  const iGate = distill.indexOf('**Eval gate on every promotion.**');
  const iDry = distill.indexOf('**`--dry-run` = the critic.**');
  const iReport = distill.indexOf('\nReport:');
  check(iPromo >= 0 && iGate > iPromo && iDry > iGate && iReport > iDry, 'improve Distill Mode order: promotion → eval gate → dry-run critic → report');
}

function testReferenceIndex() {
  console.log('\n🔖 Reference ids + index (RFC 0001 PR3)');
  const { parseReferenceIndex, referenceParityErrors, listRefFiles } = require('./build.js');
  const enDir = path.join(CORE_DIR, 'references');
  const koDir = path.join(LOCALES_DIR, 'ko', 'references');

  // Every `##` (outside fences) is tagged; ids kebab-case; no duplicates
  const en = parseReferenceIndex(enDir);
  check(en.errors.length === 0, 'core/references: every ## has a qab id, no duplicates', en.errors.join(' | '));
  const enIds = Object.keys(en.index);
  check(enIds.length >= 60, `core/references: ${enIds.length} addressable sections (≥60)`);
  check(enIds.every(k => /^REF-[a-z0-9-]+(\/[a-z0-9-]+)?#[a-z0-9-]+$/.test(k)), 'every id matches REF-<stem>#<id> / REF-playbook/<stem>#<id>');
  const must = enIds.filter(k => en.index[k].tier === 'must');
  check(must.includes('REF-playwright-patterns#never') && must.includes('REF-playwright-patterns#must-rules'), 'playwright-patterns NEVER + MUST rules are tier=must');
  check(must.every(k => !en.index[k].scope.includes('all')), 'no tier=must section is scoped to all (must is expensive — rails only)', must.filter(k => en.index[k].scope.includes('all')).join(','));
  check(enIds.every(k => Array.isArray(en.index[k].scope) && en.index[k].scope.length > 0 && typeof en.index[k].lines === 'number' && en.index[k].lines > 0), 'every entry has scope[] and positive line count');

  // ko parity: same files, same id set (build.js resolves the references *directory* per locale)
  const ko = parseReferenceIndex(koDir);
  check(ko.errors.length === 0, 'locales/ko/references: every ## has a qab id, no duplicates', ko.errors.join(' | '));
  const parity = referenceParityErrors(en.index, ko.index, 'ko');
  check(parity.length === 0, 'en/ko reference id sets are identical', parity.join(' | '));
  const enFiles = listRefFiles(enDir), koFiles = new Set(listRefFiles(koDir));
  const missing = enFiles.filter(f => !koFiles.has(f));
  check(missing.length === 0, 'every core/references file has a same-named ko twin', missing.join(', '));
  for (const k of enIds) {
    if (!ko.index[k]) continue;
    check(ko.index[k].tier === en.index[k].tier && ko.index[k].scope.join() === en.index[k].scope.join(), `${k}: ko tier/scope match en`);
  }

  // Shipped index.json in every dist (en) and dist/ko
  for (const platform of PLATFORMS) {
    for (const [label, dir] of [[`dist/${platform}`, path.join(DIST_DIR, platform)], [`dist/ko/${platform}`, path.join(DIST_DIR, 'ko', platform)]]) {
      const p = path.join(dir, 'references', 'index.json');
      if (!fs.existsSync(dir)) continue;
      check(fs.existsSync(p), `${label}/references/index.json shipped`);
      if (!fs.existsSync(p)) continue;
      let parsed = null;
      try { parsed = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
      check(parsed && Object.keys(parsed).length === enIds.length, `${label}/references/index.json parses with ${enIds.length} entries`);
    }
  }

  // Overrides: in this repo's dogfood LEARNINGS.md resolve to a real id, a skill, or none
  const learnings = readFile(path.join(ROOT, 'features-kb', 'LEARNINGS.md')) || '';
  const skills = new Set(getSkillDirs());
  const overrides = [...learnings.matchAll(/\*\*Overrides:\*\*\s*(.+)/g)].map(m => m[1].trim());
  check(overrides.length > 0, `features-kb/LEARNINGS.md has Overrides: lines (${overrides.length})`);
  for (const o of overrides) {
    const none = /^(none|없음)(?![A-Za-z0-9-])/.test(o);
    const refs = [...o.matchAll(/REF-[a-z0-9-]+(?:\/[a-z0-9-]+)?#[a-z0-9-]+/g)].map(m => m[0]);
    const skillRef = (o.match(/^SKILL:([a-z0-9-]+)/) || [])[1];
    const ok = none || (refs.length > 0 && refs.every(r => en.index[r])) || (skillRef && skills.has(skillRef));
    check(ok, `Overrides resolves: "${o.slice(0, 60)}"`, refs.filter(r => !en.index[r]).map(r => `unknown ${r}`).join(', ') || 'must be none/없음, a REF- id, or SKILL:<name>');
  }
}

function testCompile() {
  console.log('\n🧩 Compile step (RFC 0001 PR5 — unscored slice, run dir, scratchpad)');
  const { execFileSync } = require('child_process');
  const os = require('os');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  const indexPath = path.join(resolvePlatformDir('claude'), 'references', 'index.json');
  if (!fs.existsSync(shipped) || !fs.existsSync(indexPath)) { fail('shipped qab.js + index.json present for compile tests', 'run node build.js all'); return; }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // Preamble wiring: item 1 compiles, item 2 mentions candidates, recovery scans runs/
  for (const platform of PLATFORMS) {
    const distSkill = readFile(path.join(resolvePlatformDir(platform), 'skills', 'qa', 'SKILL.md')) || '';
    check(/node \$QAB compile --skill/.test(distSkill), `dist/${platform}: preamble item 1 runs qab.js compile`);
    check(/Candidate learnings/.test(distSkill), `dist/${platform}: preamble mentions ## Candidate learnings`);
    check(/\.qa-reports\/runs\//.test(distSkill), `dist/${platform}: Context Recovery scans .qa-reports/runs/`);
    check(fs.existsSync(path.join(resolvePlatformDir(platform), 'references', 'run-protocol.md')), `dist/${platform}: run-protocol.md shipped`);
  }
  // Tier-2 multi-phase skills carry the scratchpad line; tier-1 do not (decision 8)
  for (const skill of getSkillDirs()) {
    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md')) || '';
    const { fields } = parseFrontmatter(content);
    const has = /Scratchpad \(run protocol\)/.test(content);
    if (fields['preamble-tier'] === '2') check(has, `${skill} (tier 2): has the scratchpad line`);
    else check(!has, `${skill} (tier 1): no scratchpad Plan/State line`);
  }

  // Behavioural: compile in a scratch project with a fixture learnings file
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-compile-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-17T00:00:00Z' };
  const run = (args) => execFileSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(tmp, 'features-kb'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'playwright', 'pom'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'playwright', 'AUTOMATION.md'), '# decisions\n');
    fs.writeFileSync(path.join(tmp, 'playwright', 'pom', 'x.page.ts'), '');
    fs.writeFileSync(path.join(tmp, 'features-kb', 'LEARNINGS.md'), [
      '# Project Learnings', '',
      '## LRN-20260801-01: applies to test-cases', '- **Status:** active', '- **Scope:** test-cases, qa, e2e-write', '- **Statement:** seed via API', '- **Overrides:** REF-playwright-patterns#must-rules (extends)', '- **Evidence:** run', '',
      '## LRN-20260801-02: retired one', '- **Status:** retired', '- **Scope:** all', '- **Statement:** old', '- **Overrides:** none', '- **Evidence:** run', '',
      '## LRN-20260801-03: profile-narrowed (surface=api) — must be dropped for a web profile', '- **Status:** active', '- **Scope:** all', '- **Statement:** api only', '- **Overrides:** none', '- **Evidence:** run', '- **Profile:** surface=api', '',
      '## LRN-20260801-04: scope all, no profile', '- **Status:** active', '- **Scope:** all', '- **Statement:** everywhere', '- **Overrides:** none', '- **Evidence:** run', '',
    ].join('\n'));

    const out = run(['compile', '--skill', 'test-cases', '--ticket', 'PROJ-1']);
    const slicePath = path.join(tmp, out.split('\n')[0].trim());
    check(fs.existsSync(slicePath), 'compile prints an existing slice.md path');
    const runDir = path.dirname(slicePath);
    for (const f of ['profile.json', 'scratchpad.md', 'events.jsonl']) check(fs.existsSync(path.join(runDir, f)), `run dir has ${f}`);
    check(/test-cases-PROJ-1-[0-9a-f]{6}$/.test(runDir), 'run dir name = <skill>-<ticket>-<6hex>');
    const slice = fs.readFileSync(slicePath, 'utf8');
    const fm = slice.split('\n---\n')[0];
    check(/^---\nmanifest: 1\n/.test(slice) && /scoring: off/.test(fm) && /budget: \{max: 0, used: \d+\}/.test(fm), 'manifest: version, scoring off, uncapped budget with used lines');
    // Parse the two manifest blocks SEPARATELY — a compiler that packs a section and also lists it as dropped
    // must not slip through (mutation smoke 2026-08-17 caught the subtraction-based version of this test).
    const sourcesBlock = (fm.split('\nsources:\n')[1] || '').split('\ndropped:')[0];
    const droppedBlock = fm.split('\ndropped:')[1] || '';
    const manifestIds = [...sourcesBlock.matchAll(/^  - id: (\S+)/gm)].map(m => m[1]);
    const droppedIds = [...droppedBlock.matchAll(/^  - id: (\S+)/gm)].map(m => m[1]);
    const inSlice = manifestIds;
    check(inSlice.every(id => !droppedIds.includes(id)), 'no id is both packed and dropped');

    // Set-equality vs the declared read set: explicit-scope sections ∪ (scope=all ∧ must) ∪ active scoped LRNs
    const expectedRefs = Object.entries(index).filter(([, e]) => e.scope.includes('test-cases') || (e.scope.includes('all') && e.tier === 'must')).map(([id]) => id).sort();
    const gotRefs = inSlice.filter(id => id.startsWith('REF-')).sort();
    check(JSON.stringify(gotRefs) === JSON.stringify(expectedRefs), `slice REF set == declared read set for test-cases (${gotRefs.length})`, `missing: ${expectedRefs.filter(x => !gotRefs.includes(x)).join(',')} extra: ${gotRefs.filter(x => !expectedRefs.includes(x)).join(',')}`);
    const gotLrns = inSlice.filter(id => id.startsWith('LRN-')).sort();
    check(JSON.stringify(gotLrns) === JSON.stringify(['LRN-20260801-01', 'LRN-20260801-04']), `slice LRN set = active ∩ scoped ∩ profile-compatible (${gotLrns.join(',')})`);
    check(droppedIds.includes('LRN-20260801-03'), 'profile-narrowed learning (surface=api) is dropped for a web profile and listed');
    check(droppedIds.some(id => id.startsWith('REF-feature-knowledge-base-spec#')), 'scope=all non-must sections listed under dropped (general-scope), not packed');
    // must first; LRN placed right after the REF it overrides
    const refTiers = manifestIds.filter(id => id.startsWith('REF-')).map(id => (index[id] && index[id].tier) || 'should');
    const lastMust = refTiers.lastIndexOf('must');
    const firstOther = refTiers.findIndex(t => t !== 'must');
    check(firstOther === -1 || lastMust < firstOther, `every must section packed before any non-must (${manifestIds[0]})`);
    check(!/<!--\s*qab:/.test(slice.split('\n---\n').slice(1).join('')), 'qab metadata comments stripped from slice body');
    // Override adjacency + verbatim-body checks need playwright-patterns in the slice; they run
    // against an e2e-write compile further down (after the marker-dependent checks), because
    // test-cases stopped reading playwright-patterns when 0.4.0 dropped the code sketches.
    // profile + events + scratchpad
    const profile = JSON.parse(fs.readFileSync(path.join(runDir, 'profile.json'), 'utf8'));
    check(profile.schema === 'profile/1' && profile.surface === 'web' && profile.pom === 'exists' && /^[0-9a-f]{12}$/.test(profile.pfp), `profile v0 deterministic (${profile.surface}/${profile.pom}/${profile.ticket_kind}, pfp ${profile.pfp})`);
    const events = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    check(events.length === 1 && events[0].event === 'compiled' && events[0].pfp === profile.pfp && Array.isArray(events[0].sources), 'compiled event mirrored into the run dir with pfp + sources');
    const projLog = fs.readFileSync(path.join(tmp, 'features-kb', 'learnings-log.jsonl'), 'utf8').trim().split('\n');
    check(projLog.length === 1 && JSON.parse(projLog[0]).event === 'compiled', 'compiled event also in the project log');
    const scratch = fs.readFileSync(path.join(runDir, 'scratchpad.md'), 'utf8');
    check(['## Plan', '## State', '## Findings', '## Candidate learnings'].every(h => scratch.includes(h)), 'scratchpad has the four sections');
    // a subsequent log call lands in BOTH logs (same run via marker)
    run(['log', 'applied', 'LRN-20260801-01']);
    check(fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').length === 2, 'later log lines are mirrored into the run dir');
    // recompiling the same skill reuses the run (marker) instead of starting a new one
    const out2 = run(['compile', '--skill', 'test-cases']);
    check(path.dirname(path.join(tmp, out2.split('\n')[0].trim())) === runDir, 'recompile for the current run reuses its directory');
    // …but a DIFFERENT ticket starts a new run with its own profile (a bug-keyed run must not inherit the story run — caught live 2026-08-17)
    const out3 = run(['compile', '--skill', 'test-cases', '--ticket', 'BUG-7']);
    const runDir3 = path.dirname(path.join(tmp, out3.split('\n')[0].trim()));
    check(runDir3 !== runDir && /test-cases-BUG-7-[0-9a-f]{6}$/.test(runDir3), 'compile with a different --ticket starts a new run instead of reusing the marker');
    check(JSON.parse(fs.readFileSync(path.join(runDir3, 'profile.json'), 'utf8')).ticket_kind === 'bug', 'the new run\'s profile reflects the new ticket (ticket_kind=bug)');
    // Post-cutover: the repo-checkout copy is a supported dev mode — the
    // launcher falls back to core/engine + core/references (no built index
    // needed; Akela self-indexes). The old failure mode is gone by design.
    const repoOut = execFileSync(process.execPath, [path.join(ROOT, 'bin', 'qab.js'), 'compile', '--skill', 'qa', '--ticket', 'PROJ-9'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    check(/slice\.md/.test(repoOut), 'the repo-checkout copy compiles via the core/ dev fallback (self-indexed, no dist needed)');
    // Installed-alias normalization (caught live 2026-08-27: `--skill qa-exploratory` compiled a
    // 0-source slice silently — installed skills are named qa-*, scope vocabulary uses short names)
    const outAlias = run(['compile', '--skill', 'qa-test-cases', '--ticket', 'PROJ-1']);
    check(/(skill|activity) alias: qa-test-cases → test-cases/.test(outAlias), 'compile normalizes the installed qa- prefix and says so');
    const aliasSlice = fs.readFileSync(path.join(tmp, outAlias.split('\n')[0].trim()), 'utf8');
    const aliasFm = aliasSlice.split('\n---\n')[0];
    const aliasRefs = [...(aliasFm.split('\nsources:\n')[1] || '').split('\ndropped:')[0].matchAll(/^  - id: (\S+)/gm)].map(m => m[1]).filter(id => id.startsWith('REF-')).sort();
    check(JSON.stringify(aliasRefs) === JSON.stringify(expectedRefs), `qa-test-cases packs the same REF set as test-cases (${aliasRefs.length})`);

    // Body checks on a skill whose slice packs playwright-patterns (e2e-write). Compiling a
    // different skill starts a new run, so this sits after every check that relies on the
    // test-cases run marker.
    const outW = run(['compile', '--skill', 'e2e-write', '--ticket', 'PROJ-2']);
    const sliceW = fs.readFileSync(path.join(tmp, outW.split('\n')[0].trim()), 'utf8');
    const manifestIdsW = [...((sliceW.split('\n---\n')[0].split('\nsources:\n')[1] || '').split('\ndropped:')[0]).matchAll(/^  - id: (\S+)/gm)].map(m => m[1]);
    const iMust = manifestIdsW.indexOf('REF-playwright-patterns#must-rules');
    check(iMust >= 0 && manifestIdsW[iMust + 1] === 'LRN-20260801-01', 'learning packed right after the section it Overrides', iMust < 0 ? 'must-rules not in the e2e-write slice' : `next is ${manifestIdsW[iMust + 1]}`);
    // verbatim body: compare against the SAME references dir the shipped helper reads (en or ko-only dist),
    // locating headings via index.json (heading text is locale-specific; ids are not)
    const refsDir = path.join(resolvePlatformDir('claude'), 'references');
    const src = fs.readFileSync(path.join(refsDir, 'playwright-patterns.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
    const neverHeading = index['REF-playwright-patterns#never'].heading;
    const i0 = src.findIndex(l => l.replace(/^#+\s*/, '').trim() === neverHeading); let i1 = i0 + 1; while (i1 < src.length && !/^##? /.test(src[i1])) i1++;
    const expectedBody = src.slice(i0 + 1, i1).filter(l => !/^<!--\s*qab:/.test(l)).join('\n').trim();
    const afterNever = sliceW.split(`## REF-playwright-patterns#never — ${neverHeading}\n`)[1];
    const gotNever = afterNever ? afterNever.split('\n## ')[0].trim() : null;
    check(gotNever !== null && gotNever === expectedBody, 'slice body is verbatim source text (NEVER section)', gotNever !== null ? 'text differs' : 'section header not found');
    // …and the LAST section of a file (runs to EOF — off-by-one territory): pitfalls
    const pitfallsHeading = index['REF-playwright-patterns#pitfalls'].heading;
    const j0 = src.findIndex(l => l.replace(/^#+\s*/, '').trim() === pitfallsHeading);
    const expectedLast = src.slice(j0 + 1).filter(l => !/^<!--\s*qab:/.test(l)).join('\n').trim();
    const afterHeader = sliceW.split(`## REF-playwright-patterns#pitfalls — ${pitfallsHeading}\n`)[1];
    const gotLast = afterHeader ? afterHeader.split('\n## ')[0].trim() : null;
    check(gotLast !== null && gotLast === expectedLast, 'slice body is verbatim for a file\'s LAST section (pitfalls, runs to EOF)', gotLast !== null ? `got ${gotLast.split('\n').length} lines, expected ${expectedLast.split('\n').length}` : 'header not found');
    // a 0-source compile must warn loudly on stderr, never succeed silently
    // (separate scratch dir: the main fixture has a scope=all learning, which packs for ANY skill)
    const { spawnSync } = require('child_process');
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-compile2-'));
    try {
      const resUnknown = spawnSync(process.execPath, [shipped, 'compile', '--skill', 'no-such-skill'], { env: { ...process.env, QAB_CWD: tmp2 }, encoding: 'utf8' });
      // Post-cutover semantics (RFC 0003 §2): the qa pack declares the activity
      // vocabulary, so an unknown skill name is REFUSED — exit 1, no run — which
      // is stricter than the 0.7.1 warning this check used to assert.
      check(resUnknown.status === 1 && /unknown activity/.test(resUnknown.stderr || ''), 'an unknown skill name is refused loudly (no silent empty slice, no junk run)');
      check(/declares: .*test-cases/.test(resUnknown.stderr || ''), 'the refusal names the activity vocabulary');
    } finally {
      fs.rmSync(tmp2, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Coverage proof on the real skills: every reference file a skill hard-lists has ≥1 section in that skill's declared read set
  for (const skill of getSkillDirs()) {
    const content = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md')) || '';
    const listed = [...content.matchAll(/\{\{REFERENCE_PATH\}\}\/((?:playbook\/)?[a-z0-9-]+)\.md/g)].map(m => m[1]);
    for (const stem of [...new Set(listed)]) {
      if (['self-improve', 'run-protocol'].includes(stem)) continue; // protocol pointers, not knowledge scope
      const covered = Object.entries(index).some(([id, e]) => id.startsWith(`REF-${stem}#`) && (e.scope.includes(skill) || (e.scope.includes('all') && e.tier === 'must')));
      check(covered, `${skill}: hard-listed ${stem}.md is in its compiled read set (scope covers it)`, `add ${skill} to the qab: scope of ${stem}.md`);
    }
  }
}

function testScopeOverrides() {
  console.log('\n🎛  Scope overrides (RFC 0002 PR A — .qabuddy.json compiler.scope)');
  const { execFileSync } = require('child_process');
  const os = require('os');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  const indexPath = path.join(resolvePlatformDir('claude'), 'references', 'index.json');
  if (!fs.existsSync(shipped) || !fs.existsSync(indexPath)) { fail('shipped qab.js + index.json present for override tests', 'run node build.js all'); return; }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // Real ids from the shipped index, picked by property so the test tracks reality, not a hardcoded name.
  const pick = (pred) => (Object.entries(index).find(([, e]) => pred(e)) || [null])[0];
  const removableId = pick(e => e.tier !== 'must' && e.scope.includes('test-cases') && !e.scope.includes('all'));
  const addableId = pick(e => e.tier !== 'must' && !e.scope.includes('test-cases') && !e.scope.includes('all'));
  const mustId = pick(e => e.tier === 'must');
  if (!removableId || !addableId || !mustId) { fail('index has a removable / addable / must section for override tests', `got ${removableId} / ${addableId} / ${mustId}`); return; }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-ovr-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-20T00:00:00Z' };
  const run = (args) => execFileSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const failsWith = (args) => { try { run(args); return null; } catch (e) { return e.status !== 0 ? String(e.stderr || '') : null; } };
  // Post-cutover contract (RFC 0003 decision 2): engine config lives in
  // akela.json — scenarios write it directly, translated the way akela-init
  // does (compiler.references globs → PRJ knowledge directories).
  const setCfg = (compiler) => {
    const refs = path.join(resolvePlatformDir('claude'), 'references');
    const cfg = { domain: path.join(refs, 'engine', 'qa.domain.json'), knowledge: [{ path: refs, namespace: 'REF' }] };
    if (compiler) {
      const { references, ...rest } = compiler;
      for (const d of [...new Set((references || []).map(g => path.dirname(g)))]) cfg.knowledge.push({ path: d, namespace: 'PRJ' });
      if (Object.keys(rest).length) cfg.compiler = rest;
    }
    fs.writeFileSync(path.join(tmp, 'akela.json'), JSON.stringify(cfg));
  };
  const compileManifest = () => {
    const out = run(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++compileManifest.n}`]); // fresh ticket → fresh run, no marker reuse
    const slice = fs.readFileSync(path.join(tmp, out.split('\n')[0].trim()), 'utf8');
    const fm = slice.split('\n---\n')[0];
    return {
      sources: (fm.split('\nsources:\n')[1] || '').split('\ndropped:')[0],
      dropped: fm.split('\ndropped:')[1] || '',
    };
  };
  compileManifest.n = 0;

  try {
    fs.mkdirSync(path.join(tmp, 'features-kb'), { recursive: true });

    // Baseline (no compiler config): the sections behave per their shipped scope.
    setCfg(undefined);
    const base = compileManifest();
    check(base.sources.includes(`- id: ${removableId} `), `baseline packs ${removableId} (shipped scope)`);
    check(!base.sources.includes(`- id: ${addableId} `), `baseline does not pack ${addableId} (scoped elsewhere)`);
    check(!/project-override/.test(base.sources + base.dropped), 'baseline manifest has no project-override markers');

    // remove + add: effective scope = (scope − remove) ∪ add, with manifest causality both ways (§2.1).
    setCfg({ scope: { [removableId]: { remove: ['test-cases'] }, [addableId]: { add: ['test-cases'] } } });
    const ovr = compileManifest();
    check(!ovr.sources.includes(`- id: ${removableId} `), `override removes ${removableId} from the slice`);
    check(new RegExp(`^  - id: ${removableId.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}   reason: project-override$`, 'm').test(ovr.dropped),
      'removed section listed under dropped with reason: project-override');
    check(new RegExp(`^  - id: ${addableId.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}   tier: \\w+   lines: \\d+   via: project-override$`, 'm').test(ovr.sources),
      'added section packed with via: project-override');
    check((ovr.sources.match(/via: project-override/g) || []).length === 1, 'via: project-override marks ONLY the override-caused section');
    // Overrides change selection, not validity: the removed id is still citable.
    run(['log', 'applied', removableId]);
    check(true, 'log applied still accepts a section an override removed (scope ≠ validity)');

    // Refusals — every one loud, nothing written (decisions 2–3).
    setCfg({ scope: { [removableId.slice(0, -1)]: { remove: ['qa'] } } });
    const eUnknown = failsWith(['compile', '--skill', 'test-cases']);
    check(eUnknown !== null && /unknown section id/.test(eUnknown), 'unknown override id refuses the compile');
    check(eUnknown !== null && eUnknown.includes(removableId), 'unknown-id refusal suggests the nearest real id', eUnknown || '(accepted)');
    setCfg({ scope: { [mustId]: { remove: [index[mustId].scope[0] || 'qa'] } } });
    const eMust = failsWith(['compile', '--skill', 'test-cases']);
    check(eMust !== null && /tier=must/.test(eMust) && eMust.includes(mustId), 'removing a tier=must section is refused with a named error (the floor, decision 2)', eMust || '(accepted)');
    setCfg({ scope: { [mustId]: { add: ['test-cases'] } } });
    const addMust = compileManifest();
    check(new RegExp(`- id: ${mustId.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} .*via: project-override`).test(addMust.sources), 'ADDING to a must section is allowed (the floor blocks removal only)');
    setCfg({ scope: { [removableId]: { remove: 'test-cases' } } });
    check(failsWith(['compile', '--skill', 'test-cases']) !== null, 'remove as a bare string (not an array) is refused');
    setCfg({ scope: { [removableId]: { rename: ['x'] } } });
    check(failsWith(['compile', '--skill', 'test-cases']) !== null, 'unknown override key is refused');
    setCfg({ scope: [] });
    check(failsWith(['compile', '--skill', 'test-cases']) !== null, 'compiler.scope as an array is refused');
    // The refusal happens before any run state is written for THIS compile: config errors must not
    // leave half-started runs behind. (The marker from the last good compile is still there — fine.)
    setCfg({});
    check(compileManifest().sources.includes(`- id: ${removableId} `), 'empty compiler config = shipped behaviour again (overrides are opt-in)');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testProjectRefs() {
  console.log('\n🏠 Project reference sections (RFC 0002 PR B — compiler.references, PRJ- ids)');
  const { execFileSync } = require('child_process');
  const os = require('os');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  const indexPath = path.join(resolvePlatformDir('claude'), 'references', 'index.json');
  if (!fs.existsSync(shipped) || !fs.existsSync(indexPath)) { fail('shipped qab.js + index.json present for project-ref tests', 'run node build.js all'); return; }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-prj-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-20T00:00:00Z' };
  const run = (args) => execFileSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const { spawnSync } = require('child_process');
  const runFull = (args) => { // stdout + stderr + exit code, whether it fails or not
    const r = spawnSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8' });
    return { out: r.stdout || '', err: r.stderr || '', code: r.status };
  };
  // Post-cutover contract (RFC 0003 decision 2): engine config lives in
  // akela.json — scenarios write it directly, translated the way akela-init
  // does (compiler.references globs → PRJ knowledge directories).
  const setCfg = (compiler) => {
    const refs = path.join(resolvePlatformDir('claude'), 'references');
    const cfg = { domain: path.join(refs, 'engine', 'qa.domain.json'), knowledge: [{ path: refs, namespace: 'REF' }] };
    if (compiler) {
      const { references, ...rest } = compiler;
      for (const d of [...new Set((references || []).map(g => path.dirname(g)))]) cfg.knowledge.push({ path: d, namespace: 'PRJ' });
      if (Object.keys(rest).length) cfg.compiler = rest;
    }
    fs.writeFileSync(path.join(tmp, 'akela.json'), JSON.stringify(cfg));
  };
  let ticketN = 0;
  const compileSlice = () => {
    const out = run(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    return fs.readFileSync(path.join(tmp, out.split('\n')[0].trim()), 'utf8');
  };

  try {
    fs.mkdirSync(path.join(tmp, 'features-kb', 'house'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'features-kb', 'house', 'payments.md'), [
      '# Payments testing', '<!-- qab: scope=test-cases -->', '',
      '## Seed rules', '<!-- qab: id=seed-rules -->', '',
      'We test payments with sandbox account P-77; never real cards.', '',
      '## QA-only note', '<!-- qab: id=qa-note scope=qa -->', '',
      'Refund checks run against the ledger export.', '',
      '## Always rule', '<!-- qab: id=always-rule tier=must scope=all -->', '',
      'House rule that reaches every skill.', '',
    ].join('\n'));
    setCfg({ references: ['features-kb/house/*.md'] });

    // Compile: same qab: contract, PRJ- namespace, verbatim body (§2.2).
    const slice = compileSlice();
    const fm = slice.split('\n---\n')[0];
    const sources = (fm.split('\nsources:\n')[1] || '').split('\ndropped:')[0];
    check(/^  - id: PRJ-payments#seed-rules   tier: should   lines: \d+$/m.test(sources), 'project section packed under its PRJ-<stem>#<id>');
    check(/^  - id: PRJ-payments#always-rule   tier: must   lines: \d+$/m.test(sources), 'project tier=must scope=all section packs for any skill (same rule as shipped)');
    check(!sources.includes('PRJ-payments#qa-note'), 'project section scoped to another skill is not packed');
    check(slice.includes('## PRJ-payments#seed-rules — Seed rules\n') && slice.includes('We test payments with sandbox account P-77; never real cards.'),
      'slice body is the verbatim project file text under the PRJ header');
    check(!/<!--\s*qab:/.test(slice.split('\n---\n').slice(1).join('')), 'qab metadata stripped from project section bodies too');
    // must-first ordering holds across the merged namespace
    const ids = [...sources.matchAll(/^  - id: (\S+)   tier: (\w+)/gm)].map(m => ({ id: m[1], tier: m[2] }));
    const lastMust = ids.map(x => x.tier).lastIndexOf('must');
    const firstOther = ids.findIndex(x => x.tier !== 'must' && x.tier !== 'lrn');
    check(firstOther === -1 || lastMust < firstOther, 'merged pack keeps every must section before any non-must');

    // Citation: accepted, counted, suggested-on-typo (validated against the project's own files).
    const cite = runFull(['log', 'applied', 'PRJ-payments#seed-rules']);
    check(cite.code === 0, 'log applied accepts a PRJ id that exists in the configured files', cite.err || '');
    run(['log', 'outcome', '--status', 'DONE']);
    const eTypo = runFull(['log', 'applied', 'PRJ-payments#seed-rule']);
    check(eTypo.code !== 0 && /unknown (PRJ|section) id/.test(eTypo.err) && eTypo.err.includes('PRJ-payments#seed-rules'),
      'unknown PRJ id is rejected with the nearest suggestion', eTypo.err || '(accepted)');
    const eMal = runFull(['log', 'applied', 'PRJ-Payments#x']);
    check(eMal.code !== 0 && /malformed PRJ id|source id must be/.test(eMal.err), 'malformed PRJ id is rejected');
    const st = JSON.parse(run(['stats', '--json']));
    const prjRow = (st.rows || []).find(r => r.src === 'PRJ-payments#seed-rules') || {};
    check(prjRow.kind === 'PRJ' && prjRow.applied === 1 && prjRow.in_slice === 1, `stats: PRJ rows carry kind=PRJ with applied/in_slice counts (${JSON.stringify(prjRow)})`);
    check(prjRow.promotion_candidate === false, 'stats: a PRJ section is never a promotion candidate (it already is a reference)');
    const comp = st.compliance || {};
    const withRef = Object.values(comp).reduce((a, c) => a + c.with_ref, 0);
    check(withRef === 1, 'compliance: a PRJ citation counts as a reference citation (with_ref)', JSON.stringify(comp));

    // PR A × PR B: overrides address the merged namespace.
    setCfg({ references: ['features-kb/house/*.md'], scope: { 'PRJ-payments#seed-rules': { remove: ['test-cases'] } } });
    const ovr = compileSlice().split('\n---\n')[0];
    check(/^  - id: PRJ-payments#seed-rules   reason: project-override$/m.test(ovr.split('\ndropped:')[1] || ''),
      'a scope override can remove a PRJ section (one namespace, manifest causality intact)');

    // Refusals and edges — loud, named, never silent (same spirit as decision 3).
    fs.writeFileSync(path.join(tmp, 'features-kb', 'house', 'broken.md'), '# House\n\n## Untagged\n\ntext\n');
    setCfg({ references: ['features-kb/house/*.md'] });
    const eBroken = runFull(['compile', '--skill', 'test-cases']);
    check(eBroken.code !== 0 && /broken\.md:3/.test(eBroken.err) && /no <!-- (qab|akela): id=/.test(eBroken.err),
      'a project file with an untagged ## refuses the compile, naming file:line', eBroken.err || '(accepted)');
    fs.rmSync(path.join(tmp, 'features-kb', 'house', 'broken.md'));
    // Post-cutover, ambiguity is guarded one level up: Akela takes ONE root
    // per namespace, so a second PRJ root — the old stem-collision setup — is
    // refused at config time, before any id can become ambiguous.
    fs.mkdirSync(path.join(tmp, 'features-kb', 'house2'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'features-kb', 'house2', 'payments.md'), '# Other payments\n<!-- qab: id=other scope=all -->\n\ntext\n');
    fs.writeFileSync(path.join(tmp, 'akela.json'), JSON.stringify({
      domain: path.join(resolvePlatformDir('claude'), 'references', 'engine', 'qa.domain.json'),
      knowledge: [{ path: path.join(resolvePlatformDir('claude'), 'references'), namespace: 'REF' },
                  { path: 'features-kb/house', namespace: 'PRJ' }, { path: 'features-kb/house2', namespace: 'PRJ' }] }));
    const eStem = runFull(['compile', '--skill', 'test-cases']);
    check(eStem.code !== 0 && /share the namespace "PRJ"/.test(eStem.err), 'a second PRJ root is refused (one root per namespace — PRJ ids stay unambiguous)', eStem.err || '(accepted)');
    fs.rmSync(path.join(tmp, 'features-kb', 'house2'), { recursive: true });
    // Post-cutover strictness (loud-config doctrine): a knowledge root that
    // does not exist refuses the compile and names the root — the 0.7.x
    // behavior was a warning; a missing dir is a config error, not a shrug.
    setCfg({ references: ['nowhere/*.md'] });
    const warn = runFull(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    check(warn.code !== 0 && /"nowhere" does not exist/.test(warn.err), 'a missing knowledge root refuses the compile, naming the root');
    fs.writeFileSync(path.join(tmp, 'akela.json'), JSON.stringify({
      domain: path.join(resolvePlatformDir('claude'), 'references', 'engine', 'qa.domain.json'),
      knowledge: 'features-kb/house' }));
    check(runFull(['compile', '--skill', 'test-cases']).code !== 0, 'knowledge as a bare string (not an array) is refused');
    // No config → PRJ citations are refused with a pointer, not accepted blind.
    setCfg({});
    const eNoCfg = runFull(['log', 'applied', 'PRJ-payments#seed-rules', '--run', 'open-run-000001']);
    check(eNoCfg.code !== 0 && /unknown namespace "PRJ"/.test(eNoCfg.err) && /configured knowledge roots: REF/.test(eNoCfg.err),
      'a PRJ citation with no PRJ knowledge root is refused, naming the configured roots');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Preamble + docs carry the PRJ id form (citation obligation, PR4 lineage).
  for (const platform of PLATFORMS) {
    const distSkill = readFile(path.join(resolvePlatformDir(platform), 'skills', 'qa', 'SKILL.md')) || '';
    check(/PRJ-<stem>#<id>/.test(distSkill), `dist/${platform}: preamble obligation 2 names the PRJ id form`);
  }
}

function testFingerprints() {
  console.log('\n🫆 Fingerprints + scoreboard (RFC 0001 PR6 — failure classes, falsified/duplicate-by-fp, in_slice)');
  const { execFileSync } = require('child_process');
  const os = require('os');
  const crypto = require('crypto');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  const indexPath = path.join(resolvePlatformDir('claude'), 'references', 'index.json');
  if (!fs.existsSync(shipped) || !fs.existsSync(indexPath)) { fail('shipped qab.js + index.json present for fingerprint tests', 'run node build.js all'); return; }
  // ── Text guards: vocabulary + emission points + distill rows, en and ko (runtime-facing → same PR, decision 14)
  // Post-cutover the closed vocabulary lives in the qa domain pack — the pack
  // is what the engine enforces, so the pack is what this guard reads.
  const KINDS = ['locator-not-found', 'ac-unmapped', 'spec-flaky', 'ci-step-failed', 'env-unreachable', 'auth-failed', 'fixture-missing', 'assertion-mismatch', 'tool-unavailable'];
  const qaPack = JSON.parse(readFile(path.join(CORE_DIR, 'engine', 'qa.domain.json')) || '{}');
  check(JSON.stringify(qaPack.fingerprints) === JSON.stringify(KINDS), 'the qa domain pack carries the closed fingerprint vocabulary (RFC 0001 §3.4)');
  for (const [label, refPath] of [['en', 'core/references/self-improve.md'], ['ko', 'locales/ko/references/self-improve.md']]) {
    const t = readFile(path.join(ROOT, refPath)) || '';
    check(/<!--\s*qab:\s*id=fingerprints\b/.test(t), `self-improve.md (${label}): has the fingerprints section (qab: id=fingerprints)`);
    for (const k of KINDS) check(t.includes(`\`${k}\``), `self-improve.md (${label}): names kind ${k}`);
    check(/akela\.js fp --list/.test(t) && /Fingerprint:/.test(t), `self-improve.md (${label}): capture rule links Fingerprint: via fp --list`);
    check(/akela\.js scoreboard/.test(t) && /\.cache\/scoreboard\.json/.test(t), `self-improve.md (${label}): names akela.js scoreboard + cache path`);
    check(/in_slice ≥ 10/.test(t) && /applied = 0/.test(t), `self-improve.md (${label}): never-applied rule = in_slice ≥ 10 ∧ applied = 0`);
  }
  const EMIT = { 'e2e-pom': ['locator-not-found'], 'e2e-write': ['spec-flaky', 'fixture-missing'], qa: ['ac-unmapped', 'env-unreachable', 'auth-failed', 'assertion-mismatch'], 'verify-fix': ['ci-step-failed'] };
  for (const [skill, kinds] of Object.entries(EMIT)) {
    for (const [label, base] of [['core', CORE_DIR], ['ko', path.join(ROOT, 'locales', 'ko')]]) {
      const t = readFile(path.join(base, 'skills', skill, 'SKILL.md')) || '';
      for (const k of kinds) check(new RegExp(`node \\$QAB fp ${k} `).test(t), `${skill} (${label}): emits fp ${k} via node $QAB`);
    }
  }
  for (const skill of getSkillDirs()) {
    if (EMIT[skill]) continue;
    const t = readFile(path.join(CORE_DIR, 'skills', skill, 'SKILL.md')) || '';
    check(!/node \$QAB fp /.test(t), `${skill}: no fingerprint emission (only the four detection-point skills emit)`);
  }
  for (const [label, p] of [['en', 'core/skills/improve/SKILL.md'], ['ko', 'locales/ko/skills/improve/SKILL.md']]) {
    const t = readFile(path.join(ROOT, p)) || '';
    check(/\*\*(Falsified|반증됨) \((fingerprint|지문)\)\*\*/.test(t) && /\*\*(Duplicate|중복) \((fingerprint|지문)\)\*\*/.test(t) && /\*\*(Never applied|적용된 적 없음)\*\*/.test(t), `improve (${label}): distill table has falsified/duplicate-by-fingerprint + never-applied rows`);
    check(/in_slice · applied · contradicted · runs · last_applied/.test(t), `improve (${label}): computed columns include in_slice`);
    check(/akela\.js scoreboard/.test(t), `improve (${label}): rebuilds the scoreboard after applying changes`);
  }
  for (const [label, p] of [['en', 'core/skills/setup/SKILL.md'], ['ko', 'locales/ko/skills/setup/SKILL.md']]) {
    const t = readFile(path.join(ROOT, p)) || '';
    check(/features-kb\/\.cache\//.test(t) && /fingerprints\.jsonl/.test(t), `setup (${label}): gitignore template has features-kb/.cache/ and names fingerprints.jsonl`);
  }
  for (const platform of PLATFORMS) {
    const idx = JSON.parse(readFile(path.join(resolvePlatformDir(platform), 'references', 'index.json')) || '{}');
    check(!!idx['REF-self-improve#fingerprints'], `dist/${platform}: index.json has REF-self-improve#fingerprints`);
  }

  // ── Behavioural: shipped helper against a scratch project
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-fp-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-17T00:00:00Z' };
  const run = (args, extraEnv) => execFileSync(process.execPath, [shipped, ...args], { env: { ...env, ...(extraEnv || {}) }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const fails = (args, extraEnv) => { try { run(args, extraEnv); return null; } catch (e) { return e.status !== 0 ? String(e.stderr || '') : null; } };
  const sha12 = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
  const F1 = sha12('locator-not-found\ncheckout/place-order-btn');   // the ffp contract: sha256(kind + "\n" + normalized key)[:12]
  const F2 = sha12('assertion-mismatch\nproj-9/tc-03');
  const F3 = sha12('auth-failed\nadmin/login');
  const F4 = sha12('spec-flaky\nx.spec.ts › tc-01');
  const F5 = sha12('ci-step-failed\ndeploy/smoke');
  try {
    fs.mkdirSync(path.join(tmp, 'features-kb'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'playwright', 'pom'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'playwright', 'AUTOMATION.md'), '# decisions\n');
    fs.writeFileSync(path.join(tmp, 'playwright', 'pom', 'x.page.ts'), '');
    const lrn = (id, scope, extra) => [`## ${id}: t`, '- **Status:** active', `- **Scope:** ${scope}`, '- **Statement:** s', '- **Overrides:** none', '- **Evidence:** e', ...(extra || []), ''];
    fs.writeFileSync(path.join(tmp, 'features-kb', 'LEARNINGS.md'), ['# Project Learnings', '',
      ...lrn('LRN-20260801-01', 'e2e-pom, qa', [`- **Fingerprint:** ffp-${F1}   <!-- prevents place-order drift -->`]),
      ...lrn('LRN-20260801-02', 'e2e-pom', [`- **Fingerprint:** ${F1}`]),            // same ffp, DIFFERENT scope → not a duplicate
      ...lrn('LRN-20260801-03', 'qa, e2e-pom', [`- **Fingerprint:** ffp-${F1}`]),    // same ffp, same scope set (other order) → duplicate of -01
      ...lrn('LRN-20260801-04', 'all'),
      ...lrn('LRN-20260801-05', 'qa', [`- **Fingerprint:** ffp-${F2}`]),             // qa-only: not in the e2e-pom slice
      ...lrn('LRN-20260801-06', 'qa', [`- **Fingerprint:** ffp-${F3}`]),
      ...lrn('LRN-20260801-07', 'e2e-pom', [`- **Fingerprint:** ffp-${F1}`, '- **Profile:** surface=api']),   // scoped to e2e-pom but profile-dropped from the slice
      ...lrn('LRN-20260801-08', 'e2e-write', [`- **Fingerprint:** ffp-${F4}`]),
      ...lrn('LRN-20260820-09', 'e2e-write', [`- **Fingerprint:** ffp-${F5}`]),                                // dated AFTER the fp line below
    ].join('\n'));

    const out = run(['compile', '--skill', 'e2e-pom', '--ticket', 'PROJ-9']);
    const runDir = path.dirname(path.join(tmp, out.split('\n')[0].trim()));
    const runId = path.basename(runDir);
    // emit
    const o1 = run(['fp', 'locator-not-found', 'checkout/place-order-btn']);
    const o2 = run(['fp', 'locator-not-found', 'Checkout / place-order-btn 5f5c55ab7 2026-08-17T10:00:00Z']);   // same class, incident noise
    run(['fp', 'locator-not-found', 'checkout/cancel-btn']);
    run(['fp', 'assertion-mismatch', 'PROJ-9/TC-03']);   // ffp F2 — LRN-05 carries it but is NOT in this slice
    run(['fp', 'spec-flaky', 'x.spec.ts › TC-01']);       // ffp F4 — LRN-08 (e2e-write) not in this slice → active [], but the class recurred
    run(['fp', 'ci-step-failed', 'deploy/smoke']);        // ffp F5 — dated 2026-08-17, BEFORE LRN-20260820-09 exists
    const fpFile = path.join(tmp, 'features-kb', 'fingerprints.jsonl');
    check(fs.existsSync(fpFile), 'fp writes fingerprints.jsonl next to the learnings file');
    const fps = fs.readFileSync(fpFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    check(fps.length === 6, `fp appends one line per call (${fps.length}/6)`);
    const l1 = fps[0] || {};
    check(l1.v === 1 && l1.ts === '2026-08-17T00:00:00Z' && l1.run === runId && (l1.activity || l1.skill) === 'e2e-pom' && l1.kind === 'locator-not-found' && l1.key === 'checkout/place-order-btn' && /^[0-9a-f]{12}$/.test(l1.pfp || ''), 'fp line has v/ts/run/activity/pfp/kind/key from marker + args', JSON.stringify(l1));
    check(l1.ffp === F1, `ffp = sha256(kind + "\\n" + key)[:12] (${l1.ffp} vs ${F1})`);
    check(fps[1].ffp === F1, 'normalization: case, spaces around /, a hex hash and a timestamp do not change the ffp (mutation guard: unnormalized key)');
    check(fps[2].ffp !== F1, 'a different element hashes to a different ffp');
    check(JSON.stringify([...(l1.active || [])].sort()) === JSON.stringify(['LRN-20260801-01', 'LRN-20260801-02', 'LRN-20260801-03']), `active = slice learnings whose Fingerprint: == ffp (${JSON.stringify(l1.active)})`);
    check(!(l1.active || []).includes('LRN-20260801-07'), 'active excludes a same-scope learning the compile dropped (profile mismatch) — active comes from the slice, not the scope (mutation guard)');
    check(Array.isArray(fps[2].active) && fps[2].active.length === 0, 'no matching Fingerprint: → active []');
    check(fps[3].ffp === F2 && fps[3].active.length === 0, 'active is computed from THIS run\'s slice, not from every learning (LRN-05 has the ffp but is qa-only) — mutation guard');
    check(/active=\[LRN-20260801-01/.test(o1) && /falsification evidence/.test(o1), 'fp prints the falsified learnings and says so');
    check((run(['fp', '--list']).match(/^[0-9a-f]{12}  /gm) || []).length === 6, 'fp --list prints this run\'s fingerprints (ffp kind key [active])');
    const mirrorFile = path.join(runDir, 'fingerprints.jsonl');
    check(fs.existsSync(mirrorFile) && fs.readFileSync(mirrorFile, 'utf8').trim().split('\n').length === 6, 'fp lines are mirrored into the run directory');
    // fallback without a slice: a plain run-id (no compile) → active from the skill's active read set
    run(['run-id', '--skill', 'qa', '--ticket', 'PROJ-9']);
    const o5 = run(['fp', 'assertion-mismatch', 'PROJ-9/TC-03']);
    check(/active=\[LRN-20260801-05\]/.test(o5), 'without a slice, active falls back to the skill\'s scoped active learnings (qa → LRN-05)');
    // validation
    const before = fs.readFileSync(fpFile, 'utf8');
    const e1 = fails(['fp', 'selector-broke', 'x']);
    check(e1 !== null && /Closed vocabulary/.test(e1) && /locator-not-found/.test(e1), 'unknown kind is rejected and the vocabulary printed', e1 || 'accepted');
    check(fails(['fp', 'locator-not-found']) !== null, 'fp without a key exits non-zero');
    check(fs.readFileSync(fpFile, 'utf8') === before, 'rejected fp calls append nothing');

    // ── stats: in_slice, never-applied (threshold), falsified/duplicate by fingerprint, promotion column
    const logFile = path.join(tmp, 'features-kb', 'learnings-log.jsonl');
    // 9 more compiled events naming LRN-04 (→ in_slice 10) and LRN-02 (→ 9: below threshold); written directly = the reader under test
    for (let i = 0; i < 9; i++) fs.appendFileSync(logFile, JSON.stringify({ v: 1, ts: '2026-08-10T00:00:00Z', run: `x-${i}`, skill: 'qa', event: 'compiled', sources: ['LRN-20260801-04', 'LRN-20260801-02', 'REF-playwright-patterns#never'], used: 1, max: 0, dropped: [] }) + '\n');
    for (const [r, ts] of [['a', '2026-08-11T00:00:00Z'], ['b', '2026-08-12T00:00:00Z'], ['c', '2026-08-13T00:00:00Z']]) {
      run(['log', 'applied', 'LRN-20260801-05', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
      run(['log', 'applied', 'LRN-20260801-06', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
      run(['log', 'applied', 'LRN-20260801-08', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
      run(['log', 'applied', 'LRN-20260820-09', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
      run(['log', 'applied', 'REF-playwright-patterns#never', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
      run(['log', 'outcome', '--status', 'DONE', '--skill', 'qa'], { QAB_RUN: `qa-${r}`, QAB_TS: ts });
    }
    const st = JSON.parse(run(['stats', '--json']));
    const row = id => (st.rows || []).find(r => r.src === id) || {};
    check(row('LRN-20260801-04').in_slice === 10 && row('LRN-20260801-04').applied === 0 && row('LRN-20260801-04').never_applied === true, `never-applied: in_slice 10 ∧ applied 0 (${JSON.stringify(row('LRN-20260801-04'))})`);
    check(row('LRN-20260801-02').in_slice === 10 && row('LRN-20260801-02').never_applied === true, 'in_slice = own compile (1) + 9 synthetic compiled events = 10; applied 0 → never-applied');
    check(row('LRN-20260801-01').in_slice === 1 && row('LRN-20260801-01').never_applied === false, 'in_slice 1 is far below the dormancy threshold');
    check(row('REF-playwright-patterns#never').in_slice === 10 && row('REF-playwright-patterns#never').applied === 3 && row('REF-playwright-patterns#never').never_applied === false, 'applied > 0 is never dormant however often it was in the slice');
    // threshold boundary: exactly 9 compiled events → not never-applied
    fs.appendFileSync(logFile, Array.from({ length: 9 }, (_, i) => JSON.stringify({ v: 1, ts: '2026-08-10T00:00:00Z', run: `z-${i}`, skill: 'qa', event: 'compiled', sources: ['LRN-20260801-98'], used: 1, max: 0, dropped: [] })).join('\n') + '\n');
    const st2 = JSON.parse(run(['stats', '--json']));
    const row2 = id => (st2.rows || []).find(r => r.src === id) || {};
    check(row2('LRN-20260801-98').in_slice === 9 && row2('LRN-20260801-98').never_applied === false, 'never-applied threshold boundary: in_slice 9 is NOT dormant (mutation guard: ≥10)');
    // falsified / duplicate by fingerprint
    check(row2('LRN-20260801-01').falsified_by_fingerprint === 2 && JSON.stringify(row2('LRN-20260801-01').fingerprint_ffps) === JSON.stringify([F1]), 'falsified (fingerprint): count of fp lines naming the LRN in active, with the ffp');
    check(row2('LRN-20260801-04').falsified_by_fingerprint === 0, 'no fp line names LRN-04 → not falsified by fingerprint');
    check(row2('LRN-20260801-03').duplicate_of === 'LRN-20260801-01', 'duplicate (fingerprint): same Fingerprint ∧ same Scope set → newer names the older id');
    check(row2('LRN-20260801-02').duplicate_of === null, 'same Fingerprint but different Scope is NOT a duplicate (mutation guard: dedupe ignores Scope)');
    check(row2('LRN-20260801-01').duplicate_of === null, 'the oldest entry of a duplicate group is not itself marked duplicate');
    // promotion column: LRN-06 (3 applied / 3 runs, ffp silent) is a candidate; LRN-05 has the same numbers but its ffp recurred after its date → not
    check(row2('LRN-20260801-06').applied === 3 && row2('LRN-20260801-06').promotion_candidate === true, 'promotion candidate: applied≥3 across ≥3 runs, contradicted 0, ffp silent');
    check(row2('LRN-20260801-05').applied === 3 && row2('LRN-20260801-05').promotion_candidate === false, 'a fingerprint-falsified LRN with 3 applied is not a candidate (LRN-05: F2 named it in active)');
    check(row2('LRN-20260801-08').applied === 3 && row2('LRN-20260801-08').falsified_by_fingerprint === 0 && row2('LRN-20260801-08').promotion_candidate === false, 'promotion needs the LRN\'s own ffp silent since its date — F4 recurred (active [] because LRN-08 was not in that slice) → not a candidate (mutation guard: recurrence ignored)');
    check(row2('LRN-20260820-09').applied === 3 && row2('LRN-20260820-09').promotion_candidate === true, 'an fp line dated BEFORE the LRN existed does not count against it (silent since activation, not since forever)');
    check(row2('REF-playwright-patterns#never').promotion_candidate === false, 'REF rows are never promotion candidates (already references)');
    check(row2('LRN-20260801-01').promotion_candidate === false, 'a fingerprint-falsified LRN is never a promotion candidate');
    // recurrence table
    const fpr = (st2.fingerprints || []).find(f => f.ffp === F1) || {};
    check(fpr.count === 2 && fpr.runs === 1 && JSON.stringify(fpr.active) === JSON.stringify(['LRN-20260801-01', 'LRN-20260801-02', 'LRN-20260801-03']) && fpr.kind === 'locator-not-found', `stats.fingerprints aggregates per ffp (count, runs, active) — ${JSON.stringify(fpr)}`);
    check((st2.fingerprints || []).length === 5, `stats.fingerprints lists every distinct class — F1 ×2, cancel-btn, F2 ×2, F4, F5 = 5 classes over 7 lines (${(st2.fingerprints || []).length}/5)`);
    check(st2.fingerprint_lines === 7, 'stats counts fingerprint lines');
    const table = run(['stats']);
    check(/\| LRN-20260801-01 \|[^\n]*falsified \(fingerprint [0-9a-f]{12} ×2\)/.test(table), 'stats table labels falsified (fingerprint <ffp> ×n)');
    check(/\| LRN-20260801-03 \|[^\n]*duplicate \(fingerprint\) of LRN-20260801-01/.test(table), 'stats table labels duplicate (fingerprint) of <older id>');
    check(/\| LRN-20260801-04 \|[^\n]*never applied \(in_slice 10\)/.test(table), 'stats table labels never applied (in_slice N)');
    check(/fingerprint recurrence/.test(table) && new RegExp(`\\| ${F1} \\| locator-not-found \\|`).test(table), 'stats prints the recurrence table');
    // --since filters fingerprints too
    const st3 = JSON.parse(run(['stats', '--json', '--since', '2026-08-18']));
    check(st3.fingerprint_lines === 0 && (st3.rows.find(r => r.src === 'LRN-20260801-01') || {}).falsified_by_fingerprint === 0, 'stats --since applies to fingerprint lines as well');

    // ── scoreboard: derived cache from both logs
    const sbOut = run(['scoreboard']);
    const sbPath = path.join(tmp, 'features-kb', '.cache', 'scoreboard.json');
    check(fs.existsSync(sbPath) && /\.cache\/scoreboard\.json rebuilt/.test(sbOut), 'scoreboard writes features-kb/.cache/scoreboard.json');
    const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
    check(sb.v === 1 && sb.rebuilt_at === '2026-08-17T00:00:00Z' && sb.per_source && sb.per_fingerprint, 'scoreboard v1 has rebuilt_at, per_source, per_fingerprint');
    const s04 = sb.per_source['LRN-20260801-04'] || {};
    check(s04.in_slice === 10 && s04.applied === 0 && s04.contradicted === 0 && s04.runs === 0 && s04.last_applied === null, `per_source has in_slice/applied/contradicted/last_applied/runs (${JSON.stringify(s04)})`);
    const s05 = sb.per_source['LRN-20260801-05'] || {};
    check(s05.applied === 3 && s05.runs === 3 && s05.last_applied === '2026-08-13', 'per_source applied/runs/last_applied from applied events');
    check(Object.values(sb.per_source).every(x => !('wins' in x) && !('losses' in x)), 'scoreboard v1 has no wins/losses (RFC decision 4)');
    check((sb.per_fingerprint[F1] || {}).count === 2 && (sb.per_fingerprint[F1] || {}).active.includes('LRN-20260801-01'), 'per_fingerprint carries recurrence + falsified learnings');
    // in_slice comes from compiled events, not from applied (mutation guard): a source applied but never compiled has in_slice 0
    run(['log', 'applied', 'LRN-20260801-77', '--skill', 'qa'], { QAB_RUN: 'qa-z' });
    run(['scoreboard']);
    const sb2 = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
    check((sb2.per_source['LRN-20260801-77'] || {}).in_slice === 0 && (sb2.per_source['LRN-20260801-77'] || {}).applied === 1, 'in_slice counts compiled events only — an applied-but-never-compiled source has in_slice 0');
    // rebuild is idempotent (same inputs → same file)
    const a = fs.readFileSync(sbPath, 'utf8'); run(['scoreboard']);
    check(fs.readFileSync(sbPath, 'utf8') === a, 'scoreboard rebuild is deterministic for the same inputs');
    // malformed fingerprint line: skipped, counted, never crashes
    fs.appendFileSync(fpFile, '{nope\n');
    check(/malformed/.test(run(['stats'])), 'stats reports malformed fingerprint lines and continues');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testGate() {
  console.log('\n🚪 Gate report (RFC 0002 PR C — qab.js gate, the §9.3 gate per project)');
  const { execFileSync } = require('child_process');
  const os = require('os');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  if (!fs.existsSync(shipped)) { fail('shipped qab.js present for gate tests', 'run node build.js all'); return; }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-gate-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-20T00:00:00Z' };
  const run = (args) => execFileSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const logFile = path.join(tmp, 'features-kb', 'learnings-log.jsonl');
  // The log is written directly because the READER is what's under test (same approach as the
  // synthetic compiled events in testFingerprints).
  const writeLog = ({ aRuns, bRuns, orphanOutcomes, withApplied = true, withDormant = true }) => {
    const lines = [];
    const ev = (o) => lines.push(JSON.stringify({ v: 1, ts: '2026-08-15T00:00:00Z', ...o }));
    for (let i = 0; i < aRuns; i++) {
      const r = `qa-A-${String(i).padStart(6, '0')}`;
      ev({ run: r, skill: 'qa', event: 'compiled', pfp: 'aaaaaaaaaaaa', sources: withDormant ? ['REF-playwright-patterns#never', 'LRN-20260801-01'] : ['LRN-20260801-01'], used: 200, max: 0, dropped: [] });
      if (withApplied) ev({ run: r, skill: 'qa', event: 'applied', src: 'LRN-20260801-01' });
      ev({ run: r, skill: 'qa', event: 'outcome', status: 'DONE' });
    }
    for (let i = 0; i < bRuns; i++) {
      const r = `tp-B-${String(i).padStart(6, '0')}`;
      ev({ run: r, skill: 'test-plan', event: 'compiled', pfp: 'bbbbbbbbbbbb', sources: withDormant ? ['REF-playwright-patterns#never'] : [], used: 150, max: 0, dropped: [] });
      ev({ run: r, skill: 'test-plan', event: 'outcome', status: 'DONE_WITH_CONCERNS' });
    }
    for (let i = 0; i < orphanOutcomes; i++) ev({ run: `old-${i}`, skill: 'qa', event: 'outcome', status: 'DONE' });
    fs.writeFileSync(logFile, lines.join('\n') + '\n');
  };

  try {
    fs.mkdirSync(path.join(tmp, 'features-kb'), { recursive: true });

    // Eligible: 2 profiles ≥ 8 outcomes, one dormant source (in_slice 17 ≥ 10) vs one applied in ≥ 3 runs.
    writeLog({ aRuns: 9, bRuns: 8, orphanOutcomes: 3 });
    const g = JSON.parse(run(['gate', '--json']));
    check(g.eligible === true && g.threshold_met === true && g.uneven === true, `gate: 9+8 outcomes across 2 profiles with uneven application → eligible (${g.reason})`);
    const pA = (g.profiles || []).find(p => p.pfp === 'aaaaaaaaaaaa') || {};
    const pB = (g.profiles || []).find(p => p.pfp === 'bbbbbbbbbbbb') || {};
    check(pA.outcomes === 9 && pA.statuses && pA.statuses.DONE === 9, 'gate: profile outcome counts come from outcome events joined to compiled pfp', JSON.stringify(pA));
    check(pB.outcomes === 8, 'gate: second profile counted independently');
    check(g.no_profile_runs === 3 && (g.profiles || []).length === 2,
      'gate: outcome runs without a compiled pfp are reported, NEVER summed into a profile (the §9.3 #23 mis-attribution guard)');
    check((g.dormant || []).some(d => d.src === 'REF-playwright-patterns#never' && d.in_slice === 17),
      'gate: dormant lists in_slice ≥ 10 ∧ applied = 0 sources with their in_slice', JSON.stringify(g.dormant));
    const sbs = g.slice_by_skill || g.slice_by_activity;
    check(sbs && sbs.qa && sbs.qa.last === 200 && sbs['test-plan'].compiles === 8,
      'gate: slice size per skill from compiled events (last + compiles)', JSON.stringify(sbs));
    const table = run(['gate']);
    check(/verdict: ELIGIBLE/.test(table), 'gate table prints an explicit verdict line');
    check(/does not classify causes/.test(table) && /cannot fire \/ duplicated elsewhere/.test(table),
      'an eligible report ends by asking the human for cause classification (decision 6) — the tool never guesses');

    // One outcome short on profile B → not eligible, reason names the counts.
    writeLog({ aRuns: 9, bRuns: 7, orphanOutcomes: 0 });
    const g2 = JSON.parse(run(['gate', '--json']));
    check(g2.eligible === false && g2.threshold_met === false && /have 1/.test(g2.reason),
      `gate: 8-outcome threshold is exact — 7 outcomes does not qualify (${g2.reason})`);
    check(!/does not classify causes/.test(run(['gate'])), 'a not-eligible report does not print the classification ask');

    // Threshold met but nothing dormant → not eligible: there is nothing for scoring to demote.
    writeLog({ aRuns: 9, bRuns: 8, orphanOutcomes: 0, withDormant: false });
    const g3 = JSON.parse(run(['gate', '--json']));
    check(g3.eligible === false && g3.threshold_met === true && /no dormant source/.test(g3.reason),
      `gate: even application fails the gate even past the outcome threshold (${g3.reason})`);

    // Threshold met, dormancy present, but nothing repeatedly applied → the contrast is one-sided.
    writeLog({ aRuns: 9, bRuns: 8, orphanOutcomes: 0, withApplied: false });
    const g4 = JSON.parse(run(['gate', '--json']));
    check(g4.eligible === false && /no source applied in ≥ 3/.test(g4.reason),
      `gate: dormancy without a repeatedly-applied side is not "uneven" (${g4.reason})`);

    // Empty log → a clean, honest zero report.
    fs.rmSync(logFile);
    const g5 = JSON.parse(run(['gate', '--json']));
    check(g5.eligible === false && (g5.profiles || []).length === 0, 'gate on an empty log reports not eligible, no crash');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // The command is documented where the model and the human look for it.
  const helpOut = (() => { try { return execFileSync(process.execPath, [shipped, 'help'], { encoding: 'utf8' }); } catch { return ''; } })();
  check(/(qab\.js|akela) gate +\[--json\]/.test(helpOut), 'the help output lists the gate subcommand');
}

function testScoring() {
  console.log('\n⚖️  Scoring (RFC 0002 PR D — compiler.scoring behind the gate) + gate-opened notification');
  const { execFileSync, spawnSync } = require('child_process');
  const os = require('os');
  const shipped = path.join(resolvePlatformDir('claude'), 'references', 'bin', 'qab.js');
  const indexPath = path.join(resolvePlatformDir('claude'), 'references', 'index.json');
  if (!fs.existsSync(shipped) || !fs.existsSync(indexPath)) { fail('shipped qab.js + index.json present for scoring tests', 'run node build.js all'); return; }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // Four real rankable sections (non-must, test-cases-scoped) with distinct roles in the scenarios.
  const rankableIds = Object.entries(index).filter(([, e]) => e.tier !== 'must' && e.scope.includes('test-cases') && !e.scope.includes('all')).map(([id]) => id);
  if (rankableIds.length < 4) { fail('index has ≥ 4 rankable test-cases sections for scoring tests', `have ${rankableIds.length}`); return; }
  const [hot, mid, pen, cold] = rankableIds;
  const mustIds = Object.entries(index).filter(([, e]) => e.tier === 'must' && (e.scope.includes('test-cases') || e.scope.includes('all'))).map(([id]) => id);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qab-score-'));
  const env = { ...process.env, QAB_CWD: tmp, QAB_TS: '2026-08-20T00:00:00Z' };
  const run = (args) => execFileSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const runFull = (args) => { const r = spawnSync(process.execPath, [shipped, ...args], { env, encoding: 'utf8' }); return { out: r.stdout || '', err: r.stderr || '', code: r.status }; };
  // Post-cutover contract (RFC 0003 decision 2): engine config lives in
  // akela.json — scenarios write it directly, translated the way akela-init
  // does (compiler.references globs → PRJ knowledge directories).
  const setCfg = (compiler) => {
    const refs = path.join(resolvePlatformDir('claude'), 'references');
    const cfg = { domain: path.join(refs, 'engine', 'qa.domain.json'), knowledge: [{ path: refs, namespace: 'REF' }] };
    if (compiler) {
      const { references, ...rest } = compiler;
      for (const d of [...new Set((references || []).map(g => path.dirname(g)))]) cfg.knowledge.push({ path: d, namespace: 'PRJ' });
      if (Object.keys(rest).length) cfg.compiler = rest;
    }
    fs.writeFileSync(path.join(tmp, 'akela.json'), JSON.stringify(cfg));
  };
  const logFile = path.join(tmp, 'features-kb', 'learnings-log.jsonl');
  let ticketN = 0;
  const compileSlice = () => {
    const out = run(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    return fs.readFileSync(path.join(tmp, out.split('\n')[0].trim()), 'utf8');
  };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

  // Synthetic per-pfp history: `closedRuns` runs of `pfp`, applying per the pattern, + a second
  // profile with `otherOutcomes` outcomes so the gate threshold can be met. `cold` never applies
  // and rides ≥ 10 slices → the dormant half of "uneven". Written directly: the READER is under test.
  const writeLog = ({ pfp, closedRuns, otherOutcomes, appliedAt, contradictAt = {} }) => {
    const lines = [];
    const ev = (o) => lines.push(JSON.stringify({ v: 1, ts: '2026-08-15T00:00:00Z', ...o }));
    for (let i = 0; i < closedRuns; i++) {
      const r = `tc-P-${String(i).padStart(6, '0')}`;
      ev({ run: r, skill: 'test-cases', event: 'compiled', pfp, sources: [hot, mid, pen, cold], used: 100, max: 0, dropped: [] });
      for (const [src, runsSet] of Object.entries(appliedAt)) if (runsSet.includes(i)) ev({ run: r, skill: 'test-cases', event: 'applied', src });
      for (const [src, runsSet] of Object.entries(contradictAt)) if (runsSet.includes(i)) ev({ run: r, skill: 'test-cases', event: 'contradicted', src, note: 'x' });
      ev({ run: r, skill: 'test-cases', event: 'outcome', status: 'DONE' });
    }
    ev({ run: 'tc-P-extra', skill: 'test-cases', event: 'compiled', pfp, sources: [cold], used: 10, max: 0, dropped: [] });
    for (let i = 0; i < otherOutcomes; i++) {
      ev({ run: `q-F-${String(i).padStart(6, '0')}`, skill: 'qa', event: 'compiled', pfp: 'ffffffffffff', sources: [cold], used: 50, max: 0, dropped: [] });
      ev({ run: `q-F-${String(i).padStart(6, '0')}`, skill: 'qa', event: 'outcome', status: 'DONE' });
    }
    fs.writeFileSync(logFile, lines.join('\n') + '\n');
  };

  try {
    fs.mkdirSync(path.join(tmp, 'features-kb'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'features-kb', 'LEARNINGS.md'), [
      '# Project Learnings', '',
      '## LRN-20260801-01: floor learning', '- **Status:** active', '- **Scope:** test-cases', '- **Statement:** always packed', '- **Overrides:** none', '- **Evidence:** run', '',
    ].join('\n'));

    // The project's own pfp, learned from a baseline compile (profile is deterministic per directory state).
    const out0 = run(['compile', '--skill', 'test-cases', '--ticket', 'PROJ-0']);
    const pfp = JSON.parse(fs.readFileSync(path.join(tmp, path.dirname(out0.split('\n')[0].trim()), 'profile.json'), 'utf8')).pfp;
    const unscoredCount = (fs.readFileSync(path.join(tmp, out0.split('\n')[0].trim()), 'utf8').split('\nsources:\n')[1] || '').split('\ndropped:')[0].match(/^  - id: /gm).length;

    // History: hot applied every run (→ floor via recent), mid runs 0–4 (score > 0, not recent),
    // pen like mid but contradicted in the last run (→ ×0.25), cold never (dormant).
    writeLog({ pfp, closedRuns: 9, otherOutcomes: 8, appliedAt: { [hot]: [0, 1, 2, 3, 4, 5, 6, 7, 8], [mid]: [0, 1, 2, 3, 4], [pen]: [0, 1, 2, 3, 4] }, contradictAt: { [pen]: [8] } });
    check(JSON.parse(run(['gate', '--json'])).eligible === true, 'scoring scenario log opens the gate (precondition)');

    // Self-calibrating budget: read every section's rendered line count from an uncapped scored run.
    setCfg({ scoring: true, budget_lines: 100000 });
    const wide = compileSlice();
    const linesOf = (id) => parseInt((wide.match(new RegExp(`^  - id: ${esc(id)}   tier: \\w+   lines: (\\d+)`, 'm')) || [])[1] || 'NaN', 10);
    const floorUsed = [...mustIds, hot].reduce((a, id) => a + linesOf(id), 0) + linesOf('LRN-20260801-01');
    const budget = floorUsed + linesOf(mid) + linesOf(pen);   // fits mid and pen after the floor; cold does not

    setCfg({ scoring: true, budget_lines: budget });
    const slice = compileSlice();
    const fm = slice.split('\n---\n')[0];
    const sources = (fm.split('\nsources:\n')[1] || '').split('\ndropped:')[0];
    const droppedBlock = fm.split('\ndropped:')[1] || '';
    check(/scoring: on$/m.test(fm) && new RegExp(`^budget: \\{max: ${budget}, used: \\d+\\}`, 'm').test(fm), 'scored manifest declares scoring: on and the line budget');
    check(mustIds.every(id => sources.includes(`- id: ${id} `)), 'every tier=must section is packed regardless of budget (the floor)');
    check(sources.includes(`- id: ${hot} `) && !new RegExp(`- id: ${esc(hot)} .*score:`).test(sources), 'a source applied in the last 3 profile runs is floor — packed without competing on score');
    check(sources.includes('- id: LRN-20260801-01 '), 'learnings are floor — a project\'s own corrections are never budget-dropped');
    const midLine = sources.match(new RegExp(`^  - id: ${esc(mid)} .*score: ([\\d.]+)   n: (\\d+)$`, 'm'));
    check(midLine !== null && parseFloat(midLine[1]) > 0, 'a rankable candidate with applied history packs WITH its score and n in the manifest', sources);
    const coldDrop = droppedBlock.match(new RegExp(`^  - id: ${esc(cold)}   reason: budget   score: 0   n: (\\d+)$`, 'm'));
    check(coldDrop !== null && parseInt(coldDrop[1], 10) >= 10, 'the dormant source is dropped by BUDGET with score 0 and its n — dormancy alone never drops', droppedBlock);
    const penLine = (sources + droppedBlock).match(new RegExp(`id: ${esc(pen)} .*score: ([\\d.]+)`));
    check(penLine !== null && Math.abs(parseFloat(penLine[1]) - parseFloat(midLine[1]) * 0.25) < 0.002,
      `a contradiction in the last 3 profile runs multiplies the score by 0.25 (${penLine && penLine[1]} vs ${midLine[1]})`);

    // §9.3: never a global ranking. Gate eligible on OTHER profiles, this pfp thin → unscored compile.
    writeLog({ pfp: 'eeeeeeeeeeee', closedRuns: 9, otherOutcomes: 8, appliedAt: { [hot]: [0, 1, 2, 3, 4, 5, 6, 7, 8] } });
    const thin = compileSlice();
    check(/scoring: on \(insufficient data for this profile: 0\/8 outcomes — unscored\)/.test(thin), 'a profile below 8 outcomes compiles UNSCORED — thin per-profile data never falls back to a global ranking');
    const thinSources = (thin.split('\nsources:\n')[1] || '').split('\ndropped:')[0];
    check(thinSources.match(/^  - id: /gm).length === unscoredCount && /^budget: \{max: 0,/m.test(thin), 'the insufficient-data compile equals the unscored set, uncapped');

    // Audition: on every 10th closed run of the pfp, the best budget-dropped candidate rides along.
    writeLog({ pfp, closedRuns: 10, otherOutcomes: 8, appliedAt: { [hot]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [mid]: [0, 1, 2, 3, 4] } });
    setCfg({ scoring: true, budget_lines: 1 });   // floor only; every rankable is over budget
    const aud = compileSlice();
    check(new RegExp(`^  - id: ${esc(mid)} .*score: [\\d.]+   n: \\d+   \\(audition\\)$`, 'm').test((aud.split('\nsources:\n')[1] || '').split('\ndropped:')[0]),
      'every 10th profile run packs the best budget-dropped candidate marked (audition) — deterministic exploration', aud.split('\n---\n')[0]);

    // Enablement guard (RFC 0002 §2.4): not eligible → refuse; override → compile + ONE logged decision.
    writeLog({ pfp, closedRuns: 9, otherOutcomes: 0, appliedAt: { [hot]: [0, 1, 2] } });
    setCfg({ scoring: true, budget_lines: budget });
    const eGate = runFull(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    check(eGate.code !== 0 && /gate is not eligible/.test(eGate.err) && /scoringOverride/.test(eGate.err),
      'scoring with an ineligible gate refuses the compile, naming the gate reason and the override path', eGate.err || '(compiled)');
    setCfg({ scoring: true, budget_lines: budget, scoringOverride: 'pilot: maintainer accepts thin data' });
    const oc = runFull(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    check(oc.code === 0 && /decision recorded in the log/.test(oc.err), 'an explicit override compiles and announces the recorded decision', oc.err);
    const decisions = () => fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.includes('"scoring-override"')).length;
    check(decisions() === 1, 'the override decision lands in the log as a decision line with the note');
    runFull(['compile', '--skill', 'test-cases', '--ticket', `PROJ-${++ticketN}`]);
    check(decisions() === 1, 'recompiling does not duplicate the decision — one line per distinct note');

    // Config refusals.
    setCfg({ scoring: true });
    check(runFull(['compile', '--skill', 'test-cases']).code !== 0, 'scoring without budget_lines is refused');
    setCfg({ scoring: 'yes', budget_lines: budget });
    check(runFull(['compile', '--skill', 'test-cases']).code !== 0, 'scoring must be boolean true — anything else is refused');
    setCfg({ scorring: true });
    check(/unknown compiler key "scorring"/.test(runFull(['compile', '--skill', 'test-cases']).err), 'a mistyped compiler key is refused, not silently ignored');

    // Gate-opened notification: fires on the exact outcome that tips the gate, and only then.
    setCfg(undefined);
    const noteLines = [];
    const nev = (o) => noteLines.push(JSON.stringify({ v: 1, ts: '2026-08-15T00:00:00Z', ...o }));
    for (let i = 0; i < 9; i++) {
      nev({ run: `a-${i}`, skill: 'qa', event: 'compiled', pfp: 'aaaaaaaaaaaa', sources: [cold, hot], used: 9, max: 0, dropped: [] });
      nev({ run: `a-${i}`, skill: 'qa', event: 'applied', src: hot });
      nev({ run: `a-${i}`, skill: 'qa', event: 'outcome', status: 'DONE' });
    }
    nev({ run: 'a-x', skill: 'qa', event: 'compiled', pfp: 'aaaaaaaaaaaa', sources: [cold], used: 1, max: 0, dropped: [] });
    for (let i = 0; i < 7; i++) {
      nev({ run: `b-${i}`, skill: 'qa', event: 'compiled', pfp: 'bbbbbbbbbbbb', sources: [], used: 1, max: 0, dropped: [] });
      nev({ run: `b-${i}`, skill: 'qa', event: 'outcome', status: 'DONE' });
    }
    nev({ run: 'b-7', skill: 'qa', event: 'compiled', pfp: 'bbbbbbbbbbbb', sources: [], used: 1, max: 0, dropped: [] });
    nev({ run: 'b-8', skill: 'qa', event: 'compiled', pfp: 'bbbbbbbbbbbb', sources: [], used: 1, max: 0, dropped: [] });
    fs.writeFileSync(logFile, noteLines.join('\n') + '\n');
    const tip = run(['log', 'outcome', '--status', 'DONE', '--run', 'b-7', '--skill', 'qa']);
    check(/scoring gate OPENED/.test(tip) && /never enable it yourself/.test(tip) && /Gain:/.test(tip) && /Risk:/.test(tip),
      'the opened notice carries the plain-language trade-off (gain AND risk) plus the SDT-decides instruction', tip);
    const after = run(['log', 'outcome', '--status', 'DONE', '--run', 'b-8', '--skill', 'qa']);
    check(!/scoring gate OPENED/.test(after), 'the NEXT outcome does not re-announce — the notice fires on the transition only');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // The relay obligation ships in the preamble (both locales; en via dist, ko via source twin).
  for (const platform of PLATFORMS) {
    const distSkill = readFile(path.join(resolvePlatformDir(platform), 'skills', 'qa', 'SKILL.md')) || '';
    check(/scoring gate opened|점수화 게이트가 열렸다/.test(distSkill), `dist/${platform}: preamble tells the model to relay the gate-opened notice and ask the SDT`);
  }
  check(/점수화 게이트가 열렸다/.test(readFile(path.join(ROOT, 'locales', 'ko', 'preamble-base.md')) || ''), 'ko preamble twin carries the relay obligation');
}

(async () => {   // one async step (the EPIPE spawn check); everything else stays synchronous
testSkillManifest();
await testRuntimeHelper();
testLearningsGates();
testReferenceIndex();
testCompile();
testScopeOverrides();
testProjectRefs();
testGate();
testScoring();
testFingerprints();
testAkelaEquivalence();
testExcludeConditions();
testEvalFixtures();
testRubrics();
testCrlfTolerance();
testInstallerSkillSync();
testDistBom();
testKbPathHygiene();

testBadgeCount();

console.log('\n================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.msg}`);
    if (f.detail) console.log(`    → ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
  process.exit(0);
}
})();
