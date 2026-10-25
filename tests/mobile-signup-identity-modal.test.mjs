import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const source = (await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
test("direct KCP flow has no intermediate identity modal or duplicate form", () => {
  assert.doesNotMatch(source, /<VerificationModal|data-signup-verification-modal|>휴대폰 본인인증<\/h2>/);
  assert.equal((source.match(/data-signup-profile-fields/g) ?? []).length, 1);
  assert.equal((source.match(/data-signup-identity-fields/g) ?? []).length, 1);
  assert.match(source, /<fieldset disabled=\{signupPhase !== "idle"\}/);
});

test("two-step renders only the corresponding fields and stage actions", () => {
  const representative = source.slice(source.indexOf('{step === "identity" ? (\n          <div'), source.indexOf('{step === "profile" ? (\n          <div'));
  const shop = source.slice(source.indexOf('{step === "profile" ? (\n          <div'), source.indexOf('</fieldset>'));
  for (const label of ["이름", "대표자 휴대폰", "생년월일", "이메일", "비밀번호", "비밀번호 확인"]) assert.ok(representative.includes(`label="${label}"`));
  assert.ok(!representative.includes('label="매장명"')); assert.ok(!shop.includes('label="비밀번호"'));
  for (const label of ["매장명", "매장 연락처", "매장 주소"]) assert.ok(shop.includes(`label="${label}"`));
  assert.match(source, /onClick=\{moveToProfileStep\}/); assert.match(source, /onClick=\{returnToRepresentativeStep\}/);
});
