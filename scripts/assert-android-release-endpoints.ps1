[CmdletBinding()]
param(
  [string]$ExpectedServerUrl = "https://app.petmanager.co.kr/login",
  [string]$ExpectedApiBaseUrl = "https://app.petmanager.co.kr",
  [string]$NativeRootPath,
  [string]$NativeConfigPath,
  [string]$BundlePath,
  [switch]$SkipLiveCheck
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $NativeRootPath) {
  $NativeRootPath = Join-Path $projectRoot "android\app\src\main"
}
if (-not $NativeConfigPath) {
  $NativeConfigPath = Join-Path $NativeRootPath "assets\capacitor.config.json"
}

$forbiddenReleaseReference = '(?i)(localhost|127\.0\.0\.1|:(3000|3100)(?=[/\\?#"''\s]|$))'
$textAssetExtensions = @(".css", ".html", ".java", ".js", ".json", ".kt", ".properties", ".txt", ".xml")

function ConvertTo-ProductionHttpsUri {
  param(
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][string]$Label
  )

  try {
    $uri = [Uri]$Value
  } catch {
    throw "$Label is not a valid URL."
  }

  $hostname = $uri.DnsSafeHost.ToLowerInvariant()
  if (
    -not $uri.IsAbsoluteUri -or
    $uri.Scheme -ne "https" -or
    $hostname -eq "localhost" -or
    $hostname -eq "127.0.0.1" -or
    $uri.Port -eq 3000 -or
    $uri.Port -eq 3100
  ) {
    throw "$Label must be a production HTTPS URL without local hosts or development ports."
  }

  return $uri
}

function Assert-NoForbiddenReleaseReference {
  param(
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$SourceName
  )

  if ($Content -match $forbiddenReleaseReference) {
    throw "A local host or development port remains in the release path: $SourceName"
  }
}

function Assert-CapacitorConfig {
  param(
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$SourceName,
    [Parameter(Mandatory = $true)][string]$RequiredServerUrl
  )

  Assert-NoForbiddenReleaseReference -Content $Content -SourceName $SourceName
  try {
    $config = $Content | ConvertFrom-Json
  } catch {
    throw "Capacitor configuration JSON could not be read: $SourceName"
  }

  $actualServerUrl = [string]$config.server.url
  if ($actualServerUrl -ne $RequiredServerUrl) {
    throw "Capacitor server.url does not match the canonical production URL: $SourceName"
  }
  if ($config.server.cleartext -eq $true) {
    throw "Cleartext is not allowed in the release Capacitor configuration: $SourceName"
  }
}

$serverUri = ConvertTo-ProductionHttpsUri -Value $ExpectedServerUrl -Label "Release app URL"
$apiUri = ConvertTo-ProductionHttpsUri -Value $ExpectedApiBaseUrl -Label "Release API URL"

if (-not (Test-Path -LiteralPath $NativeConfigPath)) {
  throw "Generated Capacitor configuration was not found: $NativeConfigPath"
}

$nativeConfigContent = Get-Content -LiteralPath $NativeConfigPath -Raw
Assert-CapacitorConfig -Content $nativeConfigContent -SourceName $NativeConfigPath -RequiredServerUrl $serverUri.AbsoluteUri

if (Test-Path -LiteralPath $NativeRootPath) {
  Get-ChildItem -LiteralPath $NativeRootPath -Recurse -File |
    Where-Object { $textAssetExtensions -contains $_.Extension.ToLowerInvariant() } |
    ForEach-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      if (-not [string]::IsNullOrEmpty($content)) {
        Assert-NoForbiddenReleaseReference -Content $content -SourceName $_.FullName
      }
    }
}

if ($BundlePath) {
  if (-not (Test-Path -LiteralPath $BundlePath)) {
    throw "Release AAB was not found: $BundlePath"
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $bundle = [IO.Compression.ZipFile]::OpenRead($BundlePath)
  try {
    $bundleConfigEntry = $bundle.GetEntry("base/assets/capacitor.config.json")
    if ($null -eq $bundleConfigEntry) {
      throw "The AAB does not contain a Capacitor configuration."
    }

    foreach ($entry in $bundle.Entries) {
      if (-not $entry.FullName.StartsWith("base/assets/", [StringComparison]::OrdinalIgnoreCase)) {
        continue
      }
      if (-not ($textAssetExtensions -contains [IO.Path]::GetExtension($entry.FullName).ToLowerInvariant())) {
        continue
      }

      $reader = New-Object IO.StreamReader($entry.Open())
      try {
        $content = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
      }

      if (-not [string]::IsNullOrEmpty($content)) {
        Assert-NoForbiddenReleaseReference -Content $content -SourceName "AAB:$($entry.FullName)"
      }
      if ($entry.FullName -eq "base/assets/capacitor.config.json") {
        Assert-CapacitorConfig -Content $content -SourceName "AAB:$($entry.FullName)" -RequiredServerUrl $serverUri.AbsoluteUri
      }
    }
  } finally {
    $bundle.Dispose()
  }
}

if (-not $SkipLiveCheck) {
  Add-Type -AssemblyName System.Net.Http
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(20)
  try {
    $loginResponse = $client.GetAsync($serverUri).GetAwaiter().GetResult()
    if ([int]$loginResponse.StatusCode -ne 200) {
      throw "Release login returned HTTP $([int]$loginResponse.StatusCode)."
    }

    $ownerUri = [Uri]::new($serverUri, "/owner/mobile")
    $ownerResponse = $client.GetAsync($ownerUri).GetAwaiter().GetResult()
    $ownerStatus = [int]$ownerResponse.StatusCode
    if ($ownerStatus -ge 300 -and $ownerStatus -lt 400) {
      $location = $ownerResponse.Headers.Location
      if ($null -eq $location) {
        throw "Production mobile redirect has no location."
      }
      $resolvedLocation = if ($location.IsAbsoluteUri) { $location } else { [Uri]::new($ownerUri, $location) }
      $validatedLocation = ConvertTo-ProductionHttpsUri -Value $resolvedLocation.AbsoluteUri -Label "Production mobile redirect"
      if ($validatedLocation.Host -ne $serverUri.Host) {
        throw "Production mobile route redirects to a different host: $($validatedLocation.Host)"
      }
    } elseif ($ownerStatus -ne 200) {
      throw "Production mobile route returned HTTP $ownerStatus."
    }

    $apiProbeUri = [Uri]::new($apiUri, "/api/owner/shops")
    $apiResponse = $client.GetAsync($apiProbeUri).GetAwaiter().GetResult()
    $apiStatus = [int]$apiResponse.StatusCode
    if ($apiStatus -notin @(200, 401, 403)) {
      throw "Release API returned an unexpected status: HTTP $apiStatus"
    }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }

  Write-Output "release_server_url=$($serverUri.AbsoluteUri)"
  Write-Output "release_api_base_url=$($apiUri.AbsoluteUri.TrimEnd('/'))"
  Write-Output "owner_mobile_status=$ownerStatus"
  Write-Output "api_probe_status=$apiStatus"
}

if ($BundlePath) {
  Write-Output "release_bundle_checked=$BundlePath"
}
