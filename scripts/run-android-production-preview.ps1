$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverUrl = if ($env:CAPACITOR_PRODUCTION_SERVER_URL) {
  $env:CAPACITOR_PRODUCTION_SERVER_URL.TrimEnd("/") + "/login"
} else {
  "https://petmanager-app.vercel.app/login"
}
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $sdkRoot "platform-tools\adb.exe"
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$gradle = Join-Path $projectRoot "android\gradlew.bat"
$apk = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not $serverUrl.StartsWith("https://")) {
  throw "운영 미리보기 주소는 HTTPS여야 합니다."
}

if (-not (Test-Path -LiteralPath $adb)) {
  throw "Android adb를 찾지 못했습니다."
}

if (-not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "Android Studio의 Java 실행 환경을 찾지 못했습니다."
}

try {
  $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 15
  if ($response.StatusCode -ne 200) {
    throw "운영 모바일 서버 응답이 정상적이지 않습니다. HTTP $($response.StatusCode)"
  }
} catch {
  throw "운영 모바일 서버에 연결할 수 없습니다."
}

$connectedDevices = @(& $adb devices | Select-String -Pattern "\sdevice$")
if ($connectedDevices.Count -ne 1) {
  throw "USB 디버깅을 허용한 안드로이드 휴대폰 1대만 연결해 주세요."
}

$previousServerUrl = $env:CAPACITOR_SERVER_URL
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME

Push-Location $projectRoot
try {
  & $adb reverse --remove tcp:3100 2>$null | Out-Null

  $env:CAPACITOR_SERVER_URL = $serverUrl
  $env:JAVA_HOME = $javaHome
  $env:ANDROID_HOME = $sdkRoot

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor 안드로이드 동기화에 실패했습니다." }

  Push-Location (Join-Path $projectRoot "android")
  try {
    & $gradle assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "안드로이드 운영 미리보기 빌드에 실패했습니다." }
  } finally {
    Pop-Location
  }

  if ($null -eq $previousServerUrl) {
    Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue
  } else {
    $env:CAPACITOR_SERVER_URL = $previousServerUrl
  }

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor 임시 설정 정리에 실패했습니다." }

  & $adb install --user 0 -r $apk
  if ($LASTEXITCODE -ne 0) { throw "안드로이드 앱 설치에 실패했습니다." }

  & $adb shell am force-stop "kr.petmanager.owner"
  & $adb shell am start --user 0 -n "kr.petmanager.owner/.MainActivity"
  if ($LASTEXITCODE -ne 0) { throw "안드로이드 앱 실행에 실패했습니다." }

  Write-Host "안드로이드 운영 미리보기 설치 완료: $serverUrl"
} finally {
  if ($null -eq $previousServerUrl) {
    Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue
  } else {
    $env:CAPACITOR_SERVER_URL = $previousServerUrl
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

  Pop-Location
}
