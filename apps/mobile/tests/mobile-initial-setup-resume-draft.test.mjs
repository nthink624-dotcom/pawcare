import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/initial-setup-resume-draft.ts", import.meta.url), "utf8");
function harness() {
  const values = new Map();
  const sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, window: { sessionStorage }, Date });
  return { ...module.exports, values, sessionStorage };
}
const readiness = (hours = false, staff = false, pricing = false) => ({ shopId: "shop-a", steps: { hours, staff, pricing }, completed: hours && staff && pricing, nextStep: !hours ? "hours" : !staff ? "staff" : !pricing ? "pricing" : null });
const member = { id: "staff-a", name: "", defaultDays: [], startTime: "", endTime: "", profileImageFallbackKey: null };

test("pause retains incomplete staff edits in the scoped session without caching phone or server metadata", () => {
  const h = harness();
  h.saveSetupResumeDraft("owner-a:shop-a", "staff", [{ ...member, phone: "private", role: "대표", annualRemain: 10 }]);
  const raw = [...h.values.values()][0];
  assert.ok(!raw.includes("private") && !raw.includes("role") && !raw.includes("annualRemain"));
  const restored = h.readSetupResumeDraft("owner-a:shop-a", readiness(true), [{ ...member, role: "직원", phone: "fresh canonical" }]);
  assert.equal(restored.step, "staff"); assert.equal(restored.staff[0].name, ""); assert.equal(restored.staff[0].role, "직원"); assert.equal(restored.staff[0].phone, "fresh canonical");
  assert.equal(h.readSetupResumeDraft("owner-b:shop-a", readiness(true), []), null);
  assert.equal(h.readSetupResumeDraft("owner-a:shop-b", readiness(true), []), null);
});

test("resume may return to an earlier edited step but never skip canonical unfinished prerequisites", () => {
  const h = harness();
  h.saveSetupResumeDraft("key", "hours", [member]);
  assert.equal(h.readSetupResumeDraft("key", readiness(true, true), []).step, "hours");
  h.saveSetupResumeDraft("key", "pricing", [member]);
  assert.equal(h.readSetupResumeDraft("key", readiness(true), []), null);
  h.saveSetupResumeDraft("key", "pricing", [member]);
  assert.equal(h.readSetupResumeDraft("key", readiness(true, true), []).step, "pricing");
  assert.equal(h.readSetupResumeDraft("key", readiness(true, true, true), []), null);
  assert.equal(h.values.size, 0);
});

test("expired, future-dated, malformed and duplicate-ID drafts are discarded", () => {
  for (const mutate of [v => { v.savedAt -= 86400001; }, v => { v.savedAt += 10000; }, v => { v.staff[0].defaultDays = ["invalid"]; }, v => { v.staff.push(v.staff[0]); }, v => { v.step = "complete"; }]) {
    const h = harness(); h.saveSetupResumeDraft("key", "hours", [member]); const [key, raw] = [...h.values.entries()][0]; const value = JSON.parse(raw); mutate(value); h.values.set(key, JSON.stringify(value));
    assert.equal(h.readSetupResumeDraft("key", readiness(), []), null); assert.equal(h.values.size, 0);
  }
  const h = harness(); h.values.set("key:resume:v1", "broken json"); assert.equal(h.readSetupResumeDraft("key", readiness(), []), null);
});

test("storage failure or failed readback is surfaced so the caller can keep the modal open", () => {
  const h = harness(); h.sessionStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => h.saveSetupResumeDraft("key", "hours", [member]), /quota/);
  h.sessionStorage.setItem = () => undefined;
  assert.throws(() => h.saveSetupResumeDraft("key", "hours", [member]), /readback/);
});
