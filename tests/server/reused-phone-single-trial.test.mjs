import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts"), resolve(sourcePath, "index.tsx")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

process.env.OWNER_TRIAL_IDENTITY_CURRENT_VERSION = "v1";
process.env.OWNER_TRIAL_IDENTITY_HMAC_SECRET_V1 = "fixture-only-owner-trial-secret";

const credentials = await import("../../src/lib/auth/owner-credentials.ts");
const identity = await import("../../src/lib/auth/owner-identity.ts");
const ownerPlanContract = await import("../../src/lib/billing/owner-plans.ts");

test("domestic and +82 phone formats share one canonical trial identity", () => {
  const variants = ["010-1234-5678", "01012345678", "+82 10-1234-5678"];
  assert.deepEqual(variants.map(credentials.normalizeOwnerPhoneNumber), [
    "01012345678",
    "01012345678",
    "01012345678",
  ]);
  assert.equal(new Set(variants.map(identity.hashOwnerTrialPhoneIdentity)).size, 1);
  assert.match(identity.hashOwnerTrialPhoneIdentity(variants[0]), /^[0-9a-f]{64}$/);
});

test("main signup delegates trial eligibility to v5 and preserves email-specific duplicate errors", async () => {
  const route = await readFile(new URL("../../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
  assert.match(route, /claim_owner_signup_v5/);
  assert.match(route, /complete_owner_signup_v5/);
  assert.match(route, /buildOwnerTrialPhoneIdentityKeys\(verifiedIdentity\.phone_number\)/);
  assert.match(route, /이미 사용 중인 이메일입니다/);
  assert.doesNotMatch(route, /findExistingOwnerByIdentity|duplicateAccountMessage/);
  assert.doesNotMatch(route, /subscription_status:\s*"trialing"/);
});

test("client only consumes the server result and never submits eligibility", async () => {
  const form = await readFile(new URL("../../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
  assert.match(form, /ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER/);
  assert.match(form, /result\.billingRequired \? "\/owner\/billing\?notice=trial-used" : initialSetupPath/);
  const submittedBody = form.slice(form.indexOf("body: JSON.stringify({"), form.indexOf("}),\n      });", form.indexOf("body: JSON.stringify({")));
  assert.doesNotMatch(submittedBody, /trialEligible|trialDays|billingRequired/);
});

test("trial ledger schema is purpose-scoped and PII-free", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260827064926_reused_phone_single_trial_signup.sql", import.meta.url),
    "utf8",
  );
  const tableBlock = migration.slice(
    migration.indexOf("create table if not exists public.owner_trial_identity_claims"),
    migration.indexOf("alter table public.owner_trial_identity_claims enable row level security"),
  );
  assert.match(tableBlock, /owner_trial_identity_aliases/);
  assert.match(tableBlock, /owner_trial_identity_key_policy/);
  assert.doesNotMatch(tableBlock, /phone_number|raw_phone|email|user_id|shop_id|ci_hash|di_hash/);
  assert.match(migration, /revoke all on table public\.owner_trial_identity_claims from public, anon, authenticated/);
  assert.match(migration, /PM_SIGNUP_TRIAL_PREVIOUS_KEY_REQUIRED/);
  assert.match(migration, /owner_trial_identity_key_retirement_status_v1/);
  assert.match(migration, /subscription_status[\s\S]*'trialing'[\s\S]*'expired'/);
  assert.doesNotMatch(migration, /insert into public\.shop_alimtalk_credit_(?:balances|events)/);
  assert.match(migration, /current_plan_code[\s\S]*'single_monthly_v1'/);
  assert.match(migration, /'2026-08-v1', 29000, 'KRW'/);
  assert.match(migration, /owner_subscriptions_single_monthly_v1_contract_check/);
});

test("new sale and renewal use one versioned 29,000 KRW plan without rewriting legacy monthly", async () => {
  const plans = await readFile(new URL("../../src/lib/billing/owner-plans.ts", import.meta.url), "utf8");
  const billing = await readFile(new URL("../../src/server/owner-billing.ts", import.meta.url), "utf8");

  assert.match(plans, /OWNER_SINGLE_MONTHLY_PLAN_CODE = "single_monthly_v1"/);
  assert.match(plans, /OWNER_SINGLE_MONTHLY_PRODUCT_VERSION = "2026-08-v1"/);
  assert.match(plans, /OWNER_SINGLE_MONTHLY_PRICE_KRW = 29000/);
  assert.match(plans, /code: "monthly"[\s\S]*monthlyPrice: 19000/);
  assert.match(billing, /resolveBillingPlanContract/);
  assert.match(billing, /record\.price_snapshot_amount !== OWNER_SINGLE_MONTHLY_PRICE_KRW/);
  assert.match(billing, /payment\.amount !== expectedAmount/);
  assert.deepEqual(ownerPlanContract.billableOwnerPlans.map((plan) => plan.code), ["single_monthly_v1"]);
  assert.equal(ownerPlanContract.getOwnerPlanByCode("single_monthly_v1")?.monthlyPrice, 29000);
  assert.equal(ownerPlanContract.getOwnerPlanByCode("monthly")?.monthlyPrice, 19000);
  assert.equal(
    ownerPlanContract.calculateOwnerBillingAmountBreakdown(
      ownerPlanContract.getOwnerPlanByCode("single_monthly_v1"),
      3,
    ).monthlyTotalAmount,
    29000,
  );
});

test("single-plan cutover disables every top-up sale entry and keeps only historical webhook reconcile", async () => {
  const registeredRoute = await readFile(
    new URL("../../src/app/api/alimtalk-credits/purchase/registered-card/route.ts", import.meta.url),
    "utf8",
  );
  const confirmRoute = await readFile(
    new URL("../../src/app/api/alimtalk-credits/purchase/confirm/route.ts", import.meta.url),
    "utf8",
  );
  const purchaseClient = await readFile(
    new URL("../../src/lib/alimtalk-credit-purchase-client.ts", import.meta.url),
    "utf8",
  );
  const purchaseServer = await readFile(
    new URL("../../src/server/owner-alimtalk-credit-purchase.ts", import.meta.url),
    "utf8",
  );
  const settings = await readFile(
    new URL("../../src/components/owner/owner-settings-panel.tsx", import.meta.url),
    "utf8",
  );
  const ownerShell = await readFile(
    new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url),
    "utf8",
  );

  for (const route of [registeredRoute, confirmRoute]) {
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /requireOwnerBillingSession|request\.json|PortOne/);
  }
  assert.doesNotMatch(settings, /\/owner\/alimtalk-credits/);
  assert.doesNotMatch(ownerShell, /\/owner\/alimtalk-credits/);
  assert.doesNotMatch(purchaseClient, /requestPayment|fetchApiJsonWithAuth|PortOne/);
  assert.match(purchaseServer, /OWNER_ALIMTALK_TOPUP_SALES_CUTOFF_ISO/);
  assert.match(purchaseServer, /allowHistoricalReconcile/);
  assert.match(purchaseServer, /isHistoricalTopupPayment\(payment\.paidAt\)/);
});

test("subscription and payment ledgers enforce the immutable single-product snapshot", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260827064926_reused_phone_single_trial_signup.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /featured_plan_code = 'single_monthly_v1'/);
  assert.match(migration, /auto_renew_plan_code = 'single_monthly_v1'/);
  assert.match(migration, /owner_payment_ledger_single_monthly_v1_contract_check/);
  assert.match(migration, /add column if not exists product_version text/);
  assert.match(migration, /price_snapshot_amount is not distinct from 29000/);
  assert.match(migration, /PM_PAYMENT_PRODUCT_SNAPSHOT_IMMUTABLE/);
});
