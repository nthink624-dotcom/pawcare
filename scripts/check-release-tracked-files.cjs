const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

// These files change the deployed runtime or the migration contract. If they
// remain untracked, a seemingly successful Vercel/DB promotion can omit them.
const REQUIRED_TRACKED_FILES = [
  ".github/workflows/owner-auth-guard.yml",
  "package.json",
  "apps/web/package.json",
  "apps/mobile/package.json",
  ".vercelignore",
  "apps/web/.vercelignore",
  "apps/mobile/.vercelignore",
  "docs/operations/vercel-project-targets.json",
  "docs/operations/supabase-readonly-readback-20260929.json",
  "docs/operations/vercel-readonly-readback-20260929.json",
  "docs/operations/saas-readiness-plan.md",
  "docs/operations/saas-readiness-evidence.md",
  "docs/operations/incident-response-runbook.md",
  "docs/operations/privacy-operations-matrix.md",
  "docs/operations/observability-contract.md",
  "docs/operations/request-correlation-contract.md",
  "docs/operations/production-endpoint-verification.md",
  "docs/operations/notification-reliability.md",
  "docs/operations/notification-production-readback-20260929.md",
  "docs/operations/payment-production-readback-20260929.md",
  "docs/operations/environment-inventory.md",
  "docs/operations/migration-drift-readback.md",
  "docs/operations/tenant-isolation-verification.md",
  "docs/operations/backup-restore-readback-20260929.md",
  "apps/web/src/app/api/healthz/route.ts",
  "apps/web/src/app/api/readyz/route.ts",
  "apps/web/src/lib/observability.ts",
  "apps/web/src/server/owner-data-export-rate-limit.ts",
  "apps/mobile/src/app/api/healthz/route.ts",
  "apps/mobile/src/app/api/readyz/route.ts",
  "apps/mobile/src/lib/observability.ts",
  "scripts/check-production-endpoints.cjs",
  "scripts/check-media-recovery-contract.cjs",
  "scripts/check-production-launch-readiness.cjs",
  "scripts/check-postdeploy-release.cjs",
  "apps/web/scripts/check-payment-env-vercel.cjs",
  "apps/web/scripts/check-media-provider-env-vercel.cjs",
  "apps/web/scripts/lib/temporary-env-file.cjs",
  "apps/web/tests/server/temporary-env-file-contract.test.mjs",
  "docs/operations/production-launch-gate.md",
  "scripts/check-readback-evidence.cjs",
  "scripts/check-release-tracked-files.cjs",
  "scripts/check-saas-readiness.cjs",
  "scripts/check-predeploy-release.cjs",
  "scripts/check-vercel-project-target.cjs",
  "scripts/check-environment-inventory.cjs",
  "scripts/check-migration-order.cjs",
  "scripts/repair-supabase-migration-history.cjs",
  "scripts/check-owner-tenant-route-guards.cjs",
  "scripts/check-tenant-isolation-contract.cjs",
  "scripts/check-privacy-operations.cjs",
  "scripts/check-backup-recovery-contract.cjs",
  "apps/web/tests/server/production-build-source-contract.test.mjs",
  "scripts/lib/recovery-objectives.cjs",
  "scripts/lib/recovery-objectives.contract.test.cjs",
  "scripts/lib/launch-readback-consistency.cjs",
  "scripts/lib/operational-error-cleanup-readiness.cjs",
  "scripts/verify-supabase-development-rls.cjs",
  "supabase/verification/verify_policyless_rls_acl.sql",
  "supabase/migrations/20260929130000_remove_redundant_notification_index.sql",
  "supabase/migrations/20260929131500_revoke_policyless_browser_grants.sql",
  "supabase/migrations/20260922031133_harden_sensitive_shared_data_rls.sql",
  "supabase/migrations/20260922031431_add_explicit_sensitive_data_deny_policies.sql",
  "supabase/migrations/20260922033440_media_transient_retention_60_days_reconcile.sql",
  "supabase/migrations/20260926204611_20260921120000_call_id_foundation.sql",
  "supabase/migrations/20260926204624_20260926130000_catch_call_reservation_flow.sql",
  "apps/web/tests/server/notification-reliability-contract.test.mjs",
  "apps/web/src/app/api/admin/notifications/failures/route.ts",
  "apps/web/tests/server/admin-notification-retry-contract.test.mjs",
  "apps/web/src/app/admin/notifications/page.tsx",
  "apps/web/src/components/admin/admin-notification-failure-screen.tsx",
  "apps/web/tests/server/admin-notification-failure-screen-contract.test.mjs",
  "apps/web/src/app/api/admin/audit-events/route.ts",
  "apps/web/src/app/admin/audit/page.tsx",
  "apps/web/src/components/admin/admin-audit-log-screen.tsx",
  "apps/web/tests/server/admin-audit-log-contract.test.mjs",
  "apps/web/tests/server/vercel-env-sync-safety-contract.test.mjs",
  "apps/web/tests/server/payment-env-readback-contract.test.mjs",
  "apps/mobile/tests/mobile-alimtalk-provider-log-security.test.mjs",
];

const failures = [];
for (const relativePath of REQUIRED_TRACKED_FILES) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: missing from working tree`);
    continue;
  }

  const result = spawnSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  if (result.status !== 0) failures.push(`${relativePath}: not tracked by Git`);
}

if (failures.length > 0) {
  console.error("Release tracked-files check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release tracked-files check: PASS (${REQUIRED_TRACKED_FILES.length} files)`);
