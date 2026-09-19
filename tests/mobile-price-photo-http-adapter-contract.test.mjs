import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-http-adapter.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-adapter.ts", import.meta.url), "utf8");
const cleanupSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-cleanup.ts", import.meta.url), "utf8");
const matrixSource = await readFile(new URL("../src/lib/price-photo/mobile-price-guide-matrix.ts", import.meta.url), "utf8");
const generatedCoreSource = await readFile(new URL("../src/lib/price-photo/generated-price-guide-core.ts", import.meta.url), "utf8");
const nodeRequire = createRequire(import.meta.url);

function transpile(sourceText, requireImpl = () => ({})) {
  const output = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  Function("module", "exports", "require", output)(loadedModule, loadedModule.exports, requireImpl);
  return loadedModule.exports;
}

const cleanupModule = transpile(cleanupSource);
const generatedCoreModule = transpile(generatedCoreSource, (specifier) => {
  if (specifier === "zod") return nodeRequire("zod");
  throw new Error(`unexpected import: ${specifier}`);
});
const coordinatorModule = transpile(coordinatorSource, (specifier) => {
  if (specifier === "@/lib/price-photo/generated-price-guide-core") return generatedCoreModule;
  throw new Error(`unexpected import: ${specifier}`);
});
const matrixModule = transpile(matrixSource, (specifier) => {
  if (specifier === "./mobile-price-photo-adapter") return coordinatorModule;
  throw new Error(`unexpected import: ${specifier}`);
});
const adapterModule = transpile(source, (specifier) => {
  if (specifier === "@/lib/api") return { getAccessTokenWithRecovery: async () => "token" };
  if (specifier === "@/lib/supabase/client") return { getSupabaseBrowserClient: () => null };
  if (specifier === "./mobile-price-photo-cleanup") return cleanupModule;
  if (specifier === "./mobile-price-photo-adapter") return coordinatorModule;
  if (specifier === "./generated-price-guide-core") return generatedCoreModule;
  throw new Error(`unexpected import: ${specifier}`);
});

