[CmdletBinding()]
param(
  [string]$VersionCode = $env:PETMANAGER_ANDROID_VERSION_CODE,
  [string]$VersionName = $env:PETMANAGER_ANDROID_VERSION_NAME,
  [string]$ProductionServerUrl = $env:CAPACITOR_PRODUCTION_SERVER_URL,
  [string]$WebBuildEvidenceSha = $env:PETMANAGER_WEB_BUILD_EVIDENCE_SHA,
  [string]$ExpectedCertificateSha256 = $env:PETMANAGER_ANDROID_CERTIFICATE_SHA256,
  [string]$OutputDirectory,
  [switch]$VerifyOnly,
  [string]$BundlePath,
  [string]$BundleToolJar = $env:BUNDLETOOL_JAR
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$requiredServerUrl = "https://app.petmanager.co.kr"
$requiredPackage = "kr.petmanager.owner"
$defaultCertificateSha256 = "7C:76:09:4F:47:27:92:D3:8E:5B:8F:48:43:6F:B6:C5:16:D8:C2:20:BC:A0:F1:32:03:2D:1A:C1:9A:C0:9B:23"
$bundleToolVersion = "1.18.1"
$bundleToolSha256 = "675786493983787FFA11550BDB7C0715679A44E1643F3FF980A529E9C822595C"
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$java = Join-Path $javaHome "bin\java.exe"
$jarsigner = Join-Path $javaHome "bin\jarsigner.exe"
$keytool = Join-Path $javaHome "bin\keytool.exe"
$gradle = Join-Path $projectRoot "android\gradlew.bat"
$firebaseConfig = Join-Path $projectRoot "android\app\google-services.json"
$keystoreConfig = Join-Path $projectRoot "android\keystore.properties"
$generatedCapacitorConfig = Join-Path $projectRoot "android\app\src\main\assets\capacitor.config.json"
$gradleBundle = Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab"
$stageSeconds = [ordered]@{}
$stageStatus = [ordered]@{}
$totalWatch = [Diagnostics.Stopwatch]::StartNew()

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Invoke-TimedStage {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  $watch = [Diagnostics.Stopwatch]::StartNew()
  try {
    $result = & $Action
    $stageStatus[$Name] = "completed"
    return $result
  } catch {
    $stageStatus[$Name] = "failed"
    throw
  } finally {
    $watch.Stop()
    $stageSeconds[$Name] = [Math]::Round($watch.Elapsed.TotalSeconds, 2)
  }
}

function Set-SkippedStage {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Reason
  )

  $stageStatus[$Name] = $Reason
  $stageSeconds[$Name] = 0
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (exit $LASTEXITCODE)"
  }
}

function Normalize-Fingerprint {
  param([Parameter(Mandatory = $true)][string]$Value)
  return ($Value -replace '[^0-9A-Fa-f]', '').ToUpperInvariant()
}

function Format-Fingerprint {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [regex]::Replace($Value, '(..)(?!$)', '$1:')
}

function Resolve-BundleTool {
  $toolPath = $BundleToolJar
  if ([string]::IsNullOrWhiteSpace($toolPath)) {
    $toolDirectory = Join-Path $env:LOCALAPPDATA "PetManager\release-tools"
    $toolPath = Join-Path $toolDirectory "bundletool-all-$bundleToolVersion.jar"
    if (-not (Test-Path -LiteralPath $toolPath)) {
      New-Item -ItemType Directory -Path $toolDirectory -Force | Out-Null
      $downloadPath = "$toolPath.download-$PID"
      try {
        Invoke-WebRequest -Uri "https://github.com/google/bundletool/releases/download/$bundleToolVersion/bundletool-all-$bundleToolVersion.jar" -OutFile $downloadPath
        $downloadHash = (Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash
        if ($downloadHash -cne $bundleToolSha256) {
          throw "다운로드한 bundletool의 SHA256이 고정값과 다릅니다."
        }
        Move-Item -LiteralPath $downloadPath -Destination $toolPath
      } finally {
        if (Test-Path -LiteralPath $downloadPath) {
          Remove-Item -LiteralPath $downloadPath -Force
        }
      }
    }
  }

  if (-not (Test-Path -LiteralPath $toolPath)) {
    throw "bundletool JAR를 찾을 수 없습니다: $toolPath"
  }

  $resolvedToolPath = (Resolve-Path -LiteralPath $toolPath).Path
  $toolHash = (Get-FileHash -LiteralPath $resolvedToolPath -Algorithm SHA256).Hash
  if ($toolHash -cne $bundleToolSha256) {
    throw "bundletool JAR의 SHA256이 고정값과 다릅니다: $resolvedToolPath"
  }

  & $java -jar $resolvedToolPath version *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "bundletool 실행에 실패했습니다. (exit $LASTEXITCODE)"
  }

  return $resolvedToolPath
}

