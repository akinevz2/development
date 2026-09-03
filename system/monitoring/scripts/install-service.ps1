<#
.SYNOPSIS
    Registers the metrics collector as a per-user logon task in the
    Windows Task Scheduler (no admin required).

.DESCRIPTION
    Creates a scheduled task named 'SystemMonitorCollector' that starts
    the collector (node src/collector/src/index.ts) hidden, in the
    monitoring root, every time the current user logs on. The task:
      - runs regardless of elevation (port 11367 needs none),
      - is single-instance (Task Scheduler 'IgnoreNew'),
      - restarts up to 3 times, 1 minute apart, if node exits with a
        failure,
      - has no execution time limit,
      - appends collector stdout/stderr to a log file.

    The collector binds to 127.0.0.1 only, so the task is safe in a user
    session (AGENTS.md transport policy). Being a logon task, the
    collector starts at sign-in and stops when the session ends; a real
    Windows service (boot-time, session-independent) remains the
    long-term option.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1
    powershell -ExecutionPolicy Bypass -File scripts\install-service.ps1 -StartNow
#>
param(
    [string]$TaskName = 'SystemMonitorCollector',
    [string]$NodePath = '',
    [string]$LogPath = '',
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$monitorRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$entry = Join-Path $monitorRoot 'src\collector\src\index.ts'
if (-not (Test-Path -LiteralPath $entry)) {
    throw "collector entrypoint not found: $entry"
}

if (-not $NodePath) {
    $resolved = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $resolved) {
        throw 'node.exe not found on PATH; pass -NodePath "C:\...\node.exe"'
    }
    $NodePath = $resolved.Source
}
$version = (& $NodePath -v) -replace '^v', ''
if ([version]$version -lt [version]'22.4.0') {
    throw "Node >= 22.4 required for native type stripping (found v$version at $NodePath)"
}

if (-not $LogPath) {
    $LogPath = Join-Path $env:LOCALAPPDATA 'system-monitoring\collector.log'
}
$logDir = Split-Path -Parent $LogPath
if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# node runs as a child of a hidden powershell console so no window
# flashes at logon; output is appended to the log file
$inner = "& '$NodePath' 'src\collector\src\index.ts' 2>&1 | Out-File -Append -Encoding utf8 -LiteralPath '$LogPath'"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -Command `"$inner`"" `
    -WorkingDirectory $monitorRoot

$user = "$env:USERDOMAIN\$env:USERNAME"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

$description = 'System monitoring collector: REST + WebSocket on 127.0.0.1:11367. ' +
    "Remove with scripts\uninstall-service.ps1."

Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description $description | Out-Null

Write-Host "task '$TaskName' registered: starts at logon for $user (hidden)"
Write-Host "log file: $LogPath"
if ($StartNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host 'collector started'
}
