import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOpaqueMarketingAcquisitionId,
  MARKETING_ACQUISITION_EVENTS,
  MARKETING_UTM_FIELDS,
  MarketingAcquisitionInputError,
  parseMarketingAcquisitionSource,
  resolveImmutableFirstTouch,
} from "../../src/lib/marketing-acquisition.ts";

const serverPath = new URL("../../src/server/marketing-acquisition.ts", import.meta.url);
const contractPath = new URL("../../src/lib/marketing-acquisition.ts", import.meta.url);
const routePath = new URL("../../src/app/api/marketing/acquisition/route.ts", import.meta.url);
const landingPath = new URL("../../src/components/landing/landing-page.tsx", import.meta.url);
const signupPath = new URL("../../src/app/api/auth/signup/route.ts", import.meta.url);
const verifyPassPath = new URL("../../src/app/api/auth/verify-pass/route.ts", import.meta.url);
const setupMilestonePath = new URL(
  "../../src/app/api/owner/initial-setup/acquisition-milestone/route.ts",
  import.meta.url,
);
const ownerPreviewPath = new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url);
const ownerBillingPath = new URL("../../src/server/owner-billing.ts", import.meta.url);
const migrationPath = new URL(
  "../../supabase/migrations/20260908090000_marketing_acquisition_first_touch.sql",
  import.meta.url,
);

test("first touch normalizes only the standard UTM allowlist and preserves the original value", () => {
  assert.deepEqual(MARKETING_UTM_FIELDS, ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
  assert.deepEqual(parseMarketingAcquisitionSource({ unrelated: "ignored" }), { sourceKind: "direct", utm: null });
  const first = parseMarketingAcquisitionSource({
    utm_source: " Google ",
    utm_medium: "CPC",
    utm_campaign: "pilot_01",
    ignored: "https://example.com/free-form",
  });
  assert.deepEqual(first, {
    sourceKind: "utm",
    utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "pilot_01" },
  });
  assert.deepEqual(resolveImmutableFirstTouch(first, { sourceKind: "utm", utm: { utm_source: "evil" } }), {
    value: first,
    inserted: false,
  });
});

test("opaque acquisition ids are random UUIDs and carry no user or shop input", () => {
  const expected = "2d793e86-4a31-4c36-8a31-2d793e864a31";
  assert.equal(createOpaqueMarketingAcquisitionId(() => expected), expected);
  assert.throws(() => createOpaqueMarketingAcquisitionId(() => "owner@example.com"), /RANDOM_ID_INVALID/);
});

test("malformed, oversized, URL, XSS, email and phone-like UTM values fail closed", () => {
  const invalid = [
    { utm_source: "<script>alert(1)</script>" },
    { utm_source: "javascript:alert(1)" },
    { utm_source: "https://example.com/path" },
    { utm_source: "owner@example.com" },
    { utm_source: "010-1234-5678" },
    { utm_source: "a".repeat(65) },
    { utm_campaign: ["first", "overwrite"] },
  ];
  for (const value of invalid) {
    assert.throws(() => parseMarketingAcquisitionSource(value), MarketingAcquisitionInputError);
  }
});

test("landing capture sends only allowlisted UTM values and a fixed signup CTA", async () => {
  const [route, landing, server, contract] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(landingPath, "utf8"),
    readFile(serverPath, "utf8"),
    readFile(contractPath, "utf8"),
  ]);
  assert.match(route, /z\.discriminatedUnion\("eventName"/);
  assert.match(route, /z\.literal\("signup"\)/);
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /new URL\(origin\)\.origin !== request\.nextUrl\.origin/);
  assert.match(landing, /MARKETING_UTM_FIELDS/);
  assert.match(landing, /eventName: "landing_view"/);
  assert.match(landing, /eventName: "landing_cta_click", ctaId: "signup"/);
  assert.match(landing, /landingAcquisitionQueue = landingAcquisitionQueue\.then/);
  assert.doesNotMatch(landing, /document\.referrer|navigator\.userAgent|screen\.(?:width|height)/);
  assert.match(contract, /crypto\.randomUUID\(\)/);
  assert.match(server, /httpOnly: true/);
  assert.match(server, /sameSite: "lax"/);
  assert.match(server, /existingId \?\? createOpaqueMarketingAcquisitionId\(\)/);
  assert.match(server, /status === "recorded" \|\| status === "duplicate"/);
});

