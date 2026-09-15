import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const helperSource = await readFile(new URL("../src/lib/canonical-owner-api-proxy.ts", import.meta.url), "utf8");
const helperJavaScript = stripTypeScriptTypes(helperSource, { mode: "transform" });
const helperModuleUrl = `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString("base64")}`;
const { proxyCanonicalOwnerApi } = await import(helperModuleUrl);

test("the mobile owner proxy preserves the canonical path, query, bearer, method, and JSON body", async () => {
  const request = new Request("https://app.petmanager.co.kr/api/owner/grooming-record-drafts?shopId=shop-a&appointmentId=appointment-a", {
    method: "PUT",
    headers: {
      Authorization: "Bearer test-access-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reportText: "safe test draft" }),
  });
  let callCount = 0;
  const response = await proxyCanonicalOwnerApi(request, "/api/owner/grooming-record-drafts", async (input, init) => {
    callCount += 1;
    const target = new URL(input);
    assert.equal(target.origin, "https://www.petmanager.co.kr");
    assert.equal(target.pathname, "/api/owner/grooming-record-drafts");
    assert.equal(target.searchParams.get("shopId"), "shop-a");
    assert.equal(target.searchParams.get("appointmentId"), "appointment-a");
    assert.equal(init.method, "PUT");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer test-access-token");
    assert.deepEqual(JSON.parse(Buffer.from(init.body).toString("utf8")), { reportText: "safe test draft" });
    return new Response(JSON.stringify({ draft: { reportText: "safe test draft" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  assert.equal(callCount, 1);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), { draft: { reportText: "safe test draft" } });
});

test("the mobile owner proxy returns a bounded JSON error instead of an HTML page", async () => {
  const request = new Request("https://app.petmanager.co.kr/api/owner/care-reports", { method: "POST", body: "{}" });
  const response = await proxyCanonicalOwnerApi(request, "/api/owner/care-reports", async () => {
    throw new Error("upstream unavailable");
  });
  assert.equal(response.status, 502);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(typeof (await response.json()).message, "string");
});

test("each care-report dependency has a same-origin mobile route to the canonical owner API", async () => {
  const contracts = [
    ["../src/app/api/owner/care-reports/route.ts", "/api/owner/care-reports", ["POST", "PATCH"]],
    ["../src/app/api/owner/grooming-record-drafts/route.ts", "/api/owner/grooming-record-drafts", ["GET", "PUT", "DELETE"]],
    ["../src/app/api/owner/appointment-visit-weight/route.ts", "/api/owner/appointment-visit-weight", ["GET", "PUT"]],
  ];
  for (const [relativePath, pathname, methods] of contracts) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, new RegExp(pathname.replaceAll("/", "\\/")));
    for (const method of methods) assert.match(source, new RegExp(`export function ${method}\\(`));
    assert.doesNotMatch(source, /supabase|from\(|insert\(|update\(/i);
  }
});
