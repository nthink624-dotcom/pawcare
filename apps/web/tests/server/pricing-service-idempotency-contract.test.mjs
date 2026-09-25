import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

for (const key of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const { serviceInputSchema } = await import("../../src/server/schemas.ts");
const { getMockStore, resetMockStore, setMockStore } = await import("../../src/server/mock-store.ts");
const { upsertService } = await import("../../src/server/owner-mutations.ts");
const { paymentBookingSchema } = await import("../../src/server/payment-booking-schema.ts");
const { parseServicePriceInput, parseStoredServicePrice } = await import("../../src/lib/service-price-input.ts");

afterEach(() => resetMockStore());

function serviceInput(overrides = {}) {
  return {
    shopId: "demo-shop",
    serviceId: "svc-client-created-1",
    operation: "create",
    requestId: "11111111-1111-4111-8111-111111111111",
    name: "중복 없는 신규 서비스",
    price: 0,
    priceType: "starting",
    durationMinutes: 60,
    isActive: true,
    category: "미용",
    description: "",
    sortOrder: 1,
    capacityLabel: "동일 시간 1건",
    staffSelectionMode: "all",
    priceGuide: {},
    ...overrides,
  };
}

test("service and payment amount contracts accept only integer KRW 0..100,000,000", () => {
  assert.equal(serviceInputSchema.parse(serviceInput()).price, 0);
  assert.equal(serviceInputSchema.parse(serviceInput({ price: 100_000_000 })).price, 100_000_000);
  for (const price of [-1, 0.5, 100_000_000.1, 100_000_001]) {
    assert.throws(() => serviceInputSchema.parse(serviceInput({ price })));
  }

  const paymentPayload = {
    paymentId: "payment-1",
    orderId: "order-1",
    expectedAmount: 0,
    booking: {
      shopId: "shop-1",
      guardianName: "보호자",
      phone: "01012345678",
      petName: "반려견",
      weightKg: 3.8,
      serviceId: "service-1",
      appointmentDate: "2026-09-03",
      appointmentTime: "10:00",
    },
  };
  assert.equal(paymentBookingSchema.parse({ ...paymentPayload, expectedAmount: 100_000_000 }).expectedAmount, 100_000_000);
  for (const expectedAmount of [-1, 0.5, 100_000_000.1, 100_000_001]) {
    assert.throws(() => paymentBookingSchema.parse({ ...paymentPayload, expectedAmount }));
  }

  assert.equal(paymentBookingSchema.parse(paymentPayload).booking.weightKg, 3.8);
  for (const weightKg of [undefined, 0, -0.1, 200.01]) {
    const booking = { ...paymentPayload.booking };
    if (weightKg === undefined) delete booking.weightKg;
    else booking.weightKg = weightKg;
    assert.throws(() => paymentBookingSchema.parse({ ...paymentPayload, booking }));
  }
});

test("price input preserves raw invalid syntax and accepts only integer KRW including zero", () => {
  assert.deepEqual(parseServicePriceInput("0"), { ok: true, value: 0 });
  assert.deepEqual(parseServicePriceInput("100,000,000"), { ok: true, value: 100_000_000 });
  assert.deepEqual(parseStoredServicePrice("80,000원"), { ok: true, value: 80_000 });
  for (const value of ["", "-1", "0.5", "100,000,001", "1,2,3"]) {
    assert.equal(parseServicePriceInput(value).ok, false, `${value} must remain invalid`);
  }
});

test("a client-generated id explicitly creates once, retries once, and never updates a foreign service", async () => {
  const initial = getMockStore();
  const initialCount = initial.services.length;
  const first = await upsertService(serviceInput());
  const replay = await upsertService(serviceInput());
  const afterReplay = getMockStore();

  assert.equal(first.id, "svc-client-created-1");
  assert.equal(replay.id, first.id);
  assert.equal(afterReplay.services.length, initialCount + 1, "a retry must not create a second row");

  setMockStore({
    ...afterReplay,
    services: [...afterReplay.services, { ...first, id: "svc-foreign", shop_id: "other-shop" }],
  });
  const beforeForeign = getMockStore();
  await assert.rejects(
    () => upsertService(serviceInput({ serviceId: "svc-foreign", requestId: "22222222-2222-4222-8222-222222222222" })),
    (error) => error?.status === 404,
  );
  assert.deepEqual(getMockStore(), beforeForeign, "a foreign id must perform zero mutations");
});

test("the server binds request identity to its normalized payload and persists no raw payload", async () => {
  const [mutations, route, paymentRoute, paymentSchema, screen, migration, priceInput] = await Promise.all([
    readFile(new URL("../../src/server/owner-mutations.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/services/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/payments/complete-booking/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/server/payment-booking-schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../supabase/migrations/20260903063534_owner_service_save_idempotency.sql", import.meta.url), "utf8"),
    readFile(new URL("../../src/lib/service-price-input.ts", import.meta.url), "utf8"),
  ]);

  assert.match(mutations, /getServiceSavePayloadHash/);
  assert.match(mutations, /owner_service_save_requests/);
  assert.match(mutations, /priorRequest\.payload_hash !== payloadHash/);
  assert.match(mutations, /operation === "create"/);
  assert.match(mutations, /Scope ownership before consuming a request id/);
  assert.match(mutations, /scopedCandidate/);
  assert.match(mutations, /operation === "update" && \(!scopedCandidate/);
  assert.match(route, /requireOwnerShop\(request, body\?\.shopId\)/);
  assert.match(route, /shopId: owner\.shopId/);
  assert.match(paymentRoute, /import \{ paymentBookingSchema \} from "@\/server\/payment-booking-schema"/);
  assert.match(paymentRoute, /export async function POST/);
  assert.doesNotMatch(paymentRoute, /export const paymentBookingSchema/);
  assert.match(paymentSchema, /weightKg: z\.coerce\.number\(\)\.positive\(\)\.max\(200\)/);
  assert.match(paymentRoute, /quoteCustomerDiscount\(payload\.booking\)/);
  assert.match(screen, /serviceSaveAttemptsRef/);
  assert.match(screen, /operation: isCreate \? "create" : "update"/);
  assert.match(screen, /requestId: saveAttempt\.requestId/);
  assert.match(screen, /cache: "no-store"/);
  assert.match(screen, /parseServicePriceInput/);
  assert.match(screen, /price: value/);
  assert.match(priceInput, /hasValidGrouping/);
  assert.doesNotMatch(priceInput, /replace\(\/\[\^0-9\]\/g, ""\)/);
  assert.match(migration, /payload_hash char\(64\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.owner_service_save_requests from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.owner_service_save_requests to service_role/);
  assert.doesNotMatch(migration, /raw_payload|payload jsonb/i);
});
