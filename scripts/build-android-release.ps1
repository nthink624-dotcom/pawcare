$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$productionOrigin = if ($env:CAPACITOR_PRODUCTION_SERVER_URL) {
  $env:CAPACITOR_PRODUCTION_SERVER_URL.TrimEnd("/")
} else {
  "https://app.petmanager.co.kr"
}
$serverUrl = $productionOrigin + "/login"
$apiBaseUrl = if ($env:CAPACITOR_PRODUCTION_API_BASE_URL) {
  $env:CAPACITOR_PRODUCTION_API_BASE_URL.TrimEnd("/")
} else {
  "https://www.petmanager.co.kr"
}
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$gradle = Join-Path $projectRoot "android\gradlew.bat"
$firebaseConfig = Join-Path $projectRoot "android\app\google-services.json"
$keystoreConfig = Join-Path $projectRoot "android\keystore.properties"
$bundle = Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab"
$apk = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
$endpointCheck = Join-Path $PSScriptRoot "assert-android-release-endpoints.ps1"

if (-not $serverUrl.StartsWith("https://") -or -not $apiBaseUrl.StartsWith("https://")) {
  throw "출시용 앱 및 API 주소는 HTTPS여야 합니다."
}

if (-not (Test-Path -LiteralPath $firebaseConfig)) {
  throw "출시 빌드 전에 android/app/google-services.json 파일이 필요합니다."
}

if (-not (Test-Path -LiteralPath $keystoreConfig)) {
  throw "출시 빌드 전에 android/keystore.properties 파일이 필요합니다."
}

if (-not $env:PETMANAGER_ANDROID_VERSION_CODE -or -not $env:PETMANAGER_ANDROID_VERSION_NAME) {
  throw "출시 빌드 전에 PETMANAGER_ANDROID_VERSION_CODE와 PETMANAGER_ANDROID_VERSION_NAME을 설정해 주세요."
}

try {
  $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 15
  if ($response.StatusCode -ne 200) {
    throw "출시용 모바일 서버 응답이 정상적이지 않습니다. HTTP $($response.StatusCode)"
  }
} catch {
  throw "출시용 모바일 서버에 연결할 수 없습니다."
}

$previousServerUrl = $env:CAPACITOR_SERVER_URL
$previousBuildMode = $env:CAPACITOR_BUILD_MODE
$previousSiteUrl = $env:NEXT_PUBLIC_SITE_URL
$previousApiBaseUrl = $env:NEXT_PUBLIC_API_BASE_URL
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME

Push-Location $projectRoot
try {
  $env:CAPACITOR_SERVER_URL = $serverUrl
  $env:CAPACITOR_BUILD_MODE = "release"
  $env:NEXT_PUBLIC_SITE_URL = $productionOrigin
  $env:NEXT_PUBLIC_API_BASE_URL = $apiBaseUrl
  $env:JAVA_HOME = $javaHome
  $env:ANDROID_HOME = $sdkRoot

  & npm.cmd run test:android-release-endpoints
  if ($LASTEXITCODE -ne 0) { throw "안드로이드 출시 endpoint 검사에 실패했습니다." }

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "모바일 웹 출시 빌드에 실패했습니다." }

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor 안드로이드 동기화에 실패했습니다." }

  & $endpointCheck -ExpectedServerUrl $serverUrl -ExpectedApiBaseUrl $apiBaseUrl -SkipLiveCheck
  if ($LASTEXITCODE -ne 0) { throw "생성된 안드로이드 출시 endpoint 검사에 실패했습니다." }

  Push-Location (Join-Path $projectRoot "android")
  try {
    & $gradle bundleRelease assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "안드로이드 출시 번들/APK 빌드에 실패했습니다." }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path -LiteralPath $bundle)) {
    throw "출시용 AAB 파일이 생성되지 않았습니다."
  }
  if (-not (Test-Path -LiteralPath $apk)) {
    throw "설치 확인용 출시 APK 파일이 생성되지 않았습니다."
  }

  & $endpointCheck -ExpectedServerUrl $serverUrl -ExpectedApiBaseUrl $apiBaseUrl -BundlePath $bundle -SkipLiveCheck
  if ($LASTEXITCODE -ne 0) { throw "출시 AAB 내부 endpoint 검사에 실패했습니다." }

  & $endpointCheck -ExpectedServerUrl $serverUrl -ExpectedApiBaseUrl $apiBaseUrl -BundlePath $bundle
  if ($LASTEXITCODE -ne 0) { throw "운영 endpoint live 검사에 실패했습니다." }

  Write-Host "안드로이드 출시 번들 생성 완료: $bundle"
  Write-Host "안드로이드 설치 확인용 APK 생성 완료: $apk"
} finally {
  if ($null -eq $previousServerUrl) {
    Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue
  } else {
    $env:CAPACITOR_SERVER_URL = $previousServerUrl
  }

  if ($null -eq $previousBuildMode) {
    Remove-Item Env:\CAPACITOR_BUILD_MODE -ErrorAction SilentlyContinue
  } else {
    $env:CAPACITOR_BUILD_MODE = $previousBuildMode
  }

  if ($null -eq $previousSiteUrl) {
    Remove-Item Env:\NEXT_PUBLIC_SITE_URL -ErrorAction SilentlyContinue
  } else {
    $env:NEXT_PUBLIC_SITE_URL = $previousSiteUrl
  }

  if ($null -eq $previousApiBaseUrl) {
    Remove-Item Env:\NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:NEXT_PUBLIC_API_BASE_URL = $previousApiBaseUrl
  }

  if ($null -eq $previousJavaHome) {
    Remove-Item Env:\JAVA_HOME -ErrorAction SilentlyContinue
  } else {
    $env:JAVA_HOME = $previousJavaHome
  }

  if ($null -eq $previousAndroidHome) {
    Remove-Item Env:\ANDROID_HOME -ErrorAction SilentlyContinue
  } else {
    $env:ANDROID_HOME = $previousAndroidHome
  }

  & npx.cmd cap sync android | Out-Null
  Pop-Location
}