const {
  buildSingleSourcePhotoImportBody,
  createMobilePricePhotoHttpAdapter,
  getMobilePricePhotoRecoveryMessage,
  MobilePricePhotoAuthenticationError,
  MobilePricePhotoStageError,
} = adapterModule;
const photo = new File([new Uint8Array([1, 2, 3])], "guide.jpg", { type: "image/jpeg" });
const context = { runId: 1, signal: new AbortController().signal };
const cleanupProof = "a".repeat(64);
const mediaAssetId = "33333333-3333-4333-8333-333333333333";
const correlationFingerprint = "b".repeat(64);
const assetFingerprint = "c".repeat(64);
const objectLifecycleFingerprint = "d".repeat(64);
const receiptFingerprint = "e".repeat(64);
const createIntent = { operation: "create", serviceId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222" };
const ok = (body = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const fail = () => new Response(JSON.stringify({ message: "mock failure" }), { status: 500, headers: { "content-type": "application/json" } });

function intentBodyFor(init) {
  const request = JSON.parse(init.body);
  return {
    mediaAsset: { id: mediaAssetId },
    cleanupProof,
    cleanupBinding: {
      requestCorrelationFingerprint: request.requestCorrelationFingerprint,
      correlationFingerprint,
      assetFingerprint,
      objectLifecycleFingerprint,
    },
    upload: { bucket: "private", path: "one", method: "PUT", signedUrl: "https://signed.invalid/put" },
  };
}

function cleanupReceiptFor(binding) {
  return {
    hardPurged: true,
    alreadyPurged: false,
    requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
    correlationFingerprint: binding.correlationFingerprint,
    assetFingerprint: binding.assetFingerprint,
    objectLifecycleFingerprint: binding.objectLifecycleFingerprint,
    objectResidueCount: 0,
    metadataResidueCount: 0,
    receiptFingerprint,
  };
}

function cleanupReceiptFromRequest(init) {
  return cleanupReceiptFor(JSON.parse(init.body).cleanupProofs[0]);
}

test("adapter is pinned to the accepted media and photo-import contract", () => {
  assert.match(source, /"\/api\/owner\/media\/upload-intents"/);
  assert.match(source, /mediaKind: "price_guide_source"/);
  assert.match(source, /visibility: "private"/);
  assert.match(source, /retentionPolicy: "archive"/);
  assert.match(source, /uploadedFrom: "owner_mobile"/);
  assert.match(source, /"\/api\/owner\/media\/complete"/);
  assert.match(source, /"\/api\/owner\/price-guide-photo-import"/);
  assert.match(source, /privacyConfirmed: true/);
});

test("0/1/2/15 source fixtures permit exactly one provider-bound request", () => {
  for (const [count, expectedCalls] of [[0, 0], [1, 1], [2, 0], [15, 0]]) {
    let providerCalls = 0;
    const ids = Array.from({ length: count }, (_, index) => `media-${index}`);
    try {
      const body = buildSingleSourcePhotoImportBody("shop", ids);
      providerCalls += 1;
      assert.equal(body.mediaAssetIds.length, 1);
    } catch (error) {
      assert.match(error.message, /한 장만/);
    }
    assert.equal(providerCalls, expectedCalls);
  }
});

test("authenticated PC calls omit cookies and cleanup is idempotent", () => {
  assert.match(source, /headers\.set\("Authorization", `Bearer \$\{token\}`\)/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /createTransientCleanupRegistry/);
  assert.match(source, /cleanupRegistry\.acquire\(reference\)/);
  assert.match(source, /await cleanupRegistry\.retryPending\(\)/);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /clientCorrelationId/);
  assert.match(source, /requestCorrelationFingerprint/);
  assert.match(source, /cleanupProofs: \[cleanupProofBody\(binding\)\]/);
  assert.match(source, /requireHardPurgeReceipt/);
});

test("a recoverable owner session authorizes exactly one upload intent", async () => {
  let sessionRecoveryCalls = 0;
  const requests = [];
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    accessToken: async () => {
      sessionRecoveryCalls += 1;
      return "recovered-token";
    },
    fetchImpl: async (url, init) => {
      requests.push({ url: url.toString(), method: init?.method, credentials: init?.credentials });
      if (url.toString().includes("upload-intents")) return ok(intentBodyFor(init));
      if (url.toString().includes("signed.invalid")) return new Response(null, { status: 200 });
      if (url.toString().includes("/media/complete")) return ok();
      throw new Error("unexpected mock request");
    },
  });

  await adapter.uploadTransientPhoto(photo, context);
  assert.equal(sessionRecoveryCalls, 2, "each authenticated PC contract request uses the shared recovery authority");
  assert.equal(requests.filter((request) => request.url.includes("upload-intents")).length, 1);
  assert.equal(requests[0].credentials, "omit");
});

test("a truly unauthenticated owner starts no network request", async () => {
  let requests = 0;
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    accessToken: async () => null,
    fetchImpl: async () => {
      requests += 1;
      return ok();
    },
  });

  await assert.rejects(adapter.uploadTransientPhoto(photo, context), MobilePricePhotoAuthenticationError);
  assert.equal(requests, 0);
});

test("missing cleanup proof fails closed before upload and sends no cleanup", async () => {
  const paths = [];
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    paths.push(`${init?.method ?? "GET"} ${url}`);
    return ok({ ...intentBodyFor(init), cleanupProof: null });
  } });
  await assert.rejects(adapter.uploadTransientPhoto(photo, context), (error) => error instanceof MobilePricePhotoStageError && error.stage === "upload_intent");
  assert.equal(paths.length, 1);
  assert.match(paths[0], /upload-intents/);
});

test("no-network failure fixtures retain the exact recoverable photo stage", async () => {
  for (const [stage, responseFor] of [
    ["upload_intent", () => fail()],
    ["upload", () => new Response(null, { status: 500 })],
    ["complete", () => fail()],
  ]) {
    const paths = [];
    const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
      const path = url.toString();
      paths.push(path);
      if (path.includes("upload-intents")) return stage === "upload_intent" ? responseFor() : ok(intentBodyFor(init));
      if (path.includes("signed.invalid")) return stage === "upload" ? responseFor() : new Response(null, { status: 200 });
      if (path.includes("/media/complete")) return stage === "complete" ? responseFor() : ok();
      if (init?.method === "DELETE") return ok({ cleanupReceipt: cleanupReceiptFromRequest(init) });
      throw new Error("unexpected mock request");
    } });
    await assert.rejects(adapter.uploadTransientPhoto(photo, context), (error) => error instanceof MobilePricePhotoStageError && error.stage === stage);
    assert.equal(paths.filter((path) => path.includes("upload-intents")).length, 1);
  }
});

