import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isStaffProfileFallbackKey, resolveStaffProfileFallbackImageUrl } from "../../src/lib/staff-profile-fallback.ts";

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("staff profile accepts only explicit bundled preset keys without a gender attribute", async () => {
  const [fallback, route, bootstrap, avatar, migration] = await Promise.all([
    readSource("src/lib/staff-profile-fallback.ts"), readSource("src/app/api/staff-members/route.ts"),
    readSource("src/server/bootstrap.ts"), readSource("src/components/owner-web/stable-avatar.tsx"),
    readSource("supabase/migrations/20260910053252_staff_profile_fallback_key.sql"),
  ]);
  assert.equal(isStaffProfileFallbackKey("korean-groomer-profile-01"), true);
  assert.equal(isStaffProfileFallbackKey("korean-groomer-profile-02"), true);
  assert.equal(isStaffProfileFallbackKey("petmanager-default-profile"), false);
  assert.match(resolveStaffProfileFallbackImageUrl("korean-groomer-profile-01"), /korean-groomer-profile-01\.jpg$/);
  assert.match(resolveStaffProfileFallbackImageUrl("korean-groomer-profile-02"), /korean-groomer-profile-02\.jpg$/);
  assert.equal(resolveStaffProfileFallbackImageUrl(null), "");
  assert.match(route, /profile_image_fallback_key: staffMember\.profileImageFallbackKey/);
  assert.match(route, /프로필 사진을 올리거나 기본 프로필 이미지를 선택해 주세요/);
  assert.match(bootstrap, /profile_image_fallback_key/);
  assert.match(avatar, /const displayImageUrl = decodedUrl \|\| resolveStaffProfileFallbackOrDefaultImageUrl\(profileImageFallbackKey\)/);
  assert.match(migration, /profile_image_fallback_key/);
  for (const source of [fallback, route, bootstrap, avatar, migration]) assert.doesNotMatch(source, /default_profile_variant|gender_key|female|male/i);
});
