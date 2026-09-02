param(
  [string]$SecretPath = "C:\Users\happy\AppData\Local\Temp\petmanager-dev-db-password.dpapi",
  [string]$CaPath = "C:\Users\happy\AppData\Local\Temp\petmanager-supabase-prod-ca-2021.crt",
  [string]$PgBin = "C:\Program Files\PostgreSQL\18\bin",
  [string]$RemoteHost = "aws-1-ap-southeast-2.pooler.supabase.com",
  [int]$RemotePort = 5432,
  [string]$RemoteUser = "postgres.qefxdtmdtvnzgupmjlom",
  [string]$RemoteDatabase = "postgres",
  [int]$LocalPort = 55441,
  [string]$EncryptedBackupPath = "",
  [string]$ProtectedKeyPath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$expectedProjectRef = "qefxdtmdtvnzgupmjlom"
$forbiddenProjectRef = "ysxykikqnneuhypybjry"
$expectedHost = "aws-1-ap-southeast-2.pooler.supabase.com"
$expectedUser = "postgres.qefxdtmdtvnzgupmjlom"
$expectedCaSha256 = "700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7"
$selectedSchemas = @("public", "auth", "private", "supabase_migrations")
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$runId = [guid]::NewGuid().ToString("N")
$clusterPath = Join-Path $tempRoot ("petmanager-dev-restore-" + $runId)
$localDatabase = "pm_atomic_signup_restore"
$clusterStarted = $false
$clusterPid = $null

if ([string]::IsNullOrWhiteSpace($EncryptedBackupPath)) {
  $EncryptedBackupPath = Join-Path $tempRoot ("petmanager-dev-" + $runId + ".pmdump")
}
if ([string]::IsNullOrWhiteSpace($ProtectedKeyPath)) {
  $ProtectedKeyPath = $EncryptedBackupPath + ".key.dpapi"
}

function Assert-TaskTempPath {
  param([string]$Path, [string]$ExpectedPrefix)
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Task path escaped the OS temp directory"
  }
  if (-not (Split-Path -Leaf $resolved).StartsWith($ExpectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Task path prefix mismatch"
  }
  return $resolved
}

function Get-Sha256Hex {
  param([byte[]]$Bytes)
  $hash = [Security.Cryptography.SHA256]::HashData($Bytes)
  try { return [Convert]::ToHexString($hash).ToLowerInvariant() }
  finally { [Array]::Clear($hash, 0, $hash.Length) }
}

function Get-FileSha256Hex {
  param([string]$Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Set-OwnerOnlyAcl {
  param([string]$Path)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetOwner($sid)
  $acl.SetAccessRuleProtection($true, $false)
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $sid,
    [Security.AccessControl.FileSystemRights]::FullControl,
    [Security.AccessControl.AccessControlType]::Allow
  )
  [void]$acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $Path -AclObject $acl
}

function New-ProcessStartInfo {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [hashtable]$Environment = @{}
  )
  if (-not (Test-Path -LiteralPath $FilePath)) { throw "Required tool is missing: $FilePath" }
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FilePath
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  foreach ($argument in $Arguments) { [void]$psi.ArgumentList.Add($argument) }
  foreach ($entry in $Environment.GetEnumerator()) { $psi.Environment[$entry.Key] = [string]$entry.Value }
  return $psi
}

function Invoke-CapturedProcess {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [hashtable]$Environment = @{}
  )
  $psi = New-ProcessStartInfo -FilePath $FilePath -Arguments $Arguments -Environment $Environment
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $psi
  $stdout = [IO.MemoryStream]::new()
  try {
    if (-not $process.Start()) { throw "Unable to start process" }
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.StandardOutput.BaseStream.CopyTo($stdout)
    $process.WaitForExit()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $bytes = $stdout.ToArray()
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $bytes; Stderr = $stderr }
  }
  finally {
    $stdout.Dispose()
    $process.Dispose()
  }
}

