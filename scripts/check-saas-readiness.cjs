const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireFile(relativePath, label = relativePath) {
  if (!exists(relativePath)) failures.push(`${label} (${relativePath})`);
}

function requireText(relativePath, text, label) {
  const source = read(relativePath);
  if (source && !source.includes(text)) failures.push(`${label} (${relativePath})`);
}

function requireNotText(relativePath, text, label) {
  const source = read(relativePath);
  if (source.includes(text)) failures.push(`${label} (${relativePath})`);
}

function warn(text) {
  warnings.push(text);
}

requireFile("docs/operations/saas-readiness-plan.md", "SaaS readiness plan");
requireFile("docs/operations/saas-readiness-evidence.md", "SaaS readiness evidence");
requireFile("docs/operations/incident-response-runbook.md", "incident response runbook");
requireFile("docs/operations/privacy-operations-matrix.md", "privacy operations matrix");
requireFile("docs/operations/observability-contract.md", "observability contract");
requireFile("docs/operations/request-correlation-contract.md", "request correlation contract");
requireFile("docs/operations/production-endpoint-verification.md", "production endpoint verification runbook");
requireFile("docs/operations/production-launch-gate.md", "production launch gate");
requireFile("docs/operations/notification-reliability.md", "notification reliability runbook");
requireFile(
  "docs/operations/notification-production-readback-20260929.md",
  "notification production environment readback",
);
requireFile(
  "docs/operations/payment-production-readback-20260929.md",
  "payment production environment readback",
);
requireFile(
  "apps/web/tests/server/vercel-env-sync-safety-contract.test.mjs",
  "Vercel Alimtalk environment write safety contract",
);
requireFile(
  "apps/web/scripts/check-payment-env-vercel.cjs",
  "Vercel PortOne environment readback helper",
);
requireFile(
  "apps/web/tests/server/payment-env-readback-contract.test.mjs",
  "Vercel PortOne environment readback contract",
);
requireFile("docs/operations/environment-inventory.md", "environment inventory");
requireFile("docs/operations/migration-drift-readback.md", "migration drift readback");
requireFile("docs/operations/supabase-readonly-readback-20260929.json", "Supabase read-only readback");
requireFile("docs/operations/vercel-readonly-readback-20260929.json", "Vercel read-only readback");
requireFile("docs/operations/backup-restore-readback-20260929.md", "backup and restore readback");
requireFile("docs/operations/saas-recovery-readback-20261001.json", "dated database and media recovery readback");
requireFile("docs/operations/tenant-isolation-readback-20261001.json", "dated tenant-isolation fixture readback");
requireFile("docs/operations/supabase-browser-grants-readback-20261001.json", "dated Supabase browser-grant readback");
requireFile("scripts/check-environment-inventory.cjs", "environment inventory guard");
requireFile("scripts/check-vercel-project-target.cjs", "Vercel project target guard");
requireFile("scripts/check-production-endpoints.cjs", "production endpoint smoke guard");
requireFile("scripts/check-release-tracked-files.cjs", "release tracked-files guard");
requireFile("scripts/check-migration-order.cjs", "migration order guard");
requireFile("scripts/repair-supabase-migration-history.cjs", "migration history repair guard");
requireFile("docs/operations/supabase-data-safety.md", "Supabase data safety runbook");
requireFile("docs/shared/data-contracts.md", "shared data contracts");
requireFile("supabase/migrations", "Supabase migrations");
requireFile("scripts/check-data-safety-guardrails.cjs", "data safety guard");
requireFile("scripts/check-owner-auth-guards.cjs", "owner auth guard");
requireFile("scripts/check-owner-tenant-route-guards.cjs", "owner tenant route guard");
requireFile("scripts/check-tenant-isolation-contract.cjs", "tenant isolation contract guard");
requireFile("docs/operations/tenant-isolation-verification.md", "tenant isolation verification runbook");
requireFile("scripts/check-media-architecture.cjs", "media architecture guard");
requireFile("scripts/check-privacy-operations.cjs", "privacy operations guard");
requireFile("scripts/verify-development-encrypted-backup-restore.ps1", "development backup restore verifier");
requireFile("scripts/check-backup-recovery-contract.cjs", "backup recovery contract guard");
requireFile("scripts/verify-supabase-cli-target.cjs", "Supabase target guard");
requireFile("scripts/verify-supabase-development-rls.cjs", "development RLS verifier");
requireFile("supabase/verification/verify_public_table_rls.sql", "public-table RLS verification SQL");
requireFile("supabase/verification/verify_policyless_rls_acl.sql", "policy-less RLS ACL verification SQL");
requireFile(
  "supabase/migrations/20260929131500_revoke_policyless_browser_grants.sql",
  "policy-less RLS browser grant hardening migration",
);
requireFile("apps/web/src/app/api/healthz/route.ts", "liveness endpoint");
requireFile("apps/web/src/app/api/readyz/route.ts", "readiness endpoint");
requireFile("apps/mobile/src/app/api/healthz/route.ts", "mobile liveness endpoint");
requireFile("apps/mobile/src/app/api/readyz/route.ts", "mobile readiness endpoint");
requireFile("vercel.json", "mobile Vercel services routing");
requireFile("apps/web/vercel.json", "web Vercel project routing");
requireFile("apps/mobile/vercel.json", "mobile Vercel project routing");
requireText(
  "apps/web/docs/frontend-backend-split.md",
  "`backend/` is a retained Express server for legacy local development only. It is not the production authentication authority.",
  "legacy backend must not become the production authentication authority",
);
requireFile("apps/mobile/src/lib/observability.ts", "mobile redacted operational logging boundary");
requireFile("apps/web/src/lib/observability.ts", "redacted operational logging boundary");
requireFile("backend/alimtalk-relay/src/server.ts", "Alimtalk relay operational boundary");
requireFile(
  "apps/web/tests/server/notification-reliability-contract.test.mjs",
  "web notification log privacy contract",
);
requireFile(
  "apps/mobile/tests/mobile-alimtalk-provider-log-security.test.mjs",
  "mobile notification log privacy contract",
);
requireFile(".github/workflows/owner-auth-guard.yml", "CI operations gate");
requireText("apps/web/src/lib/observability.ts", "REQUEST_ID_PATTERN", "web request correlation validation");
requireText("apps/mobile/src/lib/observability.ts", "REQUEST_ID_PATTERN", "mobile request correlation validation");
requireText("apps/web/src/app/api/readyz/route.ts", '"x-request-id"', "web readiness request correlation response");
requireText("apps/mobile/src/app/api/readyz/route.ts", '"x-request-id"', "mobile readiness request correlation response");
requireText("apps/web/src/app/api/healthz/route.ts", "getReleaseId", "web liveness release identity");
requireText("apps/web/src/app/api/readyz/route.ts", "getReleaseId", "web readiness release identity");
requireText("apps/mobile/src/app/api/healthz/route.ts", "getReleaseId", "mobile liveness release identity");
requireText("apps/mobile/src/app/api/readyz/route.ts", "getReleaseId", "mobile readiness release identity");
requireText("backend/alimtalk-relay/src/server.ts", "REQUEST_ID_PATTERN", "Alimtalk relay request correlation validation");
requireText("backend/alimtalk-relay/src/server.ts", '"x-request-id"', "Alimtalk relay request correlation response");
requireText(
  "apps/web/tests/server/notification-reliability-contract.test.mjs",
  "notification dispatch logs do not include phone tails",
  "web notification phone-tail log guard",
);
requireText(
  "apps/web/src/app/api/admin/notifications/failures/route.ts",
  "requireAdminSession",
  "admin notification failure route authentication",
);
requireText(
  "apps/web/tests/server/admin-notification-retry-contract.test.mjs",
  "admin_notification_retry",
  "admin notification retry contract test",
);
requireFile(
  "apps/web/src/app/admin/notifications/page.tsx",
  "admin notification failure page",
);
requireFile(
  "apps/web/src/components/admin/admin-notification-failure-screen.tsx",
  "admin notification failure screen",
);
requireFile(
  "apps/web/tests/server/admin-notification-failure-screen-contract.test.mjs",
  "admin notification failure screen contract test",
);
requireFile("apps/web/src/app/api/admin/audit-events/route.ts", "admin audit log API");
requireFile("apps/web/src/app/admin/audit/page.tsx", "admin audit log page");
requireFile("apps/web/src/components/admin/admin-audit-log-screen.tsx", "admin audit log screen");
requireFile("apps/web/tests/server/admin-audit-log-contract.test.mjs", "admin audit log contract test");
requireText(
  "apps/mobile/tests/mobile-alimtalk-provider-log-security.test.mjs",
  "mobile notification dispatch does not log phone tails",
  "mobile notification phone-tail log guard",
);
requireText(".github/workflows/owner-auth-guard.yml", "alimtalk-relay-security", "CI Alimtalk relay security job");
requireText(".github/workflows/owner-auth-guard.yml", "npm test --prefix backend/alimtalk-relay", "CI Alimtalk relay security test");

