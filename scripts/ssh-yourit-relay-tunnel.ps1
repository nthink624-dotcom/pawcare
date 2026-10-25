$Host.UI.RawUI.WindowTitle = "YourIT Relay Tunnel"
$relayKeyPath = Join-Path $env:USERPROFILE ".ssh\petmanager-relay-codex-20261007"
$defaultKeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$sshArgs = @(
  "-L", "14010:127.0.0.1:4010",
  "-p", "22",
  "-N",
  "root@relay.petmanager.co.kr"
)

if (Test-Path $relayKeyPath) {
  & ssh -i $relayKeyPath @sshArgs
} elseif (Test-Path $defaultKeyPath) {
  & ssh -i $defaultKeyPath @sshArgs
} else {
  & ssh @sshArgs
}