function Invoke-ProcessWithBinaryInput {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [byte[]]$InputBytes,
    [hashtable]$Environment = @{}
  )
  $psi = New-ProcessStartInfo -FilePath $FilePath -Arguments $Arguments -Environment $Environment
  $psi.RedirectStandardInput = $true
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $psi
  try {
    if (-not $process.Start()) { throw "Unable to start process" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $inputPipeClosedEarly = $false
    try {
      $process.StandardInput.BaseStream.Write($InputBytes, 0, $InputBytes.Length)
      $process.StandardInput.BaseStream.Flush()
    }
    catch [IO.IOException] { $inputPipeClosedEarly = $true }
    finally { $process.StandardInput.Close() }
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    return [pscustomobject]@{
      ExitCode = $process.ExitCode
      Stdout = $stdout
      Stderr = $stderr
      InputPipeClosedEarly = $inputPipeClosedEarly
    }
  }
  finally {
    $process.Dispose()
  }
}

function Assert-ProcessSuccess {
  param([pscustomobject]$Result, [string]$Label)
  if ($Result.ExitCode -ne 0) {
    if ($Label -in @("psql", "pg_restore") -and -not [string]::IsNullOrWhiteSpace($Result.Stderr)) {
      $safeDiagnostic = (($Result.Stderr -split "`r?`n" | Where-Object { $_ -match '^(ERROR|FATAL|psql|pg_restore):' } | Select-Object -First 2) -join " ")
      if ($safeDiagnostic.Length -gt 500) { $safeDiagnostic = $safeDiagnostic.Substring(0, 500) }
      if (-not [string]::IsNullOrWhiteSpace($safeDiagnostic)) {
        throw "$Label failed with exit code $($Result.ExitCode): $safeDiagnostic"
      }
    }
    throw "$Label failed with exit code $($Result.ExitCode); diagnostic output suppressed to protect database contents"
  }
}

function Convert-BytesToUtf8 {
  param([byte[]]$Bytes)
  return [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
}

function Invoke-PsqlText {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$User,
    [string]$Database,
    [string]$Sql,
    [hashtable]$Environment = @{}
  )
  $arguments = @(
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    "-h", $HostName, "-p", [string]$Port, "-U", $User, "-d", $Database,
    "-f", "-"
  )
  $sqlBytes = [Text.UTF8Encoding]::new($false).GetBytes($Sql + "`n")
  try {
    $result = Invoke-ProcessWithBinaryInput -FilePath (Join-Path $PgBin "psql.exe") -Arguments $arguments -InputBytes $sqlBytes -Environment $Environment
    Assert-ProcessSuccess -Result $result -Label "psql"
    return $result.Stdout.Trim()
  }
  finally {
    [Array]::Clear($sqlBytes, 0, $sqlBytes.Length)
  }
}

function Invoke-PgTool {
  param([string]$Name, [string[]]$Arguments)
  $result = Invoke-CapturedProcess -FilePath (Join-Path $PgBin $Name) -Arguments $Arguments
  try { Assert-ProcessSuccess -Result $result -Label $Name }
  finally { if ($result.Stdout) { [Array]::Clear($result.Stdout, 0, $result.Stdout.Length) } }
}

function Invoke-PgCtlWithoutRedirect {
  param([string[]]$Arguments)
  $filePath = Join-Path $PgBin "pg_ctl.exe"
  if (-not (Test-Path -LiteralPath $filePath)) { throw "Required tool is missing: $filePath" }
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $filePath
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  foreach ($argument in $Arguments) { [void]$psi.ArgumentList.Add($argument) }
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $psi
  try {
    if (-not $process.Start()) { throw "Unable to start pg_ctl.exe" }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "pg_ctl.exe failed with exit code $($process.ExitCode)" }
  }
  finally { $process.Dispose() }
}

