$projectRoot = Split-Path -Parent $PSScriptRoot
$relayRoot = Join-Path $projectRoot "backend\alimtalk-relay"
$ports = @(3000, 14010)

foreach ($port in $ports) {
  $processIds = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $processIds) {
    Write-Host "No server is running on port $port."
    continue
  }

  foreach ($processId in $processIds) {
    if (-not $processId -or $processId -eq 0) {
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped PID $processId on port $port."
    } catch {
      Write-Host "Failed to stop PID $processId on port $port."
    }
  }
}

$projectRootPattern = [regex]::Escape($projectRoot) + '(?=\\|"\s|\s|$)'
$escapedRelayRoot = [regex]::Escape($relayRoot)
$currentProcessId = $PID

$runtimeProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $currentProcessId -and
    $_.CommandLine -and
    (
      $_.CommandLine -match $escapedRelayRoot -or
      (
        $_.CommandLine -match $projectRootPattern -and
        $_.CommandLine -match '(next\\dist\\bin\\next|next\\dist\\server\\lib\\start-server|npm-cli\.js"?\s+run\s+(dev|dev:local|start|start:local)|npm\.cmd\s+run\s+(dev|dev:local|start|start:local)|tsx.*src/server\.ts)'
      )
    )
  } |
  Sort-Object ProcessId -Descending

foreach ($process in $runtimeProcesses) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    Write-Host "Stopped project runtime PID $($process.ProcessId)."
  } catch {
    Write-Host "Failed to stop project runtime PID $($process.ProcessId)."
  }
}
