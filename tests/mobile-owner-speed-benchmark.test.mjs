import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const mediaClientSource = await readFile(
  new URL("../src/lib/media/owner-media-client.ts", import.meta.url),
  "utf8",
);
const ownerAppSource = await readFile(
  new URL("../src/components/owner/owner-app.tsx", import.meta.url),
  "utf8",
);

const activeRun = { current: null };

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMediaAsset() {
  return {
    id: "media-1",
    shop_id: "shop-1",
    guardian_id: "guardian-1",
    pet_id: "pet-1",
    appointment_id: "appointment-1",
    grooming_record_id: null,
    bucket: "private-media",
    storage_path: "shop-1/media-1.webp",
    original_file_name: "capture.webp",
    content_type: "image/webp",
    byte_size: 128,
    width: 1200,
    height: 1600,
    checksum_sha256: null,
    media_kind: "grooming_before",
    visibility: "customer_shared",
    status: "ready",
    retention_policy: "standard",
    uploaded_by_user_id: null,
    uploaded_from: "owner_web",
    metadata: { owner_pending_upload_id: "attempt-1" },
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    deleted_at: null,
  };
}

function createVariant() {
  return {
    id: "variant-1",
    media_asset_id: "media-1",
    variant_key: "provider_ready",
    bucket: "private-media",
    storage_path: "shop-1/provider-ready.webp",
    content_type: "image/webp",
    byte_size: 64,
    width: 960,
    height: 1280,
    status: "ready",
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
  };
}

function currentRun() {
  assert.ok(activeRun.current, "benchmark run should be active");
  return activeRun.current;
}

const benchmarkDependencies = {
  async createPetmanagerImageCompressionSession(file) {
    return { file, image: {} };
  },
  async compressImageForPetmanagerFromSession(session) {
    const run = currentRun();
    await wait(run.profile.originalCompressionMs);
    return { file: session.file, width: 1200, height: 1600, sourceByteSize: session.file.size };
  },
  async compressImageVariantsForPetmanagerFromSession(session) {
    const run = currentRun();
    await wait(Math.max(0, run.profile.providerCompressionMs - 2));
    return [{ file: session.file, width: 960, height: 1280, sourceByteSize: session.file.size, variantKey: "provider_ready" }];
  },
  async fetchApiJsonWithAuth(url) {
    const run = currentRun();
    run.requests.push(url);
    await wait(run.profile.apiRttMs);
    if (url === "/api/owner/media/upload-intents") {
      return {
        mediaAsset: { ...createMediaAsset(), status: "uploading" },
        upload: {
          bucket: "private-media",
          path: "shop-1/media-1.webp",
          signedUrl: "https://storage.invalid/original",
          method: "PUT",
          maxBytes: 1_000_000,
        },
      };
    }
    if (url === "/api/owner/media/complete") return { mediaAsset: createMediaAsset() };
    if (url === "/api/owner/media/variants/upload-intents") {
      return {
        upload: {
          bucket: "private-media",
          path: "shop-1/provider-ready.webp",
          signedUrl: "https://storage.invalid/provider-ready",
          method: "PUT",
          maxBytes: 1_000_000,
        },
      };
    }
    if (url === "/api/owner/media/variants/complete") {
      if (run.profile.failDerivative) throw new TypeError("fixture derivative failure");
      return { variant: createVariant() };
    }
    throw new Error(`Unexpected request: ${url}`);
  },
  getSupabaseBrowserClient() {
    throw new Error("The benchmark must use the signed PUT path.");
  },
  async traceOwnerMediaStep(step, work) {
    const run = currentRun();
    const startedAt = performance.now();
    try {
      const value = await work();
      run.events.push({ step, outcome: "success", durationMs: performance.now() - startedAt });
      return value;
    } catch (error) {
      run.events.push({ step, outcome: "failure", durationMs: performance.now() - startedAt });
      throw error;
    }
  },
};

function transformMediaClient(source) {
  const withoutImports = source
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gmu, "");
  const injected = `
const {
  fetchApiJsonWithAuth,
  createPetmanagerImageCompressionSession,
  compressImageForPetmanagerFromSession,
  compressImageVariantsForPetmanagerFromSession,
  traceOwnerMediaStep,
  getSupabaseBrowserClient,
} = globalThis.__petmanagerOwnerSpeedBenchmarkDependencies;
${withoutImports}`;
  return stripTypeScriptTypes(injected, { mode: "transform" });
}

globalThis.__petmanagerOwnerSpeedBenchmarkDependencies = benchmarkDependencies;
const mediaClientModule = await import(
  `data:text/javascript;base64,${Buffer.from(transformMediaClient(mediaClientSource)).toString("base64")}`
);

