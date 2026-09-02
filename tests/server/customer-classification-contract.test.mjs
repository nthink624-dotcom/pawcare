import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("customer classification is a guardian field with nullable automatic grade and no Auth role", async () => {
  const [migration, domain, schemas, mutations, customerRoute] = await Promise.all([
    read("supabase/migrations/20260831135511_guardian_customer_classification.sql"),
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

test("customer management keeps the prior detail layout and edits classification through the existing detail action", async () => {
  const [screen, detail, table] = await Promise.all([
    read("src/components/owner-web/customer-management-screen.tsx"),
    read("src/components/owner-web/customer-detail-panel.tsx"),
    read("src/components/owner-web/customer-management-table.tsx"),
  ]);

  assert.match(screen, /cache: "no-store"/);
  assert.match(screen, /async function saveCustomerGuardianProfile/);
  assert.match(screen, /customerGradeOverride: patch\.customerGradeOverride/);
  assert.match(screen, /customerMemberType: patch\.customerMemberType/);
  assert.match(screen, /customerGradeOverride: newCustomerDraft\.customerGradeOverride/);
  assert.match(screen, /customerMemberType: newCustomerDraft\.customerMemberType/);
  assert.match(detail, /가격 그룹/);
  assert.match(detail, /grid-cols-\[310px_minmax\(0,1fr\)\] overflow-hidden/);
  assert.match(detail, /onEdit=\{\(\) => setActiveAction\("guardianEdit"\)\}/);
  assert.match(detail, /action === "guardianEdit"/);
  assert.match(detail, /className="h-11 w-full appearance-none/);
  assert.match(detail, /label="회원 유형"/);
  assert.match(detail, /customerGradeOverride: guardianDraft\.customerGradeOverride/);
  assert.match(detail, /customerMemberType: guardianDraft\.customerMemberType/);
  assert.match(table, /getCustomerMemberTypeLabel/);
  assert.doesNotMatch(table, /지역/);
});
