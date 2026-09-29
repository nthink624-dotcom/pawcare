const { spawnSync } = require("node:child_process");

const EXPECTED_DEV_REF = "qefxdtmdtvnzgupmjlom";
// The previously observed remote-only versions were fetched back into the
// repository on 2026-09-29. Keep this repair command fail-closed until a new
// read-only migration-list readback identifies a fresh, explicitly approved
// repair set.
const REMOTE_ONLY_VERSIONS = [];
const execute = process.argv.includes("--execute");
const confirmation = process.env.PETMANAGER_SUPABASE_MIGRATION_REPAIR_CONFIRMATION;
const reason = process.env.PETMANAGER_SUPABASE_MIGRATION_REPAIR_REASON?.trim();

function printPlan(status) {
  console.log(JSON.stringify({
    status,
    target: `petmanager-dev:${EXPECTED_DEV_REF}`,
    operation: "migration repair --status reverted",
    versions: REMOTE_ONLY_VERSIONS,
    remoteWrites: execute ? 1 : 0,
    requiresExplicitConfirmation: true,
  }, null, 2));
}

if (!execute) {
  printPlan(REMOTE_ONLY_VERSIONS.length > 0 ? "DRY_RUN_ONLY" : "NO_REPAIR_NEEDED");
  process.exit(0);
}

if (REMOTE_ONLY_VERSIONS.length === 0) {
  throw new Error("No approved remote-only migration versions are recorded. Refresh migration-list readback before requesting repair.");
}

if (confirmation !== EXPECTED_DEV_REF) {
  throw new Error("Migration repair requires PETMANAGER_SUPABASE_MIGRATION_REPAIR_CONFIRMATION=qefxdtmdtvnzgupmjlom.");
}
if (!reason || reason.length < 10) {
  throw new Error("Migration repair requires PETMANAGER_SUPABASE_MIGRATION_REPAIR_REASON with a concrete reason.");
}

const targetCheck = spawnSync(process.execPath, ["scripts/verify-supabase-cli-target.cjs", "--target", "dev"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
if (targetCheck.status !== 0) process.exit(targetCheck.status ?? 1);

printPlan("EXECUTING_APPROVED_REPAIR");
const repair = spawnSync(
  "npx",
  ["supabase", "migration", "repair", "--status", "reverted", ...REMOTE_ONLY_VERSIONS],
  { stdio: "inherit", cwd: process.cwd(), env: process.env },
);
process.exit(repair.status ?? 1);
