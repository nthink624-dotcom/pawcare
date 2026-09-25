const { createHash } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const pending = [
  "20260826034028_secure_owner_shop_memberships.sql",
  "20260826111854_lock_product_booking_defaults.sql",
  "202608270001_atomic_owner_signup_draft.sql",
  "20260827020524_secure_signup_ai_price_guide.sql",
  "20260827031414_secure_signup_ai_price_guide_metering.sql",
];
const failures = [];
const results = [];

function read(relative) {
  const path = resolve(root, relative);
  if (!existsSync(path)) throw new Error(`missing:${relative}`);
  return readFileSync(path, "utf8");
}
function requireMatch(label, source, pattern) {
  if (!pattern.test(source)) failures.push(`${label}:${pattern}`);
}

for (const name of pending) {
  const sql = read(`../../supabase/migrations/${name}`);
  results.push({ name, sha256: createHash("sha256").update(sql).digest("hex") });
}

const membership = read("../../supabase/migrations/20260826034028_secure_owner_shop_memberships.sql");
requireMatch("membership reconstruction", membership, /create table if not exists public\.owner_shop_memberships/);
requireMatch("membership canonical validation", membership, /PM_MEMBERSHIP_SCHEMA_RECONCILIATION_FAILED/);
requireMatch("membership content fingerprint", membership, /row_fingerprint_after/);
requireMatch("membership sha256 fingerprint", membership, /extensions\.digest[\s\S]+sha256/);
requireMatch("membership browser revoke", membership, /revoke all on table public\.owner_shop_memberships from public, anon, authenticated/);
requireMatch("membership service grant", membership, /grant select, insert, update, delete[\s\S]+to service_role/);

const defaults = read("../../supabase/migrations/20260826111854_lock_product_booking_defaults.sql");
requireMatch("defaults reversible snapshot", defaults, /migration_20260826111854_booking_defaults_backup/);

const atomic = read("../../supabase/migrations/202608270001_atomic_owner_signup_draft.sql");
requireMatch("atomic membership dependency", atomic, /insert into public\.owner_shop_memberships/);
requireMatch("atomic service dependency", atomic, /insert into public\.services/);
requireMatch("atomic idempotency", atomic, /signup_idempotency_requests/);

const rollbackChecks = [
  ["20260826034028_secure_owner_shop_memberships.rollback.sql", /PM_MEMBERSHIP_ROLLBACK_BLOCKED_CONTENT_CHANGED/],
  ["20260826111854_lock_product_booking_defaults.rollback.sql", /migration_20260826111854_booking_defaults_backup/],
  ["202608270001_atomic_owner_signup_draft.rollback.sql", /PM_ATOMIC_SIGNUP_V1_ROLLBACK_BLOCKED_REQUESTS_EXIST/],
];
for (const [name, pattern] of rollbackChecks) {
  requireMatch(`rollback ${name}`, read(`../../supabase/rollback/${name}`), pattern);
}

const provider = read("src/server/price-guide-photo-import.ts");
const route = read("src/app/api/auth/signup/price-guide-preview/route.ts");
requireMatch("conservative cost reservation", provider, /PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD = 13_000/);
requireMatch("provider input usage", provider, /input_tokens/);
requireMatch("provider output usage", provider, /output_tokens/);
requireMatch("route reserves conservative max", route, /estimatedCostMicroUsd: fixtureMode \? 0 : PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD/);
if (/ESTIMATED_REQUEST_COST_MICRO_USD\s*=\s*1_200/.test(route)) failures.push("unsafe fixed 1200 micro-USD remains");

const contract = read("docs/product/SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1.md");
requireMatch("mobile shared endpoint", contract, /POST \/api\/auth\/signup/);
requireMatch("no mobile direct persistence", contract, /직접 쓰기 금지/);

console.log(JSON.stringify({ target: "Development:qefxdtmdtvnzgupmjlom", apply: false, pending: results, failures }, null, 2));
if (failures.length) process.exit(1);
