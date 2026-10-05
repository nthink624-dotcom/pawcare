import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("CatchCall migration links one call event to one appointment without raw phone data", async () => {
  const migration = await read("../../supabase/migrations/20260926130000_catch_call_reservation_flow.sql");
  assert.match(migration, /appointment_id uuid references public\.appointments/i);
  assert.match(migration, /reservation_status text not null default 'not_started'/i);
  assert.match(migration, /'in_progress', 'confirmed', 'failed'/i);
  assert.match(migration, /notification_status text not null default 'not_requested'/i);
  assert.match(migration, /call_events_appointment_id_idx/i);
  assert.match(migration, /source in \('customer', 'owner', 'catchcall'\)/i);
  assert.doesNotMatch(migration, /caller_number|raw_phone|recording|transcript/i);
});

test("owner mobile opens CatchCall onboarding once when Android screening is available", async () => {
  const app = await read("../../apps/mobile/src/components/owner/owner-app.tsx");
  assert.match(app, /petmanager:catchcall-onboarding:\$\{data\.shop\.id\}/);
  assert.match(app, /isOwnerCallScreeningAvailable\(\)/);
  assert.match(app, /getOwnerCallScreeningStatus\(\)/);
  assert.match(app, /setActiveTab\("settings"\)/);
  assert.match(app, /setSettingsEntryScreen\("catchcall"\)/);
  assert.match(app, /status\.enabled/);
  assert.doesNotMatch(app, /status\.callLogGranted/);
});

test("Android automatic CatchCall adapter allows calls before asynchronous upload", async () => {
  const manifest = await read("../../apps/mobile/android/app/src/main/AndroidManifest.xml");
  const service = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningService.java");
  const inCallService = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerInCallService.java");
  const receiver = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallStateReceiver.java");
  const plugin = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningPlugin.java");
  const store = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningStore.java");
  const notification = await read("../../apps/mobile/android/app/src/main/java/kr/petmanager/owner/OwnerCallNotification.java");
  assert.match(manifest, /android\.telecom\.CallScreeningService/);
  assert.match(manifest, /android\.intent\.action\.PHONE_STATE/);
  assert.doesNotMatch(manifest, /android\.permission\.READ_CALL_LOG/);
  assert.match(service, /respondToCall\(callDetails, response\)/);
  assert.match(service, /setDisallowCall\(false\)/);
  assert.match(service, /createIncomingEvent/);
  assert.match(receiver, /STATE_RINGING/);
  assert.match(inCallService, /call\.getDetails\(\)\.getHandle\(\)/);
  assert.match(store, /activeProviderCallId/);
  assert.match(receiver, /answered \? "ended" : "missed"/);
  assert.match(receiver, /event\.put\("eventType", eventType\)/);
  assert.match(plugin, /response\.put\("active", OwnerCallScreeningStore\.isEnabled/);
  assert.match(plugin, /public void setEnabled/);
  assert.match(store, /callCaptureEnabled/);
  assert.match(store, /AES\/GCM\/NoPadding/);
  assert.match(notification, /setOngoing\(false\)/);
  assert.match(notification, /전화만 받기/);
  assert.doesNotMatch(receiver, /OwnerCallNotification\.cancel\(context, providerCallId\)/);
  assert.doesNotMatch(service, /System\.out|Log\.d|Log\.i/);
});

test("Android event route finalizes ended events through the shared notification contract", async () => {
  const route = await read("../../apps/mobile/src/app/api/owner/call-events/android/events/route.ts");
  const helper = await read("../../apps/mobile/src/server/catch-call.ts");
  assert.match(route, /finalizeCatchCallEndedEvent/);
  assert.match(route, /body\.eventType !== "ended"/);
  assert.match(route, /metadata\?\.providerCallId/);
  assert.match(helper, /metadata->>providerCallId/);
  assert.match(helper, /dispatchCatchCallReservationNotification/);
});

test("CatchCall reservation route requires a matched event and is replay-safe", async () => {
  const route = await read("src/app/api/owner/call-events/[eventId]/reservation/route.ts");
  assert.match(route, /match_status !== "matched"/);
  assert.match(route, /source: "catchcall"/);
  assert.match(route, /event\.appointment_id/);
  assert.match(route, /is\("appointment_id", null\)/);
  assert.match(route, /event\.event_type === "ended"/);
  assert.match(route, /notification_status === "failed"/);
  assert.match(route, /dispatchCatchCallReservationNotification/);
  assert.doesNotMatch(route, /callerNumber|phoneNumber|recording|transcript/i);
});

test("ended provider event finalizes the linked CatchCall reservation once", async () => {
  const webhook = await read("src/app/api/webhooks/calls/[integrationId]/route.ts");
  const helper = await read("src/server/catch-call.ts");
  assert.match(webhook, /finalizeCatchCallEndedEvent/);
  assert.match(webhook, /eventType === "ended"/);
  assert.match(helper, /metadata->>providerCallId/);
  assert.match(helper, /currentStatus === "sent"/);
  assert.match(helper, /skipIfExists: true/);
});

test("mobile creation does not send the normal create-time notification for CatchCall", async () => {
  const source = await read("../../apps/mobile/src/server/owner-mutations.ts");
  assert.match(source, /appointment\.source !== "catchcall"/);
  assert.match(source, /createdAppointment\.source !== "catchcall"/);
});

test("mobile CatchCall APIs expose the shared event feed and reservation write", async () => {
  const eventsRoute = await read("../../apps/mobile/src/app/api/owner/call-events/route.ts");
  const reservationRoute = await read("../../apps/mobile/src/app/api/owner/call-events/[eventId]/reservation/route.ts");
  assert.match(eventsRoute, /notification_status/);
  assert.match(eventsRoute, /matchedGuardian/);
  assert.match(reservationRoute, /source: "catchcall"/);
  assert.match(reservationRoute, /event\.event_type === "ended"/);
});

test("mobile CatchCall UI keeps the reservation flow and phone privacy visible", async () => {
  const panel = await read("../../apps/mobile/src/components/owner/owner-catch-call-panel.tsx");
  assert.match(panel, /\/api\/owner\/call-events\?shopId=/);
  assert.match(panel, /\/api\/owner\/call-events\/\$\{selectedEvent\.id\}\/reservation/);
  assert.match(panel, /미확인 번호 · 끝 4자리 \$\{event\.phoneTail\}/);
  assert.match(panel, /configureOwnerCallScreening/);
  assert.doesNotMatch(panel, /requestOwnerCallLogAccess|callLogGranted/);
  assert.match(panel, /캐치콜/);
});
