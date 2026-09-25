import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const readText = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
const readBytes = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const layout = readText("src/app/layout.tsx");
const globals = readText("src/app/globals.css");
const typography = readText("src/components/owner-web/owner-typography.ts");
const actionButtons = readText("src/components/owner-web/owner-web-action-button-styles.ts");
const shell = readText("src/components/owner-web/owner-web-app-shell.tsx");
const ownerUi = readText("src/components/owner-web/owner-web-ui.tsx");
const alerts = readText("src/components/owner-web/settings-alerts-panel.tsx");
const profitability = readText("src/components/owner-web/profitability-analytics-screen.tsx");

test("bundles the pinned official Pretendard v1.3.9 WOFF2 and OFL", () => {
  const font = readBytes("src/assets/fonts/PretendardVariable.woff2");
  const license = readBytes("src/assets/fonts/OFL.txt");

  assert.equal(font.length, 2_057_688);
  assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
  assert.equal(sha256(font), "9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4");
  assert.equal(sha256(license), "d31ddd9f2bed32fd7e302a205cf2380ba0de6529152d239ef99cfb6f261bfc04");
  assert.match(license.toString("utf8"), /Copyright \(c\) 2021, Kil Hyung-jin/);
  assert.match(license.toString("utf8"), /SIL OPEN FONT LICENSE Version 1\.1/);
});

