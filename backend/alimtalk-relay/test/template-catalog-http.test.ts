import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";

test("real relay route parses 10,037 provider templates, shares refresh and scopes response codes", async () => {
  Object.assign(process.env, {
    NODE_ENV: "test", VERCEL: "1", RELAY_SECRET: "relay-test-secret",
    SSODAA_API_URL: "https://apis.ssodaa.com/kakao/send/alimtalk",
    SSODAA_API_KEY: "fixture-key", SSODAA_TOKEN_KEY: "fixture-token", SSODAA_SENDER_KEY: "fixture-sender",
    ALIMTALK_TEMPLATE_BOOKING_CONFIRMED: "PM00000",
  });
  for (const alias of ["BOOKING_RECEIVED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_TIME_PROPOSED", "BOOKING_RESCHEDULED_CONFIRMED", "BOOKING_MANAGE_LINK_REQUESTED", "BOOKING_CONSENT_REQUEST", "BOOKING_DEPOSIT_REQUEST", "APPOINTMENT_REMINDER_10M", "VISIT_SCHEDULE_NOTICE", "VISIT_REMINDER_NOTICE", "GROOMING_STARTED", "GROOMING_ALMOST_DONE", "GROOMING_COMPLETED", "GROOMING_COMPLETED_WITHOUT_REPORT", "REVISIT_NOTICE", "BIRTHDAY_GREETING"]) {
    process.env[`ALIMTALK_TEMPLATE_${alias}`] = "PM00000";
  }
  const originalFetch = globalThis.fetch;
  const source = Array.from({ length: 10_037 }, (_, index) => ({
    templateCode: "PM" + String(index).padStart(5, "0"), templateName: "fixture", modifiedAt: "20261025120000", serviceStatus: "ACT",
  }));
  let lists = 0, details = 0, active = 0, peak = 0;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://apis.ssodaa.com");
    const payload = JSON.parse(String(init?.body));
    if (url.pathname === "/kakao/template/list") {
      lists++;
      const page = Number(payload.page), count = Number(payload.count);
      return Response.json({ code: "200", content: { totalPage: 101, totalCount: source.length, list: source.slice((page - 1) * count, page * count) } });
    }
    assert.equal(url.pathname, "/kakao/template/detail", "catalog must never call a provider send/register endpoint");
    details++; active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    if (payload.templateCode === "PM00001") return Response.json({ code: "503" }, { status: 503 });
    if (payload.templateCode === "PM00002") return Response.json({ code: "200", content: { templateCode: "WRONG_FOREIGN_CODE", templateContent: "foreign", inspectionStatus: "APR", serviceStatus: "A" } });
    return Response.json({ code: "200", content: {
      templateCode: payload.templateCode, templateContent: "fixture #{매장명}", inspectionStatus: "APR", serviceStatus: "ACT", buttons: [],
    } });
  }) as typeof fetch;
  const { default: app } = await import("../src/server.ts");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("test listener unavailable");
  const read = (path: string) => new Promise<{ status: number; body: { allTemplates: Array<{ templateCode: string }> } }>((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: address.port, path, headers: { "x-relay-secret": "relay-test-secret" } }, response => {
      let body = ""; response.setEncoding("utf8"); response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, body: JSON.parse(body) }));
    }).on("error", reject);
  });
  try {
    const [a, b] = await Promise.all([read("/admin/templates?codes=PM10036"), read("/admin/templates?codes=PM00000")]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.deepEqual(a.body.allTemplates.map(row => row.templateCode), ["PM10036"]);
    assert.deepEqual(b.body.allTemplates.map(row => row.templateCode), ["PM00000"]);
    assert.equal(lists, 0, "targeted lookups must never list global provider templates");
    assert.equal(details, 2); assert(peak <= 6);
    const mismatch = await read("/admin/templates?codes=PM00002");
    const blocked = mismatch.body.allTemplates[0] as unknown as { templateCode: string; templateContent: unknown; inspectionStatus: unknown };
    assert.equal(blocked.templateCode, "PM00002"); assert.equal(blocked.templateContent, null); assert.equal(blocked.inspectionStatus, null);
    const all = await read("/admin/templates");
    assert.equal(all.body.allTemplates.length, 10_037);
    const unavailable = all.body.allTemplates.find(row => row.templateCode === "PM00001") as unknown as { inspectionStatus: unknown; templateContent: unknown };
    assert.equal(unavailable.inspectionStatus, null);
    assert.equal(unavailable.templateContent, null);
    assert.equal(lists, 101); assert.equal(details, 10_040);
    assert.equal((await read("/admin/templates?codes=%21invalid")).status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(server.listening, false);
  }
});
