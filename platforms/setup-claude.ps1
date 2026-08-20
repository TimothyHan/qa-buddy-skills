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

# ─── Orphan pruning ──────────────────────────────────────────────────────────
# A skill QABuddy shipped once and no longer ships leaves an owned entry behind.
# Uninstall and status both iterate $Skills — what ships *now* — so an entry for a
# removed skill is invisible to every code path: nothing reports it, nothing deletes it,
# and for link installs it is left dangling at a build path that no longer exists.
# Enumerate the install directory instead, and treat an owned entry we no longer ship as
# an orphan. Ownership goes through Test-Owned, exactly as install and uninstall do.
function Get-Orphans([string]$Dir, [string]$ExpectedRoot) {
    if (-not (Test-Path $Dir)) { return @() }
    $keep = @('qa-references', 'slowhama-references', 'slowhama-qa-references')
    foreach ($s in $Skills) { $keep += $s; $keep += "qa-$s" }
    return @(Get-ChildItem $Dir -Force -ErrorAction SilentlyContinue |
        Where-Object { $keep -notcontains $_.Name } |
        Where-Object { Test-Owned $_.FullName $ExpectedRoot } |
        ForEach-Object { $_.FullName })
}

# $Mode = 'remove' | 'report'. Returns how many orphans were handled.
function Invoke-Prune([string]$Dir, [string]$ExpectedRoot, [string]$Mode) {
    $n = 0
    foreach ($o in (Get-Orphans $Dir $ExpectedRoot)) {
        $n++
        $leaf = Split-Path $o -Leaf
        if ($Mode -eq 'remove') {
            Remove-Link $o
            Write-Host "  PRUNED   $leaf (no longer shipped by QABuddy)"
        } else {
            Write-Host "  ORPHAN   $leaf (no longer shipped — re-run setup to prune)"
        }
    }
    return $n
}

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
    foreach ($name in @('qa-references', 'slowhama-references', 'slowhama-qa-references')) {
        $target = Join-Path $SkillsDir $name
        if (Test-Path $target) {
            $item = Get-Item $target -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                Remove-Link $target
                Write-Host "  REMOVED  $name"
                $removed++
            } else {
                Write-Host "  SKIP     $name (not a link — left untouched)" -ForegroundColor Yellow
            }
        }
    }
    Write-Host ''
    $removed += Invoke-Prune $SkillsDir $SdtSkills 'remove'
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
                if (Test-Owned $target $SdtSkills) {
                    Write-Host "  OK      $name -> $(@((Get-Item $target -Force).Target)[0])"
                    $found = $true
                } else {
                    Write-Host "  FOREIGN $name (not QABuddy's — ignored)" -ForegroundColor Yellow
                }
            }
        }
        if (-not $found) { Write-Host "  MISSING $skill" -ForegroundColor Yellow }
    }
    $null = Invoke-Prune $SkillsDir $SdtSkills 'report'
    Write-Host ''
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        if (Test-Owned $refPath $SdtRefs) {
            Write-Host "  OK      qa-references"
        } else {
            Write-Host "  FOREIGN qa-references (not QABuddy's — ignored)" -ForegroundColor Yellow
        }
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
$null = Invoke-Prune $SkillsDir $SdtSkills 'remove'
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
        if (Test-Owned $target $SdtSkills) {
            Remove-Link $target
        } else {
            Write-Host "  FAIL    $Prefix$skill — another tool's item occupies $target. Remove it manually or use prefix mode." -ForegroundColor Red
            $skipped++
            continue
        }
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
if (Test-Path -LiteralPath $SdtRefs) {
    if ((Test-Path $refTarget) -and -not (Test-Owned $refTarget $SdtRefs)) {
        Write-Host "  FAIL    qa-references — another item occupies $refTarget. Remove it manually." -ForegroundColor Red
        $refTarget = $null
    }
    if ($refTarget) {
    if (Test-Path $refTarget) { Remove-Link $refTarget }
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
} else {
    Write-Host "  SKIP    qa-references (not found: $SdtRefs)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Installed: $installed items"
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
