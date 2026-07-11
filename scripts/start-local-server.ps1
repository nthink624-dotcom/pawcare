param(
  [switch]$Build,
  [switch]$Dev
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hostName = "127.0.0.1"
$appPort = 3000
$relayPort = 14010
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runtimeLogRoot = Join-Path $projectRoot ".tmp\runtime-logs"
$appMode = if ($Dev) { "dev" } else { "preview" }
$appLogPath = Join-Path $runtimeLogRoot "next-$appMode-$timestamp.log"
$relayRoot = Join-Path $projectRoot "backend\alimtalk-relay"
$relayLogPath = Join-Path $runtimeLogRoot "alimtalk-relay-$timestamp.log"

New-Item -ItemType Directory -Force -Path $runtimeLogRoot | Out-Null

function Stop-PortProcess($targetPort) {
  $processIds = Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $processIds) {
    if (-not $processId -or $processId -eq 0) {
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
    }
  }
}

function Stop-ProjectRuntimeProcess {
  $projectRootPattern = [regex]::Escape($projectRoot) + '(?=\\|"\s|\s|$)'
  $escapedRelayRoot = [regex]::Escape($relayRoot)
  $currentProcessId = $PID

  $processes = Get-CimInstance Win32_Process |
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

  foreach ($process in $processes) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
    }
  }
}

function Trim-ProjectRuntimeWorkingSet {
  try {
    Add-Type -Namespace Native -Name Psapi -MemberDefinition '[System.Runtime.InteropServices.DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(System.IntPtr hProcess);' -ErrorAction SilentlyContinue
  } catch {
    return
  }

  $projectRootPattern = [regex]::Escape($projectRoot) + '(?=\\|"\s|\s|$)'
  $escapedRelayRoot = [regex]::Escape($relayRoot)
  $currentProcessId = $PID

  $processes = Get-CimInstance Win32_Process |
    Where-Object {
      $_.ProcessId -ne $currentProcessId -and
      $_.CommandLine -and
      (
        $_.CommandLine -match $escapedRelayRoot -or
        (
          $_.CommandLine -match $projectRootPattern -and
          $_.CommandLine -match '(next\\dist\\bin\\next|next\\dist\\server\\lib\\start-server|npm-cli\.js"?\s+run\s+(dev|dev:local|start|start:local)|npm\.cmd\s+run\s+(dev|dev:local|start|start:local)|tsx.*src/server\.ts|postcss\.js)'
        )
      )
    }

  foreach ($process in $processes) {
    try {
      $runtimeProcess = Get-Process -Id $process.ProcessId -ErrorAction Stop
      [void][Native.Psapi]::EmptyWorkingSet($runtimeProcess.Handle)
    } catch {
    }
  }
}

function Wait-HttpOk($url, $maxAttempts) {
  for ($i = 0; $i -lt $maxAttempts; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

Stop-PortProcess $appPort
Stop-PortProcess $relayPort
Stop-ProjectRuntimeProcess

Push-Location $projectRoot
try {
  npm.cmd run sync:alimtalk-relay-env | Out-Null

  $relayCommand = "cd /d `"$relayRoot`" && npm.cmd run start > `"$relayLogPath`" 2>&1"
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c", $relayCommand -WindowStyle Hidden | Out-Null

  $relayHealthUrl = "http://127.0.0.1:$relayPort/health"
  if (-not (Wait-HttpOk $relayHealthUrl 12)) {
    Write-Host "Alimtalk relay start failed. Log: $relayLogPath"
    if (Test-Path $relayLogPath) {
      Get-Content $relayLogPath -Tail 80
    }
    exit 1
  }

  $buildIdPath = Join-Path $projectRoot ".next\BUILD_ID"
  if (-not $Dev -and ($Build -or -not (Test-Path $buildIdPath))) {
    npm.cmd run build
  }

  if ($Dev) {
    $appCommand = "cd /d `"$projectRoot`" && set NEXT_TELEMETRY_DISABLED=1&& set NODE_OPTIONS=--max-old-space-size=1024&& npm.cmd run dev:local > `"$appLogPath`" 2>&1"
  } else {
    $appCommand = "cd /d `"$projectRoot`" && set NEXT_TELEMETRY_DISABLED=1&& npm.cmd run start:local > `"$appLogPath`" 2>&1"
  }
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c", $appCommand -WindowStyle Hidden | Out-Null

  $appLoginUrl = "http://$hostName`:$appPort/login"
  if (-not (Wait-HttpOk $appLoginUrl 12)) {
    Write-Host "Next server start failed. Log: $appLogPath"
    if (Test-Path $appLogPath) {
      Get-Content $appLogPath -Tail 80
    }
    exit 1
  }

  Trim-ProjectRuntimeWorkingSet

  Write-Host "Server running ($appMode): http://$hostName`:$appPort/owner"
  Write-Host "Alimtalk relay running: $relayHealthUrl"
} finally {
  Pop-Location
}
