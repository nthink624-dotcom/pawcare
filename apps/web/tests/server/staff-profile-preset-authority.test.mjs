import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("staff preset avatar authority stores only an explicit bundled asset key", async () => {
  const [fallback, route, bootstrap, migration] = await Promise.all([
    readSource("src/lib/staff-profile-fallback.ts"),
    readSource("src/app/api/staff-members/route.ts"),
    readSource("src/server/bootstrap.ts"),
    readSource("../../supabase/migrations/20260910053252_staff_profile_fallback_key.sql"),
  ]);

  assert.match(fallback, /"korean-groomer-profile-01"/);
  assert.match(fallback, /"korean-groomer-profile-02"/);
  assert.match(fallback, /isStaffProfileFallbackKey/);
  assert.doesNotMatch(fallback, /gender|female|male/i);
  assert.match(route, /profileImageFallbackKey: z\.string\(\)\.trim\(\)\.nullable\(\)\.optional\(\)\.default\(null\)/);
  assert.match(route, /!hasUploadedProfilePhoto\(staffMember\) && !isStaffProfileFallbackKey\(staffMember\.profileImageFallbackKey\)/);
  assert.match(route, /profile_image_fallback_key: staffMember\.profileImageFallbackKey/);
  assert.match(bootstrap, /profileImageFallbackKey: isStaffProfileFallbackKey\(row\.profile_image_fallback_key\) \? row\.profile_image_fallback_key : null/);
  assert.match(migration, /add column if not exists profile_image_fallback_key text/);
  assert.match(migration, /'korean-groomer-profile-01',\s*'korean-groomer-profile-02'/);
});
