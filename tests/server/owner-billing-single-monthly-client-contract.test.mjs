import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, root), "utf8");

async function mountBillingPage({ currentShopId, shops, cachedSummary = null, subscription, search = "" }) {
  const source = await readProjectFile("src/app/owner/billing/page.tsx");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states = [];
  const effects = [];
  const listeners = new Map();
  const calls = { shops: 0, subscription: [], register: [], replace: [] };
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
    "@/components/owner/owner-billing-screen": { __esModule: true, default: () => null },
    "@/lib/api": { fetchApiJsonWithAuth: async (path) => {
      if (path === "/api/owner/shops") { calls.shops += 1; return typeof shops === "function" ? shops() : shops; }
      throw new Error(`unexpected request: ${path}`);
    } },
    "@/lib/billing/owner-billing-client": {
      fetchOwnerSubscriptionSummary: async (shopId) => { calls.subscription.push(shopId); return subscription(shopId); },
      registerOwnerBillingKey: async (input) => { calls.register.push(input); return subscription(input.shopId); },
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
  assert.match(screen, /issueOwnerBillingKeyByApi\(\{\s+shopId: summary\.shopId,/);
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
  assert.match(screen, /매월 29,000원이 자동 결제됩니다/);
});

test("billing page cold mount fetches a fresh authenticated shop summary without focus and gates registration", async () => {
  const summary = (shopId) => ({ shopId, status: "active" });
  const mounted = await mountBillingPage({
    currentShopId: "shop-a",
    shops: [{ id: "shop-a" }],
    subscription: async (shopId) => summary(shopId),
    search: "billingReturn=1&billingKey=key-a&plan=single_monthly_v1",
  });
  assert.deepEqual(mounted.calls.subscription, ["shop-a"]);
  assert.deepEqual(mounted.calls.register.map((input) => input.shopId), ["shop-a"]);
});

test("billing page never binds another-shop cache or late shop resolution to a billing-key return", async () => {
  const summary = (shopId) => ({ shopId, status: "active" });
  const mounted = await mountBillingPage({
    currentShopId: "shop-a",
    shops: [{ id: "shop-a" }],
    cachedSummary: summary("shop-b"),
    subscription: async (shopId) => summary(shopId),
    search: "billingReturn=1&billingKey=key-b&plan=single_monthly_v1",
  });
  assert.deepEqual(mounted.calls.subscription, ["shop-a"]);
  assert.deepEqual(mounted.calls.register.map((input) => input.shopId), ["shop-a"]);
  mounted.setShop("shop-b");
  await mounted.render();
  assert.equal(mounted.calls.register.length, 1);
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
