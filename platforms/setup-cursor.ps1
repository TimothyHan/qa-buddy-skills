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
    Join-Path (Join-Path '.' '.cursor') 'skills'
} else {
    Join-Path (Join-Path $HOME '.cursor') 'skills'
}

$Skills = Get-ChildItem $SdtSkills -Directory | Select-Object -ExpandProperty Name

# PS 5.1: Remove-Item on a directory symlink throws NullReferenceException,
# and -Recurse can descend into the link target. Delete links via .Delete().
function Remove-Link([string]$LinkPath) {
    $item = Get-Item $LinkPath -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        $item.Delete()
    } else {
        Remove-Item $LinkPath -Force -Recurse
    }
}

# Ownership check: never delete, overwrite, or count what QABuddy didn't install.
# Links are owned when the target resolves under our expected root; copied
# directories are owned only when they carry the .qabuddy-owned marker file.
function Test-Owned([string]$Path, [string]$ExpectedRoot) {
    $item = Get-Item $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return $false }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        $t = @($item.Target)[0]
        if (-not $t) { return $false }
        try {
            return ([IO.Path]::GetFullPath($t)).StartsWith(
                [IO.Path]::GetFullPath($ExpectedRoot), [StringComparison]::OrdinalIgnoreCase)
        } catch { return $false }
    }
    return Test-Path (Join-Path $Path '.qabuddy-owned')
}

function New-SymlinkOrCopy {
    param([string]$Target, [string]$Source, [bool]$UseProject)

    if ((Test-Path $Target) -and -not (Test-Owned $Target $Source)) { return 'occupied' }

    if ($UseProject) {
        if (Test-Path $Target) { Remove-Link $Target }
        Copy-Item -Path $Source -Destination $Target -Recurse -Force
        Set-Content -Path (Join-Path $Target '.qabuddy-owned') -Value $Source
        return 'copied'
    }

    if (Test-Path $Target) { Remove-Link $Target }
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
                if (Test-Owned $target $SdtSkills) {
                    Remove-Link $target
                    Write-Host "  REMOVED  $name"
                    $removed++
                } else {
                    Write-Host "  SKIP     $name (not QABuddy's — left untouched)" -ForegroundColor Yellow
                }
            }
        }
    }
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        if (Test-Owned $refPath $SdtRefs) {
            Remove-Link $refPath
            Write-Host '  REMOVED  qa-references'
            $removed++
        } else {
            Write-Host "  SKIP     qa-references (not QABuddy's — left untouched)" -ForegroundColor Yellow
        }
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
                if (Test-Owned $target $SdtSkills) {
                    Write-Host "  OK      $name"
                    $found = $true
                } else {
                    Write-Host "  FOREIGN $name (not QABuddy's — ignored)" -ForegroundColor Yellow
                }
            }
        }
        if (-not $found) { Write-Host "  MISSING $skill" -ForegroundColor Yellow }
    }
    Write-Host ''
    # Check MCP configs
    foreach ($mcp in @('playwright', 'atlassian')) {
        $mcpFound = $false
        foreach ($config in @(
            (Join-Path (Join-Path '.' '.cursor') 'mcp.json'),
            (Join-Path (Join-Path $HOME '.cursor') 'mcp.json')
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
Write-Host 'NOTE: Cursor is an UNVERIFIED platform — CI does not execute this installer.' -ForegroundColor Yellow
Write-Host '      Officially supported: Claude Code. Issue reports welcome.' -ForegroundColor Yellow
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
    # NOTE: plain ifs, not a switch — `continue` inside a switch continues the
    # switch, not the enclosing foreach, which would fall through to $installed++
    if ($result -eq 'occupied') {
        Write-Host "  FAIL    $Prefix$skill — another tool's item occupies the target. Remove it manually or use prefix mode." -ForegroundColor Red
        $skipped++
        continue
    }
    if ($result -eq 'failed') {
        Write-Host "  FAIL    $Prefix$skill — enable Developer Mode or run as admin" -ForegroundColor Red
        $skipped++
        continue
    }
    if ($result -eq 'symlink')  { Write-Host "  OK      $Prefix$skill -> $source" }
    if ($result -eq 'junction') { Write-Host "  OK      $Prefix$skill -> $source (junction)" }
    if ($result -eq 'copied')   { Write-Host "  OK      $Prefix$skill (copied)" }
    $installed++
}

# Install references
$refTarget = Join-Path $SkillsDir 'qa-references'
if (Test-Path -LiteralPath $SdtRefs) {
    $result = New-SymlinkOrCopy -Target $refTarget -Source $SdtRefs -UseProject $Project
    if ($result -eq 'occupied') {
        Write-Host "  FAIL    qa-references — another item occupies $refTarget. Remove it manually." -ForegroundColor Red
    } elseif ($result -ne 'failed') {
        Write-Host "  OK      qa-references ($result)"
        $installed++
    } else {
        Write-Host '  FAIL    qa-references — enable Developer Mode or run as admin' -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP    qa-references (not found: $SdtRefs)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Installed: $installed items"
if ($skipped -gt 0) { Write-Host "Skipped: $skipped" -ForegroundColor Yellow }

# ─── MCP Checks ─────────────────────────────────────────────────────────────

Write-Host ''
Write-Host 'Checking MCP servers...'

foreach ($mcp in @('playwright', 'atlassian')) {
    $mcpFound = $false
    foreach ($config in @(
        (Join-Path (Join-Path '.' '.cursor') 'mcp.json'),
        (Join-Path (Join-Path $HOME '.cursor') 'mcp.json')
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
