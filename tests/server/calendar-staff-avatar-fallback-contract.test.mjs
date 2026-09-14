import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildStaffAvatarCandidates,
  findFirstUsableStaffAvatarCandidate,
} from "../../src/lib/staff-avatar-candidates.ts";
import { resolveStaffProfileFallbackOrDefaultImageUrl } from "../../src/lib/staff-profile-fallback.ts";

const stableAvatar = readFileSync(new URL("../../src/components/owner-web/stable-avatar.tsx", import.meta.url), "utf8");
const laneHeader = readFileSync(new URL("../../src/components/owner-web/calendar-staff-lane-header.tsx", import.meta.url), "utf8");
const dailyGrid = readFileSync(new URL("../../src/components/owner-web/calendar-daily-schedule-grid.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../../src/components/owner-web/calendar-management-screen.tsx", import.meta.url), "utf8");
const staffProjection = readFileSync(new URL("../../src/components/owner-web/owner-web-staff-data.ts", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../../src/server/bootstrap.ts", import.meta.url), "utf8");

test("missing or failed photos always have the neutral bundled fallback", () => {
  assert.match(resolveStaffProfileFallbackOrDefaultImageUrl(null), /korean-groomer-profile-01\.jpg$/);
  assert.match(resolveStaffProfileFallbackOrDefaultImageUrl("korean-groomer-profile-02"), /korean-groomer-profile-02\.jpg$/);
  assert.deepEqual(buildStaffAvatarCandidates({ identity: "shop-a:staff-a", imageUrl: "", imageUrls: [null, "  "] }), []);
  assert.match(stableAvatar, /const displayImageUrl = decodedUrl \|\| resolveStaffProfileFallbackOrDefaultImageUrl\(profileImageFallbackKey\)/);
  assert.match(stableAvatar, /<img src=\{displayImageUrl\}/);
  assert.match(stableAvatar, /className="h-full w-full object-cover"/);
  assert.match(stableAvatar, /profileImageFallbackKey \? "preset"/);
});

test("candidate probing skips 401, 403, 404, and decode failures before using the next decodable photo", async () => {
  const candidates = buildStaffAvatarCandidates({
    identity: "shop-a:staff-a",
    imageUrl: "https://media.example/expired.webp",
    imageUrls: ["https://media.example/expired.webp", "https://media.example/current.webp"],
    imageAssetIds: ["old", "current"],
  });
  const attempts = [];
  const result = await findFirstUsableStaffAvatarCandidate(candidates, async (candidate) => {
    attempts.push(candidate.url);
    return candidate.url.endsWith("current.webp");
  });

  assert.deepEqual(attempts, ["https://media.example/expired.webp", "https://media.example/current.webp"]);
  assert.equal(result?.url, "https://media.example/current.webp");

  for (const failure of [401, 403, 404, "decode"]) {
    const failed = await findFirstUsableStaffAvatarCandidate(candidates, async () => false);
    assert.equal(failed, null, `failure ${failure} must use the bundled fallback`);
  }
});

test("candidate cache keys stay bound to shop, staff, asset, and current URL", () => {
  const first = buildStaffAvatarCandidates({ identity: "shop-a:staff-a", imageUrl: "https://media.example/photo.webp?token=old", imageAssetId: "asset-a" });
  const refreshed = buildStaffAvatarCandidates({ identity: "shop-a:staff-a", imageUrl: "https://media.example/photo.webp?token=new", imageAssetId: "asset-a" });
  const otherStaff = buildStaffAvatarCandidates({ identity: "shop-a:staff-b", imageUrl: "https://media.example/photo.webp?token=new", imageAssetId: "asset-a" });
  const otherShop = buildStaffAvatarCandidates({ identity: "shop-b:staff-a", imageUrl: "https://media.example/photo.webp?token=new", imageAssetId: "asset-a" });

  assert.notEqual(first[0]?.key, refreshed[0]?.key);
  assert.notEqual(refreshed[0]?.key, otherStaff[0]?.key);
  assert.notEqual(refreshed[0]?.key, otherShop[0]?.key);
});

test("canonical owner calendar preserves and passes every avatar field", () => {
  for (const field of ["profileImageUrl", "profileImageUrls", "profileImageAssetIds", "profileImageFallbackKey"]) {
    assert.match(staffProjection, new RegExp(`${field}: staff\\.${field}`));
    assert.match(dailyGrid, new RegExp(`${field}=\\{primaryStaff\\?\\.${field}\\}`));
  }
  assert.match(bootstrap, /profileImageFallbackKey: isStaffProfileFallbackKey\(row\.profile_image_fallback_key\)/);
  assert.match(calendar, /<DailyScheduleGrid\s+shopId=\{bootstrapData\.shop\.id\}/);
  assert.match(dailyGrid, /avatarIdentity=\{`\$\{shopId\}:\$\{primaryStaff\?\.key \?\? laneColumn\.key\}`\}/);
  assert.match(laneHeader, /identity=\{avatarIdentity\}/);
  assert.match(laneHeader, /profileImageFallbackKey=\{profileImageFallbackKey\}/);
});
