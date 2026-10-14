import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("benefit editor keeps the readable blue selection, tab, and footer accessibility contract", () => {
  const panel = readProjectFile("src/components/owner-web/benefits-management-panel.tsx");
  const form = readProjectFile("src/components/owner-web/benefit-registration-form.tsx");
  const table = readProjectFile("src/components/owner-web/benefit-management-table.tsx");
  const editor = readProjectFile("src/components/owner-web/discount-coupon-editor.tsx");
  const globals = readProjectFile("src/app/globals.css");
  const ownerShell = readProjectFile("src/components/owner-web/owner-web-app-shell.tsx");

  assert.match(panel, /className="owner-settings-tabbar min-w-0 w-full" role="tablist"/);
  assert.match(panel, /OWNER_SETTINGS_TAB_HEADER_CLASS/);
  assert.doesNotMatch(panel, /onReload|저장된 내용 불러오기/);
  assert.equal((panel.match(/className="owner-settings-tab"/g) ?? []).length, 2);
  assert.match(ownerShell, /owner-font pm-owner-web/);
  assert.match(globals, /\.pm-owner-web \.owner-settings-tabbar > \[role="tab"\][\s\S]*font-size: 18px !important;[\s\S]*font-weight: 500 !important;[\s\S]*line-height: 26px !important;/);
  assert.match(globals, /\.benefit-management-results\s*\{[\s\S]*container-type: inline-size;/);
  assert.match(globals, /@container \(min-width: 980px\)[\s\S]*benefit-management-desktop-table[\s\S]*benefit-management-card-list/);
  assert.match(globals, /\.pm-owner-web \.benefit-management-panel :is\(button, a\)\[class~="h-11"\][\s\S]*height: 44px !important/);
  assert.match(globals, /\.pm-owner-web \.benefit-management-panel button > svg\s*\{[\s\S]*width: 18px !important;[\s\S]*height: 18px !important;/);
  assert.match(panel, /aria-selected=\{view === "register"\}/);
  assert.match(panel, /aria-selected=\{view === "manage"\}/);
  assert.match(panel, /id="benefit-register-panel"[\s\S]*id="benefit-manage-panel"/);
  assert.match(globals, /\.owner-settings-tabbar > \[role="tab"\]\[aria-selected="true"\][\s\S]*background: #fff !important;/);
  assert.match(panel, /role="tabpanel"/);
  assert.match(panel, /!h-11 max-w-full[^"\n]*!text-\[16px\]/);
  assert.match(panel, /lg:h-full lg:min-h-0/);
  assert.match(panel, /overflow-visible rounded-\[14px\] border border-\[#e1e4ea\] p-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto/);
  assert.equal((panel.match(/overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden/g) ?? []).length, 2);
  assert.equal((panel.match(/!h-11 max-w-full[^"\n]*whitespace-normal[^"\n]*\[word-break:keep-all\]/g) ?? []).length, 2);

  assert.match(form, /aria-pressed=\{selected\}/);
  assert.match(form, /h-11 min-w-\[148px\] items-center justify-start gap-3/);
  assert.match(form, /border-\[#1677ff\] bg-\[#eff6ff\] text-\[#1677ff\]/);
  assert.match(form, /focus-visible:ring-\[#1677ff\]/);
  assert.match(form, /flex items-start gap-1 pt-3 text-\[16px\] font-medium leading-6/);
  assert.match(editor, /const fieldLabelClassName = "text-\[16px\] font-medium leading-6 text-\[#475569\]"/);
  assert.match(editor, /appearance-none[^"\n]*text-\[16px\]! font-medium! leading-6!/);
  assert.match(form, /<span className="text-\[16px\] font-medium leading-6 text-\[#475569\]">시작일<\/span>/);
  assert.match(form, /<span className="text-\[16px\] font-medium leading-6 text-\[#475569\]">종료일<\/span>/);
  assert.match(form, /grid gap-3 border-b[^"\n]*py-4/);
  assert.doesNotMatch(form, /#2f7866|#f4faf8/);

  assert.match(table, /grid-cols-1[^"\n]*sm:grid-cols-2[^"\n]*lg:grid-cols-3[^"\n]*xl:grid-cols-\[minmax\(0,1\.35fr\)_repeat\(3,minmax\(0,1fr\)\)_auto\]/);
  assert.doesNotMatch(table, /grid-cols-\[minmax\(180px,1\.35fr\)_repeat\(3,minmax\(140px,1fr\)\)_auto\]/);
  assert.match(table, /sm:col-span-2 lg:col-span-2 xl:col-span-1/);
  assert.equal((table.match(/h-11[^"\n]*focus-visible:ring-2/g) ?? []).length >= 2, true);
  assert.match(table, /const fieldClassName =\s*\n\s*"h-11 w-full/);
  assert.match(table, /!h-11 min-w-0 flex-1/);
  assert.match(table, /!h-11 min-w-max flex-none/);
  assert.match(table, /OWNER_WEB_COMPACT_PRIMARY_ACTION_BUTTON_CLASS/);
  assert.equal((table.match(/<label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">/g) ?? []).length, 2);
  assert.equal((table.match(/inline-flex h-11 w-11 items-center justify-center rounded-\[7px\][^"\n]*focus-visible:ring-2/g) ?? []).length >= 1, true);
  assert.match(table, /inline-flex h-11 items-center justify-center rounded-\[7px\][^"\n]*text-\[16px\]/);
  assert.match(table, /benefit-management-results/);
  assert.match(table, /benefit-management-desktop-table min-h-0 min-w-0 flex-1 overflow-auto/);
  assert.match(table, /benefit-management-card-list min-h-\[210px\] min-w-0 flex-1 flex-col gap-2 overflow-y-auto/);
  assert.match(table, /w-full min-w-\[960px\] table-fixed[^"\n]*text-\[16px\] font-normal leading-6/);
  assert.match(table, /flex min-h-0 flex-col lg:h-full/);
  assert.match(table, /filteredCoupons\.length === 0 && "h-full"/);
  assert.match(table, /<tr className="h-full">/);
  assert.match(table, /text-\[16px\] leading-6 text-\[#64748b\]/);
  assert.match(table, /등록된 혜택이 없습니다\. 혜택 등록 탭에서 먼저 등록해 주세요\./);
  assert.doesNotMatch(table, /새 혜택 등록/);
  assert.match(table, /<Pencil className="h-\[18px\] w-\[18px\]" strokeWidth=\{1\.8\}/);
  assert.match(table, /aria-label=\{`\$\{name\} 수정`\}/);
});
