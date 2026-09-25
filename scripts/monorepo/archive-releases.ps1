param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$workspace = 'D:\petmanager'
$archive = 'D:\petmanager\archive'
$rows = @(
  @('D:\petmanager-release-candidate-r1', $workspace, 'worktrees'),
  @('D:\petmanager-release-candidate-r15', $workspace, 'worktrees'),
  @('D:\petmanager-app-mobile-recovery-fix', 'D:\petmanager-app', 'worktrees'),
  @('D:\petmanager-app-release-auth-p0-20260915', 'D:\petmanager-app', 'worktrees'),
  @('D:\petmanager-app-release-auth-p0-deploy-20260916', 'D:\petmanager-app', 'worktrees'),
  @('D:\petmanager-app-release-r36', 'D:\petmanager-app', 'worktrees'),
  @('D:\petmanager-app-release-r38', 'D:\petmanager-app', 'worktrees'),
  @('D:\petmanager-app-release-runtime-finish-20260916', 'D:\petmanager-app', 'worktrees'),
  @('D:\PetManagerArchive\petmanager-app-release-r5', 'D:\petmanager-app', 'worktrees'),
  @('D:\PetManagerArchive\petmanager-release-candidate-20260903', $workspace, 'worktrees'),
  @('D:\petmanager-app-release-artifacts', '', 'artifacts'),
  @('D:\petmanager-schema-compare', '', 'reference')
)
function Git-Read([string]$Repo, [string[]]$Arguments) {
  $result = & git -c "safe.directory=$($Repo.Replace('\','/'))" -C $Repo @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Git check failed: $Repo" }
  return (($result | Out-String).TrimEnd())
}
$plan = @()
foreach ($row in $rows) {
  $source = [IO.Path]::GetFullPath($row[0])
  $destination = [IO.Path]::GetFullPath((Join-Path (Join-Path $archive $row[2]) (Split-Path -Leaf $source)))
  if (!(Test-Path -LiteralPath $source)) { throw "Missing exact source: $source" }
  if ($source -eq $workspace -or $source -eq 'D:\petmanager-app' -or $source -eq 'D:\') { throw 'Main roots are not archive targets.' }
  if (!$destination.StartsWith($archive + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination escapes archive.' }
  if (Test-Path -LiteralPath $destination) { throw "Destination exists: $destination" }
  $sourceItem = Get-Item -LiteralPath $source -Force
  if ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refuse top-level link: $source" }
  $gitRoot = $row[1]
  $head = ''; $status = ''
  if ($gitRoot) {
    $head = Git-Read $source @('rev-parse', 'HEAD')
    $status = Git-Read $source @('status', '--porcelain=v1', '--untracked-files=all')
    $worktrees = Git-Read $gitRoot @('worktree', 'list', '--porcelain')
    if (!$worktrees.Contains('worktree ' + $source.Replace('\','/'))) { throw "Unregistered worktree: $source" }
  }
  $plan += [pscustomobject]@{ Source=$source; Destination=$destination; GitRoot=$gitRoot; Head=$head; Status=$status; Moved=$false }
}
if (!$Apply) {
  $plan | Select-Object Source,Destination,Head | Format-Table -AutoSize
  Write-Output 'DRY RUN: no files moved.'
  exit 0
}
New-Item -ItemType Directory -Path $archive -Force | Out-Null
$record = Join-Path $workspace '.migration-backup\20260925\archive-moves.json'
foreach ($entry in $plan) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $entry.Destination) -Force | Out-Null
  if ($entry.GitRoot) {
    & git -c "safe.directory=$($entry.GitRoot.Replace('\','/'))" -C $entry.GitRoot worktree move $entry.Source $entry.Destination
    if ($LASTEXITCODE -ne 0) { throw "Worktree move failed: $($entry.Source)" }
    if ((Git-Read $entry.Destination @('rev-parse','HEAD')) -ne $entry.Head) { throw 'HEAD changed during move.' }
    if ((Git-Read $entry.Destination @('status','--porcelain=v1','--untracked-files=all')) -ne $entry.Status) { throw 'Working state changed during move.' }
  } else {
    Move-Item -LiteralPath $entry.Source -Destination $entry.Destination
  }
  if ((Test-Path -LiteralPath $entry.Source) -or !(Test-Path -LiteralPath $entry.Destination)) { throw 'Move verification failed.' }
  $entry.Moved = $true
  $plan | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $record -Encoding utf8
  Write-Output "Preserved: $($entry.Destination)"
}
