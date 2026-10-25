param(
  [string]$IngestUrl = "https://www.petmanager.co.kr/api/internal/marketing/work-events",
  [switch]$E2eChild
)

$secretPath = Join-Path $PSScriptRoot "..\.local-secrets\control-plane-production-token.bin"
if (-not (Test-Path -LiteralPath $secretPath)) { throw "보호된 gateway token이 없습니다." }
$protected = [IO.File]::ReadAllBytes($secretPath)
$plain = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  $env:MARKETING_WORK_EVENT_TOKEN = [Text.Encoding]::UTF8.GetString($plain)
  $env:CONTROL_PLANE_INGEST_URL = $IngestUrl
  $arguments = @("scripts/control-plane-gateway.mjs")
  if ($E2eChild) { $arguments += "--e2e-child" }
  & node @arguments
} finally {
  $env:MARKETING_WORK_EVENT_TOKEN = $null
  $env:CONTROL_PLANE_INGEST_URL = $null
  [Array]::Clear($plain, 0, $plain.Length)
}
