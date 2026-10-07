import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(mobileRoot, "../..");

async function read(root, relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Samsung's native call UI stays in control; CatchCall does not register a dialer or fullscreen call UI", async () => {
  const manifest = await read(mobileRoot, "android/app/src/main/AndroidManifest.xml");
  const screening = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningService.java");
  const plugin = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningPlugin.java");

  assert.match(manifest, /android\.telecom\.CallScreeningService/);
  assert.doesNotMatch(manifest, /android\.telecom\.InCallService|OwnerDialerActivity|OwnerIncomingCallActivity|USE_FULL_SCREEN_INTENT/);
  assert.ok(screening.indexOf("respondToCall(callDetails, response)") < screening.indexOf("handleIncoming(this, callerNumber)"));
  assert.doesNotMatch(screening, /OwnerInCallService\.isDefaultDialer/);
  assert.match(screening, /OwnerCallNotification\.showIncoming\(context, providerCallId, callerNumber\)/);
  assert.doesNotMatch(screening, /startActivity\(/);
  assert.doesNotMatch(plugin, /requestDialerRole|requestFullScreenIntentAccess|answerIncomingCall|endIncomingCall/);
});

test("registered caller notification offers reservation or phone-only; phone-only never launches PetManager", async () => {
  const notification = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallNotification.java");
  const receiver = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallActionReceiver.java");
  const plugin = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningPlugin.java");
  const phoneOnlyBranch = receiver.slice(
    receiver.indexOf("if (OwnerCallNotification.ACTION_DISMISS.equals(action))"),
    receiver.indexOf("if (OwnerCallNotification.ACTION_ADD_RESERVATION.equals(action))"),
  );

  assert.match(notification, /if \(registeredCaller\)[\s\S]*?"예약 추가"[\s\S]*?"전화만 받기"/);
  assert.match(notification, /catch-call-incoming-v3/);
  assert.match(notification, /channel\.setSound\(null, null\)[\s\S]*?channel\.enableVibration\(false\)/);
  assert.match(notification, /setAction\(ACTION_DISMISS\)[\s\S]*?putExtra\(EXTRA_PROVIDER_CALL_ID, providerCallId\)/);
  assert.match(receiver, /enqueueChoice\(appContext, providerCallId, "phone_only_selected"\)/);
  assert.doesNotMatch(phoneOnlyBranch, /startActivity\(/);
  assert.doesNotMatch(receiver, /OwnerCallControl\.answer|OwnerCallControl\.end/);
  assert.match(plugin, /queueAndSendChoice\(getContext\(\), providerCallId, "reservation_selected"\)/);
});

test("choice uploads are queued, ordered after call events, owner-scoped, idempotent, and contain no phone data", async () => {
  const store = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningStore.java");
  const transport = await read(mobileRoot, "android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java");
  const sync = await read(mobileRoot, "src/lib/owner-call-screening.ts");
  const route = await read(mobileRoot, "src/app/api/owner/call-events/android/choices/route.ts");
  const migration = await read(repoRoot, "supabase/migrations/20261005113145_catch_call_action_log.sql");

  assert.match(store, /static synchronized JSONArray enqueueChoice/);
  assert.match(store, /writeArray\(context, CHOICES_KEY, next\)/);
  assert.doesNotMatch(store.slice(store.indexOf("static synchronized JSONArray enqueueChoice"), store.indexOf("static synchronized JSONArray getPendingChoices")), /callerNumber/);
  assert.match(transport, /\/api\/owner\/call-events\/android\/choices/);
  assert.match(sync, /\/api\/owner\/call-events\/android\/events[\s\S]*?getPendingChoices\(\)[\s\S]*?\/api\/owner\/call-events\/android\/choices/);
  assert.match(route, /requireOwnerShop\(request, body\.shopId\)/);
  assert.match(route, /provider_event_id", `\$\{body\.providerCallId\}:incoming`/);
  assert.match(route, /match_status !== "matched"/);
  assert.match(route, /\.from\("call_event_actions"\)[\s\S]*?\.insert\(/);
  assert.doesNotMatch(route, /callerNumber|phoneFingerprint|phoneTail/);
  assert.match(migration, /action in \('reservation_selected', 'phone_only_selected'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.call_event_actions from public, anon, authenticated/);
  assert.match(migration, /unique references public\.call_events\(id\)/);
});
