$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverUrl = "http://127.0.0.1:3100/login"
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $sdkRoot "platform-tools\adb.exe"
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$gradle = Join-Path $projectRoot "android\gradlew.bat"
$apk = Join-Path $projectRoot "android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path -LiteralPath $adb)) {
  throw "Android adb was not found."
}

if (-not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "Android Studio Java runtime was not found."
}

try {
  Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
} catch {
  throw "The local mobile server is not running on 127.0.0.1:3100."
}

$connectedDevices = @(& $adb devices | Select-String -Pattern "\sdevice$")
if ($connectedDevices.Count -ne 1) {
  throw "Connect exactly one authorized Android device."
}

$previousServerUrl = $env:CAPACITOR_SERVER_URL
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME

Push-Location $projectRoot
try {
  & $adb reverse tcp:3100 tcp:3100 | Out-Null

  $env:CAPACITOR_SERVER_URL = $serverUrl
  $env:JAVA_HOME = $javaHome
  $env:ANDROID_HOME = $sdkRoot

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed." }

  Push-Location (Join-Path $projectRoot "android")
  try {
    & $gradle assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Android debug build failed." }
  } finally {
    Pop-Location
  }

  if ($null -eq $previousServerUrl) {
    Remove-Item Env:\CAPACITOR_SERVER_URL -ErrorAction SilentlyContinue
  } else {
    $env:CAPACITOR_SERVER_URL = $previousServerUrl
  }

  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Capacitor configuration cleanup failed." }

  & $adb install --user 0 -r $apk
  if ($LASTEXITCODE -ne 0) { throw "Android app installation failed." }

  & $adb shell am start --user 0 -n "kr.petmanager.owner/.MainActivity"
  if ($LASTEXITCODE -ne 0) { throw "Android app launch failed." }
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
