import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const mediaClientSource = await readFile(
  new URL("../src/lib/media/owner-media-client.ts", import.meta.url),
  "utf8",
);
const runnableMediaClientSource = mediaClientSource.replace(/^import[\s\S]*?;\r?\n/gm, "");
const mediaClientJavaScript = stripTypeScriptTypes(
  `const fetchApiJsonWithAuth = (...args) => globalThis.__ownerMediaExpiryFetch(...args);\n${runnableMediaClientSource}`,
  { mode: "transform" },
);
const mediaClient = await import(
  `data:text/javascript;base64,${Buffer.from(mediaClientJavaScript).toString("base64")}`
);

async function waitFor(predicate, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("fixture timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("the real batch helper deduplicates durable IDs and falls back missing derivatives in one original batch", async () => {
  const requests = [];
  const abortController = new AbortController();
  globalThis.__ownerMediaExpiryFetch = async (path, init) => {
    const body = JSON.parse(init.body);
    requests.push({ path, items: body.items, signal: init.signal });
    if (body.items[0]?.variant === "provider_ready") {
      return {
        items: [
          { mediaAssetId: "asset-a", signedUrl: "https://signed.example/asset-a-provider" },
          { mediaAssetId: "not-requested", signedUrl: "https://signed.example/not-requested" },
        ],
      };
    }
    return {
      items: [{ mediaAssetId: "asset-b", signedUrl: "https://signed.example/asset-b-original" }],
    };
  };

  try {
    const result = await mediaClient.getOwnerMediaSignedUrlsWithOriginalFallback(
      "shop-1",
      ["asset-a", "asset-b", "asset-a"],
      "provider_ready",
      { signal: abortController.signal },
    );

    assert.deepEqual(result, [
      { mediaAssetId: "asset-a", signedUrl: "https://signed.example/asset-a-provider" },
      { mediaAssetId: "asset-b", signedUrl: "https://signed.example/asset-b-original" },
    ]);
    assert.deepEqual(requests.map((request) => request.items), [
      [
        { mediaAssetId: "asset-a", variant: "provider_ready" },
        { mediaAssetId: "asset-b", variant: "provider_ready" },
      ],
      [{ mediaAssetId: "asset-b", variant: "original" }],
    ]);
    assert.ok(requests.every((request) => request.path === "/api/owner/media/signed-urls"));
    assert.ok(requests.every((request) => request.signal === abortController.signal));
  } finally {
    delete globalThis.__ownerMediaExpiryFetch;
  }
});

test("clock-expired image errors coalesce into one refresh batch and ignore duplicate onError events", async () => {
  let now = 1_000;
  const urls = new Map([
    ["asset-a", `https://signed.example/asset-a?issued=${now}`],
    ["asset-b", `https://signed.example/asset-b?issued=${now}`],
  ]);
  const calls = [];
  const recovery = mediaClient.createOwnerMediaSignedUrlRecovery({
    batchWindowMs: 0,
    retryDelayMs: 1,
    resolveBatch: async (mediaAssetIds) => {
      calls.push([...mediaAssetIds]);
      return mediaAssetIds.map((mediaAssetId) => ({
        mediaAssetId,
        signedUrl: `https://signed.example/${mediaAssetId}?issued=${now}`,
      }));
    },
    onResolved: (items) => {
      for (const item of items) urls.set(item.mediaAssetId, item.signedUrl);
    },
  });

  now += 3_600_000;
  const expiredA = urls.get("asset-a");
  const expiredB = urls.get("asset-b");
  recovery.enqueue("asset-a", expiredA);
  recovery.enqueue("asset-a", expiredA);
  recovery.enqueue("asset-b", expiredB);

  await waitFor(() => urls.get("asset-a") !== expiredA && urls.get("asset-b") !== expiredB);
  assert.deepEqual(calls, [["asset-a", "asset-b"]]);
  recovery.dispose();
});

