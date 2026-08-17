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
    const lines = content.split('\n').length;
    check(
      lines <= 70,
      `playbook/${file}: ${lines} lines (≤70)`,
      `${lines} lines — over budget`
    );
  }
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

      const hasSeverity = distContent.includes('Severity & Priority');
      if (tier === '2') {
        check(hasSeverity, `${skill} (tier 2) on ${platform}: has severity tables`);
      } else if (tier === '1') {
        check(!hasSeverity, `${skill} (tier 1) on ${platform}: no severity tables`);
      }
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
  'qa', 'review-ticket', 'setup', 'sprint-status', 'start', 'test-cases',
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

function testRuntimeHelper() {
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
    check(/`QAB=[^"'`\s]+\/bin\/qab\.js`/.test(distSkill), `dist/${platform}: preamble assigns QAB=<path>/bin/qab.js unquoted`);
    check(!/QAB="node/.test(distSkill), `dist/${platform}: preamble does not quote "node ~/…" (tilde would not expand)`);
    check((distSkill.match(/node \$QAB (run-id|log)/g) || []).length >= 4, `dist/${platform}: preamble calls node $QAB for run-id/log (≥4 sites)`);
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

    const runId = run(['run-id', '--skill', 'qa', '--ticket', 'PROJ-1']).trim();
    check(/^qa-PROJ-1-[0-9a-f]{6}$/.test(runId), `run-id prints <skill>-<ticket>-<6hex> (${runId})`);
    check(fs.existsSync(path.join(tmp, '.qa-reports', '.qab-run')), 'run-id writes .qa-reports/.qab-run marker');

    run(['log', 'applied', 'LRN-20260808-03']);
    run(['log', 'contradicted', 'LRN-20260808-04', '--note', 'script uses --prefix']);
    run(['log', 'outcome', '--status', 'DONE']);
    // a second run, id via env — must append, not rewrite
    run(['log', 'applied', 'LRN-20260808-03', '--skill', 'test-cases'], { QAB_RUN: 'test-cases-x-abcdef' });
    run(['log', 'outcome', '--status', 'DONE'], { QAB_RUN: 'test-cases-x-abcdef' });
    run(['log', 'applied', 'LRN-20260808-03'], { QAB_RUN: 'third-run-000001' });
    run(['log', 'outcome', '--status', 'DONE_WITH_CONCERNS'], { QAB_RUN: 'third-run-000001' });
    // boundary data: LRN-07 applied twice across two runs (NOT a candidate: needs ≥3);
    // LRN-08 contradicted twice with no applied afterwards (falsified)
    run(['log', 'applied', 'LRN-20260808-07'], { QAB_RUN: 'test-cases-x-abcdef' });
    run(['log', 'applied', 'LRN-20260808-07'], { QAB_RUN: 'third-run-000001' });
    run(['log', 'applied', 'LRN-20260808-08'], { QAB_TS: '2026-08-10T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-08', '--note', 'first'], { QAB_TS: '2026-08-11T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-08', '--note', 'second'], { QAB_RUN: 'third-run-000001', QAB_TS: '2026-08-12T00:00:00Z' });
    // LRN-09: contradicted twice but applied again afterwards → NOT falsified (the "no applied since" clause)
    run(['log', 'contradicted', 'LRN-20260808-09', '--note', 'a'], { QAB_TS: '2026-08-11T00:00:00Z' });
    run(['log', 'contradicted', 'LRN-20260808-09', '--note', 'b'], { QAB_TS: '2026-08-12T00:00:00Z' });
    run(['log', 'applied', 'LRN-20260808-09'], { QAB_RUN: 'third-run-000001', QAB_TS: '2026-08-13T00:00:00Z' });

    const logFile = path.join(tmp, 'kb', 'learnings-log.jsonl');
    check(fs.existsSync(logFile), 'log writes learnings-log.jsonl next to learningsPath');
    const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n') : [];
    check(lines.length === 15, `log appends one line per event (${lines.length}/15)`);
    let parsed = [];
    let allJson = true;
    for (const l of lines) { try { parsed.push(JSON.parse(l)); } catch { allJson = false; } }
    check(allJson, 'every log line is valid JSON');
    const first = parsed[0] || {};
    check(first.v === 1 && first.ts === '2026-08-17T00:00:00Z' && first.run === runId && first.skill === 'qa' && first.event === 'applied' && first.src === 'LRN-20260808-03',
      'first line has v/ts/run/skill/event/src from marker + args', JSON.stringify(first));
    check(parsed[1] && parsed[1].note === 'script uses --prefix', 'contradicted line carries --note');
    check(parsed[2] && parsed[2].status === 'DONE' && parsed[2].event === 'outcome', 'outcome line carries --status');
    check(parsed[3] && parsed[3].run === 'test-cases-x-abcdef' && parsed[3].skill === 'test-cases', 'QAB_RUN / --skill override the marker');

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
    check(/\| source \| applied \| contradicted \| runs \| last_applied \|/.test(table), 'stats prints the computed-columns table');
    check(/LRN-20260808-03[^\n]*promotion candidate/.test(table) && /LRN-20260808-08[^\n]*falsified/.test(table), 'stats table labels findings per row');

    // Malformed line tolerance: skipped and counted, never crashes
    fs.appendFileSync(logFile, '{not json\n');
    const stats2 = JSON.parse(run(['stats', '--json']));
    check(stats2.malformed === 1 && stats2.events === 15, 'stats skips and counts malformed lines');
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

testSkillManifest();
testRuntimeHelper();
testLearningsGates();
testExcludeConditions();
testEvalFixtures();
testCrlfTolerance();
testInstallerSkillSync();
testDistBom();
testKbPathHygiene();

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
