import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(mobileRoot, relativePath), "utf8");
}

test("registered-call notification offers reservation or phone-only without opening PetManager for phone-only", async () => {
  const notification = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallNotification.java");
  const receiver = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallActionReceiver.java");
  const reservationFlow = notification.slice(
    notification.indexOf("static void showReservationReady"),
    notification.indexOf("static void showNewCustomer"),
  );

  assert.match(reservationFlow, /new Intent\(context, MainActivity\.class\)[\s\S]*?setAction\(ACTION_ADD_RESERVATION\)/);
  assert.match(reservationFlow, /new Intent\(context, OwnerCallActionReceiver\.class\)[\s\S]*?setAction\(ACTION_DISMISS\)/);
  assert.match(reservationFlow, /PendingIntent\.getBroadcast\([\s\S]*?dismissIntent/);
  assert.match(reservationFlow, /addAction\(new NotificationCompat\.Action\.Builder\(0, "예약 접수", reservationPendingIntent\)/);
  assert.match(reservationFlow, /addAction\(new NotificationCompat\.Action\.Builder\(0, "전화만 받기", dismissPendingIntent\)/);
  assert.match(receiver, /getIntExtra\(EXTRA_NOTIFICATION_ID[\s\S]*?OwnerCallNotification\.cancel\(context, notificationId\)/);
  assert.doesNotMatch(receiver, /startActivity\(/);
});

test("incoming-call screening allows the native phone UI before background capture and notification", async () => {
  const service = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningService.java");
  const transport = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java");

  assert.ok(service.indexOf("respondToCall(callDetails, response)") < service.indexOf("handleIncoming(this, callerNumber)"));
  assert.match(service, /new Thread\(\(\) -> OwnerCallScreeningTransport\.sendOrQueue/);
  assert.match(service, /OwnerCallNotification\.showReservationReady/);
  assert.doesNotMatch(service, /startActivity\(/);
  assert.match(transport, /\/api\/owner\/call-events\/android\/events/);
  assert.match(transport, /OwnerCallScreeningStore\.enqueue\(context, event\)/);
});

test("owner notification choices are queued locally and uploaded without storing caller numbers", async () => {
  const notification = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallNotification.java");
  const receiver = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallActionReceiver.java");
  const store = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningStore.java");
  const plugin = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningPlugin.java");
  const transport = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java");
  const sync = await read("src/lib/owner-call-screening.ts");

  assert.match(notification, /dismissIntent[\s\S]*?putExtra\(EXTRA_PROVIDER_CALL_ID, providerCallId\)/);
  assert.match(receiver, /enqueueChoice\(appContext, providerCallId, "phone_only_selected"\)/);
  assert.match(plugin, /queueAndSendChoice\(getContext\(\), providerCallId, "reservation_selected"\)/);
  assert.match(store, /static synchronized JSONArray enqueueChoice/);
  assert.match(store, /choice\.put\("shopId"[\s\S]*?choice\.put\("action"/);
  assert.match(store, /writeArray\(context, CHOICES_KEY, next\)/);
  assert.match(transport, /\/api\/owner\/call-events\/android\/choices/);
  assert.match(sync, /getPendingChoices\(\)[\s\S]*?\/api\/owner\/call-events\/android\/choices[\s\S]*?acknowledgeChoices/);
  assert.doesNotMatch(store.slice(store.indexOf("static synchronized JSONArray enqueueChoice"), store.indexOf("static synchronized JSONArray getPendingChoices")), /callerNumber/);
});

test("choice endpoint is owner-scoped, matched-call-only, idempotent, and excludes phone payloads", async () => {
  const route = await read("src/app/api/owner/call-events/android/choices/route.ts");
  const migration = await read("../../supabase/migrations/20261005111548_catch_call_action_log.sql");

  assert.match(route, /requireOwnerShop\(request, body\.shopId\)/);
  assert.match(route, /provider_event_id", `\$\{body\.providerCallId\}:incoming`/);
  assert.match(route, /match_status !== "matched"/);
  assert.match(route, /\.from\("call_event_actions"\)[\s\S]*?\.insert\(/);
  assert.match(route, /\.select\("id,action"\)[\s\S]*?\.eq\("call_event_id"/);
  assert.doesNotMatch(route, /callerNumber|phoneFingerprint|phoneTail/);
  assert.match(migration, /action in \('reservation_selected', 'phone_only_selected'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.call_event_actions from public, anon, authenticated/);
  assert.match(migration, /unique references public\.call_events\(id\)/);
});
