import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const screen = fs.readFileSync(
  path.join(process.cwd(), "src/components/owner/owner-service-expired-screen.tsx"),
  "utf8",
);

test("expired owner screen keeps billing behavior in one compact accessible card", () => {
  assert.match(screen, /max-w-\[560px\]/);
  assert.match(screen, /isPastDue \? "결제를 완료해 주세요" : "이용 기간이 종료되었습니다"/);
  assert.match(screen, /기간을 연장하면 바로 다시 이용할 수 있습니다\./);
  assert.match(screen, /서비스 종료일/);
  assert.match(screen, /마지막 이용 플랜/);
  assert.match(screen, /currentPlanCode === "free"[\s\S]{0,100}"무료 체험 플랜"/);
  assert.match(screen, /notice=\$\{isPastDue \? "past_due" : "expired"\}&plan=\$\{resumePlanCode\}/);
  assert.match(screen, /기간 연장하기/);
  assert.match(screen, /bg-\[#111a30\][\s\S]{0,200}hover:bg-\[#0b1222\]/);
  assert.match(screen, /mailto:\$\{LEGAL_BUSINESS_INFO\.customerServiceEmail\}/);
  assert.match(screen, /결제·이용 문의/);
  assert.match(screen, /aria-label="결제·이용 문의 이메일 보내기"/);
  assert.match(screen, /onClick=\{onLogout\}/);
  assert.match(screen, /loggingOut \? "로그아웃 중\.\.\." : "다른 계정으로 로그인"/);
  assert.match(screen, /min-h-11[\s\S]{0,300}focus-visible:/);
  assert.match(screen, /max-w-\[1240px\] flex-wrap/);
  assert.match(screen, /min-h-11 min-w-0 max-w-full/);
  assert.match(screen, /nameClassName="whitespace-normal[^"]*\[overflow-wrap:anywhere\]"/);
  assert.equal(screen.match(/\[overflow-wrap:anywhere\]/g)?.length, 6);
  assert.doesNotMatch(screen, /lucide-react|preservedItems|gradient|shadow-|font-bold|서비스 이용 안내|지금 연장하면/);
});