test("loads the local variable font from the Korean root layout with swap and fallbacks", () => {
  assert.match(layout, /import localFont from "next\/font\/local"/);
  assert.match(layout, /src: "\.\.\/assets\/fonts\/PretendardVariable\.woff2"/);
  assert.match(layout, /display: "swap"/);
  assert.match(layout, /weight: "45 920"/);
  assert.match(layout, /variable: "--font-pretendard"/);
  assert.match(layout, /fallback: \["Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Segoe UI", "Arial"\]/);
  assert.match(layout, /<html lang="ko" className=\{pretendard\.variable\}>/);
  assert.match(layout, /<body className=\{pretendard\.className\}>/);
  assert.doesNotMatch(layout, /style=\{\{\s*fontFamily/);
  assert.doesNotMatch(layout, /https?:\/\//);
});

test("defines the shared Korean roles and lets control utilities survive family inheritance", () => {
  for (const expected of [
    "--type-micro-size: 12px;",
    "--type-micro-line: 18px;",
    "--type-helper-size: 13px;",
    "--type-helper-line: 20px;",
    "--type-body-small-size: 14px;",
    "--type-body-small-line: 20px;",
    "--type-body-size: 16px;",
    "--type-body-line: 24px;",
    "--type-heading-small-size: 18px;",
    "--type-heading-small-line: 26px;",
    "--type-heading-medium-size: 20px;",
    "--type-heading-medium-line: 28px;",
    "--type-heading-large-size: 24px;",
    "--type-heading-large-line: 32px;",
    "--type-page-title-size: 28px;",
    "--type-page-title-line: 36px;",
    "--weight-regular: 400;",
    "--weight-medium: 500;",
    "--weight-semibold: 600;",
  ]) {
    assert.match(globals, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(globals, /--font-ui-ko: var\(--font-pretendard, "Pretendard Variable"\)/);
  assert.match(globals, /\.owner-font \{[\s\S]*font-family: var\(--font-ui-ko\);[\s\S]*font-synthesis: none;/);
  assert.match(globals, /\.owner-font button,[\s\S]*font-family: inherit;/);
  assert.doesNotMatch(globals, /\.owner-font button,[\s\S]{0,180}font:\s*inherit;/);
});

test("maps owner and care-report tokens to 400, 500, and 600 semantic roles", () => {
  for (const expected of [
    'helper: "text-[13px] leading-5 font-normal"',
    'meta: "text-[12px] leading-[18px] font-medium"',
    'badge: "text-[12px] leading-[18px] font-medium"',
    'label: "text-[14px] leading-5 font-medium"',
    'control: "text-[16px] leading-6 font-medium"',
    'body: "text-[16px] leading-6 font-normal"',
    'bodyStrong: "text-[16px] leading-6 font-medium"',
    'sectionTitle: "text-[20px] leading-7 font-semibold"',
    'modalTitle: "text-[28px] leading-9 font-semibold"',
    'sectionTitle: "text-[18px] leading-[26px] font-semibold"',
    'modalTitle: "text-[20px] leading-7 font-semibold"',
  ]) {
    assert.ok(typography.includes(expected), `missing typography role: ${expected}`);
  }
  assert.doesNotMatch(typography, /font-(?:bold|extrabold|black)/);
  assert.doesNotMatch(typography, /text-\[(?:8|9|10|11|15|17|19|21|22|23|25|26|27|29|30|31)px\]/);
});

test("keeps common actions and owner shell controls on canonical readable roles", () => {
  assert.match(actionButtons, /h-11[^"]*text-\[14px\] font-medium leading-5/);
  assert.match(shell, /OWNER_HEADER_UTILITY_BUTTON_CLASS =[\s\S]*h-11[^"]*text-\[14px\] font-medium leading-5/);
  assert.match(shell, /text-\[12px\] font-medium leading-\[18px\] text-\[#8f98a6\]/);
  assert.match(shell, /h-11 w-full[^"]*text-\[14px\] font-medium leading-5/);
  assert.match(shell, /text-\[14px\] font-semibold leading-5 tracking-\[-0\.01em\]/);
  assert.match(shell, /text-\[12px\] font-medium leading-\[18px\] text-\[var\(--mut\)\]/);
  assert.doesNotMatch(shell, /font-(?:bold|extrabold|black)/);
  assert.doesNotMatch(shell, /text-\[(?:8|9|10|11|13\.5|15|17|19|21|22|23|25|26|27|29|30|31)px\]/);

  assert.match(shell, /className="pm-owner-main-surface h-full min-h-0 min-w-0 shadow-none"/);
  assert.match(shell, /data-owner-main-surface-layout=\{usesFlushCore \? "flush" : "inset"\}/);
});

test("normalizes shared owner controls without changing their interaction contracts", () => {
  assert.match(ownerUi, /export function SoftSelect/);
  assert.match(ownerUi, /aria-haspopup="listbox"/);
  assert.match(ownerUi, /role="option"/);
  assert.match(ownerUi, /grid min-h-11[^"]*text-left transition/);
  assert.match(ownerUi, /text-\[12px\] font-medium leading-\[18px\]/);
  assert.match(ownerUi, /text-\[14px\] font-medium leading-5/);
  assert.match(ownerUi, /flex min-h-11 w-full[^"]*text-\[14px\] font-medium leading-5/);
  assert.match(ownerUi, /inline-flex min-h-11[^"]*text-\[13px\] font-medium leading-5/);
  assert.doesNotMatch(ownerUi, /font-(?:bold|extrabold|black)/);
  assert.doesNotMatch(ownerUi, /text-\[(?:8|9|10|11|15|17|19|21|22|23|25|26|27|29|30|31)px\]/);
});

test("keeps product text at or above the 12/18 micro role without changing external mocks", () => {
  assert.match(alerts, /data-alerts-preview/);
  assert.match(alerts, /text-\[8px\][^>]*>[\s\S]*kakao/);
  for (const size of [8, 9, 10, 11]) {
    assert.match(globals, new RegExp(`\\[class~="text-\\[${size}px\\]"\\]`));
  }
  assert.match(globals, /:not\(\[data-booking-link-channel="naver"\] \*\)/);
  assert.match(globals, /:not\(\[data-customer-phone-preview-frame\] \*\)/);
  assert.match(globals, /font-size: var\(--type-micro-size\);[\s\S]*font-weight: var\(--weight-medium\);[\s\S]*line-height: var\(--type-micro-line\);/);
  assert.match(globals, /button,\s*\ninput,\s*\nselect,\s*\ntextarea \{\s*\n  font-family: inherit;/);
  assert.doesNotMatch(globals, /button,\s*\ninput,\s*\nselect,\s*\ntextarea \{\s*\n  font: inherit;/);
});

test("preserves the completed profitability typography and removed explanation", () => {
  assert.doesNotMatch(profitability, /owner-web-ui/);
  assert.match(profitability, /text-\[20px\] font-semibold leading-7[\s\S]*시간당 수익 분석/);
  assert.match(profitability, /text-\[18px\] font-semibold leading-\[26px\]/);
  assert.doesNotMatch(profitability, /실제 미용시간과 받은 금액을 연결해|시간당 매출이 낮은 순서입니다/);
});
