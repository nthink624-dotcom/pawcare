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
  const globals = readProjectFile("src/app/globals.css");
  const ownerShell = readProjectFile("src/components/owner-web/owner-web-app-shell.tsx");

  assert.match(panel, /h-11.*text-\[16px\].*font-medium.*leading-6.*focus-visible:ring-2/);
  assert.match(panel, /benefit-management-tab[^"\n]*focus-visible:ring-\[#2563eb\]/);
  assert.match(ownerShell, /owner-font pm-owner-web/);
  assert.match(globals, /\.owner-font button,[\s\S]*font-family: inherit;[\s\S]*\.pm-owner-web\.owner-font \.benefit-management-panel \.benefit-management-tab\s*\{[\s\S]*font-size: 16px;[\s\S]*font-weight: 500;[\s\S]*line-height: 24px;/);
  assert.match(panel, /aria-selected=\{view === "register"\}/);
  assert.match(panel, /aria-selected=\{view === "manage"\}/);
  assert.match(panel, /id="benefit-register-panel"[\s\S]*id="benefit-manage-panel"/);
  assert.match(panel, /border-\[#2563eb\] bg-\[#eff6ff\] text-\[#1d4ed8\]/);
  assert.match(panel, /role="tabpanel"/);
  assert.match(panel, /h-11.*bg-\[#1d4ed8\].*text-\[16px\].*text-white/);
  assert.match(panel, /lg:h-full lg:min-h-0/);
  assert.match(panel, /overflow-visible p-4 pb-5 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto/);
  assert.equal((panel.match(/overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden/g) ?? []).length, 2);
  assert.equal((panel.match(/min-h-11 max-w-full[^"\n]*whitespace-normal[^"\n]*\[word-break:keep-all\]/g) ?? []).length, 2);

  assert.match(form, /aria-pressed=\{selected\}/);
  assert.match(form, /h-14 min-w-\[148px\] items-center justify-start gap-3/);
  assert.match(form, /border-\[#2563eb\] bg-\[#eff6ff\] text-\[#1d4ed8\]/);
  assert.match(form, /focus-visible:ring-\[#2563eb\]/);
  assert.match(form, /grid gap-3 border-b[^"\n]*py-4/);
  assert.doesNotMatch(form, /#2f7866|#f4faf8/);

  assert.match(table, /grid-cols-1[^"\n]*sm:grid-cols-2[^"\n]*lg:grid-cols-3[^"\n]*xl:grid-cols-\[minmax\(0,1\.35fr\)_repeat\(3,minmax\(0,1fr\)\)_auto\]/);
  assert.doesNotMatch(table, /grid-cols-\[minmax\(180px,1\.35fr\)_repeat\(3,minmax\(140px,1fr\)\)_auto\]/);
  assert.match(table, /sm:col-span-2 lg:col-span-2 xl:col-span-1/);
  assert.equal((table.match(/h-11[^"\n]*focus-visible:ring-2/g) ?? []).length >= 2, true);
  assert.match(table, /const fieldClassName =\s*\n\s*"h-11 w-full/);
  assert.equal((table.match(/min-h-11 min-w-(?:0|max) flex-(?:1|none)[^"\n]*whitespace-normal[^"\n]*\[word-break:keep-all\]/g) ?? []).length >= 2, true);
  assert.equal((table.match(/border-\[#1d4ed8\] bg-\[#1d4ed8\][^"\n]*text-white/g) ?? []).length >= 2, true);
  assert.equal((table.match(/min-h-11[^"\n]*whitespace-normal[^"\n]*\[word-break:keep-all\]/g) ?? []).length >= 2, true);
  assert.equal((table.match(/<label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center">/g) ?? []).length, 2);
  assert.equal((table.match(/inline-flex h-11 w-11 items-center justify-center rounded-\[7px\][^"\n]*focus-visible:ring-\[#2563eb\]/g) ?? []).length >= 2, true);
  assert.match(table, /className="h-11 rounded-\[7px\][^"\n]*focus-visible:ring-\[#2563eb\]/);
  assert.match(table, /min-h-\[210px\] shrink-0 overflow-auto[^"\n]*lg:min-h-0 lg:flex-1/);
  assert.match(table, /flex min-h-0 flex-col lg:h-full/);
  assert.match(table, /filteredCoupons\.length === 0 && "lg:h-full"/);
  assert.match(table, /<tr className="lg:h-full">/);
  assert.match(table, /className="px-4 py-12 text-center align-middle text-\[#64748b\]"/);
  assert.match(table, /조회된 혜택이 없습니다\./);
});
