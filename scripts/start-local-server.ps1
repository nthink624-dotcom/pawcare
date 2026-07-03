$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$hostName = "127.0.0.1"
$appPort = 3000
$relayPort = 14010
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$appLogPath = Join-Path $projectRoot ".next-start-live-$timestamp.log"
$relayRoot = Join-Path $projectRoot "backend\alimtalk-relay"
$relayLogPath = Join-Path $relayRoot ".tmp-relay-live-$timestamp.log"

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

  $appCommand = "cd /d `"$projectRoot`" && npm.cmd run dev -- --webpack --hostname $hostName --port $appPort > `"$appLogPath`" 2>&1"
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c", $appCommand -WindowStyle Hidden | Out-Null

  $appLoginUrl = "http://$hostName`:$appPort/login"
  if (-not (Wait-HttpOk $appLoginUrl 12)) {
    Write-Host "Next server start failed. Log: $appLogPath"
    if (Test-Path $appLogPath) {
      Get-Content $appLogPath -Tail 80
    }
    exit 1
  }

  Write-Host "Server running: http://$hostName`:$appPort/owner"
  Write-Host "Alimtalk relay running: $relayHealthUrl"
} finally {
  Pop-Location
}
