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
