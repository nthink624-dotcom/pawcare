$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 3000
$hostName = "127.0.0.1"
$logPath = Join-Path $projectRoot ".next-start-live.log"

$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($existing) {
  foreach ($pid in $existing) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
    }
  }
}

Push-Location $projectRoot
try {
  npm.cmd run build | Out-Host

  if (Test-Path $logPath) {
    Remove-Item $logPath -Force
  }

  $command = "cd /d `"$projectRoot`" && npm.cmd run start:local > `"$logPath`" 2>&1"
  Start-Process -FilePath "C:\Windows\System32\cmd.exe" -ArgumentList "/c", $command -WindowStyle Hidden | Out-Null

  Start-Sleep -Seconds 3

  $ok = $false
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "http://$hostName`:$port/owner" -TimeoutSec 5
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
