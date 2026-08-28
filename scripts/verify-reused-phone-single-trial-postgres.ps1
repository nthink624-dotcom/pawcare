param(
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [int]$Port = 55442
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$clusterPath = Join-Path $tempRoot ("petmanager-pg-single-trial-" + [guid]::NewGuid().ToString("N"))
$database = "pm_single_trial"
$rollbackDatabase = "pm_single_trial_rollback"
$started = $false
$jobs = @()

function Invoke-PgTool {
  param([string]$Name, [string[]]$Arguments)
  $toolPath = Join-Path $PgBin $Name
  if (-not (Test-Path -LiteralPath $toolPath)) { throw "PostgreSQL tool not found: $toolPath" }
  & $toolPath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

try {
  New-Item -ItemType Directory -Path $clusterPath | Out-Null
  Invoke-PgTool "initdb.exe" @("-D", $clusterPath, "--auth=trust", "--username=postgres", "--no-locale", "--encoding=UTF8")
  $logPath = Join-Path $clusterPath "postgres.log"
  Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-l", $logPath, "-o", "-p $Port -h 127.0.0.1", "-w", "start")
  $started = $true
  Invoke-PgTool "createdb.exe" @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", $database)
  $psql = @("-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $database)
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\reused-phone-single-trial-fixture.sql")))
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "supabase\migrations\202608270001_atomic_owner_signup_draft.sql")))
  Invoke-PgTool "psql.exe" ($psql + @("-c", "alter table public.signup_idempotency_requests drop constraint signup_idempotency_requests_status_check; alter table public.signup_idempotency_requests add constraint signup_idempotency_requests_status_check check(status in ('claimed','auth_created','completed','compensation_pending','failed_compensated'));"))
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "supabase\migrations\20260827064926_reused_phone_single_trial_signup.sql")))

  $prepareSql = @"
