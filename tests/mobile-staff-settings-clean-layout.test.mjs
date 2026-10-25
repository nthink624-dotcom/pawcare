import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/owner/owner-settings-panel.tsx", import.meta.url), "utf8");
const navStart = source.indexOf("function SettingsNavRow(");
const staffStart = source.indexOf("function StaffSettingsHome(");
const staffEnd = source.indexOf("function SettingsFieldCard(", staffStart);

assert.ok(navStart >= 0, "SettingsNavRow must exist");
assert.ok(staffStart > navStart && staffEnd > staffStart, "StaffSettingsHome source slice must exist");

const navSource = source.slice(navStart, staffStart);
const staffSource = source.slice(staffStart, staffEnd);

test("staff settings keeps the app header single and places account first", () => {
  assert.doesNotMatch(staffSource, /<h1[^>]*>\s*설정\s*<\/h1>/);
  assert.doesNotMatch(staffSource, /내 계정 정보|계정 \/ 문의/);

  const accountHeading = staffSource.indexOf("계정");
  const supportHeading = staffSource.indexOf("문의·정책");
  assert.ok(accountHeading >= 0 && supportHeading > accountHeading, "account group must precede support and policy");
});

test("staff settings removes the oversized profile helper card without removing identity", () => {
  assert.doesNotMatch(staffSource, /프로필 사진, 표시 이름, 담당 서비스는 오너가 관리해요/);
  assert.doesNotMatch(staffSource, /staffInitial|truncate|rounded-full/);
  assert.match(staffSource, /title="내 계정"/);
  assert.match(staffSource, /value=\{`\$\{staffName\} · \$\{staffContext\}`\}/);
  assert.match(staffSource, /title="로그인 이메일" value=\{accountEmail\}/);
});

test("account, reset, support, and legal actions remain connected", () => {
  assert.match(staffSource, /title="내 계정"[\s\S]{0,180}onClick=\{onAccountClick\}/);
  assert.match(staffSource, /href="\/login\/reset"[\s\S]{0,100}title="비밀번호 재설정"/);
  assert.match(staffSource, /title="1:1 문의" onClick=\{onSupportClick\}/);
  assert.match(staffSource, /title="약관 및 정책" onClick=\{onLegalClick\}/);
  assert.doesNotMatch(staffSource, />로그아웃</);
});

test("compact settings typography, touch geometry, and wrapping follow the mobile contract", () => {
  assert.match(staffSource, /bg-\[#f6f9fc\]/);
  assert.match(staffSource, /safe-area-inset-bottom/);
  assert.match(staffSource, /text-\[14px\][^\n]*font-medium[^\n]*leading-5/);
  assert.match(navSource, /min-h-\[56px\]/);
  assert.match(navSource, /text-\[16px\][^\n]*font-medium[^\n]*leading-6/);
  assert.match(navSource, /text-\[14px\][^\n]*font-normal[^\n]*leading-5/);
  assert.match(navSource, /overflow-wrap:anywhere/);
  assert.doesNotMatch(`${navSource}\n${staffSource}`, /font-(?:bold|extrabold|black)|font-\[(?:[7-9]00)\]/);
});
