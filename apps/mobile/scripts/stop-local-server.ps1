$port = 3100

$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $connections) {
  Write-Host "$port port has no running local server."
  exit 0
}

foreach ($processId in $connections) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Host "Stopped PID $processId"
  } catch {
    Write-Host "Failed to stop PID $processId"
  }
}
