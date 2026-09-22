import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const {
  OWNER_INITIAL_SETUP_REQUIRED_MESSAGE,
  assertInitialSetupSettingsPayload,
  assertBootstrapOwnerInitialSetupComplete,
  assertOwnerInitialSetupAllowsMediaKind,
  assertOwnerInitialSetupAllowsStoredMedia,
  assertOwnerInitialSetupComplete,
  requireOwnerInitialSetupCompleteBootstrap,
} = await import("../../src/server/owner-initial-setup-guard.ts");

const shop = { id: "shop-gate", business_hours: {} };
const completed = {
  shop,
  initialSetupReadiness: {
    shopId: shop.id,
    steps: { hours: true, staff: true, pricing: true },
    completed: true,
    nextStep: null,
  },
};

test("canonical completed readiness allows operations", async () => {
  assert.doesNotThrow(() => assertBootstrapOwnerInitialSetupComplete(completed));
  await assert.doesNotReject(() => assertOwnerInitialSetupComplete(shop.id, async () => completed));
  assert.equal(await requireOwnerInitialSetupCompleteBootstrap(shop.id, async () => completed), completed);
});

test("missing, mismatched, incomplete, and load-error readiness fail closed", async () => {
  for (const data of [
    { shop },
    { ...completed, initialSetupReadiness: { ...completed.initialSetupReadiness, completed: false, nextStep: "staff" } },
    { ...completed, initialSetupReadiness: { ...completed.initialSetupReadiness, shopId: "other-shop" } },
  ]) {
    assert.throws(
      () => assertBootstrapOwnerInitialSetupComplete(data),
      (error) => error?.message === OWNER_INITIAL_SETUP_REQUIRED_MESSAGE && error?.status === 409,
    );
  }

  await assert.rejects(
    () => assertOwnerInitialSetupComplete(shop.id, async () => { throw new Error("database unavailable"); }),
    (error) => error?.message === OWNER_INITIAL_SETUP_REQUIRED_MESSAGE && error?.status === 409,
  );
});

test("incomplete settings accept only canonical operating-hours fields", () => {
  const setupPayload = {
    shopId: shop.id,
    bookingAvailableStartTime: "10:00",
    bookingAvailableEndTime: "17:00",
    regularClosedDays: [0],
    regularClosedCycle: "weekly",
    regularClosedAnchorDate: null,
    temporaryClosedDates: [],
    businessHours: { 1: { open: "10:00", close: "18:00", enabled: true } },
  };
  assert.doesNotThrow(() => assertInitialSetupSettingsPayload(setupPayload));
  for (const blockedField of ["notificationSettings", "name", "reservationPolicySettings"]) {
    assert.throws(
      () => assertInitialSetupSettingsPayload({ ...setupPayload, [blockedField]: {} }),
      (error) => error?.message === OWNER_INITIAL_SETUP_REQUIRED_MESSAGE && error?.status === 409,
    );
  }
});

test("incomplete media permits only setup and support purposes; completed shops remain unchanged", async () => {
  const incomplete = {
    ...completed,
    initialSetupReadiness: { ...completed.initialSetupReadiness, completed: false, nextStep: "staff" },
  };
  await assert.doesNotReject(() => assertOwnerInitialSetupAllowsMediaKind(shop.id, "staff_profile", async () => incomplete));
  await assert.doesNotReject(() => assertOwnerInitialSetupAllowsMediaKind(shop.id, "price_guide_source", async () => incomplete));
  await assert.doesNotReject(() => assertOwnerInitialSetupAllowsMediaKind(shop.id, "feedback_screenshot", async () => incomplete));
  await assert.rejects(
    () => assertOwnerInitialSetupAllowsMediaKind(shop.id, "grooming_before", async () => incomplete),
    (error) => error?.message === OWNER_INITIAL_SETUP_REQUIRED_MESSAGE && error?.status === 409,
  );

  let resolverCalls = 0;
  await assertOwnerInitialSetupAllowsStoredMedia(shop.id, async () => {
    resolverCalls += 1;
    return "message_image";
  }, async () => completed);
  assert.equal(resolverCalls, 0, "completed shops skip the extra media lookup and retain the existing path");
  await assertOwnerInitialSetupAllowsStoredMedia(shop.id, async () => {
    resolverCalls += 1;
    return "staff_profile";
  }, async () => incomplete);
  assert.equal(resolverCalls, 1);
  await assert.rejects(
    () => assertOwnerInitialSetupAllowsStoredMedia(shop.id, async () => { throw new Error("lookup failed"); }, async () => incomplete),
    (error) => error?.message === OWNER_INITIAL_SETUP_REQUIRED_MESSAGE && error?.status === 409,
  );
});