const packageJson = read("package.json");
for (const scriptName of [
  "check:supabase-cli-target:dev",
  "check:data-safety",
  "check:owner-auth-guards",
  "check:owner-tenant-guards",
  "check:tenant-isolation",
  "check:media-architecture",
  "check:media-schema:dev",
  "check:media-recovery",
  "check:privacy-operations",
  "check:backup-recovery",
  "check:backup-recovery:preflight",
  "check:backup-recovery:local",
  "check:environment-inventory",
  "check:alimtalk-env",
  "check:payment-env:vercel",
  "check:vercel-project:mobile",
  "check:vercel-project:web",
  "check:vercel-project:manifest",
  "check:production-endpoints",
  "check:readback-evidence",
  "check:release-tracked-files",
  "check:migration-order",
  "test:deployment-routing",
  "typecheck:alimtalk-relay",
  "test:alimtalk-relay",
  "lint:mobile",
  "test:saas-readiness",
  "supabase:migration:repair:dev:dry-run",
  "test:reliability",
  "predeploy",
  "predeploy:release",
  "postdeploy:release",
]) {
  requireText("package.json", `"${scriptName}"`, `root script ${scriptName}`);
}

requireText(
  "scripts/verify-supabase-cli-target.cjs",
  "PETMANAGER_SUPABASE_PRODUCTION_CONFIRMATION",
  "production Supabase explicit confirmation guard",
);
requireText(
  "scripts/verify-supabase-cli-target.cjs",
  "PETMANAGER_SUPABASE_CHANGE_REASON",
  "production Supabase change-reason guard",
);
requireText(
  "apps/web/package.json",
  '"check:alimtalk-env"',
  "Alimtalk production environment consistency check",
);
requireText(
  "apps/web/package.json",
  '"check:payment-env:vercel"',
  "PortOne production environment readback check",
);
requireText(
  "apps/web/package.json",
  'npm run check:alimtalk-env && npm run check:supabase-cli-target:dev',
  "predeploy Alimtalk environment gate",
);
requireText(
  "apps/web/package.json",
  "tests/server/owner-data-relationship-integrity.test.mjs",
  "SaaS readiness tenant mutation-integrity test",
);
requireText(
  "apps/web/package.json",
  "tests/server/policyless-rls-browser-grants-contract.test.mjs",
  "SaaS readiness policyless RLS ACL test",
);
for (const [file, key] of [
  ["apps/web/.env.example", "CALL_ID_PHONE_HMAC_SECRET="],
  ["apps/web/.env.example", "CALL_ID_WEBHOOK_HASH_SECRET="],
  ["apps/web/.env.example", "OPENAI_PRICE_GUIDE_MODEL="],
  ["apps/mobile/.env.example", "CALL_ID_PHONE_HMAC_SECRET="],
  ["apps/mobile/.env.example", "CALL_ID_WEBHOOK_HASH_SECRET="],
  ["apps/mobile/.env.example", "NEXT_PUBLIC_ALLOWED_DEV_SUPABASE_REFS="],
]) {
  requireText(file, key, `${file} environment contract: ${key}`);
}
for (const file of [".env.example", "apps/web/.env.example", "apps/mobile/.env.example"]) {
  requireNotText(file, "petmanager-admin-setup-2026", "environment example contains a reusable admin secret");
  requireNotText(file, "change-this-to-", "environment example contains a copyable placeholder secret");
}
requireNotText(
  ".github/workflows/owner-auth-guard.yml",
  "test1234",
  "CI owner-auth workflow contains a reusable test password",
);
requireNotText(
  ".github/workflows/owner-auth-guard.yml",
  "|| 'devowner'",
  "CI owner-auth workflow contains a reusable test-owner fallback",
);
for (const file of ["apps/web/scripts/measure-owner-login.cjs", "scripts/measure-owner-login.cjs"]) {
  requireText(file, "Owner login measurement requires", "owner login measurement must require explicit credentials");
  requireNotText(file, "test1234", "owner login measurement contains a reusable test password");
  requireNotText(file, "devowner@petmanager.test", "owner login measurement contains a reusable test-owner fallback");
}
requireText(
  "apps/web/src/app/api/owner/account-deletion/route.ts",
  "removeMediaStorageObjects",
  "account deletion must use the media storage abstraction",
);
requireText(
  "apps/web/src/app/api/owner/account-deletion/route.ts",
  "verifyMediaStorageObjectsAbsent",
  "account deletion must verify media cleanup",
);

