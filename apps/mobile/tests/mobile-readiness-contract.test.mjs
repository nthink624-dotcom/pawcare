import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile health endpoint is a no-store liveness check without database access", async () => {
  const route = await read("src/app/api/healthz/route.ts");
  const observability = await read("src/lib/observability.ts");

  assert.match(route, /getRequestId/);
  assert.match(route, /getReleaseId/);
  assert.match(route, /x-request-id/);
  assert.match(route, /requestId/);
  assert.match(route, /release/);
  assert.match(route, /status: "ok"/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /getSupabase|from\("/);
  assert.match(observability, /VERCEL_ENV === "production"/);
  assert.match(observability, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(observability, /headers\.get\("x-request-id"\)/);
  assert.match(observability, /"unknown"/);
});

test("mobile readiness endpoint checks Supabase and redacts operational errors", async () => {
  const route = await read("src/app/api/readyz/route.ts");
  const observability = await read("src/lib/observability.ts");

  assert.match(route, /getSupabaseAdmin/);
  assert.match(route, /await import\("@\/lib\/supabase\/server"\)/);
  assert.doesNotMatch(route, /import \{ getSupabaseAdmin \} from/);
  assert.match(route, /getRequestId/);
  assert.match(route, /getReleaseId/);
  assert.match(route, /x-request-id/);
  assert.match(route, /requestId/);
  assert.match(route, /release/);
  assert.match(route, /from\("shops"\)\.select\("id"\)\.limit\(1\)/);
  assert.match(route, /status: ready \? 200 : 503/);
  assert.match(route, /readiness\.supabase_query_failed/);
  assert.match(route, /AbortController/);
  assert.match(route, /abortSignal\(controller\.signal\)/);
  assert.match(route, /setTimeout\(\(\) => controller\.abort\(\), 2_000\)/);
  assert.doesNotMatch(route, /result\.error\.message|result\.data/);
  assert.match(observability, /SAFE_CONTEXT_KEYS/);
  assert.doesNotMatch(observability, /\"route\"/);
  assert.doesNotMatch(observability, /headers\.get\("x-request-id"\)/);
  assert.doesNotMatch(observability, /authorization|accessToken|refreshToken|phone|email/i);
});

test("mobile server and browser Supabase clients fail closed on production or unapproved remote DB refs", async () => {
  const [serverEnv, browserEnv] = await Promise.all([
    read("src/lib/server-env.ts"),
    read("src/lib/env.ts"),
  ]);

  for (const source of [serverEnv, browserEnv]) {
    assert.match(source, /runtimeStage === "production"[\s\S]*isPetManagerProductionSupabaseProject/);
    assert.match(source, /supabaseEnvName === "production"/);
    assert.match(source, /isRemoteSupabaseUrl\([\s\S]*!isAllowedDevSupabaseRef/);
    assert.match(source, /allowedDevSupabaseRefs/);
    assert.match(source, /allowProdSupabaseInDev/);
  }
});

test("production blocks temporary debug endpoints before reading data or contacting the relay", async () => {
  const [notificationAudit, alimtalkRelay] = await Promise.all([
    read("src/app/api/debug/notification-audit/route.ts"),
    read("src/app/api/debug/alimtalk-relay/route.ts"),
  ]);

  for (const [name, source, signature, sensitiveOperation] of [
    [
      "notification audit",
      notificationAudit,
      /export async function GET\(request: Request\) \{\s*if \(process\.env\.NODE_ENV === "production"\)/,
      /serverEnv\.alimtalkRelayUrl|serverEnv\.alimtalkRelaySecret|getBootstrap\(|fetchRelayDiagnostics\(/,
    ],
    [
      "Alimtalk relay diagnostic",
      alimtalkRelay,
      /export async function GET\(\) \{\s*if \(process\.env\.NODE_ENV === "production"\)/,
      /process\.env\.ALIMTALK_RELAY_URL|process\.env\.ALIMTALK_RELAY_SECRET|fetch\(/,
    ],
  ]) {
    const handlerStart = source.search(signature);
    assert.notEqual(handlerStart, -1, `${name} must reject production requests immediately`);
    const handler = source.slice(handlerStart);
    assert.match(handler, /return new Response\(null,\s*\{\s*status: 404/);
    const guardEnd = handler.search(/\n\s*}\s*/);
    const sensitiveIndex = handler.search(sensitiveOperation);
    assert.ok(guardEnd !== -1 && sensitiveIndex > guardEnd, `${name} must stop before sensitive work`);
  }
});

test("production blocks the mobile demo seed endpoint even when NODE_ENV is mis-set", async () => {
  const route = await read("src/app/api/dev/seed-demo/route.ts");

  assert.match(route, /process\.env\.NODE_ENV === "production" \|\| process\.env\.VERCEL_ENV === "production"/);
  assert.ok(route.indexOf("process.env.VERCEL_ENV === \"production\"") < route.indexOf("hasSupabaseServerEnv()"));
});

test("mobile server errors are persisted to the shared admin error inbox without raw details", async () => {
  const logger = await read("src/server/observability.ts");

  assert.match(logger, /project_name: "mobile"/);
  assert.match(logger, /event_name: eventName/);
  assert.match(logger, /release_id: releaseId/);
  assert.match(logger, /after\(/);
  assert.match(logger, /catch/);
  assert.doesNotMatch(logger, /error\.message|stack|requestId|phone|email|authorization|body/i);
});

test("disabled CatchCall keeps queued phone events local instead of syncing them", async () => {
  const source = await read("src/lib/owner-call-screening.ts");
  const sync = source.slice(source.indexOf("export async function syncOwnerCallScreeningEvents"));
  const transport = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningTransport.java");
  const plugin = await read("android/app/src/main/java/kr/petmanager/owner/OwnerCallScreeningPlugin.java");
  const setEnabled = plugin.slice(plugin.indexOf("public void setEnabled("), plugin.indexOf("@PermissionCallback", plugin.indexOf("public void setEnabled(")));

  assert.match(sync, /const status = await OwnerCallScreening\.getStatus\(\)/);
  assert.match(sync, /if \(!status\.enabled \|\| !status\.active\) return \{ sent: 0 \}/);
  assert.ok(sync.indexOf("if (!status.enabled || !status.active)") < sync.indexOf("getPendingEvents()"));
  assert.ok(sync.indexOf("if (!status.enabled || !status.active)") < sync.indexOf('fetchApiJsonWithAuth("/api/owner/call-events/android/events"'));
  assert.match(transport, /if \(!OwnerCallScreeningStore\.isEnabled\(context\)\) return;/);
  assert.match(setEnabled, /clearActiveCall\(getContext\(\)\)/);
  assert.match(setEnabled, /clearPendingReservationAction\(getContext\(\)\)/);
  assert.match(setEnabled, /clearPendingIncomingCallChoice\(getContext\(\)\)/);
});

test("mobile production media refuses Supabase or unsupported provider configuration", async () => {
  const storage = await read("src/server/media-storage.ts");
  const ownerMedia = await read("src/server/owner-media-service.ts");

  assert.match(storage, /configured && configured !== "r2" && configured !== "supabase"[\s\S]*MEDIA_STORAGE_PROVIDER must be set to r2/);
  assert.match(storage, /configured === "supabase"[\s\S]*if \(isProduction\)[\s\S]*Production media storage must use Cloudflare R2/);
  assert.match(storage, /!configured && isProduction/);
  assert.match(storage, /explicitProvider/);
  assert.match(storage, /getMediaStorageProviderForPath\(input\.path\) === "r2"/);
  assert.match(ownerMedia, /lifecyclePrefix\}\/\$\{params\.storageProvider\}/);
});