insert into auth.users(id)
select ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1,20) i;
insert into public.signup_idempotency_requests(signup_request_id,payload_hash,status,auth_user_id)
select ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, repeat('1',64), 'auth_created',
       ('20000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid
  from generate_series(1,20) i;
insert into public.owner_identity_verifications(id,purpose,status,verification_token_id,verified_expires_at)
select ('30000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'signup', 'verified',
       ('40000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, now() + interval '10 minutes'
  from generate_series(1,20) i;
"@
  Invoke-PgTool "psql.exe" ($psql + @("-c", $prepareSql))

  $psqlPath = Join-Path $PgBin "psql.exe"
  $callPath = Join-Path $repoRoot "tests\sql\reused-phone-single-trial-call.sql"
  foreach ($i in 1..20) {
    $suffix = $i.ToString("000000000000")
    $arguments = @(
      "-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $database,
      "-v", "request_id=10000000-0000-0000-0000-$suffix",
      "-v", "user_id=20000000-0000-0000-0000-$suffix",
      "-v", "verification_id=30000000-0000-0000-0000-$suffix",
      "-v", "token_id=40000000-0000-0000-0000-$suffix",
      "-v", "shop_id=trial-shop-$i", "-v", "service_id=trial-service-$i",
      "-v", "email=owner$i@example.invalid", "-v", "hash_char=1", "-f", $callPath
    )
    $jobs += Start-Job -ScriptBlock {
      param($Executable, $ToolArguments)
      & $Executable @ToolArguments 2>&1
      if ($LASTEXITCODE -ne 0) { throw "concurrent psql failed with $LASTEXITCODE" }
    } -ArgumentList $psqlPath, $arguments
  }
  $jobs | Wait-Job | Out-Null
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $jobOutput = $jobs | Receive-Job 2>&1
  $ErrorActionPreference = $previousPreference
  if (($jobs | Where-Object State -ne "Completed").Count -gt 0) { throw ($jobOutput | Out-String) }
  $jobs | Remove-Job -Force
  $jobs = @()

  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\reused-phone-single-trial-assertions.sql")))

  $rotationPrepareSql = @"
update public.owner_trial_identity_key_policy set is_current=false where key_version='v1';
insert into public.owner_trial_identity_key_policy(key_version,is_current,lookup_required) values('v2',true,true);
insert into auth.users(id) values('a1000000-0000-0000-0000-000000000001');
insert into public.signup_idempotency_requests(signup_request_id,payload_hash,status,auth_user_id)
values('a0000000-0000-0000-0000-000000000001',repeat('3',64),'auth_created','a1000000-0000-0000-0000-000000000001');
insert into public.owner_identity_verifications(id,purpose,status,verification_token_id,verified_expires_at)
values('a2000000-0000-0000-0000-000000000001','signup','verified','a3000000-0000-0000-0000-000000000001',now()+interval '10 minutes');
"@
  Invoke-PgTool "psql.exe" ($psql + @("-c", $rotationPrepareSql))
  Invoke-PgTool "psql.exe" ($psql + @("-f", (Join-Path $repoRoot "tests\sql\reused-phone-single-trial-rotation-call.sql")))

  $failureSql = @"
insert into auth.users(id) values ('50000000-0000-0000-0000-000000000001');
insert into public.signup_idempotency_requests(signup_request_id,payload_hash,status,auth_user_id)
values ('60000000-0000-0000-0000-000000000001', repeat('2',64), 'auth_created', '50000000-0000-0000-0000-000000000001');
insert into public.owner_identity_verifications(id,purpose,status,verification_token_id,verified_expires_at)
values ('70000000-0000-0000-0000-000000000001','signup','verified','80000000-0000-0000-0000-000000000001',now()+interval '10 minutes');
create function public.fail_subscription_insert() returns trigger language plpgsql as `$`$ begin raise exception 'FIXTURE_FAILURE'; end `$`$;
create trigger fixture_fail_subscription before insert on public.owner_subscriptions for each row
when (new.user_id = '50000000-0000-0000-0000-000000000001'::uuid) execute function public.fail_subscription_insert();
"@
  Invoke-PgTool "psql.exe" ($psql + @("-c", $failureSql))
  $failureArgs = $psql + @(
    "-v", "request_id=60000000-0000-0000-0000-000000000001",
    "-v", "user_id=50000000-0000-0000-0000-000000000001",
    "-v", "verification_id=70000000-0000-0000-0000-000000000001",
    "-v", "token_id=80000000-0000-0000-0000-000000000001",
    "-v", "shop_id=failed-then-retry-shop", "-v", "service_id=failed-then-retry-service",
    "-v", "email=retry@example.invalid", "-v", "hash_char=2", "-f", $callPath
  )
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $psqlPath @failureArgs 2>&1 | Out-Null
  $failureExit = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($failureExit -eq 0) { throw "injected failure unexpectedly succeeded" }
  Invoke-PgTool "psql.exe" ($psql + @("-c", "do `$`$ begin if exists(select 1 from public.owner_trial_identity_aliases where identity_key=repeat('2',64)) then raise exception 'failed signup consumed trial'; end if; end `$`$; drop trigger fixture_fail_subscription on public.owner_subscriptions; drop function public.fail_subscription_insert();"))

  Invoke-PgTool "psql.exe" $failureArgs
  Invoke-PgTool "psql.exe" ($psql + @("-c", "do `$`$ begin if not exists(select 1 from public.owner_subscriptions where user_id='50000000-0000-0000-0000-000000000001' and subscription_status='trialing') then raise exception 'retry did not receive first trial'; end if; end `$`$;"))

  $roleArgs = $psql + @("-c", "set role authenticated; select * from public.owner_trial_identity_claims;")
  $ErrorActionPreference = "Continue"
  & $psqlPath @roleArgs 2>&1 | Out-Null
  $roleExit = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($roleExit -eq 0) { throw "authenticated direct trial ledger read unexpectedly succeeded" }

  $claimRoleArgs = $psql + @("-c", "set role authenticated; select public.backfill_owner_trial_identity_claim_v2(jsonb_build_array(jsonb_build_object('identityKey',repeat('f',64),'keyVersion','v1')),'90000000-0000-0000-0000-000000000001',now());")
  $ErrorActionPreference = "Continue"
  & $psqlPath @claimRoleArgs 2>&1 | Out-Null
  $claimRoleExit = $LASTEXITCODE
  $ErrorActionPreference = $previousPreference
  if ($claimRoleExit -eq 0) { throw "authenticated direct trial claim unexpectedly succeeded" }

  $backfillSql = @"
select public.backfill_owner_trial_identity_claim_v2(jsonb_build_array(jsonb_build_object('identityKey',repeat('f',64),'keyVersion','v1')),'90000000-0000-0000-0000-000000000002','2026-02-02T00:00:00Z');
select public.backfill_owner_trial_identity_claim_v2(jsonb_build_array(jsonb_build_object('identityKey',repeat('f',64),'keyVersion','v1')),'90000000-0000-0000-0000-000000000001','2026-01-01T00:00:00Z');
do `$`$ begin
  if not exists (
    select 1 from public.owner_trial_identity_claims claims
    join public.owner_trial_identity_aliases aliases using(claim_id)
     where aliases.identity_key=repeat('f',64)
       and claims.first_signup_request_id='90000000-0000-0000-0000-000000000001'
       and claimed_at='2026-01-01T00:00:00Z'::timestamptz
       and claim_source='backfill'
  ) then raise exception 'earliest successful backfill was not retained'; end if;
end `$`$;
"@
  Invoke-PgTool "psql.exe" ($psql + @("-c", $backfillSql))

  Invoke-PgTool "createdb.exe" @("-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", $rollbackDatabase)
  $rollbackPsql = @("-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "$Port", "-U", "postgres", "-d", $rollbackDatabase)
  Invoke-PgTool "psql.exe" ($rollbackPsql + @("-f", (Join-Path $repoRoot "tests\sql\reused-phone-single-trial-fixture.sql")))
  Invoke-PgTool "psql.exe" ($rollbackPsql + @("-f", (Join-Path $repoRoot "supabase\migrations\202608270001_atomic_owner_signup_draft.sql")))
  Invoke-PgTool "psql.exe" ($rollbackPsql + @("-c", "alter table public.signup_idempotency_requests drop constraint signup_idempotency_requests_status_check; alter table public.signup_idempotency_requests add constraint signup_idempotency_requests_status_check check(status in ('claimed','auth_created','completed','compensation_pending','failed_compensated'));"))
  Invoke-PgTool "psql.exe" ($rollbackPsql + @("-f", (Join-Path $repoRoot "supabase\migrations\20260827064926_reused_phone_single_trial_signup.sql")))
  Invoke-PgTool "psql.exe" ($rollbackPsql + @("-f", (Join-Path $repoRoot "supabase\rollback\20260827064926_reused_phone_single_trial_signup.rollback.sql")))

  Write-Output "REUSED_PHONE_SINGLE_TRIAL_POSTGRES_PASS accounts=20 trial_winners=1 rotation_regain=0 signup_credits=0 product_snapshot=immutable failed_signup_claims=0 retry_trial=14 direct_claim=denied backfill=earliest rollback=pass"
}
finally {
  if ($jobs.Count -gt 0) { $jobs | Stop-Job -ErrorAction SilentlyContinue; $jobs | Remove-Job -Force -ErrorAction SilentlyContinue }
  if ($started) { try { Invoke-PgTool "pg_ctl.exe" @("-D", $clusterPath, "-m", "fast", "-w", "stop") } catch { Write-Warning $_ } }
  $resolved = [System.IO.Path]::GetFullPath($clusterPath)
  if ($resolved.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolved).StartsWith("petmanager-pg-single-trial-") -and
      (Test-Path -LiteralPath $resolved)) {
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
}
