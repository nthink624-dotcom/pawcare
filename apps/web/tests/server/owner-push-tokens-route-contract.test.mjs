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

const routePath = new URL("../../src/app/api/owner/push-tokens/route.ts", import.meta.url);
const CORS = { methods: "POST, DELETE, OPTIONS" };

function preflight(origin, requestedMethod) {
  return ownerMobileCorsPreflight(new NextRequest("http://127.0.0.1:3000/api/owner/push-tokens", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": requestedMethod,
      "Access-Control-Request-Headers": "Authorization, Content-Type",
    },
  }), CORS);
}

test("owner push token preflight permits only the registered mobile origin and POST/DELETE/OPTIONS", () => {
  const post = preflight("http://127.0.0.1:3100", "POST");
  assert.equal(post.status, 204);
  assert.equal(post.headers.get("access-control-allow-origin"), "http://127.0.0.1:3100");
  assert.equal(post.headers.get("access-control-allow-methods"), "POST, DELETE, OPTIONS");
  assert.equal(post.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");

  const remove = preflight("http://127.0.0.1:3100", "DELETE");
  assert.equal(remove.status, 204);

  const get = preflight("http://127.0.0.1:3100", "GET");
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST, DELETE, OPTIONS");

  const foreign = preflight("https://foreign.example", "POST");
  assert.equal(foreign.status, 204);
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);
});

test("owner push token route keeps owner/shop/device-scoped idempotency and redacts the token", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /const PUSH_TOKEN_CORS = \{ methods: "POST, DELETE, OPTIONS" \}/);
  assert.match(route, /export async function POST\(request: NextRequest\)/);
  assert.match(route, /export async function DELETE\(request: NextRequest\)/);
  assert.match(route, /export async function OPTIONS\(request: NextRequest\) \{\s*return ownerMobileCorsPreflight\(request, PUSH_TOKEN_CORS\);\s*\}/);
  assert.doesNotMatch(route, /export async function GET\(/);
  assert.equal(
    (route.match(/const owner = await requireOwnerShop\(request, input\.shopId\);/g) ?? []).length,
    2,
    "POST and DELETE must authorize the requested shop before mutation",
  );
  assert.match(
    route,
    /if \(!owner\.userId\) \{\s*throw new OwnerApiError\("로그인이 필요합니다\.", 401\);/,
    "database-backed registration must reject an unauthenticated owners",
  );
  assert.match(route, /const owner = await requireOwnerShop\(request, input\.shopId\);/);
  assert.match(route, /\.eq\("shop_id", owner\.shopId\)\s*\.eq\("owner_user_id", owner\.userId\)/);
  assert.match(route, /\.eq\("device_id", input\.deviceId\)\s*\.neq\("push_token", input\.pushToken\)/);
  assert.match(route, /enabled: false, disabled_at: now, updated_at: now/);
  assert.match(route, /if \(input\.pushToken\) query = query\.eq\("push_token", input\.pushToken\);/);
  assert.match(route, /if \(input\.deviceId\) query = query\.eq\("device_id", input\.deviceId\);/);
  assert.match(route, /이미 다른 매장에 연결된 알림 기기입니다\./);
  assert.match(route, /registered: true,\s*provider: input\.provider,\s*platform: input\.platform,\s*staleDeactivated,/);
  assert.doesNotMatch(route, /return ownerMobileCorsJson\(request, \{[^}]*pushToken/s);
  assert.doesNotMatch(route, /console\.(?:log|info|warn|error).*pushToken/s);
});
