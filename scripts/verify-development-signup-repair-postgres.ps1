param(
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [int]$Port = 55440
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$clusterPath = Join-Path $tempRoot ("petmanager-pg-signup-repair-" + [guid]::NewGuid().ToString("N"))
$sourceDb = "pm_signup_repair_source"
$restoreDb = "pm_signup_repair_restore"
$dumpPath = Join-Path $clusterPath "signup-repair.dump"
$started = $false

function Invoke-PgTool {
  param([string]$Name, [string[]]$Arguments)
  $toolPath = Join-Path $PgBin $Name
  if (-not (Test-Path -LiteralPath $toolPath)) { throw "PostgreSQL tool not found: $toolPath" }
  & $toolPath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

function Invoke-PgToolExpectFailure {
  param([string]$Name, [string[]]$Arguments, [string]$ExpectedCode)
  $toolPath = Join-Path $PgBin $Name
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = (& $toolPath @Arguments 2>&1 | Out-String)
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -eq 0) { throw "$Name unexpectedly succeeded; expected $ExpectedCode" }
  Write-Output "EXPECTED_FAILURE_CONFIRMED code=$ExpectedCode"
}

try {
  New-Item -ItemType Directory -Path $clusterPath | Out-Null
  Invoke-PgTool "initdb.exe" @("-D", $clusterPath, "--auth=trust", "--username=postgres", "--no-locale", "--encoding=UTF8")
  $logPath = Join-Path $clusterPath "postgres.log"
  Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-l", $logPath, "-o", "-p $Port -h 127.0.0.1", "-w", "start")
  $started = $true
  Invoke-PgTool "createdb.exe" @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", $sourceDb)
  $psql = @("-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $sourceDb)
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\development-signup-repair-fixture.sql")))
  foreach ($name in @(
    "20260826034028_secure_owner_shop_memberships.sql",
    "20260826111854_lock_product_booking_defaults.sql",
    "202608270001_atomic_owner_signup_draft.sql"
  )) { Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "supabase\migrations\$name"))) }
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\development-signup-repair-forward-assertions.sql")))

  Invoke-PgTool "pg_dump.exe" @("-Fc", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $sourceDb, "-f", $dumpPath)
  Invoke-PgTool "createdb.exe" @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", $restoreDb)
  Invoke-PgTool "pg_restore.exe" @("--exit-on-error", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $restoreDb, $dumpPath)
  $restorePsql = @("-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $restoreDb)
  Invoke-PgTool "psql.exe" ($restorePsql + @("-f", (Join-Path $repoRoot "tests\sql\development-signup-repair-forward-assertions.sql")))
  Invoke-PgTool "psql.exe" ($restorePsql + @("-c", "update public.owner_shop_memberships set role = 'manager' where shop_id = 'fixture-shop';"))
  Invoke-PgToolExpectFailure "psql.exe" ($restorePsql + @("-f", (Join-Path $repoRoot "supabase\rollback\20260826034028_secure_owner_shop_memberships.rollback.sql"))) "PM_MEMBERSHIP_ROLLBACK_BLOCKED_CONTENT_CHANGED"
  Invoke-PgTool "psql.exe" ($restorePsql + @("-c", "do `$`$ begin if to_regclass('public.owner_shop_memberships') is null then raise exception 'mutation rollback unexpectedly dropped membership'; end if; end `$`$;"))

  foreach ($name in @(
    "202608270001_atomic_owner_signup_draft.rollback.sql",
    "20260826111854_lock_product_booking_defaults.rollback.sql",
    "20260826034028_secure_owner_shop_memberships.rollback.sql"
  )) { Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "supabase\rollback\$name"))) }
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\development-signup-repair-rollback-assertions.sql")))
  Write-Output "POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS"
}
finally {
  if ($started) { try { Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-m", "fast", "-w", "stop") } catch { Write-Warning $_ } }
  $resolved = [System.IO.Path]::GetFullPath($clusterPath)
  if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolved).StartsWith("petmanager-pg-signup-repair-") -and
      (Test-Path -LiteralPath $resolved)) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
