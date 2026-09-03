<#
.SYNOPSIS
    Stops and removes the collector's Task Scheduler logon task.

.DESCRIPTION
    Stops the 'SystemMonitorCollector' task if it is running (which
    terminates the node process tree it owns) and unregisters it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\uninstall-service.ps1
#>
param(
    [string]$TaskName = 'SystemMonitorCollector'
)

$ErrorActionPreference = 'Stop'

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "task '$TaskName' is not registered"
    return
}

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# Stop-ScheduledTask kills the task's powershell wrapper, but the node
# child can outlive it (orphaned outside the task's job object) — sweep
# up any leftover collector node processes explicitly.
$leftovers = @()
$deadline = (Get-Date).AddSeconds(5)
do {
    Start-Sleep -Milliseconds 300
    $leftovers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object { $_.CommandLine -like '*src\collector\src\index.ts*' }
} while ($leftovers -and (Get-Date) -lt $deadline)
foreach ($proc in $leftovers) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "stopped leftover collector process (pid $($proc.ProcessId))"
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "task '$TaskName' removed (collector stopped)"
