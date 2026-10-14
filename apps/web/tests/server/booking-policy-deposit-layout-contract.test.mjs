import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("../../src/components/owner-web/booking-policy-panel.tsx", import.meta.url), "utf8");

test("deposit controls stay readable while loading and the enable switch lives in the settings header", () => {
  assert.match(panel, /fieldset disabled=\{!loaded \|\| busy \|\| !editable\}[^\n]*disabled:opacity-100/);
  assert.match(panel, /<h3 className="text-\[20px\] font-semibold leading-7">\{depositSection === "settings" \? "예약금 설정" : "취소·환불 안내"\}<\/h3>[\s\S]*role="switch" aria-label="예약금 사용"/);
  const depositNavigation = panel.match(/<aside className="overflow-hidden rounded-\[14px\] border border-\[#e4e7ec\] bg-white">([\s\S]*?)<\/aside>/)?.[1] ?? "";
  assert.notEqual(depositNavigation, "");
  assert.doesNotMatch(depositNavigation, /role="switch" aria-label="예약금 사용"/);
  assert.match(panel, /policy\.depositMode !== "off" \? <BookingDepositAlimtalkPreview/);
  assert.match(panel, /policy\.depositMode !== "off" \? <div className="flex-1 space-y-6/);
  assert.match(panel, /예약금 사용을 켜면 금액과 입금 계좌, 안내 기한을 설정할 수 있습니다/);
});
