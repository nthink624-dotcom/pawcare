param(
  [int]$Port = 3210,
  [string]$Spec = "tests/e2e/owner-subscription-expiry.spec.ts"
)

$ErrorActionPreference = "Stop"

if ($env:PLAYWRIGHT_PORT) {
  $Port = [int]$env:PLAYWRIGHT_PORT
}

if ($Port -lt 1 -or $Port -gt 65535) {
  throw "PLAYWRIGHT_PORT must be an integer between 1 and 65535."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$baseUrl = "http://127.0.0.1:$Port"
$stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) "petmanager-playwright-$PID.stdout.log"
$stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) "petmanager-playwright-$PID.stderr.log"
$server = $null
$testExitCode = 1

try {
  if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
    throw "Port $Port is already in use; choose a task-owned port."
  }

  $server = Start-Process `
    -FilePath "node" `
    -ArgumentList @("node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "$Port") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    if ($server.HasExited) {
      throw "Task-owned Next.js server exited before becoming ready."
    }

    try {
      $response = Invoke-WebRequest -Uri "$baseUrl/login" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  if (-not $ready) {
    throw "Task-owned Next.js server did not become ready at $baseUrl."
  }

  $env:PLAYWRIGHT_PORT = "$Port"
  $env:PLAYWRIGHT_BASE_URL = $baseUrl
  & npm.cmd exec playwright test $Spec -- --workers=1
  $testExitCode = $LASTEXITCODE
} finally {
  $listenerProcessIds = @(
    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
  foreach ($listenerProcessId in $listenerProcessIds) {
    Stop-Process -Id $listenerProcessId -Force -ErrorAction SilentlyContinue
  }

  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    $server.WaitForExit()
  }

  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}

exit $testExitCode
