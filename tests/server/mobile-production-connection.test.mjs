import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { withLandingDemoProfiles } from "../../src/lib/landing-demo-profile.ts";

test("production owner mobile route stays same-origin and preserves the owner session flow", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../../src/app/owner/mobile/page.tsx", import.meta.url), "utf8");
  const owner = readFileSync(new URL("../../src/app/owner/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(`${config}${mobile}`, /127\.0\.0\.1:3100/);
  assert.match(mobile, /<OwnerPage mobileRoute/);
  assert.match(owner, /!mobileRoute && shouldOpenMobileOwnerScreen/);
});

test("landing mobile preview is a non-interactive mock route with no placeholder copy", () => {
  const landing = readFileSync(new URL("../../src/components/landing/landing-primary-sections.tsx", import.meta.url), "utf8");
  const demo = readFileSync(new URL("../../src/app/demo/owner-mobile/page.tsx", import.meta.url), "utf8");
  assert.match(landing, /src="\/demo\/owner-mobile"/);
  assert.match(landing, /pointer-events-none/);
  assert.doesNotMatch(landing, /APP 화면 연결 예정/);
  assert.match(demo, /isPreviewDemo/);
});

test("every landing demo designer gets an approved virtual profile with fallback-compatible fields", () => {
  const input = { mode: "mock", shop: {}, staffMembers: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] };
  const output = withLandingDemoProfiles(input);
  assert.equal(output.mode, "mock");
  assert.equal(output.staffMembers.every((staff) => staff.profileImageUrl?.startsWith("/images/profiles/korean-groomer-profile-")), true);
  assert.equal(output.staffMembers.every((staff) => staff.profileImageUrls?.length === 1), true);
});
