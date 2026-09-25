$Host.UI.RawUI.WindowTitle = "YourIT Relay Tunnel"
$defaultKeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$workspaceKeyPath = "D:\pawcare\.local-secrets\yourit_vps_ed25519"
$sshArgs = @(
  "-L", "14010:127.0.0.1:4010",
  "root@103.124.101.54",
  "-p", "22",
  "-N"
)

if (Test-Path $defaultKeyPath) {
  & ssh -i $defaultKeyPath @sshArgs
} elseif (Test-Path $workspaceKeyPath) {
  & ssh -i $workspaceKeyPath @sshArgs
} else {
  & ssh @sshArgs
}
