import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../src/components/auth/signup-form.tsx", import.meta.url), "utf8");
test("single signup CTA names verification, pending stages, and separate retries", () => {
  for (const text of ["본인인증하고 가입하기", "본인인증 다시 하기", "가입 다시 시도하기", "확인 중...", "가입 중..."]) assert.ok(source.includes(text));
  assert.doesNotMatch(source, /안전한 가입을 위해 본인 확인이 필요해요|인증 수단 다시 선택하기/);
  assert.match(source, /role="alert"/);
});
