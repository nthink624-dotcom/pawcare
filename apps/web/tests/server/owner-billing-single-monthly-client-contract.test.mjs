import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, root), "utf8");

async function mountBillingPage({ currentShopId, shops, cachedSummary = null, subscription, pendingShopId, search = "" }) {
  const source = await readProjectFile("src/app/owner/billing/page.tsx");
  const compiled = ts.transpileModule(`${source}\nexport { OwnerBillingPageContent };`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states = [];
  const effects = [];
  const listeners = new Map();
  const calls = { shops: 0, subscription: [], register: [], charge: [], replace: [] };
  let cursor = 0;
  let storedShopId = currentShopId;
  const sameDeps = (left, right) => left?.length === right?.length && left.every((value, index) => value === right[index]);
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return states[index] ?? (states[index] = { current: initial }); },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = effects[index];
      if (!previous || !sameDeps(previous.deps, deps)) {
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: effect() };
      }
    },
    Suspense: "Suspense",
  };
  const router = { replace(value) { calls.replace.push(value); }, refresh() {} };
  const modules = {
    react,
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "next/navigation": { useRouter: () => router, useSearchParams: () => new URLSearchParams(search) },
    "@/components/owner/owner-billing-screen": {
      __esModule: true,
      default: () => null,
      hasSuccessfulPayment: (summary) => summary.status === "active",
      buildBillingSuccessUrl: () => "/owner/billing/success",
    },
    "@/lib/api": { fetchApiJsonWithAuth: async (path) => {
      if (path === "/api/owner/shops") { calls.shops += 1; return typeof shops === "function" ? shops() : shops; }
      throw new Error(`unexpected request: ${path}`);
    } },
    "@/lib/billing/owner-billing-client": {
      fetchOwnerSubscriptionSummary: async (shopId) => { calls.subscription.push(shopId); return subscription(shopId); },
      registerOwnerBillingKey: async (input) => { calls.register.push(input); return subscription(input.shopId); },
      takeOwnerHostedCardAttempt: (shopId, issueId) => shopId === pendingShopId && issueId === "test-attempt",
      retryOwnerSubscriptionPayment: async (shopId) => { calls.charge.push(shopId); return subscription(shopId); },
    },
    "@/lib/billing/owner-billing-navigation": { readOwnerBillingSummaryCache: () => cachedSummary, writeOwnerBillingSummaryCache: () => {} },
    "@/lib/billing/owner-plans": { getOwnerPlanByCode: (code) => code === "single_monthly_v1" ? { code } : null },
    "@/lib/owner-current-shop": { CURRENT_OWNER_SHOP_STORAGE: "petmanager:owner-current-shop", readCurrentOwnerShopId: () => storedShopId },
  };
  const context = {
    exports: {}, module: { exports: {} },
    require: (name) => modules[name] ?? {},
    window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: () => {} },
    document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: () => {}, visibilityState: "visible" },
    URLSearchParams,
    Error,
  };
  vm.runInNewContext(`(function(exports, require, module){${compiled}\n})(exports, require, module);`, context);
  const render = async () => {
    cursor = 0;
    context.exports.OwnerBillingPageContent();
    await new Promise((resolve) => setImmediate(resolve));
  };
  await render();
  await render();
  await render();
  return { calls, router, setShop: (shopId) => { storedShopId = shopId; listeners.get("storage")?.({ key: "petmanager:owner-current-shop" }); }, render };
}