function Get-FingerprintSql {
  return @'
set timezone = 'UTC';

select format(
  'select %L, count(*)::bigint, encode(extensions.digest(coalesce(string_agg(row_hash, '''' order by row_hash), ''''), ''sha256''), ''hex'') from (select encode(extensions.digest(to_jsonb(t)::text, ''sha256''), ''hex'') as row_hash from %I.%I as t) as rows_for_hash;',
  n.nspname || '.' || c.relname,
  n.nspname,
  c.relname
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname
\gexec

select format(
  'select %L, 1::bigint, encode(extensions.digest(last_value::text || '':'' || is_called::text, ''sha256''), ''hex'') from %I.%I;',
  '__SEQ__' || n.nspname || '.' || c.relname,
  n.nspname,
  c.relname
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  and c.relkind = 'S'
order by n.nspname, c.relname
\gexec

with schema_objects as (
  select 'relation'::text as kind,
         format('%I.%I|%s|%s|%s|%s|%s', n.nspname, c.relname, c.relkind, c.relpersistence,
                c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner)) as body
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select 'column',
         format('%I.%I|%s|%s|%s|%s|%s|%s', n.nspname, c.relname, a.attname,
                pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull, a.attidentity,
                a.attgenerated, coalesce(pg_get_expr(d.adbin, d.adrelid), ''))
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
    and c.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0 and not a.attisdropped
  union all
  select 'constraint', format('%I.%I|%s|%s', n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid, false))
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
    and con.contype <> 'n'
  union all
  select 'index', format('%I.%I|%s', n.nspname, c.relname, pg_get_indexdef(i.indexrelid, 0, false))
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'trigger', format('%I.%I|%s', n.nspname, c.relname, pg_get_triggerdef(t.oid, false))
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations') and not t.tgisinternal
  union all
  select 'policy',
         format('%I.%I|%s|%s|%s|%s|%s', n.nspname, c.relname, p.polname, p.polcmd,
                coalesce((select string_agg(coalesce(r.rolname, 'PUBLIC'), ',' order by coalesce(r.rolname, 'PUBLIC'))
                          from unnest(p.polroles) role_oid
                          left join pg_catalog.pg_roles r on r.oid = role_oid), ''),
                coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
                coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid = p.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'function',
         format('%I.%I(%s)|%s|%s|%s|%s|%s|%s|%s|%s', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), l.lanname,
                p.prosecdef, p.provolatile, p.proparallel, coalesce(p.proconfig::text, ''),
                coalesce(p.probin, ''), p.prosrc)
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'enum', format('%I.%I|%s|%s', n.nspname, t.typname, e.enumsortorder, e.enumlabel)
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  join pg_catalog.pg_enum e on e.enumtypid = t.oid
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'relation_acl', format('%I.%I|%s|%s', n.nspname, c.relname, pg_get_userbyid(c.relowner),
    coalesce((
      select string_agg(
        format('%s>%s:%s:%s',
          pg_get_userbyid(acl.grantor),
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable),
        ',' order by
          pg_get_userbyid(acl.grantor),
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable)
      from pg_catalog.aclexplode(
        coalesce(
          c.relacl,
          pg_catalog.acldefault(
            case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end,
            c.relowner))) acl
    ), ''))
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select 'function_acl', format('%I.%I(%s)|%s|%s', n.nspname, p.proname,
    pg_get_function_identity_arguments(p.oid), pg_get_userbyid(p.proowner),
    coalesce((
      select string_agg(
        format('%s>%s:%s:%s',
          pg_get_userbyid(acl.grantor),
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable),
        ',' order by
          pg_get_userbyid(acl.grantor),
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable)
      from pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
    ), ''))
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'schema_acl', format('%I|%s|%s', n.nspname, pg_get_userbyid(n.nspowner),
    coalesce((
      select string_agg(
        format('%s:%s:%s',
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable),
        ',' order by
          case when acl.grantee = 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
          acl.privilege_type,
          acl.is_grantable)
      from pg_catalog.aclexplode(
        coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) acl
    ), ''))
  from pg_catalog.pg_namespace n
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
  union all
  select 'sequence', format('%I.%I|%s|%s|%s|%s|%s', n.nspname, c.relname,
                            s.seqstart, s.seqincrement, s.seqmax, s.seqmin, s.seqcache)
  from pg_catalog.pg_sequence s
  join pg_catalog.pg_class c on c.oid = s.seqrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth', 'private', 'supabase_migrations')
), hashed as (
  select kind, body, encode(extensions.digest(kind || chr(31) || body, 'sha256'), 'hex') as object_hash
  from schema_objects
)
select '__SCHEMA_KIND__' || kind, count(*)::bigint,
       encode(extensions.digest(coalesce(string_agg(object_hash, '' order by body), ''), 'sha256'), 'hex')
from hashed
group by kind
union all
select '__SCHEMA_ACL_DETAIL__' || replace(body, '|', ';'), 1::bigint, object_hash
from hashed
where kind = 'schema_acl'
union all
select '__SCHEMA__', count(*)::bigint,
       encode(extensions.digest(coalesce(string_agg(object_hash, '' order by kind, body), ''), 'sha256'), 'hex')
from hashed;
'@
}

