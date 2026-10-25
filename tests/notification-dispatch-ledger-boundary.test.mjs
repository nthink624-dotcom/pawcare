import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const [
  capacitySource,
  ownerMutationsSource,
  appointmentsRouteSource,
  notificationDispatchSource,
  alimtalkProviderSource,
] = await Promise.all([
  readFile(new URL("../src/server/appointment-capacity.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server/owner-mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/appointments/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server/notification-dispatch.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server/alimtalk-provider.ts", import.meta.url), "utf8"),
]);

const APPOINTMENT_ID = "10000000-0000-4000-8000-000000000001";
const GUARDIAN_ID = "20000000-0000-4000-8000-000000000001";
const PET_ID = "30000000-0000-4000-8000-000000000001";
const SENSITIVE_SECRET = "BOOKING_ACCESS_SECRET_TEST_VALUE";
const SENSITIVE_TOKEN = "booking-token-must-not-be-logged";
const SENSITIVE_PHONE = "01012345678";
const SENSITIVE_LINK = `https://sensitive.example/manage?token=${SENSITIVE_TOKEN}`;

const payload = {
  shopId: "test-shop",
  guardianId: GUARDIAN_ID,
  petId: PET_ID,
  serviceId: "test-service",
  staffId: "test-staff",
  appointmentDate: "2099-12-31",
  appointmentTime: "10:00",
  memo: "test-only",
  source: "owner",
};

function loadTypeScriptModule(source, requireImpl, consoleImpl = console, fetchImpl = globalThis.fetch) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  Function("module", "exports", "require", "console", "fetch", output)(
    compiledModule,
    compiledModule.exports,
    requireImpl,
    consoleImpl,
    fetchImpl,
  );
  return compiledModule.exports;
}

function createLogCapture() {
  const entries = [];
  const capture = (level) => (message, context) => {
    entries.push({ level, message, context });
  };

  return {
    entries,
    console: {
      log: capture("log"),
      warn: capture("warn"),
      error: capture("error"),
    },
  };
}

function buildAppointment() {
  return {
    id: APPOINTMENT_ID,
    shop_id: payload.shopId,
    guardian_id: payload.guardianId,
    pet_id: payload.petId,
    service_id: payload.serviceId,
    staff_id: payload.staffId,
    appointment_date: payload.appointmentDate,
    appointment_time: payload.appointmentTime,
    status: "confirmed",
    memo: "",
    staff_memo: payload.memo,
    rejection_reason: null,
    start_at: "2099-12-31T10:00:00.000Z",
    end_at: "2099-12-31T11:00:00.000Z",
    visit_reminder_offset_minutes: 10,
    pickup_ready_eta_minutes: 5,
    source: payload.source,
    created_at: "2099-01-01T00:00:00.000Z",
    updated_at: "2099-01-01T00:00:00.000Z",
  };
}

function createDatabaseClient(options = {}) {
  const calls = [];
  const notifications = [];
  let persistedAppointment = options.initialAppointment ?? null;

  return {
    calls,
    notifications,
    get persistedAppointment() {
      return persistedAppointment;
    },
    from(table) {
      calls.push({ kind: "from", table });
      return {
        insert(insertPayload) {
          calls.push({ kind: "insert", table, payload: insertPayload });
          return {
            select(columns) {
              calls.push({ kind: "select", table, columns });
              return {
                async single() {
                  calls.push({ kind: "single", table });
                  if (table === "appointments") {
                    if (options.appointmentInsertError) {
                      return { data: null, error: options.appointmentInsertError };
                    }
                    persistedAppointment = { ...insertPayload };
                    return { data: persistedAppointment, error: null };
                  }
                  if (table === "notifications") {
                    if (options.notificationInsertError) {
                      return { data: null, error: options.notificationInsertError };
                    }
                    const notification = { ...insertPayload };
                    notifications.unshift(notification);
                    return { data: notification, error: null };
                  }
                  throw new Error(`Unexpected insert table: ${table}`);
                },
              };
            },
          };
        },
        delete() {
          calls.push({ kind: "delete", table });
          throw new Error("A committed appointment must not be deleted during notification recovery.");
        },
      };
    },
  };
}

function createBootstrap(database) {
  return {
    mode: "supabase",
    shop: {
      id: payload.shopId,
      name: "Test Shop",
      notification_settings: {
        visit_reminder_offset_minutes: 10,
        pickup_ready_eta_minutes: 5,
      },
    },
    services: [{ id: payload.serviceId, name: "Test Service", duration_minutes: 60 }],
    staffMembers: [{ id: payload.staffId }],
    guardians: [
      {
        id: payload.guardianId,
        name: "Test Guardian",
        phone: SENSITIVE_PHONE,
        notification_settings: {},
      },
    ],
    pets: [{ id: payload.petId, name: "Test Pet", guardian_id: payload.guardianId }],
    appointments: database.persistedAppointment ? [database.persistedAppointment] : [],
    notifications: [...database.notifications],
  };
}

