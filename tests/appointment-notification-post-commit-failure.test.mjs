import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const [capacitySource, ownerMutationsSource, appointmentsRouteSource] = await Promise.all([
  readFile(new URL("../src/server/appointment-capacity.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server/owner-mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/api/appointments/route.ts", import.meta.url), "utf8"),
]);

function loadTypeScriptModule(source, requireImpl, consoleImpl = console) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  Function("module", "exports", "require", "console", output)(
    compiledModule,
    compiledModule.exports,
    requireImpl,
    consoleImpl,
  );
  return compiledModule.exports;
}

function createDatabaseClient() {
  const calls = [];
  let persistedAppointment = null;

  return {
    calls,
    get persistedAppointment() {
      return persistedAppointment;
    },
    from(table) {
      calls.push({ kind: "from", table });
      return {
        insert(payload) {
          calls.push({ kind: "insert", payload });
          persistedAppointment = { ...payload };
          return {
            select(columns) {
              calls.push({ kind: "select", columns });
              return {
                async single() {
                  calls.push({ kind: "single" });
                  return { data: persistedAppointment, error: null };
                },
              };
            },
          };
        },
        delete() {
          calls.push({ kind: "delete" });
          throw new Error("A committed appointment must not be deleted after notification failure.");
        },
      };
    },
  };
}

test("POST keeps the committed appointment successful when booking-link notification preparation fails", async () => {
  const capacityModule = loadTypeScriptModule(capacitySource, () => ({}));
  const database = createDatabaseClient();
  const warnings = [];
  let notificationAttempts = 0;
  const safeConsole = {
    log() {},
    warn(message, context) {
      warnings.push({ message, context });
    },
  };
  const payload = {
    shopId: "test-shop",
    guardianId: "20000000-0000-4000-8000-000000000001",
    petId: "30000000-0000-4000-8000-000000000001",
    serviceId: "test-service",
    staffId: "test-staff",
    appointmentDate: "2099-12-31",
    appointmentTime: "10:00",
    memo: "test-only",
    source: "owner",
  };
  const bootstrap = {
    mode: "supabase",
    shop: {
      notification_settings: {
        visit_reminder_offset_minutes: 10,
        pickup_ready_eta_minutes: 5,
      },
    },
    services: [{ id: payload.serviceId, duration_minutes: 60 }],
    staffMembers: [{ id: payload.staffId }],
    appointments: [],
  };

  const ownerMutationsModule = loadTypeScriptModule(
    ownerMutationsSource,
    (specifier) => {
      if (specifier === "node:crypto") return { randomUUID: () => "10000000-0000-4000-8000-000000000001" };
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
      if (specifier === "@/lib/utils") {
        return {
          addDate: (date) => date,
          minutesFromTime: (time) => {
            const [hours, minutes] = time.split(":").map(Number);
            return hours * 60 + minutes;
          },
          nowIso: () => "2099-01-01T00:00:00.000Z",
          timeFromMinutes: (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
        };
      }
      if (specifier === "@/server/appointment-capacity") return capacityModule;
      if (specifier === "@/server/bootstrap") return { getBootstrap: async () => bootstrap };
      if (specifier === "@/server/mock-store") return { getMockStore: () => ({}), setMockStore() {} };
      if (specifier === "@/server/notification-dispatch") {
        class NotificationLedgerPersistenceError extends Error {}
        return {
          NotificationLedgerPersistenceError,
          dispatchNotification: async () => {
            notificationAttempts += 1;
            throw new Error("BOOKING_ACCESS_SECRET server configuration is missing");
          },
        };
      }
      if (specifier === "@/server/schemas") {
        return { appointmentInputSchema: { parse: (value) => value } };
      }
      throw new Error(`Unexpected owner mutation dependency: ${specifier}`);
    },
    safeConsole,
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
      if (specifier === "@/server/bootstrap") return { getBootstrap: async () => bootstrap };
      if (specifier === "@/server/owner-api-auth") {
        return { OwnerApiError, requireOwnerShop: async () => ({ shopId: payload.shopId }) };
      }
      if (specifier === "@/server/owner-mutations") return ownerMutationsModule;
      throw new Error(`Unexpected appointment route dependency: ${specifier}`);
    },
    safeConsole,
  );

  const response = await appointmentsRouteModule.POST({ json: async () => payload });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "10000000-0000-4000-8000-000000000001");
  assert.equal(response.body.status, "confirmed");
  assert.equal(database.persistedAppointment.id, response.body.id);
  assert.equal(database.calls.filter((call) => call.kind === "insert").length, 1);
  assert.equal(database.calls.filter((call) => call.kind === "delete").length, 0);
  assert.equal(notificationAttempts, 1);
  assert.deepEqual(
    database.calls.map((call) => call.kind),
    ["from", "insert", "select", "single"],
  );
  assert.deepEqual(warnings, [
    {
      message: "[appointments-api] notification dispatch failed after appointment commit",
      context: {
        appointmentId: response.body.id,
        notificationType: "booking_confirmed",
        reason: "dispatch_failed",
        code: "NOTIFICATION_DISPATCH_FAILED_AFTER_APPOINTMENT_COMMIT",
      },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(warnings), /BOOKING_ACCESS_SECRET|server configuration is missing/);
});
