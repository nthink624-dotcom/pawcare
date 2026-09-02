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

const routeSource = () => readFile(
  new URL("../../src/app/api/subscription/route.ts", import.meta.url),
  "utf8",
);

function preflight(origin) {
  return ownerMobileCorsPreflight(new NextRequest("http://127.0.0.1:3000/api/subscription", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Authorization, Content-Type",
    },
  }));
}

test("subscription mobile CORS allows the exact local owner origin and rejects foreign origins", async () => {
  const allowed = preflight("http://127.0.0.1:3100");
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "http://127.0.0.1:3100");
  assert.equal(allowed.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.equal(allowed.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");
  assert.equal(allowed.headers.get("vary"), "Origin");

  const foreign = preflight("https://foreign.example");
  assert.equal(foreign.status, 204);
  assert.equal(foreign.headers.get("access-control-allow-origin"), null);

  const route = await routeSource();
  assert.match(route, /export async function OPTIONS\(request: NextRequest\) \{\s*return ownerMobileCorsPreflight\(request\);\s*\}/);
  assert.match(route, /const \{ identity, shopId \} = await requireOwnerBillingSession\(request\);/);
  assert.match(route, /const summary = await getOwnerSubscriptionSummary\(identity, shopId\);/);
  assert.match(route, /return ownerMobileCorsJson\(request, summary\);/);
  assert.match(route, /ownerMobileCorsJson\(request, \{ message: error\.message \}, \{ status: error\.status \}\)/);
});
