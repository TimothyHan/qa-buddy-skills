#Requires -Version 5.1
<#
.SYNOPSIS
    QABuddy — Cursor Setup (Windows)
.DESCRIPTION
    Symlinks skills into ~/.cursor/skills/ so Cursor can discover them.
.PARAMETER NoPrefix
    Install without 'qa-' prefix.
.PARAMETER Project
    Copy skills into .cursor/skills/ in current project instead of global.
.PARAMETER Uninstall
    Remove all QABuddy skill symlinks.
.PARAMETER Status
    Show current installation status.
#>
[CmdletBinding(DefaultParameterSetName = 'Install')]
param(
    [Parameter(ParameterSetName = 'Install')]
    [switch]$NoPrefix,

    [Parameter(ParameterSetName = 'Install')]
    [switch]$Project,

    [Parameter(ParameterSetName = 'Uninstall')]
    [switch]$Uninstall,

    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SdtSkills = Join-Path $ScriptDir 'skills'
$SdtRefs   = Join-Path $ScriptDir 'references'

$SkillsDir = if ($Project) {
    Join-Path '.' '.cursor' 'skills'
} else {
    Join-Path $HOME '.cursor' 'skills'
}

$Skills = @(
    'qa', 'verify-fix', 'test-plan', 'test-cases',
    'review-ticket', 'sprint-status', 'exploratory', 'improve', 'setup', 'start', 'eval'
)

function New-SymlinkOrCopy {
    param([string]$Target, [string]$Source, [bool]$UseProject)

    if ($UseProject) {
        if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
        Copy-Item -Path $Source -Destination $Target -Recurse -Force
        return 'copied'
    }

    if (Test-Path $Target) { Remove-Item $Target -Force -Recurse }
    try {
        New-Item -ItemType SymbolicLink -Path $Target -Target $Source -Force | Out-Null
        return 'symlink'
    } catch {
        try {
            cmd /c mklink /J "`"$Target`"" "`"$Source`"" 2>&1 | Out-Null
            return 'junction'
        } catch {
            return 'failed'
        }
    }
}

# ─── Uninstall ───────────────────────────────────────────────────────────────

if ($Uninstall) {
    Write-Host 'QABuddy — Uninstall (Cursor)' -ForegroundColor Cyan
    Write-Host ('=' * 32)
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
    Write-Host ''
    Write-Host "Removed: $removed items"
    exit 0
}

# ─── Status ──────────────────────────────────────────────────────────────────

if ($Status) {
    Write-Host 'QABuddy — Status (Cursor)' -ForegroundColor Cyan
    Write-Host ('=' * 29)
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
    # Check MCP configs
    foreach ($mcp in @('playwright', 'atlassian')) {
        $mcpFound = $false
        foreach ($config in @(
            (Join-Path '.' '.cursor' 'mcp.json'),
            (Join-Path $HOME '.cursor' 'mcp.json')
        )) {
            if ((Test-Path $config) -and (Select-String -Path $config -Pattern $mcp -Quiet)) {
                $mcpFound = $true; break
            }
        }
        $label = $mcp.Substring(0,1).ToUpper() + $mcp.Substring(1)
        if ($mcpFound) {
            Write-Host "  OK      $label MCP configured"
        } else {
            Write-Host "  WARN    $label MCP not detected" -ForegroundColor Yellow
        }
    }
    exit 0
}

# ─── Install ─────────────────────────────────────────────────────────────────

$Prefix = if ($NoPrefix) { '' } else { 'qa-' }
$Mode = if ($Project) { 'project' } else { 'global' }

Write-Host 'QABuddy — Setup (Cursor)' -ForegroundColor Cyan
Write-Host ('=' * 28)
Write-Host "Mode: $Mode"
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

    $result = New-SymlinkOrCopy -Target $target -Source $source -UseProject $Project
    switch ($result) {
        'symlink'  { Write-Host "  OK      $Prefix$skill -> $source" }
        'junction' { Write-Host "  OK      $Prefix$skill -> $source (junction)" }
        'copied'   { Write-Host "  OK      $Prefix$skill (copied)" }
        'failed'   {
            Write-Host "  FAIL    $Prefix$skill — enable Developer Mode or run as admin" -ForegroundColor Red
            $skipped++
            continue
        }
    }
    $installed++
}

# Install references
$refTarget = Join-Path $SkillsDir 'qa-references'
$result = New-SymlinkOrCopy -Target $refTarget -Source $SdtRefs -UseProject $Project
if ($result -ne 'failed') {
    Write-Host "  OK      qa-references ($result)"
    $installed++
}

Write-Host ''
Write-Host "Installed: $installed items ($($installed - 1) skills + references)"
if ($skipped -gt 0) { Write-Host "Skipped: $skipped" -ForegroundColor Yellow }

# ─── MCP Checks ─────────────────────────────────────────────────────────────

Write-Host ''
Write-Host 'Checking MCP servers...'

foreach ($mcp in @('playwright', 'atlassian')) {
    $mcpFound = $false
    foreach ($config in @(
        (Join-Path '.' '.cursor' 'mcp.json'),
        (Join-Path $HOME '.cursor' 'mcp.json')
    )) {
        if ((Test-Path $config) -and (Select-String -Path $config -Pattern $mcp -Quiet)) {
            $mcpFound = $true; break
        }
    }
    $label = $mcp.Substring(0,1).ToUpper() + $mcp.Substring(1)
    if ($mcpFound) {
        Write-Host "  OK      $label MCP configured"
    } else {
        Write-Host "  WARN    $label MCP not detected" -ForegroundColor Yellow
        Write-Host "          See README.md for configuration instructions."
    }
}

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host ('-' * 37)
if ($Prefix) {
    Write-Host 'Skills installed with prefix. Use as:'
    Write-Host '  /qa-qa, /qa-test-plan, /qa-test-cases, etc.'
} else {
    Write-Host 'Skills installed without prefix. Use as:'
    Write-Host '  /qa, /test-plan, /test-cases, etc.'
}