test("provider validation keeps only the allowlisted subtype and maps a safe recovery message", async () => {
  const cases = [
    ["NO_ROWS", "사진에서 요금표 항목을 찾지 못했어요. 표 전체가 보이도록 다시 촬영해 주세요."],
    ["AXIS_INVALID", "체급과 서비스 구분을 확인하지 못했어요. 표의 행과 열이 모두 보이도록 다시 촬영해 주세요."],
    ["SHAPE_INVALID", "요금표 행과 열을 맞추지 못했어요. 표를 정면에서 다시 촬영해 주세요."],
    ["SCHEMA_INVALID", "사진 속 요금표 구조를 확인하지 못했어요. 표 전체가 보이도록 다시 촬영해 주세요."],
    ["RAW_PROVIDER_DETAIL", "사진 속 요금표 구조를 확인하지 못했어요. 더 선명한 사진으로 다시 시도해 주세요."],
  ];

  for (const [index, [safeSubtype, expectedMessage]] of cases.entries()) {
    const requests = [];
    const adapter = createMobilePricePhotoHttpAdapter({
      backendOrigin: "https://pc.invalid",
      shopId: "shop",
      fetchImpl: async (url, init) => {
        const path = url.toString();
        requests.push({ path, method: init?.method });
        if (path.includes("upload-intents")) return ok(intentBodyFor(init));
        if (path.includes("signed.invalid")) return new Response(null, { status: 200 });
        if (path.includes("/media/complete")) return ok();
        if (path.includes("price-guide-photo-import") && init?.method === "POST") {
          const request = JSON.parse(init.body);
          return new Response(JSON.stringify({
            code: "VISION_PROVIDER_INVALID_RESPONSE",
            safeSubtype,
            message: "raw provider detail must never reach mobile",
            cleanupReceipt: cleanupReceiptFor(request.cleanupProofs[0]),
          }), { status: 422, headers: { "content-type": "application/json" } });
        }
        if (init?.method === "DELETE") throw new Error("verified hard purge must suppress client DELETE");
        throw new Error(`unexpected mock request: ${init?.method} ${path}`);
      },
    });
    const transient = await adapter.uploadTransientPhoto(photo, { ...context, runId: index + 10 });
    let capturedError;
    await assert.rejects(
      adapter.analyzeTransientPhoto(transient, { ...context, runId: index + 20 }),
      (error) => {
        capturedError = error;
        assert.ok(error instanceof MobilePricePhotoStageError);
        assert.equal(error.stage, "import");
        assert.equal(error.code, "VISION_PROVIDER_INVALID_RESPONSE");
        assert.equal(error.safeSubtype, safeSubtype === "RAW_PROVIDER_DETAIL" ? null : safeSubtype);
        assert.doesNotMatch(error.message, /raw provider detail/);
        return true;
      },
    );
    assert.equal(getMobilePricePhotoRecoveryMessage(capturedError), expectedMessage);
    await adapter.cleanupTransientPhoto(transient);
    assert.equal(requests.filter(({ path, method }) => path.includes("upload-intents") && method === "POST").length, 1);
    assert.equal(requests.filter(({ path, method }) => path.includes("price-guide-photo-import") && method === "POST").length, 1);
    assert.equal(requests.filter(({ method }) => method === "DELETE").length, 0);
  }
});

test("intent-acquired media remains cleanup eligible before PUT and complete", () => {
  const acquireIndex = source.indexOf("cleanupRegistry.acquire(reference)");
  const uploadIndex = source.indexOf("fetchImpl(intent.upload.signedUrl");
  const completeIndex = source.indexOf('pcRequest("/api/owner/media/complete"');
  assert.ok(acquireIndex > 0 && acquireIndex < uploadIndex && uploadIndex < completeIndex);
  assert.match(source, /catch \(error\)[\s\S]*await cleanupRegistry\.cleanup\(reference\)/);
});

test("save is followed by an essential no-store bootstrap requery", () => {
  assert.match(source, /"\/api\/services"/);
  assert.match(source, /phase=essential/);
  assert.match(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /localhost|127\.0\.0\.1|petmanager-app\.vercel\.app/);
});

