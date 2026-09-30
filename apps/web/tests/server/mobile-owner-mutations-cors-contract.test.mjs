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
const { ownerMobileCorsJson, ownerMobileCorsPreflight } = await import("../../src/server/owner-mobile-cors.ts");

const mobileOrigin = "https://app.petmanager.co.kr";
const foreignOrigin = "https://foreign.example";
const routes = [
  {
    path: "../../src/app/api/guardians/route.ts",
    methods: "POST, PATCH, DELETE, OPTIONS",
    allowed: ["POST", "PATCH", "DELETE"],
  },
  {
    path: "../../src/app/api/guardians/restore/route.ts",
    methods: "POST, OPTIONS",
    allowed: ["POST"],
  },
  {
    path: "../../src/app/api/pets/route.ts",
    methods: "POST, PATCH, DELETE, OPTIONS",
    allowed: ["POST", "PATCH", "DELETE"],
  },
  {
    path: "../../src/app/api/customer-page-settings/route.ts",
    methods: "PATCH, OPTIONS",
    allowed: ["PATCH"],
  },
  {
    path: "../../src/app/api/notifications/route.ts",
    methods: "POST, OPTIONS",
    allowed: ["POST"],
  },
];

function preflight(origin, method) {
  return new NextRequest("https://www.petmanager.co.kr/api/mobile-write", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
}

test("mobile owner write routes allow only their declared methods and approved app origin", async () => {
  for (const route of routes) {
    const source = await readFile(new URL(route.path, import.meta.url), "utf8");
    assert.match(source, /ownerMobileCorsJson|function notificationJson/);
    assert.match(source, /export async function OPTIONS\(request: NextRequest\)/);
    assert.match(source, new RegExp(`methods: "${route.methods.replaceAll(" ", "\\s*")}"`));
    assert.doesNotMatch(source, /NextResponse\.json\(/);

    for (const method of route.allowed) {
      const response = ownerMobileCorsPreflight(preflight(mobileOrigin, method), { methods: route.methods });
      assert.equal(response.status, 204, `${route.path} ${method}`);
      assert.equal(response.headers.get("access-control-allow-origin"), mobileOrigin);
      assert.equal(response.headers.get("access-control-allow-methods"), route.methods);
      assert.equal(response.headers.get("access-control-allow-headers"), "Authorization, Content-Type, Accept");
      assert.equal(response.headers.get("vary"), "Origin");
    }

    const denied = ownerMobileCorsPreflight(preflight(mobileOrigin, "PUT"), { methods: route.methods });
    assert.equal(denied.status, 405, `${route.path} must reject undeclared methods`);
    assert.equal(denied.headers.get("allow"), route.methods);

    const foreign = ownerMobileCorsPreflight(preflight(foreignOrigin, route.allowed[0]), { methods: route.methods });
    assert.equal(foreign.status, 204);
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  }
});

test("owner mutation error responses retain CORS headers so mobile can read failures", () => {
  const response = ownerMobileCorsJson(
    new NextRequest("https://www.petmanager.co.kr/api/pets", { headers: { Origin: mobileOrigin } }),
    { message: "invalid input" },
    { status: 400 },
    { methods: "POST, PATCH, DELETE, OPTIONS" },
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), mobileOrigin);
});
