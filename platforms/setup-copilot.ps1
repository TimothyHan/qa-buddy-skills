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

    [Parameter(ParameterSetName = 'Install')]
    [switch]$Adopt,

    [Parameter(ParameterSetName = 'Uninstall')]
    [switch]$Uninstall,

    [Parameter(ParameterSetName = 'Status')]
    [switch]$Status
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
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

# -Adopt: stamp ownership markers onto pre-v0.2.3 QABuddy copies so the
# normal flow can manage them. Evidence: qa- prefixed real directory, no
# marker, SKILL.md mentioning QABuddy (references: playbook\ present).
function Invoke-AdoptLegacy([string]$Dir) {
    $adopted = 0
    foreach ($skill in $Skills) {
        $d = Join-Path $Dir "qa-$skill"
        $skillMd = Join-Path $d 'SKILL.md'
        if ((Test-Path $d) -and -not ((Get-Item $d -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) `
            -and -not (Test-Path (Join-Path $d '.qabuddy-owned')) `
            -and (Test-Path $skillMd) -and (Select-String -Path $skillMd -Pattern 'QABuddy' -Quiet)) {
            Set-Content -Path (Join-Path $d '.qabuddy-owned') -Value 'adopted pre-v0.2.3 copy'
            Write-Host "  ADOPTED  qa-$skill (legacy copy — marker stamped)"
            $adopted++
        }
    }
    $rd = Join-Path $Dir 'qa-references'
    if ((Test-Path $rd) -and -not ((Get-Item $rd -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) `
        -and -not (Test-Path (Join-Path $rd '.qabuddy-owned')) `
        -and (Test-Path (Join-Path $rd 'playbook'))) {
        Set-Content -Path (Join-Path $rd '.qabuddy-owned') -Value 'adopted pre-v0.2.3 copy'
        Write-Host '  ADOPTED  qa-references (legacy copy — marker stamped)'
        $adopted++
    }
    if ($adopted -eq 0) { Write-Host "  (no legacy copies found in $Dir)" }
}

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

$SkillsDir = Join-Path (Join-Path $RepoRoot '.github') 'skills'

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
    # Check for instructions file
    $instructions = Join-Path (Join-Path $RepoRoot '.github') 'copilot-instructions.md'
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
    $refPath = Join-Path $SkillsDir 'qa-references'
    if (Test-Path $refPath) {
        if (Test-Owned $refPath $SdtRefs) {
            Write-Host '  OK      qa-references'
        } else {
            Write-Host "  FOREIGN qa-references (not QABuddy's — ignored)" -ForegroundColor Yellow
        }
    } else {
        Write-Host '  MISSING qa-references' -ForegroundColor Yellow
    }
    Write-Host ''
    $instructions = Join-Path (Join-Path $RepoRoot '.github') 'copilot-instructions.md'
    if (Test-Path $instructions) {
        Write-Host '  OK      .github/copilot-instructions.md exists'
    } else {
        Write-Host '  MISSING .github/copilot-instructions.md' -ForegroundColor Yellow
    }
    Write-Host ''
    # Check MCP
    $mcpConfig = Join-Path (Join-Path '.' '.vscode') 'mcp.json'
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
Write-Host 'NOTE: Copilot is an UNVERIFIED platform — CI does not execute this installer.' -ForegroundColor Yellow
Write-Host '      Officially supported: Claude Code. Issue reports welcome.' -ForegroundColor Yellow
Write-Host ('=' * 29)
Write-Host ''
if ($Adopt) {
    Write-Host 'Adopting pre-v0.2.3 legacy copies:'
    Invoke-AdoptLegacy $SkillsDir
    Write-Host ''
}

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

    if ((Test-Path $target) -and -not (Test-Owned $target $SdtSkills)) {
        Write-Host "  FAIL    $Prefix$skill — unowned directory occupies $target. Pre-v0.2.3 QABuddy copy? Re-run with -Adopt. Otherwise remove it manually." -ForegroundColor Red
        $skipped++
        continue
    }
    if (Test-Path $target) { Remove-Link $target }
    Copy-Item -Path $source -Destination $target -Recurse -Force
    Set-Content -Path (Join-Path $target '.qabuddy-owned') -Value $source
    Write-Host "  OK      $Prefix$skill"
    $installed++
}

# Install references
$refTarget = Join-Path $SkillsDir 'qa-references'
if (Test-Path -LiteralPath $SdtRefs) {
    if ((Test-Path $refTarget) -and -not (Test-Owned $refTarget $SdtRefs)) {
        Write-Host "  FAIL    qa-references — another directory occupies $refTarget. Remove it manually." -ForegroundColor Red
    } else {
    if (Test-Path $refTarget) { Remove-Link $refTarget }
    Copy-Item -Path $SdtRefs -Destination $refTarget -Recurse -Force
    Set-Content -Path (Join-Path $refTarget '.qabuddy-owned') -Value $SdtRefs
    Write-Host '  OK      qa-references'
    $installed++
    }
} else {
    Write-Host "  SKIP    qa-references (not found: $SdtRefs)" -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Installed: $installed items"
if ($skipped -gt 0) { Write-Host "Skipped: $skipped" -ForegroundColor Yellow }

# ─── Project Instructions ───────────────────────────────────────────────────

Write-Host ''
$instructions = Join-Path (Join-Path $RepoRoot '.github') 'copilot-instructions.md'
if (Test-Path $instructions) {
    Write-Host '  OK      .github/copilot-instructions.md already exists'
    Write-Host '  INFO    Review and merge QABuddy instructions manually if needed.'
} else {
    $projectFile = Join-Path (Join-Path $ScriptDir '.github') 'copilot-instructions.md'
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

$mcpConfig = Join-Path (Join-Path '.' '.vscode') 'mcp.json'
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
