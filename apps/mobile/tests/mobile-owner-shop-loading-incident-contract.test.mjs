import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = new URL("../src/app/owner/mobile/page.tsx", import.meta.url);
const shellPath = new URL("../src/components/owner/owner-shell.tsx", import.meta.url);
const entryPath = new URL("../src/lib/owner-entry.ts", import.meta.url);
const pageSource = await readFile(pagePath, "utf8");
const shellSource = await readFile(shellPath, "utf8");
const entrySource = await readFile(entryPath, "utf8");

test("initial load scopes subscription and bootstrap to the same authorized shop", () => {
  // Initial load goes through loadOwnerEntry: the server entry endpoint authorizes the shop hint,
  // and the fallback validates membership before accepting any launch bootstrap.
  assert.match(pageSource, /const entry = await loadOwnerEntry\(storedShopId,/);
  assert.match(pageSource, /\(storedShopId && shops\.some\(\(shop\) => shop\.id === storedShopId\) \? storedShopId : shops\[0\]\?\.id\) \?\? null/);
  assert.match(
    pageSource,
    /`\/api\/subscription\?shopId=\$\{encodeURIComponent\(resolvedShopId\)\}`/,
  );
  assert.doesNotMatch(
    pageSource,
    /fetchApiJsonWithAuth<OwnerSubscriptionSummary>\("\/api\/subscription"/,
  );

  assert.match(entrySource, /if \(shopHint\) query\.set\("shopId", shopHint\);/);
  assert.match(entrySource, /const staleHint = Boolean\(shopHint\) && error instanceof ApiRequestError && error\.status === 403;/);
  const launchRead = entrySource.indexOf("const bootstrapRead = read<BootstrapPayload>(");
  const shopsRequest = entrySource.indexOf('read<OwnerEntryShop[]>("/api/owner/shops")');
  const membershipCheck = entrySource.indexOf("shops.some(shop => shop.id === shopHint)");
  const shopMatch = entrySource.indexOf("initial.payload.shop?.id === shopId");
  assert.ok(launchRead >= 0 && shopsRequest > launchRead, "launch bootstrap must start alongside the shops request");
  assert.ok(membershipCheck > shopsRequest && shopMatch > membershipCheck, "launch bootstrap is accepted only for the validated shop");
  assert.match(entrySource, /`\/api\/bootstrap\?shopId=\$\{encodeURIComponent\(shopId\)\}&phase=launch`/);
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
  assert.match(shellSource, /\}, \[initialData\.shop\.id(?:, [\w.]+)*\]\);/);
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
