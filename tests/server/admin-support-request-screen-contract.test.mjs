import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const supportScreen = readFileSync(
  new URL("../../src/components/admin/admin-support-request-screen.tsx", import.meta.url),
  "utf8",
);
const supportPage = readFileSync(
  new URL("../../src/app/admin/support/page.tsx", import.meta.url),
  "utf8",
);
const adminHome = readFileSync(
  new URL("../../src/components/admin/admin-home.tsx", import.meta.url),
  "utf8",
);
const sectionNav = readFileSync(
  new URL("../../src/components/admin/admin-section-nav.tsx", import.meta.url),
  "utf8",
);

test("customer support menu opens an authenticated dedicated screen", () => {
  assert.match(adminHome, /MenuCard href="\/admin\/support"/);
  assert.match(sectionNav, /href: "\/admin\/support", label: "고객 문의"/);
  assert.match(supportPage, /getServerAdminSession/);
  assert.match(supportPage, /redirect\("\/admin\/login"/);
  assert.match(supportPage, /AdminSupportRequestScreen/);
});

test("admin home puts pending customer support ahead of the compact work overview", () => {
  assert.match(adminHome, /지금 먼저 확인할 업무/);
  assert.match(adminHome, /고객 문의 · 미처리 \{pending\.length\}건/);
  assert.match(adminHome, /firstPendingSupportRequest\.title/);
  assert.match(adminHome, /고객 문의 열기/);
  assert.doesNotMatch(adminHome, /min-h-\[176px\]/);
  assert.doesNotMatch(adminHome, /rounded-t-full bg-\[#eef8ff\]/);
});

test("customer support screen shows the requester, inquiry context, and bounded handling state", () => {
  assert.match(supportScreen, /"\/api\/admin\/support-requests\?limit=100"/);
  assert.match(supportScreen, /request\.ownerName/);
  assert.match(supportScreen, /request\.shopName/);
  assert.match(supportScreen, /request\.message/);
  assert.match(supportScreen, /supportRequestStatusLabels\[request\.status\]/);
  assert.match(supportScreen, /AdminSupportRequestDetail/);
  assert.match(supportScreen, /onSaved=\{saveRequest\}/);
});

test("customer support screen keeps the approved blue-neutral type and accessible controls", () => {
  assert.match(supportScreen, /bg-\[#F4F4F4\]/);
  assert.match(supportScreen, /bg-\[#2563EB\]/);
  assert.match(supportScreen, /ADMIN_TYPOGRAPHY\.meta/);
  assert.match(supportScreen, /ADMIN_TYPOGRAPHY\.control/);
  assert.match(supportScreen, /min-h-11/);
  assert.match(supportScreen, /aria-pressed/);
  assert.match(supportScreen, /focus-visible:ring-\[#2563EB\]/);
});
