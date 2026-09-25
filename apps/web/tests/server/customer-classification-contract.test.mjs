import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("customer classification is a guardian field with nullable automatic grade and no Auth role", async () => {
  const [migration, domain, schemas, mutations, customerRoute] = await Promise.all([
    read("../../supabase/migrations/20260831135511_guardian_customer_classification.sql"),
    read("src/types/domain.ts"),
    read("src/server/schemas.ts"),
    read("src/server/owner-mutations.ts"),
    read("src/app/api/owner/customers/route.ts"),
  ]);

  assert.match(migration, /customer_grade_override is null or customer_grade_override in \('normal', 'loyal', 'attention'\)/);
  assert.match(migration, /customer_member_type in \('guardian', 'proxy', 'guest'\)/);
  assert.match(domain, /customer_grade_override\?: CustomerGradeOverride \| null/);
  assert.match(domain, /customer_member_type\?: CustomerMemberType/);
  assert.match(schemas, /customerGradeOverride: z\.enum\(\["normal", "loyal", "attention"\]\)\.nullable\(\)\.optional\(\)/);
  assert.match(schemas, /customerMemberType: z\.enum\(\["guardian", "proxy", "guest"\]\)\.optional\(\)/);
  assert.match(mutations, /customer_grade_override: payload\.customerGradeOverride/);
  assert.match(mutations, /customer_member_type: payload\.customerMemberType/);
  assert.match(customerRoute, /customerGradeOverride: body\?\.customerGradeOverride/);
  assert.doesNotMatch(migration, /owner_shop_memberships|auth\.users|role in \('owner'/);
});

test("customer grade is edited beside the guardian name without exposing member type", async () => {
  const [screen, detail, table] = await Promise.all([
    read("src/components/owner-web/customer-management-screen.tsx"),
    read("src/components/owner-web/customer-detail-panel.tsx"),
    read("src/components/owner-web/customer-management-table.tsx"),
  ]);

  assert.match(screen, /cache: "no-store"/);
  assert.match(screen, /async function saveCustomerGuardianProfile/);
  const saveGuardianProfile = screen.slice(screen.indexOf("async function saveCustomerGuardianProfile"), screen.indexOf("async function updatePetDetail"));
  assert.equal((saveGuardianProfile.match(/await patchOwnerGuardian\(/g) ?? []).length, 1);
  assert.equal((saveGuardianProfile.match(/cache: "no-store"/g) ?? []).length, 1);
  assert.match(screen, /customerGradeOverride: patch\.customerGradeOverride/);
  assert.match(screen, /customerGradeOverride: newCustomerDraft\.customerGradeOverride/);
  assert.doesNotMatch(screen, /customerMemberType:/);
  assert.match(detail, /가격 그룹/);
  assert.match(detail, /data-customer-detail-pane-layout="true"/);
  assert.match(detail, /grid-cols-1 grid-rows-\[minmax\(0,0\.82fr\)_minmax\(0,1fr\)\] overflow-hidden lg:grid-cols-\[310px_minmax\(0,1fr\)\] lg:grid-rows-1/);
  assert.match(detail, /border-b border-\[#e1e7ef\][\s\S]{0,120}lg:border-b-0 lg:border-r/);
  assert.match(detail, /grid grid-cols-1 gap-3 border-t border-\[#edf2f7\] pt-3 lg:grid-cols-\[108px_220px_minmax\(0,1fr\)\]/);
  assert.match(detail, /border-t border-\[#e5e7eb\] pt-3 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0/);
  assert.match(detail, /onEdit=\{\(\) => setActiveAction\("guardianEdit"\)\}/);
  assert.match(detail, /action === "guardianEdit"/);
  assert.match(detail, /grid-cols-1 gap-3 sm:grid-cols-\[minmax\(0,1fr\)_minmax\(172px,0\.72fr\)\]/);
  assert.match(detail, /label="고객 등급"/);
  assert.match(detail, /data-customer-grade-badge="true"/);
  assert.match(detail, /getCustomerGradeLabel/);
  assert.match(detail, /customerGradeOverride: guardianDraft\.customerGradeOverride/);
  assert.doesNotMatch(detail, /회원 유형|customerMemberType/);
  assert.doesNotMatch(table, /회원 유형|customerMemberType|getCustomerMemberTypeLabel/);
  assert.doesNotMatch(table, /지역/);
});

test("customer detail keeps every visible guardian action and field at the 44px control contract", async () => {
  const detail = await read("src/components/owner-web/customer-detail-panel.tsx");

  assert.match(detail, /aria-label="닫기"[\s\S]{0,260}h-11 w-11|h-11 w-11[\s\S]{0,260}aria-label="닫기"/);
  assert.match(detail, /onCopyPhone[\s\S]{0,420}h-11 w-11/);
  assert.match(detail, /function BiteLevelSelector[\s\S]{0,1600}h-11/);
  assert.match(detail, /grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5/);
  assert.match(detail, /flex h-11 items-center justify-center/);
  assert.doesNotMatch(detail.slice(detail.indexOf("function BiteLevelSelector"), detail.indexOf("function PetGroupSelector")), /truncate/);
  assert.match(detail, /data-grooming-record-mobile-card="true"/);
  assert.match(detail, /grid-cols-\[60px_64px_72px_minmax\(64px,1fr\)_minmax\(64px,0\.9fr\)_112px_60px_64px\][\s\S]{0,320}xl:grid-cols-\[92px_96px_110px_minmax\(0,1fr\)_minmax\(0,0\.9fr\)_132px_86px_110px\]/);
  assert.match(detail, /className="hidden min-h-\[88px\][\s\S]{0,520}focus-visible:ring-2[\s\S]{0,80}focus-visible:ring-\[#2563eb\][\s\S]{0,100}lg:grid[\s\S]{0,220}xl:grid-cols/);
  assert.match(detail, /className="grid min-h-11 w-full gap-3[\s\S]{0,320}lg:hidden"/);
  assert.match(detail, /flex-wrap items-center justify-between gap-3[\s\S]{0,260}basis-full sm:basis-auto sm:flex-1[\s\S]{0,220}break-keep \[overflow-wrap:anywhere\][\s\S]{0,180}sm:truncate/);
  assert.match(detail, /const commonClassName = cn\([\s\S]{0,360}multiline \? "min-h-\[84px\] py-2 leading-6" : "h-11"/);
  assert.match(detail, /function InlineEditableText[\s\S]{0,3200}inline-flex min-h-11 max-w-full items-center/);
  assert.match(detail, /inline-flex h-11[\s\S]{0,720}사진 선택/);
  assert.match(detail, /function SmallButton[\s\S]{0,380}h-11/);
  assert.doesNotMatch(detail, /type="button"[^>]{0,240}h-(?:8|9|10)\b/);
});
