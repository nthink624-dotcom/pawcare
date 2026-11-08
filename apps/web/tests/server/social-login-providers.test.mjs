import assert from "node:assert/strict";
import { mock, test } from "node:test";

let external = { google: false, kakao: false };
let customEnabled = false;
let customError = null;
let settingsStatus = 200;
let unsafe = false;

mock.module(new URL("../../src/lib/server-env.ts", import.meta.url).href, { namedExports: { serverEnv: { supabaseUrl: "https://fixture.invalid", supabasePublishableKey: "fixture-publishable" } } });
mock.module(new URL("../../src/lib/supabase/server.ts", import.meta.url).href, { namedExports: {
  getSupabaseAuthClient: () => { if (unsafe) throw new Error("environment blocked"); return {}; },
  getSupabaseAdmin: () => ({ auth: { admin: { customProviders: { getProvider: async (id) => {
    assert.equal(id, "custom:naver");
    return { data: { enabled: customEnabled, client_secret: "fixture-must-not-leak" }, error: customError };
  } } } } }),
} });
const { GET } = await import("../../src/app/api/auth/social/providers/route.ts");
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://fixture.invalid/auth/v1/settings");
  assert.equal(options.headers.apikey, "fixture-publishable");
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
  return Response.json({ external }, { status: settingsStatus });
};

test("provider availability exposes only booleans and preserves environment guards", async (t) => {
  await t.test("disabled providers have no fabricated readiness", async () => {
    const result = await GET();
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(await result.json(), { naver: false, kakao: false, google: false });
  });
  await t.test("enabled custom/native providers are read back without secrets", async () => {
    customEnabled = true; external = { google: true, kakao: true };
    assert.deepEqual(await (await GET()).json(), { naver: true, kakao: true, google: true });
  });
  await t.test("custom lookup failure remains disabled", async () => {
    customError = new Error("not found");
    assert.deepEqual(await (await GET()).json(), { naver: false, kakao: true, google: true });
  });
  await t.test("provider and environment errors return service unavailable without raw diagnostics", async () => {
    settingsStatus = 503;
    assert.equal((await GET()).status, 503);
    settingsStatus = 200; unsafe = true;
    const result = await GET();
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { message: "소셜 로그인 설정을 확인하지 못했습니다." });
  });
});