function Get-BundleManifestValue {
  param(
    [Parameter(Mandatory = $true)][string]$ToolPath,
    [Parameter(Mandatory = $true)][string]$ArtifactPath,
    [Parameter(Mandatory = $true)][string]$XPath
  )

  $output = @(& $java -jar $ToolPath dump manifest --bundle $ArtifactPath --xpath $XPath 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "AAB 매니페스트 readback에 실패했습니다. (exit $LASTEXITCODE)"
  }
  return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
}

function Read-BundleCapacitorConfig {
  param([Parameter(Mandatory = $true)][string]$ArtifactPath)

  $archive = [IO.Compression.ZipFile]::OpenRead($ArtifactPath)
  try {
    $entry = $archive.GetEntry("base/assets/capacitor.config.json")
    if ($null -eq $entry) {
      throw "AAB에 base/assets/capacitor.config.json이 없습니다."
    }

    $reader = [IO.StreamReader]::new($entry.Open())
    try {
      return ($reader.ReadToEnd() | ConvertFrom-Json)
    } finally {
      $reader.Dispose()
    }
  } finally {
    $archive.Dispose()
  }
}

function Get-ForbiddenEndpointHits {
  param([Parameter(Mandatory = $true)][string]$ArtifactPath)

  $hits = New-Object 'System.Collections.Generic.HashSet[string]'
  $archive = [IO.Compression.ZipFile]::OpenRead($ArtifactPath)
  try {
    foreach ($entry in $archive.Entries) {
      $isEndpointBearingEntry = (
        $entry.FullName.StartsWith("base/assets/") -or
        $entry.FullName.StartsWith("base/res/raw/") -or
        $entry.FullName.StartsWith("base/root/")
      )
      if (-not $isEndpointBearingEntry -or $entry.Length -le 0 -or $entry.Length -gt 67108864) {
        continue
      }

      $stream = $entry.Open()
      try {
        $memory = New-Object IO.MemoryStream
        try {
          $stream.CopyTo($memory)
          $text = [Text.Encoding]::GetEncoding(28591).GetString($memory.ToArray())
        } finally {
          $memory.Dispose()
        }
      } finally {
        $stream.Dispose()
      }

      foreach ($match in [regex]::Matches($text, '(?i)(?:https?:)?//[a-z0-9.-]+(?::[0-9]{1,5})?')) {
        $rawEndpoint = $match.Value
        $absoluteEndpoint = if ($rawEndpoint.StartsWith('//')) { "https:$rawEndpoint" } else { $rawEndpoint }
        try {
          $uri = [Uri]$absoluteEndpoint
          $hostName = $uri.DnsSafeHost.ToLowerInvariant()
          $hostParts = @($hostName -split '[.-]')
          $isForbidden = (
            $hostName -eq 'localhost' -or
            $hostName -eq '127.0.0.1' -or
            $uri.Port -eq 3000 -or
            $uri.Port -eq 3100 -or
            $hostName.EndsWith('.vercel.app') -or
            $hostParts -contains 'dev' -or
            $hostParts -contains 'preview' -or
            $hostParts -contains 'staging'
          )
          if ($isForbidden) {
            [void]$hits.Add("$($entry.FullName):$rawEndpoint")
          }
        } catch {
          continue
        }
      }

      foreach ($match in [regex]::Matches($text, '(?i)(?:localhost|127\.0\.0\.1)\s*:[0-9]{2,5}')) {
        [void]$hits.Add("$($entry.FullName):$($match.Value)")
      }
    }
  } finally {
    $archive.Dispose()
  }

  return @($hits)
}

