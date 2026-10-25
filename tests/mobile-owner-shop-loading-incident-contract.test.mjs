import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/owner/mobile/page.tsx", import.meta.url);
const shellPath = new URL("../src/components/owner/owner-shell.tsx", import.meta.url);
const pageSource = await readFile(pagePath, "utf8");
const shellSource = await readFile(shellPath, "utf8");

test("initial load scopes subscription and bootstrap to the same authorized shop", () => {
  assert.match(pageSource, /shops\.some\(\(shop\) => shop\.id === storedShopId\)/);
  assert.match(pageSource, /shops\[0\]\?\.id/);
  assert.match(
    pageSource,
    /`\/api\/subscription\?shopId=\$\{encodeURIComponent\(resolvedShopId\)\}`/,
  );
  assert.match(
    pageSource,
    /`\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(resolvedShopId\)\}&phase=launch`/,
  );
  assert.doesNotMatch(
    pageSource,
    /fetchApiJsonWithAuth<OwnerSubscriptionSummary>\("\/api\/subscription"/,
  );

  const cachedBootstrapStart = pageSource.indexOf("const cachedBootstrapRequest = storedShopId");
  const shopsRequest = pageSource.indexOf('const shops = await fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops")');
  const membershipCheck = pageSource.indexOf("shops.some((shop) => shop.id === storedShopId)");
  const cachedResult = pageSource.indexOf("const cachedBootstrap = storedShopId === resolvedShopId");
  assert.ok(cachedBootstrapStart >= 0 && shopsRequest > cachedBootstrapStart, "cached bootstrap must start before the shops request completes");
  assert.ok(membershipCheck > shopsRequest && cachedResult > membershipCheck, "cached bootstrap must be used only after membership validation");
  assert.match(pageSource, /setData\(canonicalBootstrap\);[\s\S]*void fetchApiJsonWithAuth<CanonicalOwnerBootstrapPayload>/);
});

test("shop changes and foreground refreshes keep subscription scoped to the active shop", () => {
  assert.match(
    pageSource,
    /`\/api\/subscription\?shopId=\$\{encodeURIComponent\(shopId\)\}`/,
  );
  assert.match(
    shellSource,
    /`\/api\/subscription\?shopId=\$\{encodeURIComponent\(initialData\.shop\.id\)\}`/,
  );
  assert.match(shellSource, /\}, \[initialData\.shop\.id\]\);/);
  assert.doesNotMatch(
    shellSource,
    /fetchApiJsonWithAuth<OwnerSubscriptionSummary>\("\/api\/subscription"/,
  );
});

test("failed entry ends skeleton loading with distinct recoverable states", () => {
  for (const kind of ["account", "initialization", "network", "no-shop", "server"]) {
    assert.match(pageSource, new RegExp(`kind: \\\"${kind}\\\"`));
  }
  assert.match(pageSource, /error instanceof TypeError/);
  assert.match(pageSource, /error instanceof ApiRequestError && error\.status >= 500/);
  assert.match(pageSource, /if \(loadFailure\) \{[\s\S]*?<OwnerMobileFailureScreen/);
  assert.match(pageSource, /onRetry=\{\(\) => setLoadAttempt\(\(attempt\) => attempt \+ 1\)\}/);
  assert.match(pageSource, /aria-busy="true"/);
  assert.match(pageSource, /min-h-\[44px\]/);
  assert.match(pageSource, /로그인 정보와 저장된 데이터는 그대로 유지됩니다/);
  assert.doesNotMatch(pageSource, /setMessage\(nextMessage\)/);
});

test("authentication and subscription access gates remain fail-closed", () => {
  assert.match(pageSource, /router\.replace\(`\/login\?next=/);
  assert.match(pageSource, /clearOwnerAuthTokenCache\(\)/);
  assert.match(pageSource, /shouldBlockOwnerAccessBySubscription\(subscription\)/);
  assert.match(pageSource, /shouldBlockOwnerAccessBySubscription\(nextSubscription\)/);
  assert.match(pageSource, /router\.replace\(`\/owner\/billing\?compare=1&plan=/);
});
