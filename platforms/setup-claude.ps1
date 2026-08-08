#Requires -Version 5.1
<#
.SYNOPSIS
    QABuddy — Claude Code Setup (Windows)
.DESCRIPTION
    Symlinks skills into ~/.claude/skills/ so Claude Code can discover them.
.PARAMETER NoPrefix
    Install without 'qa-' prefix.
.PARAMETER Uninstall
    Remove all QABuddy skill symlinks.
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
$SkillsDir = Join-Path (Join-Path $HOME '.claude') 'skills'
$SdtSkills = Join-Path $ScriptDir 'skills'
$SdtRefs   = Join-Path $ScriptDir 'references'

$Skills = Get-ChildItem $SdtSkills -Directory | Select-Object -ExpandProperty Name

# ─── Uninstall ───────────────────────────────────────────────────────────────

if ($Uninstall) {
    Write-Host 'QABuddy — Uninstall (Claude Code)' -ForegroundColor Cyan
    Write-Host ('=' * 37)
    Write-Host ''
    $removed = 0
    foreach ($skill in $Skills) {
        foreach ($name in @("qa-$skill", $skill)) {
            $target = Join-Path $SkillsDir $name
            if (Test-Path $target) {
                $item = Get-Item $target -Force
                if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                    Remove-Item $target -Force
                    Write-Host "  REMOVED  $name"
                    $removed++
                }
            }
        }
    }
    foreach ($name in @('qa-references', 'slowhama-references', 'slowhama-qa-references')) {
        $target = Join-Path $SkillsDir $name
        if (Test-Path $target) {
            Remove-Item $target -Force -Recurse
            Write-Host "  REMOVED  $name"
            $removed++
        }
    }
    Write-Host ''
    Write-Host "Removed: $removed symlinks"
    exit 0
}

# ─── Status ──────────────────────────────────────────────────────────────────

if ($Status) {
    Write-Host 'QABuddy — Status (Claude Code)' -ForegroundColor Cyan
    Write-Host ('=' * 34)
    Write-Host ''
    Write-Host "Skills directory: $SkillsDir"
    Write-Host ''
    foreach ($skill in $Skills) {
        $found = $false
        foreach ($name in @("qa-$skill", $skill)) {
            $target = Join-Path $SkillsDir $name
            if (Test-Path $target) {
                $item = Get-Item $target -Force
                if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                    $linkTarget = $item.Target
                    Write-Host "  OK      $name -> $linkTarget"
                } else {
                    Write-Host "  OK      $name (directory)"
                }
                $found = $true
            }
        }
        if (-not $found) { Write-Host "  MISSING $skill" -ForegroundColor Yellow }
    }
    Write-Host ''
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        Write-Host "  OK      qa-references"
    } else {
        Write-Host "  MISSING qa-references" -ForegroundColor Yellow
    }
    Write-Host ''
    # Check Atlassian MCP
    $settingsFile = Join-Path (Join-Path $HOME '.claude') 'settings.json'
    if ((Test-Path $settingsFile) -and (Select-String -Path $settingsFile -Pattern 'atlassian' -Quiet)) {
        Write-Host '  OK      Atlassian MCP configured'
    } else {
        Write-Host '  WARN    Atlassian MCP not detected' -ForegroundColor Yellow
    }
    exit 0
}

# ─── Install ─────────────────────────────────────────────────────────────────

$Prefix = if ($NoPrefix) { '' } else { 'qa-' }

Write-Host 'QABuddy — Setup (Claude Code)' -ForegroundColor Cyan
Write-Host ('=' * 33)
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

    if (Test-Path $target) {
        Remove-Item $target -Force -Recurse
    }

    try {
        New-Item -ItemType SymbolicLink -Path $target -Target $source -Force | Out-Null
        Write-Host "  OK      $Prefix$skill -> $source"
    } catch {
        # Symlink failed (no admin / Developer Mode off) — fall back to junction
        try {
            cmd /c mklink /J "`"$target`"" "`"$source`"" 2>&1 | Out-Null
            Write-Host "  OK      $Prefix$skill -> $source (junction)"
        } catch {
            Write-Host "  FAIL    $Prefix$skill — enable Developer Mode or run as admin" -ForegroundColor Red
            $skipped++
            continue
        }
    }
    $installed++
}

# Install references
$refTarget = Join-Path $SkillsDir 'qa-references'
if (Test-Path $SdtRefs) {
    if (Test-Path $refTarget) { Remove-Item $refTarget -Force -Recurse }
    try {
        New-Item -ItemType SymbolicLink -Path $refTarget -Target $SdtRefs -Force | Out-Null
        Write-Host "  OK      qa-references -> $SdtRefs"
    } catch {
        try {
            cmd /c mklink /J "`"$refTarget`"" "`"$SdtRefs`"" 2>&1 | Out-Null
            Write-Host "  OK      qa-references -> $SdtRefs (junction)"
        } catch {
            Write-Host "  FAIL    qa-references — enable Developer Mode or run as admin" -ForegroundColor Red
        }
    }
    $installed++
}

Write-Host ''
Write-Host "Installed: $installed items ($($installed - 1) skills + references)"
if ($skipped -gt 0) { Write-Host "Skipped: $skipped skills" -ForegroundColor Yellow }

# ─── Atlassian MCP Check ────────────────────────────────────────────────────

Write-Host ''
Write-Host 'Checking Atlassian MCP...'

$atlassianFound = $false
foreach ($config in @(
    (Join-Path (Join-Path $HOME '.claude') 'settings.json'),
    (Join-Path (Join-Path '.' '.claude') 'settings.json'),
    (Join-Path (Join-Path '.' '.claude') 'settings.local.json')
)) {
    if ((Test-Path $config) -and (Select-String -Path $config -Pattern 'atlassian' -Quiet)) {
        $atlassianFound = $true
        break
    }
}

if ($atlassianFound) {
    Write-Host '  OK      Atlassian MCP configured'
} else {
    Write-Host '  WARN    Atlassian MCP not detected' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  Most QABuddy skills need Jira/Confluence access via Atlassian MCP.'
    Write-Host '  See README.md for MCP configuration instructions.'
}

# ─── Summary ─────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host ('-' * 37)
if ($Prefix) {
    Write-Host 'Skills installed with prefix. Use as:'
    Write-Host '  /qa-qa, /qa-test-plan, /qa-test-cases, etc.'
    Write-Host ''
    Write-Host "For short names: $($MyInvocation.MyCommand.Path) -NoPrefix"
} else {
    Write-Host 'Skills installed without prefix. Use as:'
    Write-Host '  /qa, /test-plan, /test-cases, /review-ticket, etc.'
}
Write-Host ''
Write-Host "Check status:  $($MyInvocation.MyCommand.Path) -Status"
Write-Host "Uninstall:     $($MyInvocation.MyCommand.Path) -Uninstall"
