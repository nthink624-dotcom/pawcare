param(
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [int]$Port = 55439
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$clusterPath = Join-Path $tempRoot ("petmanager-pg-meter-" + [guid]::NewGuid().ToString("N"))
$database = "pm_meter_test"
$started = $false

function Invoke-PgTool {
  param([string]$Name, [string[]]$Arguments)
  $toolPath = Join-Path $PgBin $Name
  if (-not (Test-Path -LiteralPath $toolPath)) {
    throw "PostgreSQL tool not found: $toolPath"
  }
  & $toolPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

try {
  New-Item -ItemType Directory -Path $clusterPath | Out-Null
  Invoke-PgTool "initdb.exe" @("-D", $clusterPath, "--auth=trust", "--username=postgres", "--no-locale", "--encoding=UTF8")
  $logPath = Join-Path $clusterPath "postgres.log"
  Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-l", $logPath, "-o", "-p $Port -h 127.0.0.1", "-w", "start")
  $started = $true
  Invoke-PgTool "createdb.exe" @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", $database)

  $psqlBase = @("-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $database)
  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "tests\sql\signup-price-guide-metering-fixture.sql")))
  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "..\..\supabase\migrations\20260827031414_secure_signup_ai_price_guide_metering.sql")))
  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "tests\sql\signup-price-guide-metering-attack-functions.sql")))

  $pgbenchScript = Join-Path $repoRoot "tests\sql\signup-price-guide-metering-pgbench.sql"
  $scenarios = @(
    @{ Id = 1; Name = "session6"; Cost = 0; Cap = 1000; Charge = 0 },
    @{ Id = 2; Name = "device8"; Cost = 0; Cap = 1000; Charge = 0 },
    @{ Id = 3; Name = "ip10"; Cost = 0; Cap = 1000; Charge = 0 },
    @{ Id = 4; Name = "cost"; Cost = 400; Cap = 1000; Charge = 1 }
  )
  foreach ($scenario in $scenarios) {
    Invoke-PgTool "pgbench.exe" @(
      "-n", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $database,
      "-c", "20", "-j", "4", "-t", "1",
      "-D", "scenario=$($scenario.Id)",
      "-D", "estimated_cost=$($scenario.Cost)",
      "-D", "daily_cap=$($scenario.Cap)",
      "-D", "charge=$($scenario.Charge)",
      "-f", $pgbenchScript
    )
  }

  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "tests\sql\signup-price-guide-metering-assertions.sql")))
  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "..\..\supabase\rollback\20260827031414_secure_signup_ai_price_guide_metering.rollback.sql")))
  Invoke-PgTool "psql.exe" ($psqlBase + @("-f", (Join-Path $repoRoot "tests\sql\signup-price-guide-metering-rollback-assertions.sql")))
  Write-Output "POSTGRES_METERING_P0_V03_PASS"
}
finally {
  if ($started) {
    try {
      Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-m", "fast", "-w", "stop")
    }
    catch {
      Write-Warning $_
    }
  }
  $resolvedCluster = [System.IO.Path]::GetFullPath($clusterPath)
  if ($resolvedCluster.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedCluster).StartsWith("petmanager-pg-meter-", [System.StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $resolvedCluster)) {
    Remove-Item -LiteralPath $resolvedCluster -Recurse -Force
  }
}
