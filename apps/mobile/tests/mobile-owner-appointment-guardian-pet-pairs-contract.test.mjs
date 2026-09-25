import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const policyPath = new URL("../src/lib/owner-appointment-guardian-pet-pairs.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const [policySource, ownerApp] = await Promise.all([readFile(policyPath, "utf8"), readFile(ownerAppPath, "utf8")]);

function loadPolicy() {
  const output = ts.transpileModule(policySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

test("one guardian with multiple pets produces one selectable pair per pet without duplicates", () => {
  const { flattenAppointmentGuardianPetPairs } = loadPolicy();
  const pairs = flattenAppointmentGuardianPetPairs([
    { guardian: { id: "guardian-a", name: "김다은" }, pets: [{ id: "pet-a", name: "두부" }, { id: "pet-b", name: "콩이" }] },
    { guardian: { id: "guardian-b", name: "이하늘" }, pets: [{ id: "pet-c", name: "보리" }] },
  ]);
  assert.deepEqual(pairs.map(({ guardian, pet }) => `${guardian.id}:${pet.id}`), ["guardian-a:pet-a", "guardian-a:pet-b", "guardian-b:pet-c"]);
  assert.equal(new Set(pairs.map(({ pet }) => pet.id)).size, 3);
});

test("customer selection renders only the compact guardian-pet row and keeps the pet ID payload path", () => {
  const form = ownerApp.slice(ownerApp.indexOf("function NewAppointmentForm"), ownerApp.indexOf("function NewCustomerForm"));
  assert.match(form, /flattenAppointmentGuardianPetPairs\(filteredGuardianGroups\)/);
  assert.match(form, /data-testid=\{`appointment-guardian-pet-\$\{pet\.id\}`\}/);
  assert.match(form, /setSelectedPetId\(pet\.id\)/);
  assert.match(form, /guardianId: selectedPet\?\.guardian_id/);
  assert.match(form, /placeholder="보호자명 또는 아기 이름 검색"/);
  assert.match(form, /bg-\[#2f6fd6\][^\n]*text-white/);
  assert.match(form, /canViewGuardianContact \? guardian\.phone \|\| "연락처 없음" : "연락처 비공개"/);
  assert.match(form, /min-w-0 flex-1 items-center gap-2 overflow-hidden/);
  assert.doesNotMatch(form, /품종 미입력|보호자명, 연락처, 반려동물 이름으로 찾아주세요/);
});

test("new customer keeps the first pet form but removes the visible numbered card title", () => {
  const form = ownerApp.slice(ownerApp.indexOf("function NewCustomerForm"), ownerApp.indexOf("function AddPetForm"));
  assert.match(form, /index === 0 \? "아기 정보" : `아기 \$\{index \+ 1\}`/);
  assert.doesNotMatch(form, />아기 \{index \+ 1\}</);
  assert.match(form, /shopId, name: guardianName\.trim\(\), phone: phone\.trim\(\), memo: memo\.trim\(\)/);
  assert.match(form, /pets\.map\(\(pet\) => \(\{/);
  assert.match(form, /<span[^>]*>보호자 이름<\/span>/);
  assert.match(form, /min-h-11 w-full rounded-\[10px\] border border-\[#dbe5f1\] bg-white/);
  assert.doesNotMatch(form, /CustomerDetailFieldCard/);
});
