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
testExcludeConditions();
testEvalFixtures();
testCrlfTolerance();
testInstallerSkillSync();

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