function Test-BundleArtifact {
  param(
    [Parameter(Mandatory = $true)][string]$ArtifactPath,
    [Parameter(Mandatory = $true)][string]$ToolPath,
    [Parameter(Mandatory = $true)][int]$ExpectedVersionCode,
    [Parameter(Mandatory = $true)][string]$ExpectedVersionName,
    [Parameter(Mandatory = $true)][string]$ExpectedCertificate
  )

  if (-not (Test-Path -LiteralPath $ArtifactPath -PathType Leaf)) {
    throw "검증할 AAB 파일이 없습니다: $ArtifactPath"
  }

  $resolvedArtifactPath = (Resolve-Path -LiteralPath $ArtifactPath).Path
  $packageName = Get-BundleManifestValue -ToolPath $ToolPath -ArtifactPath $resolvedArtifactPath -XPath '/manifest/@package'
  $actualVersionCode = Get-BundleManifestValue -ToolPath $ToolPath -ArtifactPath $resolvedArtifactPath -XPath '/manifest/@android:versionCode'
  $actualVersionName = Get-BundleManifestValue -ToolPath $ToolPath -ArtifactPath $resolvedArtifactPath -XPath '/manifest/@android:versionName'

  if ($packageName -cne $requiredPackage) {
    throw "AAB package readback 불일치: $packageName"
  }
  if ($actualVersionCode -cne $ExpectedVersionCode.ToString()) {
    throw "AAB versionCode readback 불일치: $actualVersionCode"
  }
  if ($actualVersionName -cne $ExpectedVersionName) {
    throw "AAB versionName readback 불일치: $actualVersionName"
  }

  & $jarsigner -verify $resolvedArtifactPath *> $null
  $jarsignerExitCode = $LASTEXITCODE
  if ($jarsignerExitCode -ne 0) {
    throw "jarsigner 검증에 실패했습니다. (exit $jarsignerExitCode)"
  }

  $certificateOutput = @(& $keytool -printcert -jarfile $resolvedArtifactPath 2>&1)
  $keytoolExitCode = $LASTEXITCODE
  if ($keytoolExitCode -ne 0) {
    throw "서명 인증서 readback에 실패했습니다. (exit $keytoolExitCode)"
  }

  $certificateSha256 = $null
  foreach ($line in $certificateOutput) {
    if ($line.ToString() -match 'SHA256:\s*([0-9A-Fa-f:]{64,})') {
      $certificateSha256 = Normalize-Fingerprint $Matches[1]
      break
    }
  }
  if ([string]::IsNullOrWhiteSpace($certificateSha256)) {
    throw "서명 인증서 SHA256을 readback하지 못했습니다."
  }

  $expectedCertificateNormalized = Normalize-Fingerprint $ExpectedCertificate
  if ($certificateSha256 -cne $expectedCertificateNormalized) {
    throw "서명 인증서 SHA256이 승인된 업로드 키와 다릅니다."
  }

  $capacitorConfig = Read-BundleCapacitorConfig -ArtifactPath $resolvedArtifactPath
  if ($capacitorConfig.appId -cne $requiredPackage) {
    throw "AAB 내부 Capacitor appId 불일치: $($capacitorConfig.appId)"
  }
  if ($capacitorConfig.server.url -cne $requiredServerUrl) {
    throw "AAB 내부 server.url 불일치: $($capacitorConfig.server.url)"
  }
  if ($capacitorConfig.server.cleartext -ne $false) {
    throw "AAB 내부 server.cleartext는 false여야 합니다."
  }

  $endpointHits = @(Get-ForbiddenEndpointHits -ArtifactPath $resolvedArtifactPath)
  if ($endpointHits.Count -ne 0) {
    throw "AAB에서 실제 local/dev/preview endpoint $($endpointHits.Count)건을 발견했습니다: $($endpointHits -join ', ')"
  }

  $artifactHash = (Get-FileHash -LiteralPath $resolvedArtifactPath -Algorithm SHA256).Hash
  $artifact = Get-Item -LiteralPath $resolvedArtifactPath
  return [pscustomobject]@{
    path = $artifact.FullName
    length = $artifact.Length
    sha256 = $artifactHash
    package = $packageName
    versionCode = [int]$actualVersionCode
    versionName = $actualVersionName
    certificateSha256 = Format-Fingerprint $certificateSha256
    serverUrl = $capacitorConfig.server.url
    forbiddenEndpointCount = $endpointHits.Count
    jarsignerExitCode = $jarsignerExitCode
  }
}

$versionCodeValue = 0
if (-not [int]::TryParse($VersionCode, [ref]$versionCodeValue) -or $versionCodeValue -le 0) {
  throw "PETMANAGER_ANDROID_VERSION_CODE 또는 -VersionCode에 양의 정수를 지정해 주세요."
}
if ([string]::IsNullOrWhiteSpace($VersionName) -or $VersionName -notmatch '^\d+\.\d+\.\d+$') {
  throw "PETMANAGER_ANDROID_VERSION_NAME 또는 -VersionName에 x.y.z 형식을 지정해 주세요."
}

