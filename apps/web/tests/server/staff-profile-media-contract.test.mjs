import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

async function importStaffManagementModel(modelSource) {
  const typescriptModule = await import("typescript");
  const typescript = typescriptModule.default ?? typescriptModule;
  const javascript = typescript.transpileModule(modelSource, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText.replace(/^import[^\n]+\n/gm, "");
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function buildStaffFixture() {
  return {
    id: "staff-owner",
    name: "대표자",
    displayName: "대표자",
    profileImageUrl: "https://media.example/legacy-owner.jpg",
    profileImageUrls: ["https://media.example/old-owner.jpg"],
    profileImageAssetIds: ["old-id"],
    profileMessage: "",
    chipColorIndex: 0,
    phone: "010-1234-5678",
    role: "대표",
    titlePrefix: "",
    position: "대표",
    defaultDays: ["mon", "tue"],
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: 0,
    todayBookings: 0,
    weekBookings: 0,
  };
}

function buildStaffDraft(staff) {
  return {
    name: staff.name,
    displayName: staff.displayName,
    profileImageUrl: staff.profileImageUrl,
    profileMessage: "",
    chipColorIndex: 0,
    phone: staff.phone,
    role: staff.role,
    titlePrefix: "",
    position: staff.position,
    defaultDaysText: "월, 화",
    startTime: staff.startTime,
    endTime: staff.endTime,
    regularOff: staff.regularOff,
    annualRemain: "0",
  };
}

test("initial setup validates and previews staff photos without DataURL persistence", async () => {
  const [field, screen] = await Promise.all([
    source("src/components/owner-web/staff-profile-photo-field.tsx"),
    source("src/components/owner-web/staff-management-screen.tsx"),
  ]);
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.ok(field.includes(type), type);
  assert.match(field, /20 \* 1024 \* 1024/);
  assert.match(field, /URL\.createObjectURL\(photo\.file\)/);
  assert.match(field, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(field, /프로필 사진 올리기/);
  assert.match(field, /사진 삭제/);
  assert.match(field, /초기화/);
  assert.doesNotMatch([field, screen].join("\n"), /FileReader|readAsDataURL/);
});

test("explicit staff Save uploads through staff_profile media then persists and requeries canonical fields", async () => {
  const [screen, model, mediaClient, preview, route] = await Promise.all([
    source("src/components/owner-web/staff-management-screen.tsx"),
    source("src/components/owner-web/staff-management-model.ts"),
    source("src/lib/media/owner-media-client.ts"),
    source("src/components/owner-web/owner-web-preview.tsx"),
    source("src/app/api/staff-members/route.ts"),
  ]);
  assert.match(screen, /createOwnerStaffProfileImageFromFile\(context, file\)/);
  assert.match(screen, /persistInitialSetupStaffDraft/);
  assert.match(model, /let pendingUpload = photo\.pendingUpload \?\? null/);
  assert.match(model, /pendingUpload = await uploadPhoto\(\{ shopId, staffId: targetId \}, photo\.file\)/);
  assert.match(model, /onPhotoUploadPending\?\.\(pendingUpload\)/);
  assert.match(model, /profileImageUrls = \[pendingUpload\.signedUrl\]/);
  assert.match(model, /profileImageAssetIds = \[pendingUpload\.mediaAssetId\]/);
  assert.ok(model.indexOf("await uploadPhoto") < model.indexOf("await persistStaff"));
  assert.match(mediaClient, /createOwnerMediaAssetFromFile\(context, "staff_profile", file/);
  assert.match(preview, /fetchApiJsonWithAuth<\{ staffMembers: OwnerWebStaffMember\[\] \}>\("\/api\/staff-members"/);
  assert.match(preview, /method: "PATCH"/);
  assert.match(route, /phone: z\.string\(\)\.trim\(\)\.default\(""\)/);
  assert.match(route, /profileImageUrls: z\.array/);
  assert.match(route, /profileImageAssetIds: z\.array/);
  assert.match(route, /const staffMembers = await loadActiveStaffMembers\(supabase, owner\.shopId\)/);
  const parentSaveStart = preview.indexOf("async function handleStaffMembersChange");
  const parentSaveEnd = preview.indexOf("\n  function handleScreenSelect", parentSaveStart);
  const parentSave = preview.slice(parentSaveStart, parentSaveEnd);
  const requestIndex = parentSave.indexOf("fetchApiJsonWithAuth");
  const liveSaveStart = parentSave.lastIndexOf("\n\n    try {", requestIndex);
  const canonicalCommitIndex = parentSave.indexOf("setLiveStaffMembers(refreshed.staffMembers)");
  assert.ok(liveSaveStart >= 0 && requestIndex > liveSaveStart && canonicalCommitIndex > requestIndex);
  assert.doesNotMatch(parentSave.slice(liveSaveStart, requestIndex), /setLiveStaffMembers\(nextStaff\)|staffMembers: nextStaff/);
});

test("upload failure preserves the draft and offers retry or photo-free Save", async () => {
  const [field, screen] = await Promise.all([
    source("src/components/owner-web/staff-profile-photo-field.tsx"),
    source("src/components/owner-web/staff-management-screen.tsx"),
  ]);
  assert.match(field, /JPG, PNG, WEBP 형식의 사진을 선택해 주세요/);
  assert.match(field, /사진은 20MB 이하로 선택해 주세요/);
  assert.match(screen, /다시 저장하거나 사진 없이 저장해 주세요/);
  assert.match(screen, /업로드한 사진은 유지했습니다/);
  assert.match(screen, /syncInitialSetupSession\(currentDraft, photoForRetry, "error"\)/);
  assert.match(screen, /setInitialSetupSaveState\("error"\)/);
  assert.match(field, /photo\.pendingUpload\?\.signedUrl/);
  assert.match(field, /다시 저장해도 재업로드하지 않습니다/);
});

test("persist rejection keeps canonical media and retry reuses the pending upload before canonical commit", async () => {
  const modelSource = await source("src/components/owner-web/staff-management-model.ts");
  const { persistInitialSetupStaffDraft } = await importStaffManagementModel(modelSource);
  const canonical = buildStaffFixture();
  const draft = buildStaffDraft(canonical);
  const originalCanonical = structuredClone(canonical);
  let uploadCalls = 0;
  let pendingUpload = null;

  await assert.rejects(
    persistInitialSetupStaffDraft({
      shopId: "shop-1",
      staff: [canonical],
      selectedStaff: canonical,
      selectedStaffIsOwner: true,
      ownerStaffName: "대표자",
      draft,
      photo: { file: { name: "new.webp" }, mode: "replace", pendingUpload: null },
      nextDays: ["mon", "tue"],
      uploadPhoto: async () => {
        uploadCalls += 1;
        return { mediaAssetId: "new-id", signedUrl: "https://media.example/new-owner.webp" };
      },
      onPhotoUploadPending: (uploaded) => { pendingUpload = uploaded; },
      createStaffId: () => "unused",
      persistStaff: async () => false,
    }),
    /직원 정보를 저장하지 못했습니다/,
  );

  assert.deepEqual(canonical, originalCanonical, "failed persistence must leave old parent/canonical media untouched");
  assert.deepEqual(pendingUpload, { mediaAssetId: "new-id", signedUrl: "https://media.example/new-owner.webp" });
  assert.equal(uploadCalls, 1);

  let committedStaff = null;
  await persistInitialSetupStaffDraft({
    shopId: "shop-1",
    staff: [canonical],
    selectedStaff: canonical,
    selectedStaffIsOwner: true,
    ownerStaffName: "대표자",
    draft,
    photo: { file: null, mode: "replace", pendingUpload },
    nextDays: ["mon", "tue"],
    uploadPhoto: async () => {
      uploadCalls += 1;
      throw new Error("retry must not upload again");
    },
    createStaffId: () => "unused",
    persistStaff: async (nextStaff) => {
      committedStaff = nextStaff;
      return true;
    },
  });

  assert.equal(uploadCalls, 1);
  assert.deepEqual(committedStaff[0].profileImageAssetIds, ["new-id"]);
  assert.deepEqual(committedStaff[0].profileImageUrls, ["https://media.example/new-owner.webp"]);

  let keptStaff = null;
  await persistInitialSetupStaffDraft({
    shopId: "shop-1",
    staff: [canonical],
    selectedStaff: canonical,
    selectedStaffIsOwner: true,
    ownerStaffName: "대표자",
    draft,
    photo: { file: null, mode: "keep", pendingUpload: null },
    nextDays: ["mon", "tue"],
    uploadPhoto: async () => { throw new Error("keep must not upload"); },
    createStaffId: () => "unused",
    persistStaff: async (nextStaff) => {
      keptStaff = nextStaff;
      return true;
    },
  });
  assert.equal(keptStaff[0].profileImageUrl, canonical.profileImageUrl);
  assert.deepEqual(keptStaff[0].profileImageUrls, canonical.profileImageUrls);
  assert.deepEqual(keptStaff[0].profileImageAssetIds, canonical.profileImageAssetIds);
});
