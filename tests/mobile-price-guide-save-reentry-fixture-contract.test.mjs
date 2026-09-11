import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const fixtureSource = await readFile(new URL("../src/lib/price-photo/mobile-price-guide-save-reentry-fixture.ts", import.meta.url), "utf8");
const adapterSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-http-adapter.ts", import.meta.url), "utf8");
const coordinatorSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-adapter.ts", import.meta.url), "utf8");
const cleanupSource = await readFile(new URL("../src/lib/price-photo/mobile-price-photo-cleanup.ts", import.meta.url), "utf8");
const matrixSource = await readFile(new URL("../src/lib/price-photo/mobile-price-guide-matrix.ts", import.meta.url), "utf8");
const harnessSource = await readFile(new URL("../src/components/auth/mobile-price-guide-save-reentry-fixture.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/app/dev/price-guide-save-reentry/page.tsx", import.meta.url), "utf8");

function transpile(sourceText, requireImpl = () => ({})) {
  const output = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  Function("module", "exports", "require", output)(loadedModule, loadedModule.exports, requireImpl);
  return loadedModule.exports;
}

const cleanupModule = transpile(cleanupSource);
const coordinatorModule = transpile(coordinatorSource);
const matrixModule = transpile(matrixSource, (specifier) => {
  if (specifier === "./mobile-price-photo-adapter") return coordinatorModule;
  throw new Error(`unexpected matrix import: ${specifier}`);
});
const adapterModule = transpile(adapterSource, (specifier) => {
  if (specifier === "@/lib/api") return { getAccessTokenWithRecovery: async () => "token" };
  if (specifier === "@/lib/supabase/client") return { getSupabaseBrowserClient: () => null };
  if (specifier === "./mobile-price-photo-cleanup") return cleanupModule;
  if (specifier === "./mobile-price-photo-adapter") return coordinatorModule;
  throw new Error(`unexpected adapter import: ${specifier}`);
});
const fixtureModule = transpile(fixtureSource);

const { createMobilePricePhotoCoordinator } = coordinatorModule;
const { createMobilePricePhotoHttpAdapter } = adapterModule;
const { updateMobilePriceGuideCell, updateMobilePriceGuideService, readMobilePriceGuideMatrix, writeMobilePriceGuideMatrix } = matrixModule;
const { createInMemoryAuthenticatedOwnerTransport } = fixtureModule;

test("dev fixture route is unavailable in Production and renders the real matrix harness otherwise", () => {
  assert.match(pageSource, /process\.env\.NODE_ENV === "production"/);
  assert.match(pageSource, /process\.env\.VERCEL_ENV === "production"/);
  assert.match(pageSource, /notFound\(\)/);
  assert.match(harnessSource, /<MobilePriceGuideMatrix/);
  assert.match(harnessSource, /createMobilePricePhotoHttpAdapter/);
  assert.match(harnessSource, /createMobilePricePhotoCoordinator/);
  assert.doesNotMatch(harnessSource, /fetch\(|XMLHttpRequest|supabase|openai|gpt-/i);
});

test("actual adapter verifies correlation cleanup binding and residue-zero receipt in memory", async () => {
  const transport = createInMemoryAuthenticatedOwnerTransport();
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: transport.backendOrigin,
    shopId: transport.shopId,
    accessToken: transport.accessToken,
    fetchImpl: transport.fetchImpl,
  });
  const analysis = await createMobilePricePhotoCoordinator(adapter).analyze(new File([new Uint8Array([1])], "fixture.png", { type: "image/png" }));
  const snapshot = transport.snapshot();

  assert.equal(analysis.document.rows.length, 4);
  assert.deepEqual(snapshot.counts, { uploadIntent: 1, signedPut: 1, complete: 1, photoImport: 1, cleanupDelete: 0, servicesPost: 0, bootstrapGet: 0 });
  assert.equal(snapshot.credentialsOmitted, true);
  assert.equal(snapshot.cleanupBindingVerified, true);
  assert.match(snapshot.requestCorrelationFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.residueCount, 0);
});

test("nonzero cleanup residue fails closed before any service mutation", async () => {
  const transport = createInMemoryAuthenticatedOwnerTransport({ cleanupResidueCount: 1 });
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: transport.backendOrigin,
    shopId: transport.shopId,
    accessToken: transport.accessToken,
    fetchImpl: transport.fetchImpl,
  });
  await assert.rejects(
    createMobilePricePhotoCoordinator(adapter).analyze(new File([new Uint8Array([1])], "fixture.png", { type: "image/png" })),
    /안전한 정리 결과/,
  );
  assert.equal(transport.snapshot().counts.servicesPost, 0);
});

test("canonical bootstrap edit save and remount preserve the full PriceGuideV2 document", async () => {
  const transport = createInMemoryAuthenticatedOwnerTransport();
  const adapter = createMobilePricePhotoHttpAdapter({
    backendOrigin: transport.backendOrigin,
    shopId: transport.shopId,
    accessToken: transport.accessToken,
    fetchImpl: transport.fetchImpl,
  });
  const controller = new AbortController();
  const initial = await adapter.requeryServices(transport.serviceId, controller.signal);
  assert.equal(initial.document.tableGroups[0].weightBands[1].label, "2~4kg");
  assert.equal(initial.document.rows[1].sourceItemId, "pgi_fixture_full_2kg");
  assert.equal(initial.document.rows[1].priceKind, "unknown");
  assert.equal(initial.document.rows[1].durationMinutes, null);

  transport.resetSaveCycle();
  const renamed = updateMobilePriceGuideService(initial.document, 0, 0, "스파 목욕");
  const edited = updateMobilePriceGuideCell(renamed, 0, 0, 0, {
    priceKind: "fixed", priceMinKrw: 31_000, priceMaxKrw: null, durationMinutes: 50,
  });
  const persisted = await createMobilePricePhotoCoordinator(adapter).saveAndRequery(edited, initial.serviceId);
  const snapshot = transport.snapshot();

  assert.equal(snapshot.counts.servicesPost, 1);
  assert.equal(snapshot.counts.bootstrapGet, 1);
  assert.equal(snapshot.noStoreBootstrap, true);
  assert.deepEqual(persisted.document, transport.canonicalDocument());
  assert.equal(persisted.document.rows[0].serviceName, "스파 목욕");
  assert.equal(persisted.document.rows[0].sourceItemId, "pgi_fixture_bath_2kg");
  assert.equal(persisted.document.rows[0].priceMinKrw, 31_000);
  assert.equal(persisted.document.rows[0].durationMinutes, 50);
  assert.equal(persisted.document.rows[1].priceKind, "unknown");
  assert.equal(persisted.document.rows[1].durationMinutes, null);

  const remounted = writeMobilePriceGuideMatrix(persisted.document, readMobilePriceGuideMatrix(persisted.document));
  assert.deepEqual(remounted, persisted.document);
});

test("harness exposes one explicit save action and 44px controls without claiming rendered QA", () => {
  assert.match(harnessSource, /명시 저장 후 재진입 확인/);
  assert.match(harnessSource, /counts\.servicesPost !== 1/);
  assert.match(harnessSource, /counts\.bootstrapGet !== 1/);
  assert.match(harnessSource, /currentSnapshot\.residueCount !== 0/);
  assert.match(harnessSource, /setRemountKey\(\(value\) => value \+ 1\)/);
  assert.match(harnessSource, /min-h-11/);
  assert.match(harnessSource, /focus-visible:ring-2/);
  assert.match(harnessSource, /min-h-screen w-full min-w-0 max-w-full/);
  assert.match(harnessSource, /mx-auto w-full min-w-0 max-w-\[1040px\]/);
});
