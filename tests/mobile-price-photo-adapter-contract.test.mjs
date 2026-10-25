import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/lib/price-photo/mobile-price-photo-adapter.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");

function loadModule() {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  Function("module", "exports", output)(loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { createMobilePricePhotoCoordinator } = loadModule();

test("the adapter leaves backend URLs and payload schemas unresolved", () => {
  assert.match(source, /"fixed" \| "starting" \| "range" \| "unknown"/);
  assert.doesNotMatch(source, /fetch\(|\/api\/|supabase|openai|storage/i);
});

test("successful analysis cleans transient media exactly once", async () => {
  const calls = [];
  const adapter = {
    async uploadTransientPhoto() { calls.push("upload"); return { reference: "opaque" }; },
    async analyzeTransientPhoto() { calls.push("analyze"); return { document: { schemaVersion: 2 }, drafts: [{ clientId: "one" }] }; },
    async cleanupTransientPhoto(_photo, reason) { calls.push(`cleanup:${reason}`); },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  const rows = await createMobilePricePhotoCoordinator(adapter).analyze({});
  assert.equal(rows.drafts.length, 1);
  assert.deepEqual(calls, ["upload", "analyze", "cleanup:analyzed"]);
});

test("three-row analysis becomes available only after cleanup completes", async () => {
  let finishCleanup;
  const calls = [];
  const expected = {
    document: { schemaVersion: 2, rows: [{}, {}, {}] },
    drafts: [
      { clientId: "one", serviceName: "목욕" },
      { clientId: "two", serviceName: "전체 미용" },
      { clientId: "three", serviceName: "부분 미용" },
    ],
  };
  const adapter = {
    async uploadTransientPhoto() { calls.push("upload"); return { reference: "opaque" }; },
    async analyzeTransientPhoto() { calls.push("analyze"); return expected; },
    cleanupTransientPhoto() {
      calls.push("cleanup:start");
      return new Promise((resolve) => { finishCleanup = () => { calls.push("cleanup:done"); resolve(); }; });
    },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  let committed = false;
  const pending = createMobilePricePhotoCoordinator(adapter).analyze({}).then((result) => {
    committed = true;
    return result;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(committed, false);
  assert.deepEqual(calls, ["upload", "analyze", "cleanup:start"]);
  finishCleanup();
  const result = await pending;
  assert.equal(committed, true);
  assert.equal(result.drafts.length, 3);
  assert.equal(result, expected);
  assert.deepEqual(calls, ["upload", "analyze", "cleanup:start", "cleanup:done"]);
});

test("transient cleanup proof survives upload through cleanup before review commit", async () => {
  const calls = [];
  const transient = { reference: "media-one", cleanupProof: "a".repeat(64) };
  const analysis = { document: { schemaVersion: 2, rows: [{}, {}, {}] }, drafts: [{}, {}, {}] };
  const adapter = {
    async uploadTransientPhoto() { return transient; },
    async analyzeTransientPhoto(photo) {
      assert.equal(photo.cleanupProof, transient.cleanupProof);
      return analysis;
    },
    async cleanupTransientPhoto(photo, reason) {
      calls.push(`${reason}:${photo.reference}:${photo.cleanupProof}`);
    },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  const result = await createMobilePricePhotoCoordinator(adapter).analyze({});
  assert.equal(result, analysis);
  assert.deepEqual(calls, [`analyzed:media-one:${transient.cleanupProof}`]);
});

test("cancel during successful cleanup suppresses the late review result", async () => {
  let finishCleanup;
  const adapter = {
    async uploadTransientPhoto() { return { reference: "opaque" }; },
    async analyzeTransientPhoto() { return { document: { schemaVersion: 2 }, drafts: [{ clientId: "late" }] }; },
    cleanupTransientPhoto() { return new Promise((resolve) => { finishCleanup = resolve; }); },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  const coordinator = createMobilePricePhotoCoordinator(adapter);
  const pending = coordinator.analyze({});
  await new Promise((resolve) => setImmediate(resolve));
  coordinator.cancel();
  finishCleanup();
  await assert.rejects(pending, (error) => error.name === "AbortError");
});

test("cancelled late upload is ignored and cleaned exactly once", async () => {
  let finishUpload;
  const calls = [];
  const adapter = {
    uploadTransientPhoto() { calls.push("upload"); return new Promise((resolve) => { finishUpload = resolve; }); },
    async analyzeTransientPhoto() { calls.push("analyze"); return []; },
    async cleanupTransientPhoto(_photo, reason) { calls.push(`cleanup:${reason}`); },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  const coordinator = createMobilePricePhotoCoordinator(adapter);
  const pending = coordinator.analyze({});
  coordinator.cancel();
  finishUpload({ reference: "late" });
  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.deepEqual(calls, ["upload", "cleanup:cancelled"]);
});

test("analysis timeout cleans transient media and performs no service mutation", async () => {
  const calls = [];
  const adapter = {
    async uploadTransientPhoto() { calls.push("upload"); return { reference: "timeout-photo" }; },
    async analyzeTransientPhoto() { calls.push("analyze"); throw new Error("분석 시간이 초과되었습니다."); },
    async cleanupTransientPhoto(_photo, reason) { calls.push(`cleanup:${reason}`); },
    async saveServices() { calls.push("save"); },
    async requeryServices() { calls.push("requery"); },
  };
  await assert.rejects(createMobilePricePhotoCoordinator(adapter).analyze({}), /시간이 초과/);
  assert.deepEqual(calls, ["upload", "analyze", "cleanup:failed"]);
});

test("save completes before the no-store requery adapter step", async () => {
  const calls = [];
  const document = { schemaVersion: 2, source: "owner_corrected", rows: [] };
  const adapter = {
    async uploadTransientPhoto() { return { reference: "opaque" }; },
    async analyzeTransientPhoto() { return []; },
    async cleanupTransientPhoto() {},
    async saveServices() { calls.push("save"); },
    async requeryServices(serviceId) {
      calls.push("requery");
      return { serviceId, document, drafts: [{ clientId: "saved" }] };
    },
  };
  const persisted = await createMobilePricePhotoCoordinator(adapter).saveAndRequery(document);
  assert.deepEqual(calls, ["save", "requery"]);
  assert.equal(persisted.drafts[0].clientId, "saved");
  assert.equal(persisted.document, document);
});

test("create retries keep stable service and request ids until one successful save", async () => {
  const intents = [];
  let attempts = 0;
  const document = { schemaVersion: 2, rows: [{ serviceName: "목욕", priceMinKrw: 0 }] };
  const adapter = {
    async uploadTransientPhoto() { throw new Error("unused"); },
    async analyzeTransientPhoto() { throw new Error("unused"); },
    async cleanupTransientPhoto() {},
    async saveServices(_document, intent) {
      intents.push({ ...intent });
      attempts += 1;
      if (attempts === 1) throw new Error("uncertain response");
    },
    async requeryServices(serviceId) { return { serviceId, document, drafts: [{ clientId: "saved" }] }; },
  };
  const coordinator = createMobilePricePhotoCoordinator(adapter);
  await assert.rejects(coordinator.saveAndRequery(document), /uncertain/);
  await coordinator.saveAndRequery(document);
  assert.equal(intents.length, 2);
  assert.deepEqual(intents[1], intents[0]);
  assert.equal(intents[0].operation, "create");
  assert.ok(intents[0].serviceId);
  assert.ok(intents[0].requestId);
});

test("changed payload gets new create ids and duplicate in-flight save sends once", async () => {
  const intents = [];
  let release;
  const adapter = {
    async uploadTransientPhoto() { throw new Error("unused"); },
    async analyzeTransientPhoto() { throw new Error("unused"); },
    async cleanupTransientPhoto() {},
    saveServices(_document, intent) {
      intents.push({ ...intent });
      return new Promise((resolve) => { release = resolve; });
    },
    async requeryServices(serviceId) { return { serviceId, document: firstDocument, drafts: [] }; },
  };
  const coordinator = createMobilePricePhotoCoordinator(adapter);
  const firstDocument = { schemaVersion: 2, rows: [{ serviceName: "목욕", priceMinKrw: 0 }] };
  const first = coordinator.saveAndRequery(firstDocument);
  const duplicate = coordinator.saveAndRequery(firstDocument);
  assert.equal(intents.length, 1);
  release();
  await Promise.all([first, duplicate]);
  const second = coordinator.saveAndRequery({ ...firstDocument, rows: [{ serviceName: "목욕", priceMinKrw: 1 }] });
  assert.equal(intents.length, 2);
  assert.notEqual(intents[1].serviceId, intents[0].serviceId);
  assert.notEqual(intents[1].requestId, intents[0].requestId);
  release();
  await second;
});

test("a remounted coordinator updates the persisted service identity without collapsing the document", async () => {
  const intents = [];
  const document = {
    schemaVersion: 2,
    source: "owner_corrected",
    overallNote: "원본 안내",
    rows: [{
      serviceName: "견종별 미용",
      species: "dog",
      breedNames: ["푸들"],
      breedGroup: "장모",
      sizeClass: "small",
      minKg: 1,
      maxKg: 5,
      priceKind: "range",
      priceMinKrw: 30_000,
      priceMaxKrw: 45_000,
      durationMinutes: 90,
      note: "엉킴 추가",
    }],
    surcharges: [{ condition: "엉킴", amountKrw: 5_000, percent: null, note: null }],
    aiReview: [{ targetId: "row-1", field: "price", rawText: "3~4.5", confidence: "medium", userConfirmed: true, userCorrected: true }],
  };
  const adapter = {
    async uploadTransientPhoto() { throw new Error("unused"); },
    async analyzeTransientPhoto() { throw new Error("unused"); },
    async cleanupTransientPhoto() {},
    async saveServices(savedDocument, intent) {
      intents.push({ document: savedDocument, intent: { ...intent } });
    },
    async requeryServices(serviceId) {
      return { serviceId, document, drafts: [{ clientId: "price-row-0", rowIndex: 0, serviceName: "견종별 미용" }] };
    },
  };

  const persistedServiceId = "service-existing";
  const result = await createMobilePricePhotoCoordinator(adapter).saveAndRequery(document, persistedServiceId);
  assert.equal(intents.length, 1);
  assert.equal(intents[0].intent.operation, "update");
  assert.equal(intents[0].intent.serviceId, persistedServiceId);
  assert.ok(intents[0].intent.requestId);
  assert.equal(result.serviceId, persistedServiceId);
  assert.deepEqual(result.document, document);
  assert.deepEqual(result.document.rows[0].breedNames, ["푸들"]);
  assert.equal(result.document.rows[0].priceMaxKrw, 45_000);
});

test("an uncertain update retry keeps the persisted service and request ids", async () => {
  const intents = [];
  let attempts = 0;
  const document = { schemaVersion: 2, source: "owner_corrected", rows: [{ serviceName: "목욕", priceMinKrw: 25_000 }] };
  const adapter = {
    async uploadTransientPhoto() { throw new Error("unused"); },
    async analyzeTransientPhoto() { throw new Error("unused"); },
    async cleanupTransientPhoto() {},
    async saveServices(_document, intent) {
      intents.push({ ...intent });
      attempts += 1;
      if (attempts === 1) throw new Error("uncertain update");
    },
    async requeryServices(serviceId) { return { serviceId, document, drafts: [] }; },
  };
  const coordinator = createMobilePricePhotoCoordinator(adapter);
  await assert.rejects(coordinator.saveAndRequery(document, "service-existing"), /uncertain update/);
  await coordinator.saveAndRequery(document, "service-existing");
  assert.equal(intents.length, 2);
  assert.deepEqual(intents[1], intents[0]);
  assert.equal(intents[0].operation, "update");
  assert.equal(intents[0].serviceId, "service-existing");
  assert.ok(intents[0].requestId);
});

test("cleanup failure rejects analysis instead of committing a late result", async () => {
  const adapter = {
    async uploadTransientPhoto() { return { reference: "pending" }; },
    async analyzeTransientPhoto() { return { document: { schemaVersion: 2 }, drafts: [{ clientId: "must-not-commit" }] }; },
    async cleanupTransientPhoto() { throw new Error("cleanup unavailable"); },
    async saveServices() {},
    async requeryServices() { return []; },
  };
  await assert.rejects(createMobilePricePhotoCoordinator(adapter).analyze({}), /cleanup unavailable/);
});