function countInserts(database, table) {
  return database.calls.filter((call) => call.kind === "insert" && call.table === table).length;
}

function assertNoSensitiveLogs(entries) {
  const serialized = JSON.stringify(entries);
  for (const sensitiveValue of [SENSITIVE_SECRET, SENSITIVE_TOKEN, SENSITIVE_PHONE, SENSITIVE_LINK]) {
    assert.equal(serialized.includes(sensitiveValue), false, `logs exposed ${sensitiveValue}`);
  }

  const operationalEntries = entries.filter(
    (entry) =>
      entry.message.startsWith("[notification-dispatch]") ||
      entry.message.startsWith("[alimtalk-provider]") ||
      entry.message.startsWith("[appointments-api] notification") ||
      entry.message.startsWith("[appointments-api] P1 notification"),
  );
  const allowedKeys = new Set(["appointmentId", "notificationType", "reason", "code"]);
  for (const entry of operationalEntries) {
    assert.deepEqual(
      Object.keys(entry.context ?? {}).filter((key) => !allowedKeys.has(key)),
      [],
      `unsafe operational log fields in ${entry.message}`,
    );
  }
}

function createHarness(options = {}) {
  const database = createDatabaseClient(options);
  const logCapture = createLogCapture();
  let providerCalls = 0;
  const getBootstrap = async () => createBootstrap(database);
  const utils = {
    addDate: (date) => date,
    formatClockTime: (time) => time,
    minutesFromTime: (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    },
    nowIso: () => "2099-01-01T00:00:00.000Z",
    phoneNormalize: (value) => value.replace(/\D/g, ""),
    shortDate: (date) => date,
    timeFromMinutes: (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
  };

  const capacityModule = loadTypeScriptModule(capacitySource, () => ({}), logCapture.console);
  const notificationDispatchModule = loadTypeScriptModule(
    notificationDispatchSource,
    (specifier) => {
      if (specifier === "node:crypto") return { randomUUID: () => "notification-id" };
      if (specifier === "@/lib/notification-registry") {
        return {
          getAlimtalkTemplateAlias: () => "approved-template",
          shouldSendByGuardianSettings: () => true,
          shouldSendByShopSettings: () => true,
        };
      }
      if (specifier === "@/lib/server-env") {
        return {
          hasAlimtalkServerEnv: () => true,
          hasSupabaseServerEnv: () => true,
          resolveAlimtalkTemplateKey: (value) => value,
          serverEnv: {
            alimtalkProvider: "ssodaa",
            alimtalkRelayUrl: null,
            alimtalkRelaySecret: null,
          },
        };
      }
      if (specifier === "@/lib/supabase/server") return { getSupabaseAdmin: () => database };
      if (specifier === "@/lib/utils") return utils;
      if (specifier === "@/server/alimtalk-template-overrides") {
        return { renderNotificationTemplateBodyWithOverrides: async () => "safe test message" };
      }
      if (specifier === "@/server/booking-access-token") {
        return {
          buildBookingEntryUrl: () => "https://sensitive.example/booking",
          buildBookingManageUrl: () => SENSITIVE_LINK,
          createBookingAccessToken: () => {
            if (options.preparationFailure) {
              throw new Error(`Missing secret ${SENSITIVE_SECRET}`);
            }
            return SENSITIVE_TOKEN;
          },
        };
      }
      if (specifier === "@/server/bootstrap") return { getBootstrap };
      if (specifier === "@/server/mock-store") {
        return { getMockStore: () => ({ notifications: [] }), setMockStore() {} };
      }
      if (specifier === "@/server/alimtalk-provider") {
        return {
          sendAlimtalkMessage: async () => {
            providerCalls += 1;
            if (options.providerFailure) {
              throw new Error(`provider rejected ${SENSITIVE_SECRET} ${SENSITIVE_PHONE} ${SENSITIVE_LINK}`);
            }
            return {
              provider: "test-provider",
              providerMessageId: "provider-message-id",
              responseBody: { ok: true },
            };
          },
        };
      }
      throw new Error(`Unexpected notification dependency: ${specifier}`);
    },
    logCapture.console,
  );

  const ownerMutationsModule = loadTypeScriptModule(
    ownerMutationsSource,
    (specifier) => {
      if (specifier === "node:crypto") return { randomUUID: () => APPOINTMENT_ID };
      if (specifier === "@/lib/availability") return { computeAvailableSlots: () => [payload.appointmentTime] };
      if (specifier === "@/lib/notification-settings") {
        return {
          coerceEnabledShopNotificationSettings: (value) => value,
          defaultGuardianNotificationSettings: {},
          normalizeBootstrapNotifications: (value) => value,
        };
      }
      if (specifier === "@/lib/server-env") return { hasSupabaseServerEnv: () => true };
      if (specifier === "@/lib/supabase/server") return { getSupabaseAdmin: () => database };
      if (specifier === "@/lib/utils") return utils;
      if (specifier === "@/server/appointment-capacity") return capacityModule;
      if (specifier === "@/server/bootstrap") return { getBootstrap };
      if (specifier === "@/server/mock-store") return { getMockStore: () => ({}), setMockStore() {} };
      if (specifier === "@/server/notification-dispatch") return notificationDispatchModule;
      if (specifier === "@/server/schemas") {
        return { appointmentInputSchema: { parse: (value) => value } };
      }
      throw new Error(`Unexpected owner mutation dependency: ${specifier}`);
    },
    logCapture.console,
  );

  class OwnerApiError extends Error {}
  const appointmentsRouteModule = loadTypeScriptModule(
    appointmentsRouteSource,
    (specifier) => {
      if (specifier === "next/server") {
        return {
          NextResponse: {
            json(body, init) {
              return { body, status: init?.status ?? 200 };
            },
          },
        };
      }
      if (specifier === "@/server/bootstrap") return { getBootstrap };
      if (specifier === "@/server/owner-api-auth") {
        return { OwnerApiError, requireOwnerShop: async () => ({ shopId: payload.shopId }) };
      }
      if (specifier === "@/server/owner-mutations") return ownerMutationsModule;
      throw new Error(`Unexpected appointment route dependency: ${specifier}`);
    },
    logCapture.console,
  );

  return {
    database,
    entries: logCapture.entries,
    notificationDispatchModule,
    get providerCalls() {
      return providerCalls;
    },
    postAppointment: () => appointmentsRouteModule.POST({ json: async () => payload }),
  };
}

test("a reservation failure before commit remains a failed request and never calls the provider", async () => {
  const harness = createHarness({
    appointmentInsertError: { code: "XX000", message: "precommit appointment insert failed" },
  });

  const response = await harness.postAppointment();

  assert.equal(response.status, 400);
  assert.equal(harness.database.persistedAppointment, null);
  assert.equal(harness.providerCalls, 0);
  assert.equal(countInserts(harness.database, "appointments"), 1);
  assert.equal(countInserts(harness.database, "notifications"), 0);
  assertNoSensitiveLogs(harness.entries);
});

test("a post-commit booking secret preparation failure keeps the reservation and never calls the provider", async () => {
  const harness = createHarness({ preparationFailure: true });

  const response = await harness.postAppointment();

  assert.equal(response.status, 200);
  assert.equal(harness.database.persistedAppointment.id, APPOINTMENT_ID);
  assert.equal(harness.providerCalls, 0);
  assert.equal(countInserts(harness.database, "notifications"), 0);
  assert.deepEqual(
    harness.entries.filter((entry) => entry.level === "warn"),
    [
      {
        level: "warn",
        message: "[appointments-api] notification dispatch failed after appointment commit",
        context: {
          appointmentId: APPOINTMENT_ID,
          notificationType: "booking_confirmed",
          reason: "dispatch_failed",
          code: "NOTIFICATION_DISPATCH_FAILED_AFTER_APPOINTMENT_COMMIT",
        },
      },
    ],
  );
  assertNoSensitiveLogs(harness.entries);
});

test("a provider failure keeps the reservation and persists an explicit failed ledger row", async () => {
  const harness = createHarness({ providerFailure: true });

  const response = await harness.postAppointment();

  assert.equal(response.status, 200);
  assert.equal(harness.providerCalls, 1);
  assert.equal(harness.database.notifications.length, 1);
  assert.equal(harness.database.notifications[0].status, "failed");
  assert.equal(harness.database.notifications[0].fail_reason, "ALIMTALK_PROVIDER_FAILED");
  assert.equal(countInserts(harness.database, "notifications"), 1);
  assert.equal(harness.entries.some((entry) => entry.level === "error" || entry.level === "warn"), false);
  assertNoSensitiveLogs(harness.entries);
});

test("dispatch exposes a structured no-retry error when provider success is followed by ledger failure", async () => {
  const harness = createHarness({
    initialAppointment: buildAppointment(),
    notificationInsertError: {
      code: "XX001",
      message: `ledger failed ${SENSITIVE_SECRET} ${SENSITIVE_PHONE} ${SENSITIVE_LINK}`,
    },
  });

  await assert.rejects(
    () =>
      harness.notificationDispatchModule.dispatchNotification({
        shopId: payload.shopId,
        appointmentId: APPOINTMENT_ID,
        guardianId: GUARDIAN_ID,
        petId: PET_ID,
        type: "booking_confirmed",
      }),
    (error) => {
      assert.equal(error instanceof harness.notificationDispatchModule.NotificationLedgerPersistenceError, true);
      assert.equal(error.code, "NOTIFICATION_PROVIDER_SUCCEEDED_LEDGER_PERSIST_FAILED");
      assert.equal(error.providerSucceeded, true);
      assert.equal(error.ledgerPersisted, false);
      assert.equal(error.automaticRetryAllowed, false);
      assert.equal(error.appointmentId, APPOINTMENT_ID);
      assert.equal(error.notificationType, "booking_confirmed");
      return true;
    },
  );

  assert.equal(harness.providerCalls, 1);
  assert.equal(countInserts(harness.database, "notifications"), 1);
  assert.equal(harness.database.notifications.length, 0);
  assertNoSensitiveLogs(harness.entries);
});

test("owner booking stays successful and emits the distinct P1 trace without automatic resend", async () => {
  const harness = createHarness({
    notificationInsertError: {
      code: "XX001",
      message: `ledger failed ${SENSITIVE_SECRET} ${SENSITIVE_PHONE} ${SENSITIVE_LINK}`,
    },
  });

  const response = await harness.postAppointment();

  assert.equal(response.status, 200);
  assert.equal(response.body.id, APPOINTMENT_ID);
  assert.equal(harness.database.persistedAppointment.id, APPOINTMENT_ID);
  assert.equal(harness.providerCalls, 1);
  assert.equal(countInserts(harness.database, "notifications"), 1);
  assert.equal(harness.database.notifications.length, 0);
  assert.deepEqual(
    harness.entries.filter((entry) => entry.level === "error"),
    [
      {
        level: "error",
        message: "[appointments-api] P1 notification ledger persistence failed after provider success",
        context: {
          appointmentId: APPOINTMENT_ID,
          notificationType: "booking_confirmed",
          reason: "provider_succeeded_ledger_persist_failed_no_retry",
          code: "NOTIFICATION_PROVIDER_SUCCEEDED_LEDGER_PERSIST_FAILED",
        },
      },
    ],
  );
  assert.equal(harness.entries.some((entry) => entry.level === "warn"), false);
  assertNoSensitiveLogs(harness.entries);
});

test("provider success with ledger success preserves the existing sent result", async () => {
  const harness = createHarness();

  const response = await harness.postAppointment();

  assert.equal(response.status, 200);
  assert.equal(harness.providerCalls, 1);
  assert.equal(harness.database.notifications.length, 1);
  assert.equal(harness.database.notifications[0].status, "sent");
  assert.equal(harness.database.notifications[0].provider_message_id, "provider-message-id");
  assert.equal(countInserts(harness.database, "notifications"), 1);
  assert.equal(harness.entries.some((entry) => entry.level === "error" || entry.level === "warn"), false);
  assertNoSensitiveLogs(harness.entries);
});

test("provider relay diagnostics never log secret, token, phone, link, message, or raw response body", async () => {
  const logCapture = createLogCapture();
  let fetchCalls = 0;
  const providerModule = loadTypeScriptModule(
    alimtalkProviderSource,
    (specifier) => {
      if (specifier === "@/lib/server-env") {
        return {
          serverEnv: {
            alimtalkRelayUrl: `https://relay.example/send?token=${SENSITIVE_TOKEN}`,
            alimtalkRelaySecret: SENSITIVE_SECRET,
          },
        };
      }
      throw new Error(`Unexpected provider dependency: ${specifier}`);
    },
    logCapture.console,
    async () => {
      fetchCalls += 1;
      return {
        ok: false,
        status: 502,
        headers: { get: () => "application/json" },
        json: async () => ({
          error: `relay rejected ${SENSITIVE_SECRET} ${SENSITIVE_PHONE} ${SENSITIVE_LINK}`,
        }),
      };
    },
  );

  await assert.rejects(() =>
    providerModule.sendAlimtalkMessage({
      to: SENSITIVE_PHONE,
      message: `sensitive message ${SENSITIVE_LINK}`,
      appointmentId: APPOINTMENT_ID,
      notificationType: "booking_confirmed",
      templateAlias: "approved-template",
      metadata: { secret: SENSITIVE_SECRET },
    }),
  );

  assert.equal(fetchCalls, 1);
  assertNoSensitiveLogs(logCapture.entries);
});
