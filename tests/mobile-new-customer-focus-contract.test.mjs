import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const formStart = ownerApp.indexOf("function NewCustomerForm");
const formEnd = ownerApp.indexOf("\nfunction ", formStart + 1);
const form = ownerApp.slice(formStart, formEnd);

function guardianInput(label) {
  const labelStart = form.indexOf(`>${label}</span>`);
  assert.ok(labelStart >= 0, `${label} label must exist`);
  const nextLabel = form.indexOf('<label className="block">', labelStart + 1);
  return form.slice(labelStart, nextLabel >= 0 ? nextLabel : form.length);
}

test("new-customer guardian fields keep an inset focus ring inside their boxes", () => {
  for (const label of ["보호자 이름", "연락처", "고객 메모"]) {
    const input = guardianInput(label);
    assert.match(input, /<input/);
    assert.match(input, /className="[^"]*box-border/);
    assert.match(input, /min-h-11/);
    assert.match(input, /w-full/);
    assert.match(input, /text-\[16px\]/);
    assert.match(input, /focus-visible:border-\[#2563eb\]/);
    assert.match(input, /focus-visible:ring-2/);
    assert.match(input, /focus-visible:ring-inset/);
    assert.match(input, /focus-visible:ring-\[#2563eb\]/);
    assert.doesNotMatch(input, /focus-visible:ring-offset/);
  }
});

test("new-customer guardian focus order and state bindings remain unchanged", () => {
  const name = guardianInput("보호자 이름");
  const phone = guardianInput("연락처");
  const memo = guardianInput("고객 메모");
  assert.ok(form.indexOf(">보호자 이름</span>") < form.indexOf(">연락처</span>"));
  assert.ok(form.indexOf(">연락처</span>") < form.indexOf(">고객 메모</span>"));
  assert.match(name, /value=\{guardianName\}/);
  assert.match(name, /setGuardianName\(event\.target\.value\)/);
  assert.match(phone, /value=\{phone\}/);
  assert.match(phone, /setPhone\(event\.target\.value\)/);
  assert.match(memo, /value=\{memo\}/);
  assert.match(memo, /setMemo\(event\.target\.value\)/);
});

test("new-customer save still trims and sends the existing guardian payload", () => {
  assert.match(form, /const canSave = !saving && guardianName\.trim\(\) && phone\.trim\(\)/);
  assert.match(form, /\{ shopId, name: guardianName\.trim\(\), phone: phone\.trim\(\), memo: memo\.trim\(\) \}/);
  assert.match(form, />\s*고객 저장\s*<\/ActionButton>/);
  assert.doesNotMatch(form, /fetch\(|fetchApiJsonWithAuth|\/api\/guardians/);
});
