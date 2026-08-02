import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeProfileMediaAssetIds,
  mergeRecoveredProfileMediaAssetIds,
  mergeResolvedProfileImageUrls,
} from "../../src/lib/media/profile-image-collection.ts";

test("adding profile media keeps every existing asset id", () => {
  assert.deepEqual(
    mergeProfileMediaAssetIds(["old-1", "old-2", "old-3"], ["new-1"], 200),
    ["old-1", "old-2", "old-3", "new-1"],
  );
});

test("profile media collections are not silently truncated at twenty items", () => {
  const existingIds = Array.from({ length: 25 }, (_, index) => `asset-${index + 1}`);

  assert.equal(mergeProfileMediaAssetIds(existingIds, ["asset-26"], 200).length, 26);
});

test("resolved asset URLs are appended without removing persistent legacy URLs", () => {
  const result = mergeResolvedProfileImageUrls({
    currentImageUrls: ["https://images.example.com/legacy-1.jpg"],
    currentMediaAssetIds: ["asset-a", "asset-b"],
    resolvedItems: [
      { mediaAssetId: "asset-a", signedUrl: "https://signed.example.com/asset-a" },
      { mediaAssetId: "asset-b", signedUrl: "https://signed.example.com/asset-b" },
    ],
    maxCount: 200,
    preserveCurrentUrlsAsLegacy: true,
  });

  assert.deepEqual(result, {
    imageUrls: [
      "https://images.example.com/legacy-1.jpg",
      "https://signed.example.com/asset-a",
      "https://signed.example.com/asset-b",
    ],
    mediaAssetIds: ["asset-a", "asset-b"],
  });
});

test("a partial signed URL response keeps the current URL for unresolved assets", () => {
  const result = mergeResolvedProfileImageUrls({
    currentImageUrls: [
      "https://signed.example.com/asset-a-old",
      "https://signed.example.com/asset-b-old",
    ],
    currentMediaAssetIds: ["asset-a", "asset-b"],
    resolvedItems: [
      { mediaAssetId: "asset-a", signedUrl: "https://signed.example.com/asset-a-new" },
    ],
    maxCount: 200,
  });

  assert.deepEqual(result.imageUrls, [
    "https://signed.example.com/asset-a-new",
    "https://signed.example.com/asset-b-old",
  ]);
  assert.deepEqual(result.mediaAssetIds, ["asset-a", "asset-b"]);
});

test("recovery skips older duplicate uploads while reconnecting unique ready assets", () => {
  const currentAsset = {
    id: "current-a",
    original_file_name: "shop.jpg",
    source_byte_size: 123_456,
    width: 1200,
    height: 800,
  };
  const olderDuplicate = {
    ...currentAsset,
    id: "older-a",
  };
  const uniqueAsset = {
    id: "unique-b",
    original_file_name: "counter.jpg",
    source_byte_size: 99_000,
    width: 900,
    height: 900,
  };

  assert.deepEqual(
    mergeRecoveredProfileMediaAssetIds({
      currentIds: [currentAsset.id],
      recoveredAssets: [currentAsset, olderDuplicate, uniqueAsset],
      maxCount: 200,
    }),
    ["current-a", "unique-b"],
  );
});
