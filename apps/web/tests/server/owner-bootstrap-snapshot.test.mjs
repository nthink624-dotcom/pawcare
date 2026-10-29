import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const output = ts.transpileModule(readFileSync(new URL("../../src/server/owner-bootstrap-snapshot.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const role of ["owner", "staff"]) for (const phase of ["essential", "launch", "full"]) {
  test(`${role} ${phase} retains canonical query bounds and privacy projection`, async () => {
    const owner = { shopId: "shop-a", userId: "owner-a", role, staffId: role === "staff" ? "staff-a" : null };
    const timing = () => {};
    const raw = { shop: { id: "shop-a" }, services: ["canonical-service"], secret: "fixture-private" };
    const modules = {
      "@/server/bootstrap": { getBootstrap: async (shopId, options) => {
        assert.equal(shopId, owner.shopId); assert.equal(options.allowMock, false);
        assert.equal(options.includeDepositPreview, role !== "staff");
        assert.equal(options.includeOwnerProfile, phase !== "essential");
        for (const key of ["includeNotifications", "includeAppointmentChangeEvents", "includeGroomingRecords", "includeOwnerExtras", "includePilotCohort", "includeStaffProfileImages", "includePetDisplayPhotos"]) assert.equal(options[key], phase === "full", key);
        assert.ok(options.appointmentsFrom < options.appointmentsTo); assert.equal(options.groomingRecordLimit, 1000);
        assert.equal(options.notificationLimit, 200); assert.equal(options.onTiming, timing); return raw;
      } },
      "@/server/staff-privacy": { scopeBootstrapForStaff: (data, context) => {
        assert.equal(data, raw); assert.equal(context, owner); return { shop: data.shop, services: data.services };
      } },
      "@/lib/price-guide-core": { getPriceGuideCoreContract: () => "price-contract", projectCanonicalPriceGuidesForRead: value => value },
    };
    const runtimeModule = { exports: {} };
    Function("require", "module", "exports", output)(name => { assert.ok(modules[name], name); return modules[name]; }, runtimeModule, runtimeModule.exports);
    const result = await runtimeModule.exports.getOwnerBootstrapSnapshot(owner, phase, timing);
    assert.equal(result.secret, undefined); assert.deepEqual(result.actor, { shopId: owner.shopId, role, staffId: owner.staffId });
    assert.equal(result.priceGuideCore, "price-contract"); assert.deepEqual(result.services, raw.services);
  });
}
