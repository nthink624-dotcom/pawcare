param(
  [switch]$GeneratePassword
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Program Files\Android\Android Studio\jbr" }
$keytool = Join-Path $javaHome "bin\keytool.exe"
$secretDirectory = Join-Path $projectRoot ".local-secrets\android"
$keystorePath = Join-Path $secretDirectory "petmanager-upload.jks"
$propertiesPath = Join-Path $projectRoot "android\keystore.properties"
$keyAlias = "petmanager-upload"

if (-not (Test-Path -LiteralPath $keytool)) {
  throw "Android Studio의 Java keytool을 찾지 못했습니다."
}

if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $propertiesPath)) {
  throw "안드로이드 출시 서명 파일이 이미 있습니다. 기존 파일은 변경하지 않았습니다."
}

$securePassword = $null
$securePasswordConfirmation = $null

if ($GeneratePassword) {
  $randomBytes = New-Object byte[] 32
  $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($randomBytes)
  } finally {
    $randomNumberGenerator.Dispose()
  }
  $password = [Convert]::ToBase64String($randomBytes)
  $passwordConfirmation = $password
} else {
  $securePassword = Read-Host "안드로이드 업로드 키 비밀번호" -AsSecureString
  $securePasswordConfirmation = Read-Host "안드로이드 업로드 키 비밀번호 다시 입력" -AsSecureString
  $password = [System.Net.NetworkCredential]::new("", $securePassword).Password
  $passwordConfirmation = [System.Net.NetworkCredential]::new("", $securePasswordConfirmation).Password
}

if ($password.Length -lt 8) {
  throw "업로드 키 비밀번호는 8자 이상으로 설정해 주세요."
}

if ($password -cne $passwordConfirmation) {
  throw "입력한 업로드 키 비밀번호가 서로 다릅니다."
}

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null

try {
  $env:PETMANAGER_UPLOAD_KEY_PASSWORD = $password

  & $keytool `
    -genkeypair `
    -v `
    -keystore $keystorePath `
    -alias $keyAlias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -storepass:env PETMANAGER_UPLOAD_KEY_PASSWORD `
    -keypass:env PETMANAGER_UPLOAD_KEY_PASSWORD `
    -dname "CN=PetManager, OU=Mobile, O=Nemchin Day, L=Cheonan, ST=Chungcheongnam-do, C=KR"

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $keystorePath)) {
    throw "안드로이드 업로드 키 생성에 실패했습니다."
  }

  $properties = @(
    "storeFile=../.local-secrets/android/petmanager-upload.jks"
    "storePassword=$password"
    "keyAlias=$keyAlias"
    "keyPassword=$password"
  ) -join [Environment]::NewLine

  [System.IO.File]::WriteAllText($propertiesPath, $properties + [Environment]::NewLine)

  Write-Host "안드로이드 출시 서명 설정을 완료했습니다."
  Write-Host ".local-secrets/android/petmanager-upload.jks와 비밀번호를 안전한 곳에 반드시 백업해 주세요."
  Write-Host "서명 파일은 Git에 포함되지 않습니다."
} finally {
  Remove-Item Env:\PETMANAGER_UPLOAD_KEY_PASSWORD -ErrorAction SilentlyContinue
  $password = $null
  $passwordConfirmation = $null
  $securePassword = $null
  $securePasswordConfirmation = $null
}
