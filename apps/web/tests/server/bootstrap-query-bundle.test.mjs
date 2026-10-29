import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const runtimeModule = { exports: {} };
Function("module", "exports", ts.transpileModule(readFileSync(new URL("../../src/server/bootstrap-query-bundle.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(runtimeModule, runtimeModule.exports);
const { loadBootstrapQueryBundle } = runtimeModule.exports;
const defaults = { staffSelection: "id,name", appointmentSelection: "*,booking_deposit_links(active_amount)",
  appointmentsFrom: "2026-09-01", appointmentsTo: "2026-11-30", includeOwnerProfile: true };
function fixture({ error, profile = [{ user_id: "owner-a" }], wrongShop = false, malformed = false } = {}) {
  const calls = [];
  const row = { id: wrongShop ? "shop-b" : "shop-a", name: "fixture", owner_user_id: "owner-a",
    entry_guardians: [{ id: "guardian-a", shop_id: "shop-a" }], entry_pets: [{ id: "pet-a", shop_id: "shop-a" }],
    entry_services: [], entry_staff: [], entry_overrides: [], entry_appointments: [], entry_owner_profile: profile };
  if (malformed) row.entry_pets = null;
  const client = createClient("https://fixture.supabase.co", "fixture-not-a-credential", { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: async (input, init) => { calls.push({ url: new URL(input), method: init?.method ?? "GET" });
      return new Response(JSON.stringify(error ?? row), { status: error ? 400 : 200, headers: { "Content-Type": "application/json" } }); },
  } });
  return { calls, run: options => loadBootstrapQueryBundle(client, "shop-a", { ...defaults, ...options }) };
}

test("one authenticated server query retains shop, active staff, appointment bounds, ordering and deposit projection", async () => {
  const { calls, run } = fixture(); const bundle = await run();
  assert.equal(calls.length, 1); assert.equal(calls[0].method, "GET");
  const query = calls[0].url.searchParams;
  assert.equal(query.get("id"), "eq.shop-a"); assert.equal(query.get("deleted_at"), "is.null");
  assert.equal(query.get("entry_staff.is_active"), "eq.true");
  assert.equal(query.get("entry_staff.order"), "sort_order.asc,created_at.asc");
  assert.equal(query.get("entry_appointments.order"), "appointment_date.asc,appointment_time.asc");
  assert.deepEqual(query.getAll("entry_appointments.appointment_date"), ["gte.2026-09-01", "lte.2026-11-30"]);
  assert.match(query.get("select"), /entry_appointments:appointments!appointments_shop_id_fkey\(\*,booking_deposit_links\(active_amount\)\)/);
  for (const table of ["guardians", "pets", "services", "staff_members", "staff_schedule_overrides", "owner_profiles"]) {
    assert.ok(query.get("select").includes(`${table}!${table}_shop_id_fkey(`));
  }
  assert.equal(bundle.shop.id, "shop-a"); assert.equal(bundle.guardians[0].shop_id, "shop-a");
  assert.ok(Object.keys(bundle.shop).every(key => !key.startsWith("entry_")));
});
test("essential entry omits the owner profile and can omit deposit preview without changing other fields", async () => {
  const { calls, run } = fixture({ profile: undefined });
  const bundle = await run({ includeOwnerProfile: false, appointmentSelection: "*" });
  assert.equal(bundle.ownerProfile, null);
  assert.doesNotMatch(calls[0].url.searchParams.get("select"), /owner_profiles|booking_deposit_links/);
});
for (const profile of [null, [], [{ user_id: "owner-a" }, { user_id: "owner-b" }]]) test(`profile cardinality preserves maybeSingle semantics: ${JSON.stringify(profile)}`, async () => {
  assert.equal((await fixture({ profile }).run()).ownerProfile, null);
});
test("a one-to-one profile object is preserved", async () => {
  const profile = { user_id: "owner-a" }; assert.deepEqual((await fixture({ profile }).run()).ownerProfile, profile);
});
for (const code of ["42703", "PGRST200", "PGRST201", "PGRST204", "PGRST205"]) test(`schema compatibility (${code}) can retain the established queries`, async () => {
  const { calls, run } = fixture({ error: { code, message: "fixture schema drift" } });
  assert.equal(await run(), null); assert.equal(calls.length, 1);
});
for (const code of ["42501", "PGRST301", "PGRST000", "57014"]) test(`permission/outage error (${code}) never becomes an empty successful snapshot`, async () => {
  await assert.rejects(fixture({ error: { code, message: "fixture failure" } }).run());
});
test("a foreign shop or malformed embedded result is rejected", async () => {
  await assert.rejects(fixture({ wrongShop: true }).run()); await assert.rejects(fixture({ malformed: true }).run());
});
