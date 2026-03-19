$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $connections) {
  Write-Host "3000 포트에서 실행 중인 서버가 없습니다."
  exit 0
}

foreach ($pid in $connections) {
  try {
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Host "종료됨: PID $pid"
  } catch {
    Write-Host "종료 실패: PID $pid"
  }
}