function Convert-ToFingerprintSummary {
  param([string]$Text)
  $lines = @($Text -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $schemaLine = @($lines | Where-Object { $_.StartsWith("__SCHEMA__|") })
  if ($schemaLine.Count -ne 1) { throw "Schema fingerprint output is incomplete" }
  $schemaKindLines = @($lines | Where-Object { $_.StartsWith("__SCHEMA_KIND__") } | Sort-Object)
  $schemaAclDetailLines = @($lines | Where-Object { $_.StartsWith("__SCHEMA_ACL_DETAIL__") } | Sort-Object)
  $dataLines = @($lines | Where-Object {
      -not $_.StartsWith("__SCHEMA__|") -and
      -not $_.StartsWith("__SCHEMA_KIND__") -and
      -not $_.StartsWith("__SCHEMA_ACL_DETAIL__")
    } | Sort-Object)
  $tableLines = @($dataLines | Where-Object { -not $_.StartsWith("__SEQ__") })
  $sequenceLines = @($dataLines | Where-Object { $_.StartsWith("__SEQ__") })
  $totalRows = [int64]0
  foreach ($line in $tableLines) {
    $parts = $line.Split('|')
    if ($parts.Count -ne 3) { throw "Malformed table fingerprint output" }
    $totalRows += [int64]$parts[1]
  }
  $canonical = (($dataLines + $schemaKindLines + $schemaAclDetailLines + $schemaLine) -join "`n")
  $canonicalBytes = [Text.Encoding]::UTF8.GetBytes($canonical)
  try { $combinedHash = Get-Sha256Hex -Bytes $canonicalBytes }
  finally { [Array]::Clear($canonicalBytes, 0, $canonicalBytes.Length) }
  $schemaParts = $schemaLine[0].Split('|')
  return [pscustomobject]@{
    Canonical = $canonical
    CombinedHash = $combinedHash
    TableCount = $tableLines.Count
    SequenceCount = $sequenceLines.Count
    TotalRows = $totalRows
    SchemaObjectCount = [int64]$schemaParts[1]
    SchemaHash = $schemaParts[2]
  }
}

function Get-DatabaseFingerprint {
  param(
    [string]$HostName,
    [int]$Port,
    [string]$User,
    [string]$Database,
    [hashtable]$Environment = @{}
  )
  $text = Invoke-PsqlText -HostName $HostName -Port $Port -User $User -Database $Database -Sql (Get-FingerprintSql) -Environment $Environment
  return Convert-ToFingerprintSummary -Text $text
}

function Write-EncryptedArchive {
  param([byte[]]$ArchiveBytes, [string]$ArchivePath, [string]$KeyPath)
  $aad = [Text.Encoding]::UTF8.GetBytes("PM_ATOMIC_SIGNUP_R1|qefxdtmdtvnzgupmjlom|schemas=auth,private,public,supabase_migrations|pg_dump=18.4")
  $entropy = [Security.Cryptography.SHA256]::HashData($aad)
  $key = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  $nonce = [Security.Cryptography.RandomNumberGenerator]::GetBytes(12)
  $tag = [byte[]]::new(16)
  $ciphertext = [byte[]]::new($ArchiveBytes.Length)
  $magic = [Text.Encoding]::ASCII.GetBytes("PMDUMP01")
  try {
    $aes = [Security.Cryptography.AesGcm]::new($key, 16)
    try { $aes.Encrypt($nonce, $ArchiveBytes, $ciphertext, $tag, $aad) }
    finally { $aes.Dispose() }
    $payload = [byte[]]::new($magic.Length + $nonce.Length + $tag.Length + $ciphertext.Length)
    [Buffer]::BlockCopy($magic, 0, $payload, 0, $magic.Length)
    [Buffer]::BlockCopy($nonce, 0, $payload, $magic.Length, $nonce.Length)
    [Buffer]::BlockCopy($tag, 0, $payload, $magic.Length + $nonce.Length, $tag.Length)
    [Buffer]::BlockCopy($ciphertext, 0, $payload, $magic.Length + $nonce.Length + $tag.Length, $ciphertext.Length)
    [IO.File]::WriteAllBytes($ArchivePath, $payload)
    Set-OwnerOnlyAcl -Path $ArchivePath
    $protectedKey = [Security.Cryptography.ProtectedData]::Protect(
      $key, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    try {
      [IO.File]::WriteAllBytes($KeyPath, $protectedKey)
      Set-OwnerOnlyAcl -Path $KeyPath
    }
    finally { [Array]::Clear($protectedKey, 0, $protectedKey.Length) }
    return [pscustomobject]@{
      EncryptedBytes = $payload.Length
      EncryptedSha256 = Get-Sha256Hex -Bytes $payload
    }
  }
  finally {
    foreach ($buffer in @($aad, $entropy, $key, $nonce, $tag, $ciphertext, $magic)) {
      if ($buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
    }
    if ($payload) { [Array]::Clear($payload, 0, $payload.Length) }
  }
}

function Read-EncryptedArchive {
  param([string]$ArchivePath, [string]$KeyPath)
  $payload = [IO.File]::ReadAllBytes($ArchivePath)
  $aad = [Text.Encoding]::UTF8.GetBytes("PM_ATOMIC_SIGNUP_R1|qefxdtmdtvnzgupmjlom|schemas=auth,private,public,supabase_migrations|pg_dump=18.4")
  $entropy = [Security.Cryptography.SHA256]::HashData($aad)
  $expectedMagic = [Text.Encoding]::ASCII.GetBytes("PMDUMP01")
  $protectedKey = [IO.File]::ReadAllBytes($KeyPath)
  $key = $null
  try {
    if ($payload.Length -lt 36) { throw "Encrypted archive is truncated" }
    $actualMagic = [byte[]]::new(8)
    [Buffer]::BlockCopy($payload, 0, $actualMagic, 0, 8)
    if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($expectedMagic, $actualMagic)) {
      throw "Encrypted archive magic mismatch"
    }
    $nonce = [byte[]]::new(12)
    $tag = [byte[]]::new(16)
    $ciphertext = [byte[]]::new($payload.Length - 36)
    [Buffer]::BlockCopy($payload, 8, $nonce, 0, 12)
    [Buffer]::BlockCopy($payload, 20, $tag, 0, 16)
    [Buffer]::BlockCopy($payload, 36, $ciphertext, 0, $ciphertext.Length)
    $key = [Security.Cryptography.ProtectedData]::Unprotect(
      $protectedKey, $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    $plaintext = [byte[]]::new($ciphertext.Length)
    $aes = [Security.Cryptography.AesGcm]::new($key, 16)
    try { $aes.Decrypt($nonce, $ciphertext, $tag, $plaintext, $aad) }
    finally { $aes.Dispose() }
    return ,$plaintext
  }
  finally {
    foreach ($buffer in @($payload, $aad, $entropy, $expectedMagic, $actualMagic, $protectedKey, $key, $nonce, $tag, $ciphertext)) {
      if ($buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
    }
  }
}

$archiveBytes = $null
$restoreBytes = $null
$passwordBytes = $null
$password = $null

try {
  if ($RemoteHost -ne $expectedHost -or $RemoteUser -ne $expectedUser) {
    throw "Development target allowlist mismatch"
  }
  if (($RemoteHost + $RemoteUser + $RemoteDatabase) -match [regex]::Escape($forbiddenProjectRef)) {
    throw "Production target detected"
  }
  if (-not ($RemoteUser -match [regex]::Escape($expectedProjectRef))) {
    throw "Development project ref is missing from the pooler user"
  }
  if (-not (Test-Path -LiteralPath $SecretPath)) { throw "DPAPI secret is missing" }
  if (-not (Test-Path -LiteralPath $CaPath)) { throw "Supabase CA certificate is missing" }
  if ((Get-FileSha256Hex -Path $CaPath) -ne $expectedCaSha256) { throw "Supabase CA certificate checksum mismatch" }

  $EncryptedBackupPath = Assert-TaskTempPath -Path $EncryptedBackupPath -ExpectedPrefix "petmanager-dev-"
  $ProtectedKeyPath = Assert-TaskTempPath -Path $ProtectedKeyPath -ExpectedPrefix "petmanager-dev-"
  $clusterPath = Assert-TaskTempPath -Path $clusterPath -ExpectedPrefix "petmanager-dev-restore-"
  if (Test-Path -LiteralPath $EncryptedBackupPath) { throw "Encrypted backup path already exists" }
  if (Test-Path -LiteralPath $ProtectedKeyPath) { throw "Protected key path already exists" }

  Add-Type -AssemblyName System.Security
  $passwordBytes = [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($SecretPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  $password = [Text.UTF8Encoding]::new($false, $true).GetString($passwordBytes)
  if ([string]::IsNullOrWhiteSpace($password) -or $password.Contains("`r") -or $password.Contains("`n")) {
    throw "Decrypted secret format is invalid"
  }
  $remoteEnvironment = @{
    PGPASSWORD = $password
    PGSSLMODE = "verify-full"
    PGSSLROOTCERT = $CaPath
    PGCONNECT_TIMEOUT = "15"
    PGAPPNAME = "pm_atomic_signup_backup_gate"
  }

  $identity = Invoke-PsqlText -HostName $RemoteHost -Port $RemotePort -User $RemoteUser -Database $RemoteDatabase -Environment $remoteEnvironment -Sql @'
select current_database() || '|' || current_setting('server_version') || '|' || current_setting('transaction_read_only');
'@
  $identityParts = $identity.Split('|')
  if ($identityParts.Count -ne 3 -or $identityParts[0] -ne "postgres" -or -not $identityParts[1].StartsWith("17.6") -or $identityParts[2] -ne "off") {
    throw "Unexpected Development database identity"
  }

  $remoteBefore = Get-DatabaseFingerprint -HostName $RemoteHost -Port $RemotePort -User $RemoteUser -Database $RemoteDatabase -Environment $remoteEnvironment

  $dumpArguments = @(
    "--format=custom", "--no-comments",
    "--host=$RemoteHost", "--port=$RemotePort", "--username=$RemoteUser", "--dbname=$RemoteDatabase"
  )
  foreach ($schema in $selectedSchemas) { $dumpArguments += "--schema=$schema" }
  $dumpResult = Invoke-CapturedProcess -FilePath (Join-Path $PgBin "pg_dump.exe") -Arguments $dumpArguments -Environment $remoteEnvironment
  try {
    Assert-ProcessSuccess -Result $dumpResult -Label "pg_dump"
    $archiveBytes = $dumpResult.Stdout
    $dumpResult.Stdout = $null
  }
  finally {
    if ($dumpResult.Stdout) { [Array]::Clear($dumpResult.Stdout, 0, $dumpResult.Stdout.Length) }
  }
  if (-not $archiveBytes -or $archiveBytes.Length -lt 1024) { throw "pg_dump archive is unexpectedly small" }
  $plaintextArchiveSha256 = Get-Sha256Hex -Bytes $archiveBytes

  $remoteAfter = Get-DatabaseFingerprint -HostName $RemoteHost -Port $RemotePort -User $RemoteUser -Database $RemoteDatabase -Environment $remoteEnvironment
  if ($remoteBefore.Canonical -cne $remoteAfter.Canonical) {
    throw "Development changed during the backup window; no remote write was attempted"
  }

  $encryption = Write-EncryptedArchive -ArchiveBytes $archiveBytes -ArchivePath $EncryptedBackupPath -KeyPath $ProtectedKeyPath
  [Array]::Clear($archiveBytes, 0, $archiveBytes.Length)
  $archiveBytes = $null
  [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
  $passwordBytes = $null
  $password = $null
  $remoteEnvironment.Clear()

  $restoreBytes = Read-EncryptedArchive -ArchivePath $EncryptedBackupPath -KeyPath $ProtectedKeyPath
  if ((Get-Sha256Hex -Bytes $restoreBytes) -cne $plaintextArchiveSha256) {
    throw "Decrypted archive checksum mismatch"
  }

  New-Item -ItemType Directory -Path $clusterPath | Out-Null
  Invoke-PgTool -Name "initdb.exe" -Arguments @(
    "-D", $clusterPath, "--auth=trust", "--username=postgres", "--no-locale", "--encoding=UTF8"
  )
  $logPath = Join-Path $clusterPath "postgres.log"
  Invoke-PgCtlWithoutRedirect -Arguments @(
    "-s", "-D", $clusterPath, "-l", $logPath, "-o", "-p $LocalPort -h 127.0.0.1", "-w", "start"
  )
  $clusterStarted = $true
  $pidPath = Join-Path $clusterPath "postmaster.pid"
  if (Test-Path -LiteralPath $pidPath) { $clusterPid = [int](Get-Content -LiteralPath $pidPath -TotalCount 1) }
  Invoke-PgTool -Name "createdb.exe" -Arguments @(
    "-h", "127.0.0.1", "-p", [string]$LocalPort, "-U", "postgres", $localDatabase
  )

  $bootstrapSql = @'
do $pm$
declare role_name text;
begin
  foreach role_name in array array['anon','authenticated','dashboard_user','service_role','supabase_admin','supabase_auth_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin', role_name);
    end if;
  end loop;
end
$pm$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
drop schema public;
'@
  [void](Invoke-PsqlText -HostName "127.0.0.1" -Port $LocalPort -User "postgres" -Database $localDatabase -Sql $bootstrapSql)

  $restoreResult = Invoke-ProcessWithBinaryInput -FilePath (Join-Path $PgBin "pg_restore.exe") -Arguments @(
    "--exit-on-error", "--host=127.0.0.1", "--port=$LocalPort", "--username=postgres", "--dbname=$localDatabase"
  ) -InputBytes $restoreBytes
  Assert-ProcessSuccess -Result $restoreResult -Label "pg_restore"
  [Array]::Clear($restoreBytes, 0, $restoreBytes.Length)
  $restoreBytes = $null

  [void](Invoke-PsqlText -HostName "127.0.0.1" -Port $LocalPort -User "postgres" -Database $localDatabase -Sql @'
grant usage on schema public to public;
'@)

  $localFingerprint = Get-DatabaseFingerprint -HostName "127.0.0.1" -Port $LocalPort -User "postgres" -Database $localDatabase
  if ($remoteAfter.Canonical -cne $localFingerprint.Canonical) {
    $fingerprintDiff = @(
      Compare-Object -ReferenceObject @($remoteAfter.Canonical -split "`n") -DifferenceObject @($localFingerprint.Canonical -split "`n") |
        Select-Object -First 40 |
        ForEach-Object { "$($_.SideIndicator)|$($_.InputObject)" }
    )
    throw "Isolated restore count or fingerprint mismatch: $($fingerprintDiff -join ';')"
  }

  [pscustomobject]@{
    Status = "PM_DEV_ENCRYPTED_BACKUP_RESTORE_PASS"
    Target = "petmanager-dev:$expectedProjectRef"
    RemoteServer = $identityParts[1]
    PgDump = (& (Join-Path $PgBin "pg_dump.exe") --version | Out-String).Trim()
    SelectedSchemas = ($selectedSchemas -join ",")
    RestoreNormalization = "public_schema_builtin_usage"
    TableCount = $localFingerprint.TableCount
    SequenceCount = $localFingerprint.SequenceCount
    TotalRows = $localFingerprint.TotalRows
    SchemaObjectCount = $localFingerprint.SchemaObjectCount
    FingerprintSha256 = $localFingerprint.CombinedHash
    SchemaSha256 = $localFingerprint.SchemaHash
    PlaintextArchiveSha256 = $plaintextArchiveSha256
    EncryptedArchiveSha256 = $encryption.EncryptedSha256
    EncryptedArchiveBytes = $encryption.EncryptedBytes
    EncryptedBackupPath = $EncryptedBackupPath
    ProtectedKeyPath = $ProtectedKeyPath
    TemporaryClusterPid = $clusterPid
    RemoteWrites = 0
  } | ConvertTo-Json -Depth 3
}
finally {
  if ($archiveBytes) { [Array]::Clear($archiveBytes, 0, $archiveBytes.Length) }
  if ($restoreBytes) { [Array]::Clear($restoreBytes, 0, $restoreBytes.Length) }
  if ($passwordBytes) { [Array]::Clear($passwordBytes, 0, $passwordBytes.Length) }
  $password = $null
  if ($clusterStarted -and (Test-Path -LiteralPath $clusterPath)) {
    try { Invoke-PgCtlWithoutRedirect -Arguments @("-s", "-D", $clusterPath, "-m", "fast", "-w", "stop") }
    catch { Write-Warning "Temporary PostgreSQL cleanup failed" }
  }
  $resolvedCluster = [IO.Path]::GetFullPath($clusterPath)
  if ($resolvedCluster.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedCluster).StartsWith("petmanager-dev-restore-", [StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $resolvedCluster)) {
    Remove-Item -LiteralPath $resolvedCluster -Recurse -Force
  }
}
