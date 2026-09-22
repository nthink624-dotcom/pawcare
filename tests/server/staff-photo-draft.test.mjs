import assert from "node:assert/strict";
import test from "node:test";
import { hasStaffProfileChoice, prepareStaffProfilePhoto } from "../../src/components/owner-web/staff-photo-draft.ts";

const empty = { profileImageUrl: "" };
const uploaded = { mediaAssetId: "new-photo", signedUrl: "https://example.test/new.webp" };
const noUpload = async () => { throw new Error("unexpected upload"); };
const prepare = (draft, options = {}) => prepareStaffProfilePhoto({ draft, upload: noUpload, onUploaded: () => {}, ...options });

test("missing image requires a choice; explicit preset and saved media satisfy it", () => {
  assert.equal(hasStaffProfileChoice(empty), false);
  assert.equal(hasStaffProfileChoice({ ...empty, profileImageFallbackKey: "korean-groomer-profile-02" }), true);
  assert.equal(hasStaffProfileChoice(empty, { profileImageAssetIds: ["saved-photo"] }), true);
});

test("choosing a preset persists its key and explicitly replaces photo display", async () => {
  const result = await prepare({ ...empty, profileImageChoice: "default", profileImageFallbackKey: "korean-groomer-profile-02" }, {
    existing: { profileImageUrl: "old.jpg", profileImageUrls: ["old.jpg"], profileImageAssetIds: ["old-id"] },
  });
  assert.deepEqual(result, { profileImageUrl: "", profileImageUrls: [], profileImageAssetIds: [], profileImageFallbackKey: "korean-groomer-profile-02" });
});

test("editing text preserves canonical and legacy photos without uploading", async () => {
  const result = await prepare({ profileImageUrl: "old.jpg" }, { existing: { profileImageUrl: "old.jpg", profileImageAssetIds: ["old-id"] } });
  assert.deepEqual(result.profileImageUrls, ["old.jpg"]);
  assert.deepEqual(result.profileImageAssetIds, ["old-id"]);
});

test("an existing fallback key never removes an asset-only profile during text edits", async () => {
  const result = await prepare({ ...empty, profileImageFallbackKey: "korean-groomer-profile-01" }, { existing: { profileImageAssetIds: ["saved-photo"] } });
  assert.deepEqual(result.profileImageAssetIds, ["saved-photo"]);
});

test("upload then failed save reuses the same asset on retry and keeps previous photos", async () => {
  const file = new File(["fixture"], "photo.png", { type: "image/png" });
  let draft = { ...empty, profileImageFile: file };
  let uploads = 0;
  const options = {
    existing: { profileImageUrl: "old.jpg", profileImageAssetIds: ["old-id"] },
    upload: async (input) => { assert.equal(input, file); uploads++; return uploaded; },
    onUploaded: (photo) => { draft = { ...draft, profileImagePendingUpload: photo }; },
  };
  const first = await prepare(draft, options);
  const retry = await prepare(draft, options);
  assert.equal(uploads, 1);
  assert.deepEqual(retry, first);
  assert.deepEqual(retry.profileImageAssetIds, ["new-photo", "old-id"]);
  assert.deepEqual(retry.profileImageUrls, [uploaded.signedUrl, "old.jpg"]);
  assert.equal(JSON.stringify(retry).includes("blob:"), false);
});

test("failed upload preserves the input and does not mark it uploaded", async () => {
  const draft = { ...empty, profileImageFile: new File(["fixture"], "photo.png") };
  await assert.rejects(prepare(draft, { upload: async () => { throw new Error("upload failed"); }, onUploaded: () => assert.fail("must not mark failed upload") }), /upload failed/);
  assert.equal(draft.profileImageFile.name, "photo.png");
  assert.equal(draft.profileImagePendingUpload, undefined);
});

test("full photo collection is never silently truncated or uploaded again", async () => {
  await assert.rejects(prepare({ ...empty, profileImageFile: new File(["fixture"], "photo.png") }, {
    existing: { profileImageAssetIds: ["one", "two", "three"] },
  }), /기존 프로필 사진이 3장/);
});
