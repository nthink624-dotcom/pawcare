const fs = require("node:fs");
const path = require("node:path");

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

function requireText(relativePath, text, label = text) {
  if (!read(relativePath).includes(text)) failures.push(`${label} (${relativePath})`);
}

for (const [text, label] of [
  ["type StorageProvider = \"supabase\" | \"r2\"", "media provider abstraction must keep Supabase and R2 paths"],
  ["verifyMediaStorageObjectsAbsent", "media deletion must verify provider absence"],
  ["getMediaStorageProviderForPath", "media cleanup must resolve the provider per object path"],
]) requireText("apps/web/src/server/media-storage.ts", text, label);

for (const [text, label] of [
  ["storage.petmanager-media", "media schema readback must check the private bucket"],
  ["not public", "media bucket must remain private"],
  ["increment_shop_media_usage", "media usage accounting must be verifiable"],
]) requireText("docs/media-production-rollout-checklist.md", text, label);

for (const [text, label] of [
  ["default temporary retention: 60 days", "temporary media retention must be explicit"],
  ["Run dry-run first in production", "media cleanup must have a dry-run gate"],
  ["Production uses `MEDIA_CLEANUP_CRON_SECRET`", "production cleanup must be secret-bound"],
]) requireText("docs/media-retention-policy-options.md", text, label);

for (const [text, label] of [
  ["Daily backups and PITR", "database backup policy must be explicit"],
  ["database backup does not restore Supabase Storage or Cloudflare R2 objects", "database backup must not be treated as media backup"],
  ["encrypted off-site logical dump", "database backup must have an encrypted boundary"],
]) requireText("docs/operations/supabase-data-safety.md", text, label);

for (const [text, label] of [
  ["R2 bucket", "media provider lifecycle readback must be documented"],
  ["lifecycle", "media retention lifecycle must be documented"],
]) requireText("docs/operations/privacy-operations-matrix.md", text, label);

for (const relativePath of [
  "apps/web/tests/server/media-cleanup-verification-contract.test.mjs",
  "apps/web/tests/server/media-retention-policy-contract.test.mjs",
  "supabase/verification/media_schema_readiness.sql",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`missing verification artifact: ${relativePath}`);
}

if (failures.length > 0) {
  console.error("Media recovery contract check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Media recovery contract check: PASS (provider, retention, cleanup, and recovery boundaries present)");
console.log("WARN: R2/Storage lifecycle and restore evidence still require read-only account verification.");