test("no-store requery returns the exact persisted identity and full price guide", async () => {
  const document = {
    schemaVersion: 2,
    source: "owner_corrected",
    overallNote: "원본 안내",
    rows: [{
      sourceItemId: "pgi_test_row_1",
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
  const requests = [];
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    fetchImpl: async (url, init) => {
      requests.push({ url: url.toString(), cache: init?.cache });
      return ok({ priceGuideCore: generatedCoreModule.getMobilePriceGuideCoreContract(), services: [
        { id: "other-service", price_guide: { ...document, overallNote: "다른 요금표" } },
        { id: "service-existing", price_guide: document },
      ] });
    },
  });

  const persisted = await adapter.requeryServices("service-existing", context.signal);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].cache, "no-store");
  assert.equal(persisted.serviceId, "service-existing");
  assert.deepEqual(persisted.document, document);
  assert.deepEqual(persisted.document.rows[0].breedNames, ["푸들"]);
  assert.equal(persisted.document.rows[0].durationMinutes, 90);
  assert.equal(persisted.drafts[0].maximumPrice, 45_000);
});

test("bootstrap core mismatch fails closed before accepting persisted data", async () => {
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    fetchImpl: async () => ok({
      priceGuideCore: { version: "2.0.0", sourceHash: "0".repeat(64) },
      services: [],
    }),
  });
  await assert.rejects(adapter.requeryServices("service-existing", context.signal));
});

test("service save accepts only canonical integer KRW 0 through 100,000,000", async () => {
  const requests = [];
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    requests.push({ url: url.toString(), body: init?.body ? JSON.parse(init.body) : null });
    return ok();
  } });
  const documentFor = (priceKind, priceMinKrw, priceMaxKrw = null) => ({
    schemaVersion: 2, source: "manual", overallNote: null,
    rows: [{ serviceName: "목욕", species: "all", breedNames: [], breedGroup: null, sizeClass: "all", minKg: null, maxKg: null, priceKind, priceMinKrw, priceMaxKrw, durationMinutes: 60, note: null }],
    surcharges: [], aiReview: [],
  });
  for (const price of [0, 100_000_000]) await adapter.saveServices(documentFor("fixed", price), createIntent, context.signal);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.operation, "create");
  assert.equal(requests[0].body.serviceId, createIntent.serviceId);
  assert.equal(requests[0].body.requestId, createIntent.requestId);
  for (const price of [-1, 0.5, 100_000_000.1, 100_000_001]) {
    await assert.rejects(adapter.saveServices(documentFor("starting", price), createIntent, context.signal), /정수/);
  }
  await assert.rejects(adapter.saveServices(documentFor("range", 10, 9), createIntent, context.signal), /최대 가격/);
  await assert.rejects(adapter.saveServices(documentFor("range", 10, 100_000_001), createIntent, context.signal), /최대 가격/);
  assert.equal(requests.length, 2, "invalid prices must perform zero mutations");
});

test("update save preserves the persisted service id in one mutation", async () => {
  const requests = [];
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    requests.push({ url: url.toString(), body: init?.body ? JSON.parse(init.body) : null });
    return ok();
  } });
  const document = {
    schemaVersion: 2, source: "owner_corrected", overallNote: null,
    rows: [{ serviceName: "목욕", species: "dog", breedNames: ["푸들"], breedGroup: null, sizeClass: "small", minKg: null, maxKg: 5, priceKind: "range", priceMinKrw: 30_000, priceMaxKrw: 45_000, durationMinutes: 90, note: null }],
    surcharges: [], aiReview: [],
  };
  const updateIntent = { operation: "update", serviceId: "service-existing", requestId: "request-update" };
  await adapter.saveServices(document, updateIntent, context.signal);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.operation, "update");
  assert.equal(requests[0].body.serviceId, "service-existing");
  assert.equal(requests[0].body.requestId, "request-update");
  assert.deepEqual(requests[0].body.priceGuide, document);
});

test("intent failure acquires no media and sends no cleanup", async () => {
  const paths = [];
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    paths.push(`${init?.method ?? "GET"} ${url}`);
    return fail();
  } });
  await assert.rejects(adapter.uploadTransientPhoto(photo, context), (error) => error instanceof MobilePricePhotoStageError && error.stage === "upload_intent");
  assert.equal(paths.length, 1);
  assert.match(paths[0], /upload-intents/);
});

