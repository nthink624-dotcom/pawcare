import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { ownerMobileCorsPreflight } from "../../src/server/owner-mobile-cors.ts";

test("deposit mobile preflight uses the existing allowlist for POST and PATCH", () => {
  for (const method of ["POST", "PATCH"]) {
    const request = new NextRequest("http://127.0.0.1:3000/api/owner/booking-preparation", { method: "OPTIONS", headers: { Origin: "http://127.0.0.1:3100" } });
    const response = ownerMobileCorsPreflight(request, { methods: `GET, ${method}, OPTIONS` });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:3100");
    assert.ok(response.headers.get("access-control-allow-methods").includes(method));
    assert.ok(response.headers.get("access-control-allow-headers").includes("Authorization"));
  }
});
test("unknown origins are not enabled", () => {
  const response = ownerMobileCorsPreflight(new NextRequest("http://127.0.0.1:3000/api/owner/booking-preparation", { method: "OPTIONS", headers: { Origin: "https://untrusted.invalid" } }), { methods: "GET, POST, OPTIONS" });
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
test("both deposit routes retain owner/manager authorization and scoped CORS for failures", () => {
  for (const file of ["booking-preparation", "booking-deposits"]) {
    const source = readFileSync(new URL(`../../src/app/api/owner/${file}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /assertOwnerOrManager\(owner\)/);
    assert.match(source, /requireOwnerShop\(request/);
    assert.match(source, /export function OPTIONS\(request: NextRequest\)/);
    assert.match(source, /function failure\([^\n]*request: NextRequest\)/);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin.*\*/);
  }
});
test("bootstrap actor comes from authorized context and is absent from public projection", () => {
  const source = readFileSync(new URL("../../src/app/api/bootstrap/route.ts", import.meta.url), "utf8");
  assert.match(source, /actor: \{ shopId: owner\.shopId, role: owner\.role, staffId: owner\.staffId \}/);
  assert.doesNotMatch(source.slice(source.indexOf('if (scope === "public")'), source.indexOf("const authorizationStartedAt")), /actor:/);
});