test("PASS and atomic signup bind only after their authoritative success boundaries", async () => {
  const [signup, verifyPass] = await Promise.all([readFile(signupPath, "utf8"), readFile(verifyPassPath, "utf8")]);
  const atomicSuccess = signup.indexOf("const orchestration = await orchestrateDevelopmentSignup");
  const bind = signup.indexOf("await bindMarketingAcquisitionToSignup", atomicSuccess);
  const signIn = signup.indexOf("authClient.auth.signInWithPassword", bind);
  assert.ok(atomicSuccess >= 0 && bind > atomicSuccess && signIn > bind);
  assert.match(signup.slice(bind, signIn), /signupRequestId: payload\.signupRequestId/);
  assert.match(signup.slice(bind, signIn), /ownerUserId: orchestration\.authUserId/);
  assert.match(signup.slice(bind, signIn), /shopId: orchestration\.shopId/);
  assert.equal(verifyPass.match(/recordSignupIdentityVerified/g)?.length, 4); // import + three verified return paths
  assert.doesNotMatch(verifyPass, /recordSignupIdentityVerified[\s\S]{0,180}purpose: "reset-password"/);
  assert.match(verifyPass, /if \(payload\.purpose === "signup"\)/);
});

test("migration enforces immutable first touch, exact tenant binding and idempotent milestone inserts", async () => {
  const migration = await readFile(migrationPath, "utf8");
  for (const event of MARKETING_ACQUISITION_EVENTS) assert.match(migration, new RegExp(`'${event}'`));
  assert.match(migration, /unique \(acquisition_id, event_key\)/);
  assert.match(migration, /marketing_acquisition_authoritative_event_key_unique/);
  assert.match(migration, /where event_name not in \('landing_view', 'landing_cta_click'\)/);
  assert.match(migration, /owner_user_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /shop_id text references public\.shops\(id\) on delete set null/);
  assert.match(migration, /on conflict \(acquisition_id\) do nothing/);
  assert.doesNotMatch(migration, /update public\.marketing_acquisitions/);
  assert.match(migration, /v_signup\.status <> 'completed'/);
  assert.match(migration, /v_signup\.auth_user_id is distinct from p_owner_user_id/);
  assert.match(migration, /v_signup\.shop_id is distinct from p_shop_id/);
  assert.match(migration, /where id = p_shop_id and owner_user_id = p_owner_user_id/);
  assert.match(migration, /PM_ACQUISITION_FOREIGN_BINDING/);
  assert.match(migration, /where owner_user_id = p_owner_user_id and shop_id = p_shop_id/);
  assert.match(migration, /on conflict do nothing/g);
  assert.match(migration, /revoke all on table public\.marketing_acquisitions from public, anon, authenticated/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("schema stores no raw referrer, URL, IP, device, free-form payload or contact fields", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(migration, /referrer|raw_url|landing_url|ip_address|user_agent|device_id|email|phone|payload jsonb/i);
  assert.match(migration, /source_kind text not null check \(source_kind in \('direct', 'utm'\)\)/);
  assert.match(migration, /utm_source text check[\s\S]*length\(utm_source\) between 1 and 64/);
  assert.match(migration, /utm_campaign text check[\s\S]*length\(utm_campaign\) between 1 and 128/);
});

test("missing schema stays compatible while foreign or malformed binding never mutates", async () => {
  const [server, migration] = await Promise.all([readFile(serverPath, "utf8"), readFile(migrationPath, "utf8")]);
  assert.match(server, /error\?\.code === "42P01"/);
  assert.match(server, /error\?\.code === "42883"/);
  assert.match(server, /return "schema_missing" as const/);
  const bindingGuard = migration.indexOf("PM_ACQUISITION_SIGNUP_AUTHORITY_MISMATCH");
  const bindingInsert = migration.indexOf("insert into public.marketing_acquisition_bindings", bindingGuard);
  assert.ok(bindingGuard >= 0 && bindingInsert > bindingGuard);
  const tenantGuard = migration.indexOf("PM_ACQUISITION_TENANT_MISMATCH", bindingGuard);
  assert.ok(tenantGuard > bindingGuard && tenantGuard < bindingInsert);
});

test("setup milestones require canonical requery acceptance and never roll back the saved setup", async () => {
  const [route, ownerPreview] = await Promise.all([
    readFile(setupMilestonePath, "utf8"),
    readFile(ownerPreviewPath, "utf8"),
  ]);
  const setupSave = ownerPreview.slice(
    ownerPreview.indexOf("async function handleInitialSetupStepSaved"),
    ownerPreview.indexOf("function handleInitialSetupHoursNext"),
  );

  assert.match(setupSave, /await refreshInitialSetupReadiness\(\)/);
  assert.match(setupSave, /if \(!readiness\.steps\[step\]\)[\s\S]*return;/);
  assert.match(setupSave, /if \(!isDemoOwnerWebData\(refreshed\)\)[\s\S]*\/api\/owner\/initial-setup\/acquisition-milestone/);
  assert.match(setupSave, /\.catch\(\(\) => undefined\)/);
  assert.match(route, /requireOwnerShop\(request, body\.shopId\)/);
  assert.match(route, /getBootstrap\(owner\.shopId/);
  assert.match(route, /if \(!readiness\.steps\[body\.step\]\)/);
  assert.match(route, /eventName: "setup_step_completed"/);
  assert.match(route, /authoritativeEventId: `\$\{owner\.shopId\}:\$\{stepKey\}`/);
  assert.deepEqual(
    [...route.matchAll(/(?:hours|staff|pricing): "([a-z_]+)"/g)].map((match) => match[1]),
    ["operating_hours", "staff_hours", "services"],
  );
  assert.match(route, /recordBoundOwnerOperationalActivity/);
  assert.match(route, /evaluateBoundOwnerDay7Activation/);
});

test("paid conversion records only after tenant-bound PAID persistence and billing acknowledgement", async () => {
  const billing = await readFile(ownerBillingPath, "utf8");
  const syncBoundary = billing.slice(
    billing.indexOf("export async function syncOwnerSubscriptionFromPayment"),
    billing.indexOf("export async function resetOwnerPaymentMethod"),
  );
  const retryBoundary = billing.slice(
    billing.indexOf("export async function retryOwnerSubscriptionCharge"),
    billing.indexOf("export async function syncOwnerSubscriptionFromPayment"),
  );

  assert.match(syncBoundary, /expectedContext\?\.userId[\s\S]*expectedContext\?\.shopId/);
  assert.match(syncBoundary, /if \(payment\.status === "PAID"\)[\s\S]*persistSubscriptionRecord[\s\S]*recordBillingEvent[\s\S]*recordBoundShopAcquisitionMilestone/);
  assert.match(retryBoundary, /if \(payment\.status === "PAID"\)[\s\S]*persistSubscriptionRecord[\s\S]*recordBillingEvent[\s\S]*recordBoundShopAcquisitionMilestone/);
  assert.equal((billing.match(/eventName: "paid_conversion"/g) ?? []).length, 3);
  assert.equal((billing.match(/authoritativeEventId: paymentId/g) ?? []).length, 3);
  assert.doesNotMatch(billing, /eventName: "test_booking_created"|eventName: "activated_day_7"/);
});
