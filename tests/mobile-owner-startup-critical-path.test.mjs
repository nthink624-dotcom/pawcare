import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const helperSource = await readFile(new URL("../src/lib/owner-mobile-startup.ts", import.meta.url), "utf8");
const helperJavascript = stripTypeScriptTypes(helperSource, { mode: "transform" });
const helperModuleUrl = `data:text/javascript;base64,${Buffer.from(helperJavascript).toString("base64")}`;
const {
  OwnerMobileStartupTimeoutError,
  loadOwnerMobileCriticalData,
  withOwnerMobileTimeout,
} = await import(helperModuleUrl);

const pageSource = await readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const shellSource = await readFile(new URL("../src/components/owner/owner-shell.tsx", import.meta.url), "utf8");

test("subscription starts alongside shops and each critical request runs once", async () => {
  const calls = [];
  const counts = { shops: 0, subscription: 0, bootstrap: 0 };
  const result = await loadOwnerMobileCriticalData({
    signal: new AbortController().signal,
    loadShops: async () => {
      counts.shops += 1;
      calls.push("shops");
      return [{ id: "shop-1" }];
    },
    loadSubscription: async () => {
      counts.subscription += 1;
      calls.push("subscription");
      return { status: "active" };
    },
    loadBootstrap: async (shopId) => {
      counts.bootstrap += 1;
      calls.push(`bootstrap:${shopId}`);
      return { shopId };
    },
    resolveShopId: (shops) => shops[0]?.id ?? null,
  });

  assert.deepEqual(calls, ["subscription", "shops", "bootstrap:shop-1"]);
  assert.deepEqual(counts, { shops: 1, subscription: 1, bootstrap: 1 });
  assert.equal(result.shopId, "shop-1");
});

test("a never-settling startup request is aborted and returns a bounded error", async () => {
  let signal;
  const startedAt = Date.now();
  await assert.rejects(
    withOwnerMobileTimeout((nextSignal) => {
      signal = nextSignal;
      return new Promise(() => {});
    }, 20),
    (error) => error instanceof OwnerMobileStartupTimeoutError,
  );
  assert.equal(signal?.aborted, true);
  assert.ok(Date.now() - startedAt < 250);
});

test("API requests reuse the established owner token instead of repeating auth recovery", () => {
  const functionStart = apiSource.indexOf("export async function getAccessTokenWithRecovery");
  const cacheRead = apiSource.indexOf("readOwnerAuthTokenCache()", functionStart);
  const supabaseRead = apiSource.indexOf("getSupabaseBrowserClient()", functionStart);
  assert.ok(cacheRead > functionStart && cacheRead < supabaseRead);
  assert.match(apiSource, /writeOwnerAuthTokenCache\([\s\S]*initialSession\.data\.session\.access_token/);
});

test("startup failure leaves an explicit retry screen instead of an endless skeleton", () => {
  assert.match(pageSource, /withOwnerMobileTimeout\(\(\) => getOwnerAccessContext\(\), 12_000\)/);
  assert.match(pageSource, /withOwnerMobileTimeout\([\s\S]*loadOwnerMobileCriticalData/);
  assert.match(pageSource, /setEntryFailed\(true\)/);
  assert.match(pageSource, /다시 시도하기/);
  assert.match(pageSource, /setLoadAttempt\(\(attempt\) => attempt \+ 1\)/);
});

test("noncritical push registration is delayed and subscription is not fetched again on mount", () => {
  const pushEffectStart = shellSource.indexOf('if (appRole !== "owner") return;');
  const pushEffectEnd = shellSource.indexOf("}, [appRole, currentStaffId, initialData.shop.id]);", pushEffectStart);
  const pushEffect = shellSource.slice(pushEffectStart, pushEffectEnd);
  assert.match(pushEffect, /window\.setTimeout/);
  assert.match(pushEffect, /syncOwnerPushNotifications/);
  assert.ok(pushEffect.indexOf("setTimeout") < pushEffect.indexOf("syncOwnerPushNotifications"));
  assert.equal(shellSource.match(/void refreshSummary\(\);/g)?.length ?? 0, 2);
});
