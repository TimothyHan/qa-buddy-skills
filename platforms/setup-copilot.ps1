#Requires -Version 5.1
<#
.SYNOPSIS
    QABuddy — GitHub Copilot Setup (Windows)
.DESCRIPTION
    Copies skills into .github/skills/ in the current repo so Copilot can discover them.
    Must be run from within a git repository.
.PARAMETER NoPrefix
    Install without 'qa-' prefix.
.PARAMETER Uninstall
    Remove all QABuddy skills from .github/skills/.
.PARAMETER Status
    Show current installation status.
#>
[CmdletBinding(DefaultParameterSetName = 'Install')]
param(
    [Parameter(ParameterSetName = 'Install')]
    [switch]$NoPrefix,

    [Parameter(ParameterSetName = 'Uninstall')]
    [switch]$Uninstall,

    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SdtSkills = Join-Path $ScriptDir 'skills'
$SdtRefs   = Join-Path $ScriptDir 'references'

$Skills = @(
    'qa', 'verify-fix', 'test-plan', 'test-cases',
    'review-ticket', 'sprint-status', 'exploratory', 'improve', 'setup', 'start', 'eval'
)

# Verify git repo
try {
    $RepoRoot = (git rev-parse --show-toplevel 2>&1).Trim()
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Host 'ERROR: Not in a git repository.' -ForegroundColor Red
    Write-Host 'Copilot reads skills from .github/skills/ in the repo.'
    Write-Host 'Run this script from within your project repo.'
    exit 1
}

$SkillsDir = Join-Path $RepoRoot '.github' 'skills'

# ─── Uninstall ───────────────────────────────────────────────────────────────

if ($Uninstall) {
    Write-Host 'QABuddy — Uninstall (Copilot)' -ForegroundColor Cyan
    Write-Host ('=' * 33)
    Write-Host ''
    $removed = 0
    foreach ($skill in $Skills) {
        foreach ($name in @("qa-$skill", $skill)) {
            $target = Join-Path $SkillsDir $name
            if (Test-Path $target) {
                Remove-Item $target -Force -Recurse
                Write-Host "  REMOVED  $name"
                $removed++
            }
        }
    }
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        Remove-Item $refPath -Force -Recurse
        Write-Host '  REMOVED  qa-references'
        $removed++
    }
    # Check for instructions file
    $instructions = Join-Path $RepoRoot '.github' 'copilot-instructions.md'
    if ((Test-Path $instructions) -and (Select-String -Path $instructions -Pattern 'QABuddy' -Quiet)) {
        Write-Host ''
        Write-Host '  NOTE    .github/copilot-instructions.md contains QABuddy content.'
        Write-Host "          Remove manually if desired: $instructions"
    }
    Write-Host ''
    Write-Host "Removed: $removed items"
    exit 0
}

# ─── Status ──────────────────────────────────────────────────────────────────

if ($Status) {
    Write-Host 'QABuddy — Status (Copilot)' -ForegroundColor Cyan
    Write-Host ('=' * 30)
    Write-Host ''
    Write-Host "Skills directory: $SkillsDir"
    Write-Host ''
    foreach ($skill in $Skills) {
        $found = $false
        foreach ($name in @("qa-$skill", $skill)) {
            $target = Join-Path $SkillsDir $name
            if (Test-Path $target) {
                Write-Host "  OK      $name"
                $found = $true
            }
        }
        if (-not $found) { Write-Host "  MISSING $skill" -ForegroundColor Yellow }
    }
    Write-Host ''
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        Write-Host '  OK      qa-references'
    } else {
        Write-Host '  MISSING qa-references' -ForegroundColor Yellow
    }
    Write-Host ''
    $instructions = Join-Path $RepoRoot '.github' 'copilot-instructions.md'
    if (Test-Path $instructions) {
        Write-Host '  OK      .github/copilot-instructions.md exists'
    } else {
        Write-Host '  MISSING .github/copilot-instructions.md' -ForegroundColor Yellow
    }
    Write-Host ''
    # Check MCP
    $mcpConfig = Join-Path '.' '.vscode' 'mcp.json'
    foreach ($mcp in @('playwright', 'atlassian')) {
        $label = $mcp.Substring(0,1).ToUpper() + $mcp.Substring(1)
        if ((Test-Path $mcpConfig) -and (Select-String -Path $mcpConfig -Pattern $mcp -Quiet)) {
            Write-Host "  OK      $label MCP configured"
        } else {
            Write-Host "  WARN    $label MCP not detected in .vscode/mcp.json" -ForegroundColor Yellow
        }
    }
    exit 0
}

