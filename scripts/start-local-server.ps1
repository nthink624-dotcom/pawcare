$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 3000
$hostName = "127.0.0.1"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $projectRoot ".next-start-live-$timestamp.log"

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($existing) {
  foreach ($processId in $existing) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
    } catch {
    }
  }
}

Push-Location $projectRoot
try {
  $command = "cd /d `"$projectRoot`" && npm.cmd run dev -- --webpack --hostname 127.0.0.1 --port 3000 > `"$logPath`" 2>&1"
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c", $command -WindowStyle Hidden | Out-Null

  Start-Sleep -Seconds 3

  $ok = $false
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://$hostName`:$port/login" -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        $ok = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $ok) {
    Write-Host "서버 시작 실패. 로그 확인: $logPath"
    if (Test-Path $logPath) {
      Get-Content $logPath -Tail 80
    }
    exit 1
  }

  Write-Host "서버 실행 중: http://$hostName`:$port/owner"
} finally {
  Pop-Location
}
