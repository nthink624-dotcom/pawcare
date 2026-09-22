import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const detailStart = ownerApp.indexOf('activeTab === "customers" && selectedGuardian && (');
const detailEnd = ownerApp.indexOf('activeTab === "settings"', detailStart);
assert.notEqual(detailStart, -1, "customer detail surface marker is present");
assert.notEqual(detailEnd, -1, "customer detail surface end marker is present");
const detailSurface = ownerApp.slice(detailStart, detailEnd);

test("customer detail uses the approved heading, label, body, and control type roles", () => {
  assert.match(detailSurface, /<h2 className="text-\[20px\] font-semibold leading-7 tracking-\[-0\.015em\][^>]*>고객 상세<\/h2>/);
  assert.match(detailSurface, /text-\[18px\] font-semibold leading-\[26px\] tracking-\[-0\.01em\][^>]*>기본 정보<\/p>/);
  assert.match(detailSurface, /text-\[18px\] font-semibold leading-\[26px\] tracking-\[-0\.01em\][^>]*>개인 알림톡<\/p>/);
  assert.match(detailSurface, /text-\[14px\] font-medium leading-5 tracking-\[-0\.005em\][^>]*>보호자<\/span>/);
  assert.match(detailSurface, /text-\[14px\] font-medium leading-5 tracking-\[-0\.005em\][^>]*>연락처<\/span>/);
  assert.match(detailSurface, /text-\[14px\] font-medium leading-5 tracking-\[-0\.005em\][^>]*>반려동물<\/span>/);
  assert.match(detailSurface, /text-\[16px\] font-medium leading-6 tracking-\[-0\.005em\][^>]*>\{selectedGuardian\.name\}<\/span>/);
  assert.match(detailSurface, /data-customer-detail-tab=\{item\}[\s\S]*?min-h-11[^"`]*text-\[16px\] font-medium leading-6/);
});

test("customer detail does not use undersized labels or semibold control copy", () => {
  assert.doesNotMatch(detailSurface, /text-\[12px\][^>]*>기본 정보<\/p>/);
  assert.doesNotMatch(detailSurface, /text-\[12px\][^>]*>개인 알림톡<\/p>/);
  assert.doesNotMatch(detailSurface, /text-\[13px\] font-normal[^>]*>(?:보호자|연락처|반려동물|메모)<\/span>/);
  assert.doesNotMatch(detailSurface, /text-\[16px\] font-semibold[^>]*>알림톡 전체 수신<\/p>/);
  assert.doesNotMatch(detailSurface, /font-(?:bold|extrabold|black|\[(?:7\d{2}|8\d{2}|9\d{2}|1000)\])/);
});
