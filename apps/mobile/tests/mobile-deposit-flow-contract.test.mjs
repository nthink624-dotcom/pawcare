import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const output = ts.transpileModule(read("../src/lib/owner-customer-pet-integrity.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loadedModule = { exports: {} }; Function("module", "exports", output)(loadedModule, loadedModule.exports);
const { resolveOwnerMobileRoleContext: role } = loadedModule.exports;
const base = { shop: { id: "a" }, ownerProfile: null, staffMembers: [{ id: "s" }], appointments: [{ staff_id: "s" }] };

test("server-authorized owner membership does not become staff because primary profile is absent", () => {
  assert.deepEqual(role({ ...base, actor: { shopId: "a", role: "owner", staffId: null } }), { appRole: "owner", currentStaffId: null });
});
test("staff actor wins over an owner-shaped profile and requires the exact scoped lane", () => {
  assert.deepEqual(role({ ...base, ownerProfile: { user_id: "not-authority" }, actor: { shopId: "a", role: "staff", staffId: "s" } }), { appRole: "staff", currentStaffId: "s" });
  assert.throws(() => role({ ...base, actor: { shopId: "a", role: "staff", staffId: "other" } }));
  assert.throws(() => role({ ...base, actor: { shopId: "a", role: "staff", staffId: "s" }, appointments: [{ staff_id: "other" }] }));
});
test("cross-shop and malformed actor fail closed instead of falling back to an owner profile", () => {
  for (const actor of [{ shopId: "b", role: "owner", staffId: null }, { shopId: "a", role: "unknown" }, null]) assert.throws(() => role({ ...base, actor, ownerProfile: { user_id: "not-authority" } }));
});
test("older authenticated payloads retain their previous profile-based behavior", () => {
  assert.deepEqual(role({ ...base, ownerProfile: { user_id: "owner" } }), { appRole: "owner", currentStaffId: null });
  assert.deepEqual(role(base), { appRole: "staff", currentStaffId: "s" });
});
test("mobile detail uses shared deposit presentation and existing authenticated server APIs", () => {
  const source = read("../src/components/owner/owner-booking-deposit-panel.tsx");
  assert.match(source, /@petmanager\/shared\/components\/booking-deposit-ledger-panel/);
  assert.match(source, /fetchApiJsonWithAuth/);
  assert.match(source, /notifyCustomer: false, preserveStatus: true, depositTransfer: transfer/);
  assert.doesNotMatch(source, /createClient|SUPABASE_SERVICE_ROLE|\.from\(/);
  const owner = read("../src/components/owner/owner-app.tsx");
  assert.match(owner, /!isReadOnly && canViewGuardianContact \? <OwnerBookingDepositPanel/);
  assert.match(owner, /appointment\.status === "pending".*예약 대기 확인/);
});
test("customer mobile changes do not issue creation on resume, refresh or page show", () => {
  const resume = read("../../web/src/lib/use-booking-resume-refresh.ts");
  for (const event of ["focus", "pageshow", "visibilitychange"]) assert.ok(resume.includes(event));
  assert.doesNotMatch(resume, /POST|report_deposit|customer-bookings/);
  const ledger = read("../../shared/components/booking-deposit-ledger-panel.tsx");
  assert.match(ledger, /navigator\.clipboard\.writeText\(d\.bankAccount\)/);
  assert.match(ledger, /d\.reportValid && name\.trim\(\) === d\.payerName/);
  assert.match(ledger, /window\.visualViewport/);
  // Local reusable drafts can share the placeholder id 'primary'. Keep both names
  // selectable without changing any canonical pet id or hiding a test name.
  const flow = read("../../web/src/components/customer/customer-first-visit-claude-flow.tsx");
  assert.ok(flow.includes('key={`${pet.id}:${pet.name}`}'));
  const booking = read("../../web/src/components/customer/customer-booking-page.tsx");
  assert.match(booking, /window\.history\.replaceState\(null, "",/);
  assert.match(booking, /encodeURIComponent\(completedFirstVisitBooking\.bookingAccessToken\)[\s\S]*?window\.location\.reload\(\)/);
});
