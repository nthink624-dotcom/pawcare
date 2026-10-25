$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root=Join-Path $env:LOCALAPPDATA 'PetManagerBackupCredentials'
$out=Join-Path $env:LOCALAPPDATA 'PetManagerDbBackups'
$pg='C:\Program Files\PostgreSQL\18\bin'
$ca=Join-Path $root 'supabase-prod-ca-2021.crt'
$reader=Import-Clixml (Join-Path $root 'supabase-backup-reader.xml')
if($reader -isnot [Security.SecureString] -or $reader.Length -lt 20){throw 'Protected DB password is missing or invalid'}
if(!(Test-Path $ca) -or !(Test-Path (Join-Path $pg 'pg_dump.exe'))){throw 'CA or PostgreSQL tools missing'}
$driveFolder='G:\내 드라이브\PetManager 암호화 백업'
New-Item -ItemType Directory -Force $out | Out-Null
if((Get-FileHash -LiteralPath $ca -Algorithm SHA256).Hash -ne '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'){throw 'Supabase CA fingerprint differs'}
function PrivateAcl($p){$acl=New-Object Security.AccessControl.FileSecurity;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')));[IO.File]::SetAccessControl($p,$acl)}
function Hex([byte[]]$b){([BitConverter]::ToString($b)).Replace('-','').ToLowerInvariant()}
function Hash([byte[]]$b){$h=[Security.Cryptography.SHA256]::Create();try{return ,$h.ComputeHash($b)}finally{$h.Dispose()}}
function Mac([byte[]]$k,[byte[]]$b){$h=[Security.Cryptography.HMACSHA256]::new($k);try{return ,$h.ComputeHash($b)}finally{$h.Dispose()}}
function JoinB([byte[][]]$a){$n=0;foreach($x in $a){$n+=$x.Length};$o=[byte[]]::new($n);$i=0;foreach($x in $a){[Buffer]::BlockCopy($x,0,$o,$i,$x.Length);$i+=$x.Length};return ,$o}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss';$usb=Join-Path 'E:\PetManagerRecovery' "petmanager-prod-$stamp.key";if(Test-Path $usb){throw 'Recovery key target already exists'};$name="petmanager-prod-$stamp";$plain=Join-Path $out "$name.dump";$encrypted=Join-Path $out "$name.pmdump";$dpapi=Join-Path $out "$name.key.dpapi";$drivePath=Join-Path $driveFolder "$name.pmdump";$pgpass=Join-Path $root "pgpass-temp-$PID"
try{
  $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($reader);try{$pw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}
  $pw=$pw.Replace('\','\\').Replace(':','\:');[IO.File]::WriteAllText($pgpass,("aws-1-ap-southeast-1.pooler.supabase.com:5432:postgres:backup_reader.ysxykikqnneuhypybjry:$pw"+[Environment]::NewLine),[Text.Encoding]::ASCII);$pw=$null;PrivateAcl $pgpass
  $env:PGPASSFILE=$pgpass;$env:PGSSLMODE='verify-full';$env:PGSSLROOTCERT=$ca
  $snapshotStartedAt=[DateTimeOffset]::UtcNow.ToString('o')
  $args=@('--host=aws-1-ap-southeast-1.pooler.supabase.com','--port=5432','--username=backup_reader.ysxykikqnneuhypybjry','--dbname=postgres','--format=custom','--no-comments','--no-owner','--no-large-objects','--file',$plain,'--schema=auth','--schema=pm_marketing_private','--schema=pm_signup_private','--schema=private','--schema=public','--schema=supabase_migrations')
  [IO.File]::WriteAllBytes($plain,[byte[]]::new(0));PrivateAcl $plain
  $proc=Start-Process (Join-Path $pg 'pg_dump.exe') -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
  if($proc.ExitCode -ne 0){throw "pg_dump failed with exit code $($proc.ExitCode)"}
  PrivateAcl $plain;& (Join-Path $pg 'pg_restore.exe') --list $plain *> $null;if($LASTEXITCODE -ne 0){throw 'pg_restore listing check failed'}
  $raw=[IO.File]::ReadAllBytes($plain);$rawHash=Hex (Hash $raw)
  $aad=[Text.Encoding]::UTF8.GetBytes('PETMANAGER_PRODUCTION|ysxykikqnneuhypybjry|schemas=auth,pm_marketing_private,pm_signup_private,private,public,supabase_migrations|pg_dump=18|cipher=PMDUMP02')
  $entropy=Hash $aad;$keyBytes=[byte[]]::new(32);$iv=[byte[]]::new(16);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($keyBytes);$rng.GetBytes($iv)}finally{$rng.Dispose()}
  [IO.File]::WriteAllBytes($usb,$keyBytes);PrivateAcl $usb
  $aes=[Security.Cryptography.AesManaged]::new();$aes.Mode='CBC';$aes.Padding='PKCS7';$aes.Key=$keyBytes;$aes.IV=$iv;try{$enc=$aes.CreateEncryptor();try{$cipher=$enc.TransformFinalBlock($raw,0,$raw.Length)}finally{$enc.Dispose()}}finally{$aes.Dispose()}
  $magic=[Text.Encoding]::ASCII.GetBytes('PMDUMP02');$tag=Mac $keyBytes (JoinB @($aad,$magic,$iv,$cipher));$payload=JoinB @($magic,$iv,$tag,$cipher);[IO.File]::WriteAllBytes($encrypted,$payload);PrivateAcl $encrypted
  $protected=[Security.Cryptography.ProtectedData]::Protect($keyBytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes($dpapi,$protected);PrivateAcl $dpapi
  $check=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($dpapi),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser);$actualTag=Mac $check (JoinB @($aad,$magic,$iv,$cipher));if((Hex $actualTag) -ne (Hex $tag)){throw 'Local HMAC verification failed'}
  $decAes=[Security.Cryptography.AesManaged]::new();$decAes.Mode='CBC';$decAes.Padding='PKCS7';$decAes.Key=$check;$decAes.IV=$iv;try{$dec=$decAes.CreateDecryptor();try{$recovered=$dec.TransformFinalBlock($cipher,0,$cipher.Length)}finally{$dec.Dispose()}}finally{$decAes.Dispose()}
  if((Hex (Hash $recovered)) -ne $rawHash){throw 'Local decrypt SHA256 verification failed'}
  Remove-Item $plain -Force
  if(!(Test-Path -LiteralPath $driveFolder -PathType Container)){throw 'Google Drive backup folder unavailable'}
  if(Test-Path -LiteralPath $drivePath){throw 'Google Drive backup target already exists'}
  Copy-Item -LiteralPath $encrypted -Destination $drivePath -ErrorAction Stop
  $localHash=(Get-FileHash -LiteralPath $encrypted -Algorithm SHA256).Hash.ToLowerInvariant();$driveHash=(Get-FileHash -LiteralPath $drivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if($localHash -ne $driveHash -or (Get-Item -LiteralPath $encrypted).Length -ne (Get-Item -LiteralPath $drivePath).Length){throw 'Google Drive sync-folder readback differs from local encrypted artifact'}
  $cutoff=[DateTime]::UtcNow.AddDays(-60);$driveBackups=@(Get-ChildItem -LiteralPath $driveFolder -File -Filter 'petmanager-prod-*.pmdump' -Force | Sort-Object LastWriteTimeUtc -Descending)
  $newestDriveBackup=$driveBackups | Select-Object -First 1;$expiredDriveBackups=@($driveBackups | Where-Object {$_.LastWriteTimeUtc -lt $cutoff -and $_.FullName -ne $newestDriveBackup.FullName})
  foreach($expiredBackup in $expiredDriveBackups){Remove-Item -LiteralPath $expiredBackup.FullName -Force}
  $receipt=[pscustomobject]@{Status='ENCRYPTED_BACKUP_SAVED_TO_GOOGLE_DRIVE';PrivilegesIncluded=$true;ObjectKey="$name.pmdump";RawArchiveBytes=$raw.Length;RawArchiveSHA256=$rawHash;EncryptedBytes=(Get-Item $encrypted).Length;EncryptedSHA256=$localHash;Format='PMDUMP02 AES-CBC+HMAC-SHA256';GoogleDrivePath=$drivePath;GoogleDriveSyncFolderReadback='byte-for-byte SHA256 match; cloud sync completes asynchronously';GoogleDriveRetentionDays=60;ExpiredDriveBackupsRemoved=$expiredDriveBackups.Count;LocalEncryptedFile=$encrypted;DPAPIKey=$dpapi;PortableRecoveryKey=$usb;RawDumpRemoved=$true}
  $receipt | Add-Member -NotePropertyName RecoverablePointAt -NotePropertyValue $snapshotStartedAt
  $receipt | Add-Member -NotePropertyName VerifiedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToString("o"))
  $receiptPath=Join-Path $out "$name.receipt.json"; $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptPath -Encoding UTF8;PrivateAcl $receiptPath
  $receipt
  foreach($b in @($raw,$aad,$entropy,$keyBytes,$iv,$cipher,$tag,$payload,$protected,$check,$actualTag,$recovered)){if($b){[Array]::Clear($b,0,$b.Length)}}
}finally{
  Remove-Item $pgpass -Force -ErrorAction SilentlyContinue;Remove-Item Env:PGPASSFILE,Env:PGSSLMODE,Env:PGSSLROOTCERT -ErrorAction SilentlyContinue
  Remove-Item $plain -Force -ErrorAction SilentlyContinue
}