$serverUrl = if ([string]::IsNullOrWhiteSpace($ProductionServerUrl)) { $requiredServerUrl } else { $ProductionServerUrl.Trim().TrimEnd([char]'/') }
if ($serverUrl -cne $requiredServerUrl) {
  throw "출시용 server.url은 정확히 $requiredServerUrl 이어야 합니다."
}

$expectedCertificate = if ([string]::IsNullOrWhiteSpace($ExpectedCertificateSha256)) { $defaultCertificateSha256 } else { $ExpectedCertificateSha256 }

foreach ($requiredTool in @($java, $jarsigner, $keytool)) {
  if (-not (Test-Path -LiteralPath $requiredTool -PathType Leaf)) {
    throw "Android 출시 도구를 찾을 수 없습니다: $requiredTool"
  }
}

$sourceSha = (& git -C $projectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "현재 Git SHA를 확인하지 못했습니다."
}
$workingTreeStatus = @(& git -C $projectRoot status --porcelain)

if ($VerifyOnly) {
  if ([string]::IsNullOrWhiteSpace($BundlePath)) {
    throw "-VerifyOnly에는 -BundlePath가 필요합니다."
  }
  Set-SkippedStage -Name "web_build" -Reason "not_run_verify_only"
  Set-SkippedStage -Name "server_probe" -Reason "not_run_verify_only"
  Set-SkippedStage -Name "capacitor_sync" -Reason "not_run_verify_only"
  Set-SkippedStage -Name "bundle_release" -Reason "not_run_verify_only"

  $resolvedBundleTool = Invoke-TimedStage -Name "bundletool_ready" -Action { Resolve-BundleTool }
  $verification = Invoke-TimedStage -Name "artifact_verify" -Action {
    Test-BundleArtifact -ArtifactPath $BundlePath -ToolPath $resolvedBundleTool -ExpectedVersionCode $versionCodeValue -ExpectedVersionName $VersionName -ExpectedCertificate $expectedCertificate
  }

  $totalWatch.Stop()
  $stageSeconds["total"] = [Math]::Round($totalWatch.Elapsed.TotalSeconds, 2)
  $stageStatus["total"] = "completed"
  [pscustomobject]@{
    mode = "verify_only"
    sourceSha = $sourceSha
    workingTreeDirty = ($workingTreeStatus.Count -gt 0)
    artifact = $verification
    stageSeconds = $stageSeconds
    stageStatus = $stageStatus
  } | ConvertTo-Json -Depth 6
  exit 0
}

foreach ($requiredFile in @($firebaseConfig, $keystoreConfig, $gradle)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "출시 빌드 필수 파일이 없습니다: $requiredFile"
  }
}

if (-not [string]::IsNullOrWhiteSpace($WebBuildEvidenceSha) -and $WebBuildEvidenceSha.Trim() -ceq $sourceSha) {
  Set-SkippedStage -Name "web_build" -Reason "skipped_matching_sha_evidence"
} else {
  Invoke-TimedStage -Name "web_build" -Action {
    Push-Location $projectRoot
    try {
      Invoke-NativeCommand -FilePath "npm.cmd" -Arguments @("run", "build") -FailureMessage "모바일 Production web build에 실패했습니다."
    } finally {
      Pop-Location
    }
  }
}

Invoke-TimedStage -Name "server_probe" -Action {
  try {
    $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -ne 200) {
      throw "HTTP $($response.StatusCode)"
    }
  } catch {
    throw "출시용 모바일 서버에 연결할 수 없습니다: $serverUrl"
  }
}

$previousEnvironment = @{}
foreach ($environmentName in @("CAPACITOR_SERVER_URL", "JAVA_HOME", "ANDROID_HOME", "PETMANAGER_ANDROID_VERSION_CODE", "PETMANAGER_ANDROID_VERSION_NAME")) {
  $previousEnvironment[$environmentName] = [Environment]::GetEnvironmentVariable($environmentName, "Process")
}

$generatedConfigExisted = Test-Path -LiteralPath $generatedCapacitorConfig -PathType Leaf
$generatedConfigBytes = if ($generatedConfigExisted) { [IO.File]::ReadAllBytes($generatedCapacitorConfig) } else { $null }
$bundleBackup = $null
$buildSucceeded = $false
$candidatePath = $null
$verification = $null

