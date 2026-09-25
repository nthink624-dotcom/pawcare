$Host.UI.RawUI.WindowTitle = "YourIT VPS SSH"
$defaultKeyPath = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$workspaceKeyPath = "D:\pawcare\.local-secrets\yourit_vps_ed25519"

if (Test-Path $defaultKeyPath) {
  ssh -i $defaultKeyPath root@103.124.101.54 -p 22
} elseif (Test-Path $workspaceKeyPath) {
  ssh -i $workspaceKeyPath root@103.124.101.54 -p 22
} else {
  ssh root@103.124.101.54 -p 22
}