test("owner billing consumers use the active shop single-monthly subscription API", async () => {
  const [client, api, page, screen] = await Promise.all([
    readProjectFile("src/lib/billing/owner-billing-client.ts"),
    readProjectFile("src/api/billing.ts"),
    readProjectFile("src/app/owner/billing/page.tsx"),
    readProjectFile("src/components/owner/owner-billing-screen.tsx"),
  ]);

  assert.match(client, /saveOwnerSubscriptionPreferences\(shopId: string\)/);
  assert.match(client, /retryOwnerSubscriptionPayment\(shopId: string\)/);
  assert.match(client, /currentPlanCode: OWNER_SINGLE_MONTHLY_PLAN_CODE/);
  assert.doesNotMatch(client, /requestOwnerOneTimePayment/);
  assert.doesNotMatch(api, /requestOwner(?:OneTime|Billing)Payment/);
  assert.doesNotMatch(page, /planCode,\s*\n\s*}\);/);
  assert.match(screen, /saveOwnerSubscriptionPreferences\(summary\.shopId\)/);
  assert.match(screen, /retryOwnerSubscriptionPayment\(summary\.shopId\)/);
  assert.match(screen, /retryOwnerSubscriptionPayment\(registeredSummary\.shopId\)/);
  assert.match(screen, /cancelOwnerSubscriptionRenewal\(summary\.shopId\)/);
  assert.match(screen, /requestOwnerHostedBillingKey\(summary\.shopId, summary\.portoneCustomerId\)/);
  assert.doesNotMatch(screen, /issueOwnerBillingKeyByApi/);
  assert.match(page, /readCurrentOwnerShopId\(\)/);
  assert.match(page, /fetchApiJsonWithAuth<OwnedShopSummary\[\]>\("\/api\/owner\/shops", \{ cache: "no-store" \}\)/);
  assert.match(page, /shops\.some\(\(shop\) => shop\.id === storedShopId\)/);
  assert.match(page, /activeShopResolutionRef\.current !== resolutionId/);
  assert.match(page, /fetchOwnerSubscriptionSummary\(activeShopId\)/);
  assert.match(page, /freshSummaryShopId !== activeShopId/);
  assert.match(page, /isSummaryForActiveShop\(summary, activeShopId\)/);
  assert.match(page, /activeShopIdRef\.current !== activeShopId/);
  assert.match(page, /const verifiedShopId = activeShopId/);
  assert.match(page, /registerOwnerBillingKey\(\{\s+shopId: verifiedShopId,/);
  assert.doesNotMatch(page, /fetchApiJsonWithAuth<OwnerSubscriptionSummary>\("\/api\/subscription"/);
  assert.doesNotMatch(page, /shops\[0\]/);
  assert.doesNotMatch(screen, /requestOwnerOneTimePayment|usesOneTimePayment|handleOneTimePayment/);
  assert.match(screen, /checkboxLabel=\{`월 \$\{won\(selectedBillingAmount\.monthlyTotalAmount\)\} 자동결제와 KCP·포트원 카드 처리를 확인했습니다\.`\}/);
});

test("billing page cold mount fetches a fresh authenticated shop summary without focus and gates registration", async () => {
  const summary = (shopId) => ({ shopId, status: "active" });
  const mounted = await mountBillingPage({
    currentShopId: "shop-a",
    shops: [{ id: "shop-a" }],
    subscription: async (shopId) => summary(shopId),
    pendingShopId: "shop-a",
    search: "billingReturn=1&billingKey=key-a&plan=single_monthly_v1&attempt=test-attempt",
  });
  assert.deepEqual(mounted.calls.subscription, ["shop-a"]);
  assert.deepEqual(mounted.calls.register.map((input) => input.shopId), ["shop-a"]);
  assert.deepEqual(mounted.calls.charge, ["shop-a"]);
});

test("billing page never binds another-shop cache or late shop resolution to a billing-key return", async () => {
  const summary = (shopId) => ({ shopId, status: "active" });
  const mounted = await mountBillingPage({
    currentShopId: "shop-a",
    shops: [{ id: "shop-a" }],
    cachedSummary: summary("shop-b"),
    subscription: async (shopId) => summary(shopId),
    pendingShopId: "shop-b",
    search: "billingReturn=1&billingKey=key-b&plan=single_monthly_v1&attempt=test-attempt",
  });
  assert.deepEqual(mounted.calls.subscription, ["shop-a"]);
  assert.deepEqual(mounted.calls.register, []);
  assert.deepEqual(mounted.calls.charge, []);
  mounted.setShop("shop-b");
  await mounted.render();
  assert.equal(mounted.calls.register.length, 0);
});

test("billing page clears the cold path on logout instead of using cache or a guessed shop", async () => {
  const mounted = await mountBillingPage({
    currentShopId: "shop-a",
    shops: () => Promise.reject(new Error("로그인이 필요합니다.")),
    cachedSummary: { shopId: "shop-a", status: "active" },
    subscription: async () => { throw new Error("must not fetch"); },
  });
  assert.deepEqual(mounted.calls.subscription, []);
  assert.deepEqual(mounted.calls.register, []);
  assert.deepEqual(mounted.calls.replace, ["/login?next=/owner/billing"]);
});

test("hosted registration sends only the customer reference and consumes the matching redirect attempt once", async () => {
  const source = await readProjectFile("src/lib/billing/owner-billing-client.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const stored = new Map();
  const sdkCalls = [];
  const modules = {
    "@/lib/billing/owner-plans": { OWNER_SINGLE_MONTHLY_PLAN_CODE: "single_monthly_v1" },
    "@/lib/env": { env: { portoneStoreId: "test-store", portoneBillingChannelKey: "test-channel" } },
    "@portone/browser-sdk/v2": {
      requestIssueBillingKey: async (request) => { sdkCalls.push(request); return undefined; },
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => modules[name] ?? {},
    URL,
    URLSearchParams,
    window: {
      location: { origin: "https://owner.example.test" },
      crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
      sessionStorage: {
        getItem: (key) => stored.get(key),
        setItem: (key, value) => stored.set(key, value),
        removeItem: (key) => stored.delete(key),
      },
    },
  });
  assert.equal(await exports.requestOwnerHostedBillingKey("shop-a", "owner-shop-a"), null);
  const [request] = sdkCalls;
  assert.equal(request.billingKeyMethod, "CARD");
  assert.deepEqual(Object.keys(request.customer), ["customerId"]);
  const redirect = new URL(request.redirectUrl);
  assert.equal(redirect.pathname, "/owner/billing");
  assert.equal(redirect.searchParams.get("attempt"), request.issueId);
  assert.equal(exports.takeOwnerHostedCardAttempt("shop-b", request.issueId), false);
  assert.equal(exports.takeOwnerHostedCardAttempt("shop-a", request.issueId), true);
  assert.equal(exports.takeOwnerHostedCardAttempt("shop-a", request.issueId), false);
});

test("hosted registration checks provider ownership before writing and saves the new token before deleting the old one", async () => {
  const source = await readProjectFile("src/server/owner-billing.ts");
  const start = source.indexOf("export async function registerOwnerBillingMethod(");
  const end = source.indexOf("\nexport async function chargeOwnerRegisteredCard(", start);
  assert.ok(start >= 0 && end > start);
  const compiled = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const record = { subscription_status: "active", billing_key: "old-token" };
  const info = {
    status: "ISSUED",
    storeId: "test-store",
    issueId: "test-attempt",
    customer: { id: "another-owner" },
    channels: [{ key: "test-channel", pgProvider: "KCP_V2" }],
  };
  let failSave = false;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    OwnerBillingError: Error,
    env: { portoneStoreId: "test-store" },
    serverEnv: { portoneBillingChannelKey: "test-channel" },
    OWNER_SINGLE_MONTHLY_PLAN_CODE: "single_monthly_v1",
    canWriteProtectedBillingData: () => true,
    createOwnerShopPortoneCustomerId: () => "this-owner",
    portoneFetch: async (_path, init) => { calls.push(init?.method ?? "GET"); return info; },
    readOrCreateSubscription: async () => ({ tableReady: true, record, profile: {} }),
    readStoredBillingKey: () => "old-token",
    buildBillingMethodLabelFromInfo: () => "등록된 카드",
    applyOwnerPlanContract: (saved) => saved,
    nextStatusForRecord: (saved) => saved.subscription_status,
    persistSubscriptionRecord: async (_identity, next) => {
      calls.push("save");
      if (failSave) throw new Error("test save failed");
      return next;
    },
    recordBillingEvent: async () => {},
    buildOwnerSubscriptionSummary: async (_identity, _shopId, saved) => saved,
  });
  const register = () => exports.registerOwnerBillingMethod({ id: "test-owner" }, "shop-a", {
    billingKey: "new-token",
    issueId: "test-attempt",
    autoRenewPlanCode: "single_monthly_v1",
    verifyPortoneIssue: true,
  });
  await assert.rejects(register, /일치하지 않습니다/);
  assert.deepEqual(calls.splice(0), ["GET"]);
  info.customer.id = "this-owner";
  failSave = true;
  await assert.rejects(register, /test save failed/);
  assert.deepEqual(calls.splice(0), ["GET", "save"]);
  failSave = false;
  assert.equal((await register()).billing_key, "new-token");
  assert.deepEqual(calls, ["GET", "save", "DELETE"]);
});
