#!/usr/bin/env bash
# Install QABuddy skills on a GitHub runner from a checkout of this repository
# (global symlinks, the same path QABuddy's own CI proves). Usage: install.sh <qabuddy checkout>
set -euo pipefail
QB="${1:?path to the QABuddy checkout}"
cd "$QB"
npm ci --silent
node build.js claude > /dev/null
dist/claude/setup > "$RUNNER_TEMP/qabuddy-setup.txt"
dist/claude/setup --status | tee "$RUNNER_TEMP/qabuddy-status.txt"
! grep -Eq 'MISSING|FAIL' "$RUNNER_TEMP/qabuddy-status.txt"
echo "QAB_BIN=$HOME/.claude/skills/qa-references/bin" >> "$GITHUB_ENV"
echo "QAB_SRC=$QB" >> "$GITHUB_ENV"
