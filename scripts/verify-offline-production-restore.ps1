param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackupPath,
  [string]$ProtectedKeyPath,
  [string]$PortableKeyPath,
  [string]$RoleManifestPath,
  [string]$BaselineDeviceFingerprint,
  [Parameter(Mandatory=$true)][string]$RecoverablePointAt,
  [Parameter(Mandatory=$true)][string]$ReceiptPath,
  [int]$LocalPort=55471,
  [string]$PgBin='C:\Program Files\PostgreSQL\18\bin'
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$cluster=Join-Path $tempRoot ('petmanager-prod-restore-'+[guid]::NewGuid().ToString('N'))
$started=$false
$passwordPath=$null
$previousPgPassword=$env:PGPASSWORD
$archive=$null;$key=$null;$plain=$null
$incident=[DateTimeOffset]::UtcNow
$deviceHash=[Security.Cryptography.SHA256]::Create()
try{$machineGuid=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid;$deviceFingerprint=([BitConverter]::ToString($deviceHash.ComputeHash([Text.Encoding]::UTF8.GetBytes('PetManager restore device v1:'+$machineGuid)))).Replace('-','').ToLowerInvariant()}finally{$deviceHash.Dispose();$machineGuid=$null}
$deviceType='current_windows_pc'
if($BaselineDeviceFingerprint){if($BaselineDeviceFingerprint -notmatch '^[a-f0-9]{64}$'){throw 'Invalid baseline device fingerprint'};if($BaselineDeviceFingerprint -ne $deviceFingerprint){if(!$PortableKeyPath){throw 'Second-device restore must use the portable USB key'};$deviceType='second_windows_pc'}}
function PrivateFile($p){$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow'));[IO.File]::SetAccessControl($p,$acl)}
function Tool($name,[string[]]$toolArgs){$result=& (Join-Path $PgBin ($name+'.exe')) @toolArgs 2>&1;if($LASTEXITCODE -ne 0){throw "$name failed with exit code $LASTEXITCODE"};return ($result -join "`n")}
function Sql([string]$sql){$result=$sql | & (Join-Path $PgBin 'psql.exe') -X -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $LocalPort -U postgres -d postgres 2>&1;if($LASTEXITCODE -ne 0){throw "Local SQL validation failed"};return ($result -join "`n")}
try{
  if(($ProtectedKeyPath -and $PortableKeyPath) -or (!$ProtectedKeyPath -and !$PortableKeyPath)){throw 'Choose exactly one recovery key source'}
  if($LocalPort -lt 1024 -or $LocalPort -gt 65535 -or (Get-NetTCPConnection -LocalPort $LocalPort -ErrorAction SilentlyContinue)){throw 'Local restore port is unavailable'}
  $archive=[IO.File]::ReadAllBytes($EncryptedBackupPath)
  if($archive.Length -lt 72 -or [Text.Encoding]::ASCII.GetString($archive,0,8) -ne 'PMDUMP02'){throw 'Invalid encrypted archive format'}
  $aad=[Text.Encoding]::UTF8.GetBytes('PETMANAGER_PRODUCTION|ysxykikqnneuhypybjry|schemas=auth,pm_marketing_private,pm_signup_private,private,public,supabase_migrations|pg_dump=18|cipher=PMDUMP02')
  $sha=[Security.Cryptography.SHA256]::Create()
  if($PortableKeyPath){$key=[IO.File]::ReadAllBytes($PortableKeyPath)}else{$entropy=$sha.ComputeHash($aad);$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($ProtectedKeyPath),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)}
  if($key.Length -ne 32){throw 'Invalid recovery key length'}
  $iv=[byte[]]::new(16);[Buffer]::BlockCopy($archive,8,$iv,0,16)
  $tag=[byte[]]::new(32);[Buffer]::BlockCopy($archive,24,$tag,0,32)
  $cipher=[byte[]]::new($archive.Length-56);[Buffer]::BlockCopy($archive,56,$cipher,0,$cipher.Length)
  $signed=[byte[]]::new($aad.Length+24+$cipher.Length);[Buffer]::BlockCopy($aad,0,$signed,0,$aad.Length);[Buffer]::BlockCopy($archive,0,$signed,$aad.Length,24);[Buffer]::BlockCopy($cipher,0,$signed,$aad.Length+24,$cipher.Length)
  $hmac=[Security.Cryptography.HMACSHA256]::new($key);$actual=$hmac.ComputeHash($signed);$hmac.Dispose()
  $difference=0;for($i=0;$i -lt 32;$i++){$difference=$difference -bor ($actual[$i] -bxor $tag[$i])};if($difference -ne 0){throw 'Archive authentication failed'}
  $aes=[Security.Cryptography.Aes]::Create();$aes.Mode='CBC';$aes.Padding='PKCS7';$aes.Key=$key;$aes.IV=$iv;$decrypt=$aes.CreateDecryptor();$plain=$decrypt.TransformFinalBlock($cipher,0,$cipher.Length);$decrypt.Dispose();$aes.Dispose()
  New-Item -ItemType Directory -Path $cluster | Out-Null
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'));[IO.Directory]::SetAccessControl($cluster,$acl)
  $passwordBytes=[byte[]]::new(32);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();$rng.GetBytes($passwordBytes);$rng.Dispose()
  $password=[Convert]::ToBase64String($passwordBytes)
  $passwordPath=Join-Path $tempRoot ('petmanager-prod-restore-password-'+[guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::WriteAllBytes($passwordPath,[byte[]]::new(0));PrivateFile $passwordPath;[IO.File]::WriteAllText($passwordPath,$password,[Text.Encoding]::ASCII)
  $env:PGPASSWORD=$password
  [void](Tool 'initdb' @('-D',$cluster,'--auth-host=scram-sha-256','--auth-local=trust','--pwfile',$passwordPath,'--username=postgres','--no-locale','--encoding=UTF8'))
  $log=Join-Path $cluster 'postgres.log'
  $ctl=Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentList @('-D',$cluster,'-l',$log,'-o',"`"-p $LocalPort -h 127.0.0.1`"",'-w','start') -WindowStyle Hidden -PassThru
  # PowerShell -Wait waits for the whole child tree, including the DB daemon.
  # Wait only for pg_ctl; the daemon remains task-owned until finally stops it.
  $ctl.WaitForExit()
  $started=Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')
  if($ctl.ExitCode -ne 0 -or !$started){throw 'Isolated PostgreSQL startup failed'}
  [void](Sql "do `$roles`$ declare r text; begin foreach r in array array['anon','authenticated','dashboard_user','service_role','supabase_admin','supabase_auth_admin'] loop execute format('create role %I nologin',r); end loop; end `$roles`$; create schema extensions;create extension pgcrypto with schema extensions;create extension `"uuid-ossp`" with schema extensions;drop schema public;")
  if($RoleManifestPath){
    $rolesJson=(Get-Content -LiteralPath $RoleManifestPath -Raw | ConvertFrom-Json) | ConvertTo-Json -Depth 3 -Compress
    $rolesJson=$rolesJson.Replace("'","''")
    [void](Sql ('do $roles$ declare item jsonb; begin for item in select value from jsonb_array_elements('''+$rolesJson+'''::jsonb) loop if not exists(select 1 from pg_roles where rolname=item->>''name'') then execute format(''create role %I nologin'',item->>''name''); end if; if item->>''name'' <> ''postgres'' then execute format(''alter role %I %s'',item->>''name'',case when (item->>''bypassRls'')::boolean then ''bypassrls'' else ''nobypassrls'' end); end if; end loop; end $roles$;'))
  }
  $psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=Join-Path $PgBin 'pg_restore.exe';$psi.Arguments="--exit-on-error --no-owner --host=127.0.0.1 --port=$LocalPort --username=postgres --dbname=postgres";$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardInput=$true;$psi.RedirectStandardError=$true;$psi.RedirectStandardOutput=$true
  $proc=[Diagnostics.Process]::new();$proc.StartInfo=$psi;[void]$proc.Start();$errors=$proc.StandardError.ReadToEndAsync();$output=$proc.StandardOutput.ReadToEndAsync();$proc.StandardInput.BaseStream.Write($plain,0,$plain.Length);$proc.StandardInput.Close();$proc.WaitForExit();if($proc.ExitCode -ne 0){throw ('Archive restore failed: '+(($errors.Result -split "`r?`n" | Where-Object {$_ -match '^pg_restore: error:'} | Select-Object -First 2) -join ' '))};$proc.Dispose()
  $summary=(Sql "select json_build_object('tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','auth','private','pm_signup_private','pm_marketing_private','supabase_migrations')),'rlsEnabledTables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname='public' and c.relrowsecurity),'bookingExpiryRestored',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='expire_unreported_booking_deposits'),'feedbackRestored',exists(select 1 from pg_proc where proname='submit_hanmadi_feedback_v1'));" ) | ConvertFrom-Json
  if($summary.tables -lt 100 -or !$summary.feedbackRestored -or !$summary.bookingExpiryRestored){throw 'Restored schema completeness check failed'}
  if($RoleManifestPath){
    $invalidPrivileges=[int](Sql "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_hanmadi_feedback_v1','decide_hanmadi_tester_access_v1','grant_owner_pilot_pre_payment_benefit_v1','expire_unreported_booking_deposits') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or not has_function_privilege('service_role',p.oid,'EXECUTE'));" )
    if($invalidPrivileges -ne 0){throw 'Restored privileged RPC permissions differ from the server-only contract'}
    [void](Sql "set role service_role; select count(*) from public.shops; reset role;")
    $summary | Add-Member -NotePropertyName serverOnlyRpcPrivilegesVerified -NotePropertyValue $true
    $summary | Add-Member -NotePropertyName serviceRoleReadVerified -NotePropertyValue $true
  }
  # Force a read of every restored application/auth table; never emit customer rows.
  [void](Sql "do `$counts`$ declare t record; total bigint; begin for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','auth','private','pm_signup_private','pm_marketing_private','supabase_migrations') loop execute format('select count(*) from %I.%I',t.nspname,t.relname) into total; end loop; end `$counts`$;")
  $verified=[DateTimeOffset]::UtcNow;$archiveHash=(Get-FileHash -LiteralPath $EncryptedBackupPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $receipt=[pscustomobject]@{status='PASS';isolatedTargetVerified=$true;temporaryHostAuth='scram-sha-256';verifiedAt=$verified.ToString('o');recoverablePointAt=$RecoverablePointAt;incidentStartedAt=$incident.ToString('o');serviceVerifiedAt=$verified.ToString('o');completedAt=$verified.ToString('o');rpoMinutes=[math]::Ceiling(($incident-[DateTimeOffset]::Parse($RecoverablePointAt)).TotalMinutes);rtoMinutes=[math]::Ceiling(($verified-$incident).TotalMinutes);archiveSha256=$archiveHash;keySource=$(if($PortableKeyPath){'removable_usb'}else{'dpapi_current_user'});deviceType='current_windows_pc';networkAccess='none';remoteWrites=0;summary=$summary;temporaryClusterCleanup='pending'}
} finally {
  if($started){$ctl=Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentList @('-D',$cluster,'-m','fast','-w','stop') -WindowStyle Hidden -PassThru;$ctl.WaitForExit();if($ctl.ExitCode -ne 0 -and (Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid'))){throw 'Temporary PostgreSQL did not stop'}}
  if(Test-Path -LiteralPath $cluster){$resolved=[IO.Path]::GetFullPath($cluster);if(!$resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolved) -notlike 'petmanager-prod-restore-*'){throw 'Temporary cluster cleanup path rejected'};Remove-Item -LiteralPath $resolved -Recurse -Force}
  foreach($bytes in @($key,$plain,$archive)){if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}}
  if($passwordBytes){[Array]::Clear($passwordBytes,0,$passwordBytes.Length)}
  if($passwordPath -and (Test-Path -LiteralPath $passwordPath)){Remove-Item -LiteralPath $passwordPath -Force}
  $env:PGPASSWORD=$previousPgPassword;$password=$null
}
if($receipt){$receipt.deviceType=$deviceType;$receipt | Add-Member -NotePropertyName deviceFingerprint -NotePropertyValue $deviceFingerprint;$receipt.temporaryClusterCleanup='PASS';$receipt.completedAt=[DateTimeOffset]::UtcNow.ToString('o');[IO.File]::WriteAllText([IO.Path]::GetFullPath($ReceiptPath),($receipt | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false));PrivateFile $ReceiptPath;$receipt | ConvertTo-Json -Depth 5}
