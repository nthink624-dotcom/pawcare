const fs = require("fs");
const path = require("path");

function read(filePath) {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

function assertIncludes(filePath, expected, message) {
  if (!read(filePath).includes(expected)) throw new Error(`${message} (${filePath})`);
}

function assertExcludes(filePath, unexpected, message) {
  if (read(filePath).includes(unexpected)) throw new Error(`${message} (${filePath})`);
}

function assertOwnerWithdrawalSafety() {
  const filePath = "src/app/api/admin/owners/withdraw/route.ts";
  const source = read(filePath);
  const failClosedCall = 'assertAdminHighRiskActionReady("withdraw", account)';

  assertExcludes(filePath, '.from("shops").delete()', "Owner withdrawal must not physically delete shops.");

  if (source.includes(failClosedCall)) {
    if (source.indexOf("requireAdminSession(request)") > source.indexOf(failClosedCall)) {
      throw new Error(`Owner withdrawal must authenticate before the fail-closed high-risk gate. (${filePath})`);
    }

    for (const forbidden of [
      '.from("shops").update(',
      "admin.auth.admin.deleteUser(",
      "getSupabaseAdmin(",
      "request.json(",
    ]) {
      assertExcludes(filePath, forbidden, "Fail-closed owner withdrawal must not contain deletion side effects.");
    }
    return;
  }

  assertIncludes(filePath, "deleted_at: deletedAt", "Enabled owner withdrawal must soft-delete shops.");
}

try {
  assertIncludes(
    "../../supabase/migrations/20260806013153_protect_business_data_deletion.sql",
    "data_deletion_audit",
    "Deletion audit migration is missing.",
  );
  assertIncludes(
    "../../supabase/migrations/20260806013153_protect_business_data_deletion.sql",
    "before truncate on public.shops",
    "Shop TRUNCATE protection is missing.",
  );
  assertIncludes(
    "../../supabase/migrations/20260806015102_secure_shop_identity_change_events.sql",
    "enable row level security",
    "Shop identity change audit must have RLS enabled.",
  );
  assertOwnerWithdrawalSafety();
  assertIncludes(
    "src/server/bootstrap.ts",
    '.eq("id", shopId).is("deleted_at", null)',
    "Deleted shops must not load in booking/bootstrap flows.",
  );
  assertIncludes(
    "scripts/smoke-owner-auth-recovery.cjs",
    "SUPABASE_ENV_NAME=test",
    "Destructive smoke tests must require an isolated test project.",
  );
  assertIncludes(
    "package.json",
    "verify-supabase-cli-target.cjs --target prod --require-production-intent",
    "Safe Supabase CLI wrappers are missing.",
  );
  console.log("OK data safety guardrails are present.");
} catch (error) {
  console.error(`DATA SAFETY CHECK FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