for (const failureStage of ["put", "complete"]) {
  test(`${failureStage} failure cleans the intent-acquired media`, async () => {
    const paths = [];
    const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
      const path = `${init?.method ?? "GET"} ${url}`;
      paths.push(path);
      if (url.toString().includes("upload-intents")) return ok(intentBodyFor(init));
      if (url.toString().includes("signed.invalid")) return failureStage === "put" ? new Response(null, { status: 500 }) : new Response(null, { status: 200 });
      if (url.toString().includes("/media/complete")) return failureStage === "complete" ? fail() : ok();
      if (init?.method === "DELETE") return ok({ cleanupReceipt: cleanupReceiptFromRequest(init) });
      throw new Error(`unexpected fetch: ${path}`);
    } });
    await assert.rejects(adapter.uploadTransientPhoto(photo, context));
    assert.equal(paths.filter((path) => path.startsWith("DELETE ")).length, 1);
  });
}

test("import failure cleans completed media and failed DELETE retries before save", async () => {
  let deleteCalls = 0;
  const paths = [];
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    const path = `${init?.method ?? "GET"} ${url}`;
    paths.push(path);
    if (url.toString().includes("upload-intents")) return ok(intentBodyFor(init));
    if (url.toString().includes("signed.invalid")) return new Response(null, { status: 200 });
    if (url.toString().includes("/media/complete")) return ok();
    if (url.toString().includes("price-guide-photo-import") && init?.method === "POST") return fail();
    if (url.toString().includes("price-guide-photo-import") && init?.method === "DELETE") {
      const body = JSON.parse(init.body);
      assert.equal(body.cleanupProofs.length, 1);
      assert.equal(body.cleanupProofs[0].mediaAssetId, mediaAssetId);
      assert.equal(body.cleanupProofs[0].proof, cleanupProof);
      assert.match(body.cleanupProofs[0].clientCorrelationId, /^[0-9a-f-]{36}$/i);
      deleteCalls += 1;
      return deleteCalls === 1 ? fail() : ok({ cleanupReceipt: cleanupReceiptFromRequest(init) });
    }
    if (url.toString().endsWith("/api/services")) return ok();
    throw new Error(`unexpected fetch: ${path}`);
  } });
  const transient = await adapter.uploadTransientPhoto(photo, context);
  await assert.rejects(adapter.analyzeTransientPhoto(transient, context), (error) => error instanceof MobilePricePhotoStageError && error.stage === "import");
  await assert.rejects(adapter.cleanupTransientPhoto(transient, "failed"), /mock failure/);
  await adapter.saveServices({ schemaVersion: 2, source: "manual", overallNote: null, rows: [{ serviceName: "목욕", species: "all", breedNames: [], breedGroup: null, sizeClass: "all", minKg: null, maxKg: null, priceKind: "fixed", priceMinKrw: 1000, priceMaxKrw: null, durationMinutes: 60, note: null }], surcharges: [], aiReview: [] }, createIntent, context.signal);
  assert.equal(deleteCalls, 2);
  assert.ok(paths.at(-1).endsWith("/api/services"));
});

test("mismatched cleanup proof is rejected before DELETE", async () => {
  let deleteCalls = 0;
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    if (url.toString().includes("upload-intents")) return ok(intentBodyFor(init));
    if (url.toString().includes("signed.invalid")) return new Response(null, { status: 200 });
    if (url.toString().includes("/media/complete")) return ok();
    if (init?.method === "DELETE") deleteCalls += 1;
    return ok();
  } });
  const transient = await adapter.uploadTransientPhoto(photo, context);
  await assert.rejects(adapter.cleanupTransientPhoto({ ...transient, cleanupProof: "b".repeat(64) }, "failed"), /정리 정보를 확인하지 못했습니다/);
  assert.equal(deleteCalls, 0);
});

