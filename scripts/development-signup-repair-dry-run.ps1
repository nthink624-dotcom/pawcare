param(
  [string]$ProjectRef = "qefxdtmdtvnzgupmjlom"
)

$ErrorActionPreference = "Stop"
$developmentRef = "qefxdtmdtvnzgupmjlom"
$productionRef = "ysxykikqnneuhypybjry"
if ($ProjectRef -eq $productionRef) { throw "Production target is forbidden." }
if ($ProjectRef -ne $developmentRef) { throw "Unknown project target." }

npm.cmd run verify:signup-repair
if ($LASTEXITCODE -ne 0) { throw "Local signup repair verification failed." }
npm.cmd run check:supabase-cli-target:dev
if ($LASTEXITCODE -ne 0) { throw "Development target verification failed." }
npx.cmd supabase db push --linked --include-all --dry-run
if ($LASTEXITCODE -ne 0) { throw "Supabase Development dry-run failed." }

Write-Output "DRY_RUN_ONLY target=$ProjectRef apply=false vision=false customer_data=false"
