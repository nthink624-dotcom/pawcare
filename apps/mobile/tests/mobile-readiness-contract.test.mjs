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
  assert.doesNotMatch(observability, /authorization|accessToken|refreshToken|phone|email/i);
});

test("mobile media provider honors an explicit Supabase selection in production", async () => {
  const storage = await read("src/server/media-storage.ts");
  const ownerMedia = await read("src/server/owner-media-service.ts");

  assert.match(storage, /configured === "supabase"\) return "supabase"/);
  assert.match(storage, /!configured && process\.env\.VERCEL_ENV === "production"/);
  assert.match(storage, /explicitProvider/);
  assert.match(storage, /getMediaStorageProviderForPath\(input\.path\) === "r2"/);
  assert.match(ownerMedia, /lifecyclePrefix\}\/\$\{params\.storageProvider\}/);
});