# ─── Install ─────────────────────────────────────────────────────────────────

$Prefix = if ($NoPrefix) { '' } else { 'qa-' }

Write-Host 'QABuddy — Setup (Copilot)' -ForegroundColor Cyan
Write-Host ('=' * 29)
Write-Host ''

if (-not (Test-Path $SkillsDir)) {
    New-Item -ItemType Directory -Path $SkillsDir -Force | Out-Null
}

$installed = 0
$skipped = 0

foreach ($skill in $Skills) {
    $target = Join-Path $SkillsDir "$Prefix$skill"
    $source = Join-Path $SdtSkills $skill

    if (-not (Test-Path $source)) {
        Write-Host "  SKIP    $skill (source not found)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    if (Test-Path $target) { Remove-Item $target -Force -Recurse }
    Copy-Item -Path $source -Destination $target -Recurse -Force
    Write-Host "  OK      $Prefix$skill"
    $installed++
}

# Install references
$refTarget = Join-Path $SkillsDir 'qa-references'
if (Test-Path $SdtRefs) {
    if (Test-Path $refTarget) { Remove-Item $refTarget -Force -Recurse }
    Copy-Item -Path $SdtRefs -Destination $refTarget -Recurse -Force
    Write-Host '  OK      qa-references'
    $installed++
}

Write-Host ''
Write-Host "Installed: $installed items ($($installed - 1) skills + references)"
if ($skipped -gt 0) { Write-Host "Skipped: $skipped" -ForegroundColor Yellow }

# ─── Project Instructions ───────────────────────────────────────────────────

Write-Host ''
$instructions = Join-Path $RepoRoot '.github' 'copilot-instructions.md'
if (Test-Path $instructions) {
    Write-Host '  OK      .github/copilot-instructions.md already exists'
    Write-Host '  INFO    Review and merge QABuddy instructions manually if needed.'
} else {
    $projectFile = Join-Path $ScriptDir '.github' 'copilot-instructions.md'
    if (Test-Path $projectFile) {
        $instrDir = Split-Path $instructions -Parent
        if (-not (Test-Path $instrDir)) { New-Item -ItemType Directory -Path $instrDir -Force | Out-Null }
        Copy-Item -Path $projectFile -Destination $instructions
        Write-Host '  OK      Created .github/copilot-instructions.md'
    }
}

# ─── MCP Checks ─────────────────────────────────────────────────────────────

Write-Host ''
Write-Host 'Checking MCP servers...'

$mcpConfig = Join-Path '.' '.vscode' 'mcp.json'
foreach ($mcp in @('playwright', 'atlassian')) {
    $label = $mcp.Substring(0,1).ToUpper() + $mcp.Substring(1)
    if ((Test-Path $mcpConfig) -and (Select-String -Path $mcpConfig -Pattern $mcp -Quiet)) {
        Write-Host "  OK      $label MCP configured"
    } else {
        Write-Host "  WARN    $label MCP not detected" -ForegroundColor Yellow
        Write-Host "          See README.md for configuration instructions."
    }
}

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host ('-' * 37)
Write-Host 'Skills copied to .github/skills/. Copilot will discover them automatically.'
Write-Host ''
Write-Host 'Remember to commit .github/skills/ to your repo so all team members get them.'
