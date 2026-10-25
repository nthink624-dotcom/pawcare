$Host.UI.RawUI.WindowTitle = "YourIT VPS SSH"
$relayKeyPath = Join-Path $env:USERPROFILE ".ssh\petmanager-relay-codex-20261007"
$defaultKeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$sshArgs = @("-p", "22", "root@relay.petmanager.co.kr")

if (Test-Path $relayKeyPath) {
  ssh -i $relayKeyPath @sshArgs
} elseif (Test-Path $defaultKeyPath) {
  ssh -i $defaultKeyPath @sshArgs
} else {
  ssh @sshArgs
}