test("one run can issue at most one photo import request", async () => {
  let importCalls = 0;
  const binding = {
    mediaAssetId,
    clientCorrelationId: "44444444-4444-4444-8444-444444444444",
    requestCorrelationFingerprint: "f".repeat(64),
    cleanupProof,
    correlationFingerprint,
    assetFingerprint,
    objectLifecycleFingerprint,
  };
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async (url, init) => {
    if (url.toString().includes("price-guide-photo-import") && init?.method === "POST") {
      importCalls += 1;
      return ok({ document: { schemaVersion: 2, source: "vision", overallNote: null, rows: [], tableGroups: [], surcharges: [], aiReview: [] }, sourceMediaAssetIds: [mediaAssetId], cleanupReceipt: cleanupReceiptFor(binding) });
    }
    throw new Error("unexpected fetch");
  } });
  const transient = { reference: mediaAssetId, cleanupProof, cleanupBinding: binding };
  await adapter.analyzeTransientPhoto(transient, context);
  await assert.rejects(adapter.analyzeTransientPhoto(transient, context), /한 번만/);
  assert.equal(importCalls, 1);
});

test("a verified hard-purge receipt closes the lifecycle without a duplicate DELETE", async () => {
  const counts = { intent: 0, put: 0, complete: 0, import: 0, delete: 0 };
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    fetchImpl: async (url, init) => {
      const value = url.toString();
      if (value.includes("upload-intents")) {
        counts.intent += 1;
        return ok(intentBodyFor(init));
      }
      if (value.includes("signed.invalid")) {
        counts.put += 1;
        return new Response(null, { status: 200 });
      }
      if (value.includes("/media/complete")) {
        counts.complete += 1;
        return ok();
      }
      if (value.includes("price-guide-photo-import") && init?.method === "POST") {
        counts.import += 1;
        const binding = JSON.parse(init.body).cleanupProofs[0];
        return ok({
          document: { schemaVersion: 2, source: "vision", overallNote: null, rows: [], tableGroups: [], surcharges: [], aiReview: [] },
          sourceMediaAssetIds: [mediaAssetId],
          cleanupReceipt: cleanupReceiptFor(binding),
        });
      }
      if (init?.method === "DELETE") {
        counts.delete += 1;
        throw new Error("verified purge must not issue DELETE");
      }
      throw new Error(`unexpected fetch: ${value}`);
    },
  });

  const transient = await adapter.uploadTransientPhoto(photo, { ...context, runId: 91 });
  await adapter.analyzeTransientPhoto(transient, { ...context, runId: 91 });
  await adapter.cleanupTransientPhoto(transient, "analyzed");
  assert.deepEqual(counts, { intent: 1, put: 1, complete: 1, import: 1, delete: 0 });
});

test("nonzero hard-purge residue fails closed", async () => {
  const binding = {
    mediaAssetId,
    clientCorrelationId: "44444444-4444-4444-8444-444444444444",
    requestCorrelationFingerprint: "f".repeat(64),
    cleanupProof,
    correlationFingerprint,
    assetFingerprint,
    objectLifecycleFingerprint,
  };
  const adapter = createMobilePricePhotoHttpAdapter({ backendOrigin: "https://pc.invalid", shopId: "shop", fetchImpl: async () => ok({
    document: { schemaVersion: 2, source: "vision", overallNote: null, rows: [], tableGroups: [], surcharges: [], aiReview: [] },
    sourceMediaAssetIds: [mediaAssetId],
    cleanupReceipt: { ...cleanupReceiptFor(binding), objectResidueCount: 1 },
  }) });
  await assert.rejects(
    adapter.analyzeTransientPhoto({ reference: mediaAssetId, cleanupProof, cleanupBinding: binding }, { ...context, runId: 92 }),
    (error) => error instanceof MobilePricePhotoStageError && error.stage === "cleanup",
  );
});

