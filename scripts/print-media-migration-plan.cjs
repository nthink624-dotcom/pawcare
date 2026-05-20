const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

const migrations = [
  "supabase/migrations/202605180002_owner_scale_indexes.sql",
  "supabase/migrations/202605180003_media_assets_and_notification_attachments.sql",
  "supabase/migrations/202605180004_media_cost_controls.sql",
  "supabase/migrations/202605180005_shop_media_limits.sql",
];

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function getSupabaseRef(url) {
  if (!url) return "(missing)";
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/);
  return match?.[1] ?? "(unknown)";
}

function maskRef(ref) {
  if (!ref || ref.length < 10) return ref;
  return `${ref.slice(0, 6)}...${ref.slice(-4)}`;
}

if (!fs.existsSync(envPath)) {
  console.error(".env.local was not found. Cannot determine the development Supabase target.");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const publicStage = env.NEXT_PUBLIC_SUPABASE_ENV_NAME || "(empty)";
const serverStage = env.SUPABASE_ENV_NAME || "(empty)";
const ref = getSupabaseRef(env.NEXT_PUBLIC_SUPABASE_URL);
const allowedDevRefs = env.ALLOWED_DEV_SUPABASE_REFS || env.NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS || "";
const siteUrl = env.NEXT_PUBLIC_SITE_URL || "(empty)";

console.log("PetManager media migration plan");
console.log("");
console.log("This command is read-only. It does not apply migrations.");
console.log("");
console.log("Detected local/development target:");
console.log(`- site: ${siteUrl}`);
console.log(`- public stage: ${publicStage}`);
console.log(`- server stage: ${serverStage}`);
console.log(`- Supabase ref: ${maskRef(ref)}`);
console.log(`- allowed dev refs: ${allowedDevRefs ? allowedDevRefs.split(",").map((item) => maskRef(item.trim())).join(", ") : "(empty)"}`);
console.log("");

if (publicStage !== "development" || serverStage !== "development") {
  console.error("Refusing to print a development apply plan because .env.local is not marked as development.");
  process.exit(1);
}

if (!allowedDevRefs.split(",").map((item) => item.trim()).includes(ref)) {
  console.error("Refusing to print a development apply plan because the Supabase ref is not allowlisted.");
  process.exit(1);
}

console.log("Apply to development Supabase first, in this order:");
for (const migration of migrations) {
  const exists = fs.existsSync(path.join(root, migration));
  console.log(`- ${migration}${exists ? "" : " (missing)"}`);
}
console.log("");
console.log("Then run read-only verification:");
console.log("- supabase/verification/media_schema_readiness.sql");
console.log("");
console.log("Only after development verification passes should production be considered.");