test("temporary request failure retries once, while persistent failure is bounded and never loops", async () => {
  let transientCalls = 0;
  const transientResolved = [];
  const transientRecovery = mediaClient.createOwnerMediaSignedUrlRecovery({
    batchWindowMs: 0,
    retryDelayMs: 1,
    maxAttempts: 2,
    resolveBatch: async (mediaAssetIds) => {
      transientCalls += 1;
      if (transientCalls === 1) throw new TypeError("simulated offline");
      return mediaAssetIds.map((mediaAssetId) => ({
        mediaAssetId,
        signedUrl: `https://signed.example/${mediaAssetId}?retry=2`,
      }));
    },
    onResolved: (items) => transientResolved.push(...items),
  });
  transientRecovery.enqueue("asset-a", "https://signed.example/asset-a?expired=1");
  await waitFor(() => transientResolved.length === 1);
  assert.equal(transientCalls, 2);
  transientRecovery.dispose();

  let persistentCalls = 0;
  const exhausted = [];
  const persistentRecovery = mediaClient.createOwnerMediaSignedUrlRecovery({
    batchWindowMs: 0,
    retryDelayMs: 1,
    maxAttempts: 2,
    resolveBatch: async () => {
      persistentCalls += 1;
      throw new TypeError("simulated offline");
    },
    onResolved: () => assert.fail("persistent failure must not resolve"),
    onExhausted: (mediaAssetIds) => exhausted.push(...mediaAssetIds),
  });
  persistentRecovery.enqueue("asset-b", "https://signed.example/asset-b?expired=1");
  await waitFor(() => exhausted.length === 1);
  persistentRecovery.enqueue("asset-b", "https://signed.example/asset-b?expired=2");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(persistentCalls, 2);
  assert.deepEqual(exhausted, ["asset-b"]);
  persistentRecovery.dispose();
});

test("partial refresh retries only missing IDs and preserves existing and legacy entries", async () => {
  const previews = new Map([
    ["asset-a", "https://signed.example/asset-a?expired=1"],
    ["asset-b", "https://signed.example/asset-b?expired=1"],
    ["legacy", "https://legacy.example/photo.jpg"],
  ]);
  const calls = [];
  const recovery = mediaClient.createOwnerMediaSignedUrlRecovery({
    batchWindowMs: 0,
    retryDelayMs: 1,
    maxAttempts: 2,
    resolveBatch: async (mediaAssetIds) => {
      calls.push([...mediaAssetIds]);
      return calls.length === 1
        ? [{ mediaAssetId: "asset-a", signedUrl: "https://signed.example/asset-a?fresh=1" }]
        : [{ mediaAssetId: "asset-b", signedUrl: "https://signed.example/asset-b?fresh=1" }];
    },
    onResolved: (items) => {
      for (const item of items) previews.set(item.mediaAssetId, item.signedUrl);
    },
  });
  recovery.enqueue("asset-a", previews.get("asset-a"));
  recovery.enqueue("asset-b", previews.get("asset-b"));

  await waitFor(() => previews.get("asset-b") === "https://signed.example/asset-b?fresh=1");
  assert.deepEqual(calls, [["asset-a", "asset-b"], ["asset-b"]]);
  assert.equal(previews.get("asset-a"), "https://signed.example/asset-a?fresh=1");
  assert.equal(previews.get("legacy"), "https://legacy.example/photo.jpg");
  recovery.dispose();
});

test("abort on unmount or account change cancels in-flight application and further retries", async () => {
  const abortController = new AbortController();
  let finishRequest;
  let receivedSignal;
  let callCount = 0;
  const resolved = [];
  const exhausted = [];
  const recovery = mediaClient.createOwnerMediaSignedUrlRecovery({
    signal: abortController.signal,
    batchWindowMs: 0,
    retryDelayMs: 1,
    resolveBatch: async (_mediaAssetIds, signal) => {
      callCount += 1;
      receivedSignal = signal;
      return new Promise((resolve) => { finishRequest = resolve; });
    },
    onResolved: (items) => resolved.push(...items),
    onExhausted: (mediaAssetIds) => exhausted.push(...mediaAssetIds),
  });
  recovery.enqueue("asset-a", "https://signed.example/asset-a?expired=1");
  await waitFor(() => typeof finishRequest === "function");
  abortController.abort();
  finishRequest([{ mediaAssetId: "asset-a", signedUrl: "https://signed.example/asset-a?fresh=1" }]);
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(receivedSignal, abortController.signal);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(callCount, 1);
  assert.deepEqual(resolved, []);
  assert.deepEqual(exhausted, []);
});