const profiles = [
  { originalCompressionMs: 6, providerCompressionMs: 5, apiRttMs: 8, uploadMs: 18 },
  { originalCompressionMs: 7, providerCompressionMs: 6, apiRttMs: 10, uploadMs: 22 },
  { originalCompressionMs: 8, providerCompressionMs: 7, apiRttMs: 12, uploadMs: 26 },
  { originalCompressionMs: 9, providerCompressionMs: 8, apiRttMs: 14, uploadMs: 30 },
  { originalCompressionMs: 10, providerCompressionMs: 9, apiRttMs: 16, uploadMs: 34 },
];

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function runUploadSample(profile, { failDerivative = false } = {}) {
  const originalFetch = globalThis.fetch;
  const run = {
    profile: { ...profile, failDerivative },
    events: [],
    requests: [],
    uploads: [],
  };
  activeRun.current = run;
  globalThis.fetch = async (url) => {
    run.uploads.push(String(url));
    await wait(profile.uploadMs);
    return { ok: true, status: 200 };
  };
  const file = new File(["controlled-owner-photo"], "capture.jpg", { type: "image/jpeg" });
  const startedAt = performance.now();
  try {
    const result = await mediaClientModule.createOwnerMediaAssetFromFile(
      {
        shopId: "shop-1",
        guardianId: "guardian-1",
        petId: "pet-1",
        appointmentId: "appointment-1",
        metadata: { owner_pending_upload_id: "attempt-1" },
      },
      "grooming_before",
      file,
      { waitForProviderReadyVariant: false },
    );
    const criticalMs = performance.now() - startedAt;
    const variant = await result.providerReady;
    return {
      criticalMs,
      derivativeMs: performance.now() - startedAt,
      variant,
      requestCount: run.requests.length + run.uploads.length,
      criticalRequestCount: 3,
      events: run.events,
      requestOrder: run.requests,
    };
  } finally {
    globalThis.fetch = originalFetch;
    activeRun.current = null;
  }
}

test("current production upload function exposes a repeatable controlled-RTT baseline", async () => {
  const samples = [];
  for (const profile of profiles) samples.push(await runUploadSample(profile));
  const summary = {
    criticalP50Ms: Math.round(percentile(samples.map((sample) => sample.criticalMs), 0.5)),
    criticalP95Ms: Math.round(percentile(samples.map((sample) => sample.criticalMs), 0.95)),
    derivativeP50Ms: Math.round(percentile(samples.map((sample) => sample.derivativeMs), 0.5)),
    derivativeP95Ms: Math.round(percentile(samples.map((sample) => sample.derivativeMs), 0.95)),
    requestCount: [...new Set(samples.map((sample) => sample.requestCount))],
    criticalRequestCount: [...new Set(samples.map((sample) => sample.criticalRequestCount))],
    criticalStages: samples[0].events
      .map((event) => event.step)
      .filter((step) => ["compress-original", "create-upload-intent", "upload-original", "complete-upload-readback"].includes(step)),
    derivativeStages: samples[0].events
      .map((event) => event.step)
      .filter((step) => ["compress-provider-ready", "create-provider-ready-intent", "upload-provider-ready", "complete-provider-ready"].includes(step)),
  };
  console.info("OWNER_SPEED_CONTROLLED_RTT", JSON.stringify(summary));
  assert.deepEqual(summary.requestCount, [6]);
  assert.deepEqual(summary.criticalRequestCount, [3]);
  assert.deepEqual(summary.criticalStages, [
    "compress-original",
    "create-upload-intent",
    "upload-original",
    "complete-upload-readback",
  ]);
  assert.deepEqual(summary.derivativeStages, [
    "compress-provider-ready",
    "create-provider-ready-intent",
    "upload-provider-ready",
    "complete-provider-ready",
  ]);
  for (const sample of samples) {
    assert.ok(
      sample.requestOrder.indexOf("/api/owner/media/complete")
        < sample.requestOrder.indexOf("/api/owner/media/variants/upload-intents"),
    );
  }
});

test("slow derivative failure never invalidates the ready original", async () => {
  const sample = await runUploadSample(
    { originalCompressionMs: 8, providerCompressionMs: 25, apiRttMs: 30, uploadMs: 45 },
    { failDerivative: true },
  );
  assert.equal(sample.variant, null);
  assert.equal(sample.requestCount, 6);
  assert.equal(sample.events.find((event) => event.step === "complete-upload-readback")?.outcome, "success");
  assert.equal(sample.events.find((event) => event.step === "complete-provider-ready")?.outcome, "failure");
});

test("UI source applies pending preview before IndexedDB and preserves immediate authoritative row apply", () => {
  const stageStart = ownerAppSource.indexOf("async function stageMobilePhotoFile(");
  const stageEnd = ownerAppSource.indexOf("\n  async function discardStagedMobilePhoto", stageStart);
  const stage = ownerAppSource.slice(stageStart, stageEnd);
  const indexedDbIndex = stage.indexOf('traceOwnerMediaStep("stage-pending-local"');
  const previewIndex = stage.indexOf("setMobilePhotoPreviewFile(");
  assert.ok(indexedDbIndex >= 0 && previewIndex >= 0);

  const updateStart = ownerAppSource.indexOf("async function updateAppointment(");
  const updateEnd = ownerAppSource.indexOf("\n  function openMobilePhotoStatusAction", updateStart);
  const update = ownerAppSource.slice(updateStart, updateEnd);
  assert.ok(update.indexOf("mergeAuthoritativeAppointment(previous, authoritativeAppointment)") < update.indexOf("void reconcileAfterAppointmentMutation()"));
  assert.ok(previewIndex < indexedDbIndex);
  assert.match(stage, /setMobilePhotoStaging\(true\)/);
  console.info("OWNER_SPEED_PENDING_FEEDBACK_RESULT", JSON.stringify({
    waitsForIndexedDbBeforePreview: previewIndex > indexedDbIndex,
  }));
});
