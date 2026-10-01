const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];
const warnings = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(relativePath, text, label) {
  const source = read(relativePath);
  if (source && !source.includes(text)) failures.push(`${label} (${relativePath})`);
}

const privacyPage = read("apps/web/src/app/privacy/page.tsx");
const deletionPage = read("apps/web/src/app/account-deletion/page.tsx");
const deletionRoute = read("apps/web/src/app/api/owner/account-deletion/route.ts");
const exportRoute = read("apps/web/src/app/api/owner/data-export/route.ts");
const policy = read("apps/web/src/lib/legal/privacy-policy.ts");
const mobilePolicy = read("apps/mobile/src/lib/legal/privacy-policy.ts");
const mobileCallScreening = read("apps/mobile/src/lib/owner-call-screening.ts");
const nativeCallTransport = read("apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java");

const callSyncStart = mobileCallScreening.indexOf("export async function syncOwnerCallScreeningEvents");
const callSync = callSyncStart >= 0 ? mobileCallScreening.slice(callSyncStart) : "";
const inactiveSyncGuard = "if (!status.enabled || !status.active) return { sent: 0 };";
if (!callSync.includes(inactiveSyncGuard) || callSync.indexOf(inactiveSyncGuard) > callSync.indexOf("getPendingEvents()")) {
  failures.push("disabled CatchCall must not read or send its encrypted pending queue (apps/mobile/src/lib/owner-call-screening.ts)");
}
requireText(
  "apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java",
  "if (!OwnerCallScreeningStore.isEnabled(context)) return;",
  "disabled CatchCall must not send or enqueue new native events",
);

if (privacyPage) {
  requireText("apps/web/src/app/privacy/page.tsx", "PUBLIC_PRIVACY_POLICY", "privacy page must render the canonical policy");
  requireText("apps/web/src/app/privacy/page.tsx", "LegalSection", "privacy page must use the shared legal layout");
}

if (deletionPage) {
  requireText("apps/web/src/app/account-deletion/page.tsx", "AccountDeletionRequest", "account deletion page must use the authenticated deletion flow");
  requireText("apps/web/src/app/account-deletion/page.tsx", 'href="/privacy"', "account deletion page must link the privacy policy");
}

for (const [text, label] of [
  ["store:false", "explicit non-storage option for price-guide image analysis"],
  ["Cloudflare R2", "media provider disclosure"],
  ["DeepSeek", "care-report provider disclosure"],
  ["60일", "transient media retention disclosure"],
  ["account-deletion", "public deletion route disclosure"],
  ["backup purge SLA", "provider backup deletion boundary disclosure"],
]) {
if (policy && !policy.includes(text)) failures.push(`${label} (apps/web/src/lib/legal/privacy-policy.ts)`);
}

for (const [relativePath, source] of [
  ["apps/web/src/lib/legal/privacy-policy.ts", policy],
  ["apps/mobile/src/lib/legal/privacy-policy.ts", mobilePolicy],
]) {
  for (const [text, label] of [
    ["Android 캐치콜", "Android CatchCall feature disclosure"],
    ["수신 전화번호", "incoming phone-number processing disclosure"],
    ["보호자 매칭", "phone-number matching purpose disclosure"],
    ["암호화된 기기 저장소", "encrypted local queue disclosure"],
    ["최대 50건", "pending event queue bound disclosure"],
    ["로그아웃", "CatchCall logout retention disclosure"],
  ]) {
    if (source && !source.includes(text)) failures.push(`${label} (${relativePath})`);
  }
}

for (const [text, label] of [
  ["Bearer ", "bearer session requirement"],
  ["currentPassword", "current-password confirmation"],
  ["confirmation: z.literal(true)", "explicit deletion confirmation"],
  ["idempotencyKey: z.string().uuid()", "idempotent deletion request"],
  ["removeMediaStorageObjects", "provider-aware media deletion"],
  ["verifyMediaStorageObjectsAbsent", "media residue verification"],
  ["auth.admin.signOut", "session revocation"],
  ["finalize_owner_account_deletion_v1", "terminal account deletion RPC"],
]) {
  if (deletionRoute && !deletionRoute.includes(text)) failures.push(`${label} (apps/web/src/app/api/owner/account-deletion/route.ts)`);
}

requireText("docs/shared/data-contracts.md", "## Owner Account Deletion Contract", "deletion contract documentation");

for (const [text, label] of [
  ["authClient.auth.getUser(token)", "data export session authentication"],
  ["loadOwnerShopAccessForUser(user.id)", "data export tenant access lookup"],
  ['access.role !== "owner"', "data export owner-only authority"],
  ['searchParams.get("shopId")', "data export explicit shop scope"],
  ['Cache-Control": "private, no-store"', "data export cache prevention"],
  ["Media binary objects are not included", "data export media boundary"],
]) {
  if (exportRoute && !exportRoute.includes(text)) failures.push(`${label} (apps/web/src/app/api/owner/data-export/route.ts)`);
}

const apiFiles = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name === "route.ts") apiFiles.push(absolute);
  }
}
walk(path.join(root, "apps/web/src/app/api"));
const exportRoutes = apiFiles.filter((file) => /(?:export|download)/i.test(file));
if (exportRoutes.length === 0) {
  warnings.push("No authenticated data-export/download API route was found; keep this as a launch gate until implemented or legally approved as a manual process.");
}

if (failures.length > 0) {
  console.error("Privacy operations check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Privacy operations check: PASS (policy, deletion, and retention contracts present)");
for (const warning of warnings) console.log(`WARN: ${warning}`);
