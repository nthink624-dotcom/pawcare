const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source, text, label) {
  if (source && !source.includes(text)) failures.push(label);
}

const restore = read("scripts/verify-development-encrypted-backup-restore.ps1");
const localRestore = read("scripts/verify-development-signup-repair-postgres.ps1");
const safety = read("docs/operations/supabase-data-safety.md");

for (const [text, label] of [
  ['$expectedProjectRef = "qefxdtmdtvnzgupmjlom"', "backup verifier must target the development project"],
  ['$forbiddenProjectRef = "ysxykikqnneuhypybjry"', "backup verifier must reject the production project"],
  ["AesManaged", "backup archive must use a Windows PowerShell-compatible cipher"],
  ["HMACSHA256", "backup archive must be authenticated-encrypted"],
  ["PMDUMP02", "backup archive format must be versioned"],
  ["Preflight", "backup verifier must support a no-network preflight"],
  ["pg_restore.exe", "backup verifier must restore the archive"],
  ["pm_atomic_signup_restore", "backup verifier must use an isolated local database"],
  ["RemoteWrites = 0", "backup verifier must prove no remote writes"],
  ["Remove-Item -LiteralPath $resolvedCluster -Recurse -Force", "backup verifier must clean the temporary cluster"],
]) {
  requireText(restore, text, label);
}

for (const [text, label] of [
  ["pg_dump.exe", "local backup fixture must create a PostgreSQL dump"],
  ["pg_restore.exe", "local backup fixture must restore a PostgreSQL dump"],
  ["POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS", "local backup fixture must expose a deterministic pass marker"],
  ["petmanager-pg-signup-repair-", "local backup fixture must isolate its temporary cluster"],
  ["Remove-Item -LiteralPath $resolved -Recurse -Force", "local backup fixture must clean its temporary cluster"],
]) {
  requireText(localRestore, text, label);
}

for (const [text, label] of [
  ["Daily backups and PITR", "runbook must require production backup/PITR configuration"],
  ["encrypted off-site logical dump", "runbook must define an encrypted database backup boundary"],
  ["quarterly", "runbook must require a recurring restore drill"],
]) {
  requireText(safety, text, label);
}

if (failures.length > 0) {
  console.error("Backup recovery contract check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Backup recovery contract check: PASS (encrypted remote guard and isolated local restore fixture present)");
console.log("WARN: encrypted restore against the development Supabase project still requires protected credentials; the local dump/restore fixture is credential-free.");
