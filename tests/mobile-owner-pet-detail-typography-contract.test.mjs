import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const ownerSource = await readFile(ownerAppPath, "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = ownerSource.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = endMarker ? ownerSource.indexOf(endMarker, start + startMarker.length) : ownerSource.length;
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return ownerSource.slice(start, end);
}

const tabSurface = sourceBetween(
  'data-testid="owner-customer-detail-tabs"',
  '{detailTab === "records" ?',
);
const addPetSurface = sourceBetween(
  '{detailTab === "pets" ?',
  '{detailTab === "notifications" ?',
);
const storeVerificationSurface = sourceBetween(
  "function PetStoreVerificationPanel",
  "function GuardianPetEditorCard",
);
const petEditorSurface = sourceBetween("function GuardianPetEditorCard");
const typographySurface = `${tabSurface}\n${addPetSurface}\n${storeVerificationSurface}\n${petEditorSurface}`;

test("pet detail removes the two obsolete helper paragraphs from the DOM contract", () => {
  assert.doesNotMatch(ownerSource, /실제 반려동물을 확인한 뒤 요금표 기준에 맞는 그룹을 선택해 주세요\./);
  assert.doesNotMatch(ownerSource, /매장 확인값 저장 필드와 요금표 그룹 연동 후 수정할 수 있어요\./);
});

test("pet detail maps tabs, titles, labels, values, and controls to the approved type roles", () => {
  assert.match(tabSurface, /min-h-11[^"`]*text-\[16px\][^"`]*font-medium[^"`]*leading-6/);
  assert.match(petEditorSurface, /text-\[18px\] font-semibold leading-\[26px\][^>]*>\{pet\.name\}<\/p>/);
  assert.match(petEditorSurface, /text-\[16px\] font-normal leading-6[^>]*>\{pet\.breed \|\| "미입력"\}<\/p>/);
  assert.match(petEditorSurface, /text-\[14px\] font-medium leading-5[^>]*>아기 이름<\/span>/);
  assert.match(petEditorSurface, /text-\[14px\] font-medium leading-5[^>]*>고객 입력 품종<\/p>/);
  assert.match(petEditorSurface, /text-\[14px\] font-medium leading-5[^>]*>고객 요청사항<\/p>/);
  assert.match(storeVerificationSurface, /text-\[14px\] font-medium leading-5[^>]*>매장 확인 정보<\/h4>/);
  assert.match(storeVerificationSurface, /<dt className="text-\[14px\] font-medium leading-5/);
  assert.match(storeVerificationSurface, /<dd className=\{cn\("text-\[16px\] font-normal leading-6/);
  assert.match(petEditorSurface, /min-h-11[^"`]*text-\[16px\] font-medium leading-6[^>]*>[\s\S]*?\{isEditing \? "닫기" : "수정"\}/);
  assert.match(petEditorSurface, /min-h-11[^"`]*text-\[16px\] font-medium leading-6[^>]*>[\s\S]*?취소/);
  assert.match(petEditorSurface, /min-h-11[^"`]*text-\[16px\] font-medium leading-6[^>]*>[\s\S]*?정보 저장/);
  assert.match(addPetSurface, /min-h-11[^"`]*text-\[16px\] font-medium leading-6[^>]*>[\s\S]*?아기 추가하기/);
});

test("pet detail ordinary UI uses only regular, medium, and semibold weights", () => {
  assert.doesNotMatch(typographySurface, /\bfont-(?:bold|extrabold|black|\[(?:[7-9]\d{2}|1000)\])\b/);
  assert.doesNotMatch(typographySurface, /fontWeight\s*:\s*["']?(?:[7-9]\d{2}|1000)/);
});

test("pet detail keeps customer request text verbatim and empty values readable", () => {
  const requestSurface = petEditorSurface.slice(
    petEditorSurface.indexOf("고객 요청사항"),
    petEditorSurface.indexOf("<PetStoreVerificationPanel"),
  );
  assert.match(requestSurface, /whitespace-pre-wrap[\s\S]*?\{pet\.notes \|\| "미입력"\}<\/p>/);
  assert.doesNotMatch(requestSurface, /truncate|line-clamp|\.slice\(|\.trim\(/);
  assert.match(typographySurface, /text-\[\#64748b\][^\n]*"미입력"/);
});

test("pet detail uses one white information plane with dividers and narrow-width reflow", () => {
  assert.match(petEditorSurface, /data-testid="guardian-pet-editor" className="border-t[^\n]*px-4 py-4"/);
  assert.match(petEditorSurface, /className="space-y-3"/);
  assert.match(storeVerificationSurface, /<section[^>]*className="border-t[^>]*pt-3">/);
  assert.match(storeVerificationSurface, /<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 max-\[340px\]:grid-cols-1">/);
  assert.doesNotMatch(storeVerificationSurface, /rounded-|bg-\[/);
  assert.doesNotMatch(petEditorSurface, /bg-\[\#f8fafc\]|truncate|line-clamp/);
  assert.match(petEditorSurface, /flex flex-wrap items-center justify-end/);
});

test("pet selection, editing, cancel, save, tabs, and add-pet behavior stay wired", () => {
  assert.match(ownerSource, /onSelect=\{\(\) => setSelectedCustomerPetId\(pet\.id\)\}/);
  assert.match(ownerSource, /onSave=\{\(name, breed, birthday\) => updatePetProfile\(pet\.id, name, breed, birthday\)\}/);
  assert.match(tabSurface, /onClick=\{\(\) => setDetailTab\(item\)\}/);
  assert.match(addPetSurface, /onClick=\{\(\) => setModal\(\{ type: "add-pet", guardianId: selectedGuardian\.id \}\)\}/);
  assert.match(petEditorSurface, /onClick=\{onSelect\}/);
  assert.match(petEditorSurface, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(petEditorSurface, /setIsEditing\(\(prev\) => !prev\)/);
  assert.match(petEditorSurface, /setName\(pet\.name\);\s*setIsEditing\(false\);/);
  assert.match(petEditorSurface, /onSave\(name\.trim\(\), pet\.breed, pet\.birthday\);\s*setIsEditing\(false\);/);
  assert.match(petEditorSurface, /aria-pressed=\{isSelected\}/);
});
