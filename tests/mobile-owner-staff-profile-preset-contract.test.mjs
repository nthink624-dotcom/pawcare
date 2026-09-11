import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [settings, ownerApp, fallback, domain] = await Promise.all([
  readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/staff-profile-fallback.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/types/domain.ts", import.meta.url), "utf8"),
]);

test("staff profile header is clean, readable, and keeps uploaded media read-only", () => {
  assert.match(settings, /data-staff-profile-header/);
  assert.match(settings, /h-\[84px\] w-\[84px\]/);
  assert.match(settings, /text-\[20px\] font-semibold leading-7/);
  assert.match(settings, /Array\.from\(new Set\(\[/);
  assert.match(settings, /draft\.titlePrefix\.trim\(\)/);
  assert.match(settings, /draft\.position\.trim\(\)/);
  assert.doesNotMatch(settings, /고객에게 보일 프로필/);
  assert.doesNotMatch(settings, /사진 올리기|사진 지우기|type="file"[\s\S]{0,180}handleStaffProfileImageChange/);
  assert.match(settings, /src=\{draft\.profileImageUrl\}/);
});

test("two explicit non-gendered presets are selectable and required only without an upload", () => {
  assert.match(fallback, /"korean-groomer-profile-01"/);
  assert.match(fallback, /"korean-groomer-profile-02"/);
  assert.match(domain, /profileImageFallbackKey\?: "korean-groomer-profile-01" \| "korean-groomer-profile-02" \| null/);
  assert.match(settings, /data-staff-profile-preset-picker/);
  assert.match(settings, /role="radio"/);
  assert.match(settings, /aria-checked=\{selected\}/);
  assert.match(settings, /min-h-\[96px\]/);
  assert.match(settings, /!draft\.profileImageUrl\.trim\(\) && !isStaffProfileFallbackKey\(draft\.profileImageFallbackKey\)/);
  assert.match(settings, /기본 프로필 이미지 두 개 중 하나를 선택해 주세요\./);
  assert.match(settings, /profileImageFallbackKey: draft\.profileImageFallbackKey/);
  assert.doesNotMatch(settings, /gender|female|male|random/i);
});

test("profile save and demo readback preserve the canonical preset key", () => {
  assert.match(ownerApp, /profileImageFallbackKey\?: BootstrapStaffMember\["profileImageFallbackKey"\]/);
  assert.match(ownerApp, /profileImageFallbackKey: staffPayload\.profileImageFallbackKey \?\? staffMember\.profileImageFallbackKey/);
});