try {
  $env:CAPACITOR_SERVER_URL = $serverUrl
  $env:JAVA_HOME = $javaHome
  $env:ANDROID_HOME = $sdkRoot
  $env:PETMANAGER_ANDROID_VERSION_CODE = $versionCodeValue.ToString()
  $env:PETMANAGER_ANDROID_VERSION_NAME = $VersionName

  Invoke-TimedStage -Name "capacitor_sync" -Action {
    Push-Location $projectRoot
    try {
      Invoke-NativeCommand -FilePath "npx.cmd" -Arguments @("cap", "sync", "android") -FailureMessage "Capacitor Android 동기화에 실패했습니다."
    } finally {
      Pop-Location
    }
  }

  if (Test-Path -LiteralPath $gradleBundle -PathType Leaf) {
    $bundleBackup = Join-Path ([IO.Path]::GetTempPath()) "petmanager-app-release-$([Guid]::NewGuid().ToString('N')).aab"
    Move-Item -LiteralPath $gradleBundle -Destination $bundleBackup
  }

  Invoke-TimedStage -Name "bundle_release" -Action {
    Push-Location (Join-Path $projectRoot "android")
    try {
      Invoke-NativeCommand -FilePath $gradle -Arguments @("--no-daemon", "bundleRelease") -FailureMessage "Android signed release bundle 생성에 실패했습니다."
    } finally {
      Pop-Location
    }
  }

  if (-not (Test-Path -LiteralPath $gradleBundle -PathType Leaf)) {
    throw "bundleRelease가 새 AAB를 생성하지 않았습니다."
  }

  $resolvedBundleTool = Invoke-TimedStage -Name "bundletool_ready" -Action { Resolve-BundleTool }
  $verification = Invoke-TimedStage -Name "artifact_verify" -Action {
    Test-BundleArtifact -ArtifactPath $gradleBundle -ToolPath $resolvedBundleTool -ExpectedVersionCode $versionCodeValue -ExpectedVersionName $VersionName -ExpectedCertificate $expectedCertificate
  }

  $resolvedOutputDirectory = if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    Join-Path $projectRoot "artifacts\android-release"
  } elseif ([IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory
  } else {
    Join-Path $projectRoot $OutputDirectory
  }
  New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
  $shortSha = $sourceSha.Substring(0, [Math]::Min(12, $sourceSha.Length))
  $candidatePath = Join-Path $resolvedOutputDirectory "petmanager-owner-$VersionName-code$versionCodeValue-$shortSha-release.aab"

  if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
    $existingCandidateHash = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash
    if ($existingCandidateHash -cne $verification.sha256) {
      throw "동일 이름의 다른 AAB 후보가 이미 있습니다: $candidatePath"
    }
  } else {
    Copy-Item -LiteralPath $gradleBundle -Destination $candidatePath
  }

  $candidateHash = (Get-FileHash -LiteralPath $candidatePath -Algorithm SHA256).Hash
  if ($candidateHash -cne $verification.sha256) {
    throw "보존한 AAB 후보의 SHA256이 검증 원본과 다릅니다."
  }

  $buildSucceeded = $true
} finally {
  foreach ($environmentName in $previousEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($environmentName, $previousEnvironment[$environmentName], "Process")
  }

  if ($generatedConfigExisted) {
    [IO.File]::WriteAllBytes($generatedCapacitorConfig, $generatedConfigBytes)
  } elseif (Test-Path -LiteralPath $generatedCapacitorConfig) {
    Remove-Item -LiteralPath $generatedCapacitorConfig -Force
  }

  if ($buildSucceeded) {
    if ($bundleBackup -and (Test-Path -LiteralPath $bundleBackup)) {
      Remove-Item -LiteralPath $bundleBackup -Force
    }
  } elseif ($bundleBackup -and (Test-Path -LiteralPath $bundleBackup)) {
    if (Test-Path -LiteralPath $gradleBundle) {
      Remove-Item -LiteralPath $gradleBundle -Force
    }
    Move-Item -LiteralPath $bundleBackup -Destination $gradleBundle
  } elseif (Test-Path -LiteralPath $gradleBundle) {
    Remove-Item -LiteralPath $gradleBundle -Force
  }
}

$totalWatch.Stop()
$stageSeconds["total"] = [Math]::Round($totalWatch.Elapsed.TotalSeconds, 2)
$stageStatus["total"] = "completed"

[pscustomobject]@{
  mode = "build_and_verify"
  sourceSha = $sourceSha
  workingTreeDirty = ($workingTreeStatus.Count -gt 0)
  candidatePath = (Resolve-Path -LiteralPath $candidatePath).Path
  artifact = $verification
  stageSeconds = $stageSeconds
  stageStatus = $stageStatus
} | ConvertTo-Json -Depth 6
