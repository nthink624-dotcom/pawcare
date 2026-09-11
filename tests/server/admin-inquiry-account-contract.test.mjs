import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAdminErrorMessage } from "../../src/components/admin/admin-error-message.ts";

const adminHome = readFileSync(new URL("../../src/components/admin/admin-home.tsx", import.meta.url), "utf8");
const supportDetail = readFileSync(
  new URL("../../src/components/admin/admin-support-request-detail.tsx", import.meta.url),
  "utf8",
);
const ownerScreen = readFileSync(
  new URL("../../src/components/admin/owner-admin-screen.tsx", import.meta.url),
  "utf8",
);
const supportRoute = readFileSync(
  new URL("../../src/app/api/admin/support-requests/route.ts", import.meta.url),
  "utf8",
);
const ownerRoute = readFileSync(new URL("../../src/app/api/admin/owners/route.ts", import.meta.url), "utf8");
const adminAccount = readFileSync(new URL("../../src/server/admin-account.ts", import.meta.url), "utf8");

test("admin UI hides raw infrastructure errors and preserves actionable product errors", () => {
  const fallback = "관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
  assert.equal(getAdminErrorMessage(new Error("TypeError: fetch failed"), fallback), fallback);
  assert.equal(getAdminErrorMessage(new Error("PGRST205 schema cache failure"), fallback), fallback);
  assert.equal(getAdminErrorMessage(new Error("관리자 로그인이 필요합니다."), fallback), "관리자 로그인이 필요합니다.");
});

test("customer inquiry list opens a real detail and exposes bounded status or answer actions", () => {
  assert.match(adminHome, /AdminSupportRequestDetail/);
  assert.match(adminHome, /setSelectedSupportRequest\(request\)/);
  assert.match(adminHome, /문의 목록을 불러오는 중입니다/);
  assert.match(adminHome, /미처리 문의가 없습니다/);
  assert.doesNotMatch(adminHome, /visibleRequests\.slice\(0, 5\)/);

  assert.match(supportDetail, /role="dialog"/);
  assert.match(supportDetail, /"\/api\/admin\/support-requests"/);
  assert.match(supportDetail, /method: "PATCH"/);
  assert.match(supportDetail, /answerMessage/);
  assert.match(supportDetail, /처리 상태/);
  assert.match(supportDetail, /답변 저장/);
});

test("customer inquiry save notice survives same-request response updates", () => {
  assert.match(supportDetail, /activeRequestIdRef\.current === request\.id/);
  assert.match(supportDetail, /activeRequestIdRef\.current = request\.id/);
  assert.doesNotMatch(supportDetail, /\}, \[request\]\);/);
  assert.ok(supportDetail.indexOf("onSaved(response.request)") < supportDetail.indexOf("setNotice(answerMessage.trim()"));
});

test("customer inquiry detail traps forward and reverse focus and closes on Escape", () => {
  assert.match(supportDetail, /event\.key === "Escape"/);
  assert.match(supportDetail, /event\.key !== "Tab"/);
  assert.match(supportDetail, /event\.shiftKey && \(activeElement === firstFocusable/);
  assert.match(supportDetail, /lastFocusable\.focus\(\)/);
  assert.match(supportDetail, /!event\.shiftKey && \(activeElement === lastFocusable/);
  assert.match(supportDetail, /firstFocusable\.focus\(\)/);
});

test("customer inquiry detail restores the triggering row after every close path", () => {
  assert.match(adminHome, /supportRequestTriggerRef\.current = event\.currentTarget/);
  assert.match(adminHome, /trigger\?\.isConnected/);
  assert.match(adminHome, /trigger\.focus\(\)/);
  assert.match(adminHome, /supportSummaryRef\.current\?\.focus\(\)/);
  assert.match(supportDetail, /onClick=\{onClose\}/);
  assert.match(supportDetail, /if \(event\.target === event\.currentTarget\) onClose\(\)/);
});

test("account management distinguishes loading, fetch failure, true empty, and search empty states", () => {
  assert.match(ownerScreen, /ownerLoadFailed/);
  assert.match(ownerScreen, /ownerLoadError/);
  assert.match(ownerScreen, /등록된 오너 계정이 없습니다/);
  assert.match(ownerScreen, /검색 결과가 없습니다/);
  assert.match(ownerScreen, />다시 시도</);
  assert.match(ownerScreen, /RefreshCcw/);
});

test("admin inquiry and account APIs authenticate before reads or writes and sanitize 5xx responses", () => {
  const supportGet = supportRoute.indexOf("export async function GET");
  const supportPatch = supportRoute.indexOf("export async function PATCH");
  assert.ok(supportRoute.indexOf("await requireAdminSession(request)", supportGet) < supportPatch);
  assert.ok(supportRoute.indexOf("await requireAdminSession(request)", supportPatch) > supportPatch);
  assert.match(supportRoute, /error\.status >= 500/);

  const ownerGet = ownerRoute.indexOf("export async function GET");
  const ownerPatch = ownerRoute.indexOf("export async function PATCH");
  assert.ok(ownerRoute.indexOf("await requireAdminSession(request)", ownerGet) < ownerPatch);
  assert.ok(ownerRoute.indexOf("await requireAdminSession(request)", ownerPatch) > ownerPatch);
  assert.match(ownerRoute, /error\.status >= 500/);

  assert.match(adminAccount, /관리자 데이터 연결을 확인하지 못했습니다/);
  assert.doesNotMatch(adminAccount, /error\.message \|\| "관리자 정보를 불러오는 중 문제가 발생했습니다/);
});
