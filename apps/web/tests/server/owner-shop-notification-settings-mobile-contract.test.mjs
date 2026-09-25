import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/server" ? "next/server.js" : specifier, context);
  },
});

const { NextRequest } = await import("next/server.js");
const { ownerMobileCorsPreflight } = await import("../../src/server/owner-mobile-cors.ts");
const routePath = new URL("../../src/app/api/owner/shops/route.ts", import.meta.url);
const SHOP_WRITE_CORS = { methods: "GET, PATCH, OPTIONS" };

function preflight(origin, requestedMethod) {
  return ownerMobileCorsPreflight(new NextRequest("http://127.0.0.1:3000/api/owner/shops", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": requestedMethod,
      "Access-Control-Request-Headers": "Authorization, Content-Type",
    },
  }), SHOP_WRITE_CORS);
}

test("shop notification settings PATCH preflight accepts only the approved mobile origin and method", () => {
  const patch = preflight("http://127.0.0.1:3100", "PATCH");
  assert.equal(patch.status, 204);
  assert.equal(patch.headers.get("access-control-allow-origin"), "http://127.0.0.1:3100");
  assert.equal(patch.headers.get("access-control-allow-methods"), "GET, PATCH, OPTIONS");
  assert.equal(patch.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");

  const deleteMethod = preflight("http://127.0.0.1:3100", "DELETE");
  assert.equal(deleteMethod.status, 405);
  assert.equal(deleteMethod.headers.get("allow"), "GET, PATCH, OPTIONS");

  const foreign = preflight("https://foreign.example", "PATCH");
  assert.equal(foreign.status, 204);
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
});

test("shop notification settings PATCH keeps the authenticated shop, allowlist, conflict, and readback contracts", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const SHOP_WRITE_CORS = \{ methods: "GET, PATCH, OPTIONS" \}/);
  assert.match(route, /notificationSettings: notificationSettingsPatchSchema\.optional\(\)/);
  assert.match(route, /\.strict\(\)/);
  assert.match(route, /const owner = await requireOwnerShop\(request, body\.shopId\);/);
  assert.match(route, /if \(body\.expectedUpdatedAt && currentShop\.updated_at !== body\.expectedUpdatedAt\)/);
  assert.match(route, /updateQuery = updateQuery\.eq\("updated_at", currentShop\.updated_at\);/);
  assert.match(route, /if \(!result\.data\) \{\s*throw new OwnerApiError\("다른 설정 변경이 반영되었습니다\. 화면을 다시 확인해 주세요\."/);
  assert.match(route, /toStoredNotificationSettings\(body\.notificationSettings!\)/);
  assert.match(route, /coerceEnabledShopNotificationSettings\(/);
  assert.match(route, /notificationSettings: toMobileNotificationSettingsReadback\(result\.data\.notification_settings\)/);
  assert.match(route, /select\("id,name,phone,address,description,approval_mode,concurrent_capacity,reservation_policy_settings,customer_page_settings,notification_settings"\)/);
  assert.match(route, /return ownerMobileCorsPreflight\(request, SHOP_WRITE_CORS\);/);
  assert.doesNotMatch(route, /alimtalk_sender_profile_key/);
  assert.doesNotMatch(route, /notification_settings:\s*undefined/);
});
