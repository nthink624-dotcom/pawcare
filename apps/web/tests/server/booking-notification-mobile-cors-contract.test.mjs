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
const {
  ownerMobileCorsJson,
  ownerMobileCorsPreflight,
} = await import("../../src/server/owner-mobile-cors.ts");

const exactOrigin = "http://127.0.0.1:3100";
const foreignOrigin = "https://foreign.example";

function request(origin, method = "GET") {
  return new NextRequest("http://127.0.0.1:3000/api/owner/booking-notification-snapshot?shopId=shop-a", {
    method,
    headers: {
      Origin: origin,
      ...(method === "OPTIONS"
        ? {
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
          }
        : {}),
    },
  });
}

test("booking notification snapshot applies mobile CORS without changing its auth query contract", async () => {
  const preflight = ownerMobileCorsPreflight(request(exactOrigin, "OPTIONS"));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), exactOrigin);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(preflight.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");

  const getResponse = ownerMobileCorsJson(request(exactOrigin), { notifications: [] });
  assert.equal(getResponse.headers.get("access-control-allow-origin"), exactOrigin);

  const foreignPreflight = ownerMobileCorsPreflight(request(foreignOrigin, "OPTIONS"));
  const foreignGet = ownerMobileCorsJson(request(foreignOrigin), { notifications: [] });
  assert.equal(foreignPreflight.headers.get("access-control-allow-origin"), null);
  assert.equal(foreignGet.headers.get("access-control-allow-origin"), null);

  const route = await readFile(
    new URL("../../src/app/api/owner/booking-notification-snapshot/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /const owner = await requireOwnerShop\(request, requestedShopId\);/);
  assert.match(route, /\.from\("notifications"\)[\s\S]*\.eq\("shop_id", owner\.shopId\)[\s\S]*\.eq\("type", "owner_booking_requested"\)[\s\S]*\.eq\("status", "sent"\)[\s\S]*\.limit\(50\)/);
  assert.match(route, /error instanceof OwnerApiError[\s\S]*jsonNoStore\(request, \{ message: error\.message \}, \{ status: error\.status \}\)/);
  assert.match(route, /return ownerMobileCorsJson\(request, body, \{ \.\.\.init, headers \}\);/);
  assert.match(route, /export async function OPTIONS\(request: NextRequest\) \{\s*return ownerMobileCorsPreflight\(request\);\s*\}/);
});
