import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { readFile } from "node:fs/promises";
const next = await import("next/server");
const jobs = [];
const rows = [];
let sinkFails = false;
mock.module("next/server", { namedExports: { ...next, after: job => jobs.push(job) } });
mock.module("@/lib/supabase/server", { namedExports: { getSupabaseAdmin: () => ({ from: () => ({ insert: row => { rows.push(row); return { abortSignal: async () => ({ error: sinkFails ? { message: "private database details" } : null }) }; } }) }) } });
const { logOperationalEvent } = await import("../../src/server/observability.ts");

test("server error persistence accepts failure variants and omits all caller context", async () => {
  mock.method(console, "error", () => {});
  for (const event of ["billing.event_insert_failed", "alimtalk.relay_request_failed", "appointment_notification.failed"]) {
    logOperationalEvent(event, { status: 503, email: "private@example.test", customerId: "private", requestId: "private" });
    await jobs.shift()();
  }
  assert.equal(rows.length, 3);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["event_name", "http_status", "project_name", "release_id"]);
  assert.equal(rows[0].http_status, 503);
  assert.equal(rows[0].project_name, "web");
  logOperationalEvent("appointment_notification.completed");
  logOperationalEvent("private@example.test.failed");
  assert.equal(jobs.length, 0);
  mock.restoreAll();
});

test("sink failure never exposes database details or fails the original request", async () => {
  const messages=[];
  mock.method(console, "error", message => messages.push(message));
  sinkFails=true;
  assert.doesNotThrow(() => logOperationalEvent("billing.failed", { status: 200 }));
  await assert.doesNotReject(jobs.shift()());
  assert.equal(rows.at(-1).http_status, null);
  assert.equal(messages.some(message => message.includes("private database details")), false);
  sinkFails=false;
  mock.restoreAll();
});

test("administrator reads and cleanup enforce their separate authorization boundaries", async () => {
  const route = await readFile(new URL("../../src/app/api/admin/operational-errors/route.ts", import.meta.url),"utf8");
  assert.ok(route.indexOf("await requireAdminSession(request)") < route.indexOf('admin.from("operational_error_events")'));
  assert.match(route, /7 \* 86400000/);
  assert.match(route, /limit\(100\)/);
  const cleanup = await readFile(new URL("../../src/app/api/cron/operational-errors/cleanup/route.ts", import.meta.url),"utf8");
  assert.match(cleanup, /!secret \|\| request.headers.get/);
  assert.doesNotMatch(cleanup, /user-agent|vercel-cron|NODE_ENV/);
});
