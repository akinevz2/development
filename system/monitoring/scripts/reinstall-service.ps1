<#
.SYNOPSIS
    Verifies, rebuilds and reinstalls the collector service in one step.

.DESCRIPTION
    Intended after pulling changes (e.g. from the WSL side): runs the
    typecheck and test suites, rebuilds the web viewer bundle so the
    collector serves fresh assets, then uninstalls and re-registers the
    SystemMonitorCollector task with -StartNow so the collector starts
    immediately. Aborts without touching the service if any step fails.

.EXAMPLE
    npm run reinstall-service
#>
$ErrorActionPreference = 'Stop'

$monitorRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

Push-Location $monitorRoot
try {
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'typecheck failed — not reinstalling' }
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'tests failed — not reinstalling' }
} finally {
    Pop-Location
}

Push-Location (Join-Path $monitorRoot 'src\viewer')
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'viewer build failed — not reinstalling' }
} finally {
    Pop-Location
}

& (Join-Path $PSScriptRoot 'uninstall-service.ps1')
& (Join-Path $PSScriptRoot 'install-service.ps1') -StartNow