test("core booking routes guard before mutation, AI, discount, or payment provider work", () => {
  const appointments = readFileSync(new URL("../../src/app/api/appointments/route.ts", import.meta.url), "utf8");
  const schedule = readFileSync(new URL("../../src/app/api/owner/schedule/route.ts", import.meta.url), "utf8");
  const availability = readFileSync(new URL("../../src/app/api/availability/route.ts", import.meta.url), "utf8");
  const payments = readFileSync(new URL("../../src/app/api/payments/complete-booking/route.ts", import.meta.url), "utf8");
  const customerBookings = readFileSync(new URL("../../src/server/customer-bookings.ts", import.meta.url), "utf8");

  assert.ok(appointments.indexOf("await assertOwnerInitialSetupComplete(owner.shopId)") < appointments.indexOf("await createAppointment("));
  assert.ok(schedule.indexOf("await assertOwnerInitialSetupComplete(owner.shopId)") < schedule.indexOf("await createGuardian("));
  const availabilityGuard = availability.indexOf("await requireOwnerInitialSetupCompleteBootstrap(shopId)");
  const paymentGuard = payments.indexOf("await assertOwnerInitialSetupComplete(payload.booking.shopId)");
  const customerBookingGuard = customerBookings.indexOf("await requireOwnerInitialSetupCompleteBootstrap(payload.shopId)");
  assert.ok(availabilityGuard >= 0 && availability.indexOf("recommendAvailableSlotsWithAi({", availabilityGuard) > availabilityGuard);
  assert.ok(paymentGuard >= 0 && payments.indexOf("quoteCustomerDiscount(payload.booking)", paymentGuard) > paymentGuard);
  assert.ok(paymentGuard >= 0 && payments.indexOf("if (!hasPortoneServerEnv())", paymentGuard) > paymentGuard);
  assert.ok(paymentGuard >= 0 && payments.indexOf("fetch(`https://api.portone.io", paymentGuard) > paymentGuard);
  assert.ok(customerBookingGuard >= 0 && customerBookings.indexOf("quoteCustomerDiscount({", customerBookingGuard) > customerBookingGuard);
});

test("customer mutation routes preserve the canonical 409 and settings branch before mutation", () => {
  for (const relativePath of [
    "../../src/app/api/customer-bookings/route.ts",
    "../../src/app/api/customer-appointments/route.ts",
    "../../src/app/api/customer-rebooking-link/route.ts",
    "../../src/app/api/payments/complete-booking/route.ts",
    "../../src/app/api/availability/route.ts",
  ]) {
    const route = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(route, /error instanceof OwnerApiError[\s\S]*status: error\.status/);
  }

  const settings = readFileSync(new URL("../../src/app/api/settings/route.ts", import.meta.url), "utf8");
  const readiness = settings.indexOf("getBootstrapOwnerInitialSetupReadiness(bootstrap)");
  const restriction = settings.indexOf("assertInitialSetupSettingsPayload(body)", readiness);
  const limitedMutation = settings.indexOf("updateInitialSetupShopSettings(body)", restriction);
  const completedMutation = settings.indexOf("updateShopSettings(body", readiness);
  assert.ok(readiness >= 0 && restriction > readiness && limitedMutation > restriction);
  assert.ok(completedMutation > readiness, "completed shops retain the existing settings mutation path");
});

test("push-token and notification media operations guard before mock or downstream work", () => {
  const pushTokens = readFileSync(new URL("../../src/app/api/owner/push-tokens/route.ts", import.meta.url), "utf8");
  const pushPost = pushTokens.indexOf("export async function POST");
  const pushDelete = pushTokens.indexOf("export async function DELETE");
  assert.ok(pushTokens.indexOf("await assertOwnerInitialSetupComplete(owner.shopId)", pushPost) < pushTokens.indexOf("if (!hasSupabaseServerEnv())", pushPost));
  assert.ok(pushTokens.indexOf("await assertOwnerInitialSetupComplete(owner.shopId)", pushDelete) < pushTokens.indexOf("if (!hasSupabaseServerEnv())", pushDelete));

  for (const [relativePath, downstream] of [
    ["../../src/app/api/owner/media/notification-attachments/route.ts", "await attachMediaToNotification("],
    ["../../src/app/api/owner/media/notification-delivery-results/route.ts", "await markNotificationMediaDeliveryResult("],
  ]) {
    const route = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const guard = route.indexOf("await assertOwnerInitialSetupComplete(owner.shopId)");
    assert.ok(guard >= 0 && route.indexOf(downstream, guard) > guard);
    assert.match(route, /error instanceof OwnerApiError[\s\S]*status: error\.status/);
  }
});

