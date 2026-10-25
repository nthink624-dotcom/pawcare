import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const focus = readFileSync(new URL("../../src/components/admin/retention-policy-approval-focus.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../src/components/admin/focused-approval-route.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../../src/components/admin/admin-dashboard.tsx", import.meta.url), "utf8");

test("retention policy appears as one registration-pending decision without persistence", () => {
  assert.match(dashboard, /RETENTION-POLICY-V01/);
  assert.match(dashboard, /회원 탈퇴 후 어떤 정보를 남길까요\?/);
  assert.match(dashboard, /등록 준비 중/);
  assert.match(route, /RetentionPolicyApprovalFocus/);
  assert.match(focus, /이 원칙 승인/);
  assert.match(focus, /법률 확인 후 결정/);
  assert.equal((focus.match(/type="button" disabled/g) ?? []).length, 2);
  assert.doesNotMatch(focus, /fetch\(|server action|Supabase|migration|Storage key/);
});

test("retention policy copy preserves the approved fail-closed scope", () => {
  assert.match(focus, /최소 거래·동의·분쟁 증빙/);
  assert.match(focus, /나머지 개인정보와 파일은 즉시 삭제/);
  assert.match(focus, /법률상 정확한 보관기간/);
  assert.match(focus, /실제 운영 환경 적용·삭제 실행은 이번 결정에 포함되지 않습니다/);
  assert.match(focus, /신규 개인정보 전체 사본 금지/);
});