if (!packageJson.includes('"check:saas-readiness"')) {
  failures.push("root script check:saas-readiness is not wired");
}

const trackedFilesCheck = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-release-tracked-files.cjs")],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (trackedFilesCheck.status !== 0) {
  const details = `${trackedFilesCheck.stdout ?? ""}\n${trackedFilesCheck.stderr ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
  failures.push(
    ...(details.length > 0
      ? details.map((detail) => detail.slice(2))
      : ["release tracked-files gate must pass before deployment"]),
  );
}

requireText(
  ".github/workflows/owner-auth-guard.yml",
  "npm run check:tenant-isolation",
  "CI tenant isolation gate",
);
requireText(
  "scripts/check-predeploy-release.cjs",
  '"check:migration-order"',
  "predeploy migration-order gate",
);
requireText(
  "scripts/check-predeploy-release.cjs",
  '"check:media-schema:dev"',
  "predeploy development media schema gate",
);
requireText(
  "scripts/check-predeploy-release.cjs",
  '"check:alimtalk-env:vercel"',
  "predeploy protected Vercel Alimtalk environment readback gate",
);
requireText(
  "scripts/check-predeploy-release.cjs",
  '"check:payment-env:vercel"',
  "predeploy protected Vercel PortOne environment readback gate",
);
requireText(
  "scripts/check-production-launch-readiness.cjs",
  "--pull-vercel-production",
  "production launch protected Vercel Alimtalk environment readback gate",
);
requireText(
  "scripts/check-production-launch-readiness.cjs",
  "check-payment-env-vercel.cjs",
  "production launch PortOne environment readback gate",
);
requireText(
  "apps/web/scripts/sync-vercel-alimtalk-env.cjs",
  "PETMANAGER_VERCEL_ENV_CONFIRMATION",
  "Vercel Alimtalk environment write confirmation guard",
);
requireText(
  "apps/web/scripts/sync-vercel-alimtalk-env.cjs",
  "--dry-run",
  "Vercel Alimtalk environment dry-run mode",
);

warn("Current production readback shows no database backup/PITR and no verified R2 recovery configuration; production launch remains blocked pending protection and restore drills.");
warn("A static check cannot prove tenant isolation or recovery; run focused tests and a restore drill before launch.");

if (failures.length > 0) {
  console.error("SaaS readiness check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SaaS readiness check: PASS (repository baseline)");
for (const warning of warnings) console.log(`WARN: ${warning}`);