test("general media writes resolve setup-safe purpose before storage or metadata mutation", () => {
  const uploadIntent = readFileSync(new URL("../../src/app/api/owner/media/upload-intents/route.ts", import.meta.url), "utf8");
  const uploadGuard = uploadIntent.indexOf("await assertOwnerInitialSetupAllowsMediaKind(");
  assert.ok(uploadGuard >= 0 && uploadIntent.indexOf("await createOwnerMediaUploadIntent(", uploadGuard) > uploadGuard);

  for (const [relativePath, downstream] of [
    ["../../src/app/api/owner/media/complete/route.ts", "await completeOwnerMediaUpload("],
    ["../../src/app/api/owner/media/variants/upload-intents/route.ts", "await createOwnerMediaVariantUploadIntent("],
    ["../../src/app/api/owner/media/variants/complete/route.ts", "await completeOwnerMediaVariantUpload("],
  ]) {
    const route = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const guard = route.indexOf("await assertOwnerInitialSetupAllowsStoredMedia(");
    assert.ok(guard >= 0 && route.indexOf("getOwnerMediaAssetKind(owner, mediaAssetId)", guard) > guard);
    assert.ok(route.indexOf(downstream, guard) > guard);
    assert.match(route, /error instanceof OwnerApiError[\s\S]*status: error\.status/);
  }
});

test("locked account control meets 44px and the manage-read fixture is development-only", () => {
  const shell = readFileSync(new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /className="grid min-h-11 min-w-\[178px\]/);

  const demoManage = readFileSync(new URL("../../src/app/demo/book/manage/page.tsx", import.meta.url), "utf8");
  const managePanel = readFileSync(new URL("../../src/components/customer/customer-booking-manage-panel.tsx", import.meta.url), "utf8");
  assert.match(demoManage, /process\.env\.NODE_ENV !== "development" \|\| initialSetup !== "1"/);
  assert.match(demoManage, /initialLookupResult=\{initialLookupResult\}[\s\S]*operationsLocked/);
  assert.doesNotMatch(demoManage, /getBootstrap|fetch\(|supabase|createCustomerBooking|updateCustomerBooking/);
  assert.match(managePanel, /useState<LookupPayload \| null>\(initialLookupResult\)/);
  assert.match(managePanel, /manageable && !operationsLocked/);
  assert.equal(
    (managePanel.match(/className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full/g) ?? []).length,
    2,
    "both manage close targets must remain at least 44px",
  );
  assert.doesNotMatch(managePanel, /className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full/);
});

test("incomplete owner shops open the normal dashboard without an initial-setup page", () => {
  const preview = readFileSync(new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(preview, /if \(!getBootstrapOwnerInitialSetupReadiness\(data\)\.completed\) return "operatingHours"/);
  assert.match(preview, /function getInitialOwnerWebScreen\(data: BootstrapPayload\): OwnerWebScreenKey \{[\s\S]*return shouldStartWithPriceGuideSetup\(data\) \? "services" : "schedule";/);
  assert.doesNotMatch(preview, /showInitialSetupAction=/);
  assert.match(preview, /<div className="h-full min-h-0 min-w-0">\s*<div className="h-full min-h-0 min-w-0"[^>]*>\s*\{renderScreen\(/);
  assert.match(shell, /inert=\{backgroundBlocked \? true : undefined\}/);
  assert.match(shell, /aria-hidden=\{backgroundBlocked \? true : undefined\}/);
  assert.match(shell, /backgroundBlocked && "pointer-events-none select-none"/);
  assert.match(shell, /설정 마무리하기/);
  assert.match(preview, /<OwnerInitialSetupGuide/);
  assert.doesNotMatch(shell, /operationsLocked/);
});

test("public entry, booking, and info routes use the same unavailable state", () => {
  for (const relativePath of [
    "../../src/app/entry/[shopId]/page.tsx",
    "../../src/app/book/[shopId]/page.tsx",
    "../../src/app/book/[shopId]/info/page.tsx",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /!data \|\| !getBootstrapOwnerInitialSetupReadiness\(data\)\.completed/);
    assert.match(source, /return <CustomerBookingUnavailable \/>/);
  }

  const unavailable = readFileSync(new URL("../../src/components/customer/customer-booking-unavailable.tsx", import.meta.url), "utf8");
  assert.equal((unavailable.match(/OWNER_INITIAL_SETUP_REQUIRED_MESSAGE/g) ?? []).length, 2);
  assert.match(unavailable, /max-w-\[430px\][\s\S]*px-6/);
});

test("the setup guide is mounted as a modal without replacing the dashboard", () => {
  const preview = readFileSync(new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../src/components/owner-web/owner-web-app-shell.tsx", import.meta.url), "utf8");
  assert.match(preview, /<OwnerInitialSetupGuide[\s\S]*open=\{initialSetupOpen\}/);
  assert.match(preview, /onClose=\{closeInitialSetup\}/);
  assert.match(shell, /설정 마무리하기/);
});
