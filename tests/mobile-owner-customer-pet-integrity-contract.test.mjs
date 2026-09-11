import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const helperPath = new URL("../src/lib/owner-customer-pet-integrity.ts", import.meta.url);
const ownerPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const pagePath = new URL("../src/app/owner/mobile/page.tsx", import.meta.url);
const domainPath = new URL("../src/types/domain.ts", import.meta.url);
const helperSource = await readFile(helperPath, "utf8");
const ownerSource = await readFile(ownerPath, "utf8");
const pageSource = await readFile(pagePath, "utf8");
const domainSource = await readFile(domainPath, "utf8");

function loadHelper() {
  const output = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  Function("module", "exports", output)(module, module.exports);
  return module.exports;
}

const { assertCurrentShopEntity, assertCurrentShopEntities, assertOwnerBootstrapPayload, createGuardianAndPets } = loadHelper();

test("guardian create failure prevents every pet POST and is not retried", async () => {
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    throw new Error("고객 저장 실패");
  };
  await assert.rejects(
    createGuardianAndPets({ shopId: "shop-a", guardianPayload: {}, petPayloads: [{ name: "pet" }], request }),
    /고객 저장 실패/,
  );
  assert.deepEqual(calls, ["/api/guardians"]);
});

test("pets use only the exact guardian id returned by create", async () => {
  const bodies = [];
  const request = async (url, init) => {
    bodies.push({ url, body: JSON.parse(init.body) });
    return url === "/api/guardians" ? { id: "created-guardian", shop_id: "shop-a" } : { id: "pet" };
  };
  await createGuardianAndPets({
    shopId: "shop-a",
    guardianPayload: { name: "owner" },
    petPayloads: [{ name: "one" }, { name: "two" }],
    request,
  });
  assert.deepEqual(bodies.map((call) => call.url), ["/api/guardians", "/api/pets", "/api/pets"]);
  assert.deepEqual(bodies.slice(1).map((call) => call.body.guardianId), ["created-guardian", "created-guardian"]);
  assert.deepEqual(bodies.map((call) => call.body.shopId), ["shop-a", "shop-a", "shop-a"]);
  assert.doesNotMatch(ownerSource, /guardians\[refreshed\.guardians\.length - 1\]/);
});

test("mismatched or missing shop entities are blocked before mutation", () => {
  const entities = [{ id: "guardian-a", shop_id: "shop-a" }];
  assert.equal(assertCurrentShopEntity(entities, "guardian-a", "shop-a", "고객").id, "guardian-a");
  assert.throws(() => assertCurrentShopEntity(entities, "guardian-a", "shop-b", "고객"), /현재 매장/);
  assert.throws(() => assertCurrentShopEntity(entities, "missing", "shop-a", "고객"), /현재 매장/);
  assert.throws(() => assertCurrentShopEntities(entities, ["guardian-a", "guardian-a"], "shop-a", "고객"), /선택 정보/);
});

test("production bootstrap rejects mock, cross-shop rows, and unknown statuses", () => {
  const base = {
    mode: "supabase",
    shop: { id: "shop-a" },
    guardians: [], pets: [], services: [], staffMembers: [], appointments: [],
    groomingRecords: [], notifications: [], landingInterests: [], landingFeedback: [],
  };
  assert.equal(assertOwnerBootstrapPayload(base, "shop-a", { allowMock: false }), base);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, mode: "mock" }, "shop-a", { allowMock: false }), /운영 데이터/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, guardians: [{ id: "g", shop_id: "shop-b" }] }, "shop-a", { allowMock: false }), /다른 매장/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, appointments: [{ shop_id: "shop-a", status: "mystery" }] }, "shop-a", { allowMock: false }), /예약 데이터/);
});

test("bootstrap fails closed for every broken appointment relationship", () => {
  const guardian = { id: "g-a", shop_id: "shop-a" };
  const pet = { id: "p-a", shop_id: "shop-a", guardian_id: "g-a" };
  const service = { id: "s-a", shop_id: "shop-a" };
  const appointment = {
    id: "a-a", shop_id: "shop-a", guardian_id: "g-a", pet_id: "p-a", service_id: "s-a", status: "confirmed",
  };
  const base = {
    mode: "supabase", shop: { id: "shop-a" }, guardians: [guardian], pets: [pet], services: [service],
    staffMembers: [], appointments: [appointment], groomingRecords: [], notifications: [], landingInterests: [], landingFeedback: [],
  };
  assert.equal(assertOwnerBootstrapPayload(base, "shop-a", { allowMock: false }), base);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, guardians: [] }, "shop-a", { allowMock: false }), /연결 정보/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, pets: [] }, "shop-a", { allowMock: false }), /연결 정보/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, services: [] }, "shop-a", { allowMock: false }), /연결 정보/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, pets: [{ ...pet, guardian_id: "g-other" }] }, "shop-a", { allowMock: false }), /연결 정보/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, services: [{ ...service, shop_id: "shop-b" }] }, "shop-a", { allowMock: false }), /다른 매장/);
  assert.throws(() => assertOwnerBootstrapPayload({ ...base, appointments: [{ ...appointment, shop_id: "shop-b" }] }, "shop-a", { allowMock: false }), /예약 데이터/);
});

test("preview query alone cannot enable production or remote mock bootstrap", () => {
  assert.match(pageSource, /process\.env\.NODE_ENV === "production"\) return false/);
  assert.match(pageSource, /window\.location\.hostname !== "127\.0\.0\.1"/);
  assert.match(pageSource, /window\.location\.hostname !== "localhost"/);
  assert.match(pageSource, /params\.get\("preview"\) === "1"/);
});

test("mobile DTO includes canonical nullable customer and pet projection fields", () => {
  assert.match(domainSource, /customer_grade_override\?: CustomerGradeOverride \| null/);
  assert.match(domainSource, /customer_member_type\?: CustomerMemberType \| null/);
  assert.match(domainSource, /pricing_group\?: string \| null/);
  for (const status of ["pending", "confirmed", "in_progress", "almost_done", "completed", "cancelled", "rejected", "noshow"]) {
    assert.match(domainSource, new RegExp(`\\| "${status}"`));
  }
});

test("guardian and pet update/delete payloads carry shopId", () => {
  assert.match(ownerSource, /JSON\.stringify\(\{ shopId: data\.shop\.id, guardianId, notificationSettings: patch \}\)/);
  assert.match(ownerSource, /JSON\.stringify\(\{ shopId: data\.shop\.id, guardianId, name, phone, memo \}\)/);
  assert.match(ownerSource, /JSON\.stringify\(\{ shopId: data\.shop\.id, guardianId \}\)/);
  assert.match(ownerSource, /JSON\.stringify\(\{ shopId: data\.shop\.id, guardianIds: scopedGuardianIds \}\)/);
  assert.match(ownerSource, /JSON\.stringify\(\{ shopId: data\.shop\.id, petId, name, breed, birthday \}\)/);
  assert.match(ownerSource, /newCustomerSaveInFlightRef\.current/);
});
