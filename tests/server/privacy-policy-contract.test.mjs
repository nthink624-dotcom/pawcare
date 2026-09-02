import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PUBLIC_PRIVACY_POLICY } from "../../src/lib/legal/privacy-policy.ts";

const privacyPagePath = new URL("../../src/app/privacy/page.tsx", import.meta.url);
const EXPECTED_NORMALIZED_SHA256 = "D115F77DA008C5251CEBDDB79BA3BBC62014F803E5AF935593AA5939D9DEDCBE";

function normalizePolicyBody(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

test("public privacy policy renders the approved 2026-09-03 canonical body", () => {
  const body = normalizePolicyBody(PUBLIC_PRIVACY_POLICY);
  const hash = createHash("sha256").update(body, "utf8").digest("hex").toUpperCase();

  assert.equal(hash, EXPECTED_NORMALIZED_SHA256);
  assert.match(body, /^개인정보처리방침\n정책 버전: 2026\.09\.03\n시행일자: 2026년 9월 3일/);
  assert.match(body, /https:\/\/www\.petmanager\.co\.kr\/privacy/);
  assert.match(body, /DeepSeek 요청에는 사진, 이미지 파일 또는 미디어 참조를 전송하지 않습니다\./);
  assert.match(body, /OpenAI.*하나 이상의 파생 이미지/);
  assert.match(body, /계정 삭제는 고객센터로 요청할 수 있습니다\./);
  assert.doesNotMatch(body, /\b(?:HOLD|TODO)\b|\[확인 필요\]|{{|}}/);
});

test("public privacy route keeps the unauthenticated policy rendering contract", async () => {
  const source = await readFile(privacyPagePath, "utf8");

  assert.match(source, /PUBLIC_PRIVACY_POLICY/);
  assert.match(source, /<LegalSection title="개인정보처리방침" body=\{PUBLIC_PRIVACY_POLICY\} \/>/);
});