test("deterministic analysis draft round-trips matrix edits through one save and one no-store requery", async () => {
  const analyzedDocument = {
    schemaVersion: 2,
    source: "ai_imported",
    overallNote: null,
    tableGroups: [{
      sourceLabel: "베이직",
      species: "dog",
      breedNames: ["푸들"],
      sizeClass: "small",
      weightBands: [
        { label: "2kg 이하", minKg: null, maxKg: 2, note: null },
        { label: "2~4kg", minKg: 2, maxKg: 4, note: null },
      ],
      serviceNames: ["목욕", "전체 미용"],
      note: null,
    }],
    rows: [
      { sourceItemId: "pgi_fixture_1", serviceName: "목욕", species: "dog", breedNames: ["푸들"], breedGroup: "베이직", sizeClass: "small", minKg: null, maxKg: 2, weightBandLabel: "2kg 이하", priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: 45, note: null },
      { sourceItemId: "pgi_fixture_2", serviceName: "전체 미용", species: "dog", breedNames: ["푸들"], breedGroup: "베이직", sizeClass: "small", minKg: null, maxKg: 2, weightBandLabel: "2kg 이하", priceKind: "unknown", priceMinKrw: 61_000, priceMaxKrw: null, durationMinutes: null, note: "확인 필요" },
      { sourceItemId: "pgi_fixture_3", serviceName: "목욕", species: "dog", breedNames: ["푸들"], breedGroup: "베이직", sizeClass: "small", minKg: 2, maxKg: 4, weightBandLabel: "2~4kg", priceKind: "fixed", priceMinKrw: 35_000, priceMaxKrw: null, durationMinutes: null, note: null },
      { sourceItemId: "pgi_fixture_4", serviceName: "전체 미용", species: "dog", breedNames: ["푸들"], breedGroup: "베이직", sizeClass: "small", minKg: 2, maxKg: 4, weightBandLabel: "2~4kg", priceKind: "fixed", priceMinKrw: 70_000, priceMaxKrw: null, durationMinutes: 90, note: null },
    ],
    surcharges: [],
    aiReview: [],
  };

  const counts = { intent: 0, put: 0, complete: 0, import: 0, delete: 0, save: 0, requery: 0 };
  let canonicalDocument = null;
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: "https://pc.invalid",
    shopId: "shop",
    fetchImpl: async (url, init) => {
      const value = url.toString();
      if (value.includes("upload-intents")) {
        counts.intent += 1;
        return ok(intentBodyFor(init));
      }
      if (value.includes("signed.invalid")) {
        counts.put += 1;
        return new Response(null, { status: 200 });
      }
      if (value.includes("/media/complete")) {
        counts.complete += 1;
        return ok();
      }
      if (value.includes("price-guide-photo-import") && init?.method === "POST") {
        counts.import += 1;
        const binding = JSON.parse(init.body).cleanupProofs[0];
        return ok({ document: analyzedDocument, sourceMediaAssetIds: [mediaAssetId], cleanupReceipt: cleanupReceiptFor(binding) });
      }
      if (value.endsWith("/api/services") && init?.method === "POST") {
        counts.save += 1;
        canonicalDocument = structuredClone(JSON.parse(init.body).priceGuide);
        return ok();
      }
      if (value.includes("/api/bootstrap?") && init?.method === undefined) {
        counts.requery += 1;
        assert.equal(init.cache, "no-store");
        return ok({
          priceGuideCore: generatedCoreModule.getMobilePriceGuideCoreContract(),
          services: [{ id: "service-existing", price_guide: canonicalDocument }],
        });
      }
      if (init?.method === "DELETE") {
        counts.delete += 1;
        throw new Error("verified purge must not issue DELETE");
      }
      throw new Error(`unexpected fetch: ${value}`);
    },
  });
  const coordinator = coordinatorModule.createMobilePricePhotoCoordinator(adapter);
  const analysis = await coordinator.analyze(photo);
  let edited = matrixModule.updateMobilePriceGuideCell(analysis.document, 0, 0, 0, { priceMinKrw: 31_000, durationMinutes: 50 });
  edited = matrixModule.addMobilePriceGuideWeightBand(edited, 0);
  edited = matrixModule.updateMobilePriceGuideWeightBand(edited, 0, 2, "4~6kg");
  edited = matrixModule.removeMobilePriceGuideWeightBand(edited, 0, 2);

  const persisted = await coordinator.saveAndRequery(edited, "service-existing");
  assert.deepEqual(counts, { intent: 1, put: 1, complete: 1, import: 1, delete: 0, save: 1, requery: 1 });
  assert.deepEqual(persisted.document, edited);
  assert.equal(persisted.document.rows[0].serviceName, "목욕");
  assert.equal(persisted.document.rows[0].priceMinKrw, 31_000);
  assert.equal(persisted.document.rows[0].durationMinutes, 50);
  assert.equal(persisted.document.rows[1].priceKind, "unknown");
  assert.equal(persisted.document.rows[1].priceMinKrw, 61_000);
  assert.equal(persisted.document.rows[1].durationMinutes, null);
});
