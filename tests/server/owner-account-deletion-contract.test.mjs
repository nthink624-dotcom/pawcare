import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getSafeOwnerLoginReturnPath } from "../../src/lib/auth/login-return-path.ts";

const read = (relativePath) => readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("owner account deletion migration is server-only, idempotent, and redacts deletion audit data", () => {
  const migration = read("supabase/migrations/20260901143000_owner_account_deletion_contract.sql");
  assert.match(migration, /owner_account_deletion_requests/);
  assert.match(migration, /idempotency_key_hash char\(64\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /revoke all on table private\.owner_account_deletion_requests from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claim_owner_account_deletion_v1/);
  assert.match(migration, /record_snapshot = jsonb_build_object\('schema_version', 2, 'redacted', true/);
  assert.doesNotMatch(migration, /to_jsonb\(old\)/);
});

test("self-delete route requires current-password reauthentication and reaches terminal auth deletion only after purge", () => {
  const route = read("src/app/api/owner/account-deletion/route.ts");
  assert.match(route, /currentPassword/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /claim_owner_account_deletion_v1/);
  assert.match(route, /finalize_owner_account_deletion_v1/);
  assert.match(route, /auth\.admin\.signOut\(accessToken, "global"\)/);
  assert.doesNotMatch(route, /auth\.admin\.signOut\(user\.id/);
  assert.equal((route.match(/auth\.admin\.signOut\(/g) ?? []).length, 1);
  assert.match(route, /auth\.admin\.deleteUser\(user\.id\)/);
  assert.doesNotMatch(route, /auth\.admin\.deleteUser\(user\.id,\s*true\)/);
  assert.match(route, /complete_owner_account_deletion_v1/);
  assert.match(route, /removeMediaStorageObjects/);
  assert.match(route, /verifyMediaStorageObjectsAbsent/);
  assert.match(route, /\.from\("media_assets"\)[\s\S]*?\.in\("shop_id", params\.shopIds\)/);
  assert.match(route, /\.from\("media_variants"\)[\s\S]*?\.in\("media_asset_id", assetIds\)/);
  assert.ok(route.indexOf("verifyMediaStorageObjectsAbsent") < route.indexOf("finalize_owner_account_deletion_v1"));
  assert.doesNotMatch(route, /params\.admin\.storage\.from/);
  assert.doesNotMatch(route, /shopIds\s*:\s*body|storage_path\s*:\s*body|bucket\s*:\s*body/);
  assert.ok(route.indexOf("signInWithPassword") < route.indexOf("claim_owner_account_deletion_v1"));
  assert.ok(route.indexOf('if (!accessToken)') < route.indexOf("auth.admin.signOut"));
  assert.ok(route.indexOf("userResult.error") < route.indexOf("auth.admin.signOut"));
  assert.ok(route.indexOf("passwordResult.error") < route.indexOf("auth.admin.signOut"));
  assert.ok(route.indexOf("finalize_owner_account_deletion_v1") < route.indexOf("auth.admin.deleteUser"));
  assert.ok(route.indexOf("auth.admin.deleteUser") < route.indexOf("complete_owner_account_deletion_v1"));
  assert.doesNotMatch(route, /console\.(log|error|warn).*currentPassword/i);
  assert.doesNotMatch(route, /console\.(log|error|warn).*(accessToken|authorization)/i);
});

test("terminal media cleanup is provider-aware, exact-path, residue-checked, and retry-safe", () => {
  const route = read("src/app/api/owner/account-deletion/route.ts");
  const storage = read("src/server/media-storage.ts");

  assert.match(storage, /process\.env\.MEDIA_STORAGE_PROVIDER === "r2"/);
  assert.match(storage, /method: "DELETE"/);
  assert.match(storage, /response\.status !== 404/);
  assert.match(storage, /method: "HEAD"/);
  assert.match(storage, /if \(response\.status === 404\) continue/);
  assert.match(route, /new Map<string, Set<string>>\(\)/);
  assert.match(route, /Media storage target is incomplete/);
  assert.match(route, /Media storage residue detected/);
  assert.ok(route.indexOf("removeShopStorage") < route.indexOf("auth.admin.signOut"));
  assert.ok(route.indexOf("removeShopStorage") < route.indexOf("finalize_owner_account_deletion_v1"));
  assert.match(route, /첨부 파일을 안전하게 삭제하지 못했어요/);
});

test("public deletion page uses the existing authenticated destructive endpoint without account enumeration", () => {
  const page = read("src/app/account-deletion/page.tsx");
  const request = read("src/components/account-deletion/account-deletion-request.tsx");
  const legal = read("src/lib/legal/legal-info.ts");

  assert.match(page, /계정 삭제 요청/);
  assert.match(page, /삭제 및 보관 범위/);
  assert.match(page, /진행 중인 결제·환불/);
  assert.match(page, /href="\/privacy"/);
  assert.match(request, /로그인하고 계정 삭제 요청/);
  assert.match(request, /\/login\?next=/);
  assert.match(request, /fetchApiJsonWithAuth<\{ success: true \}>\("\/api\/owner\/account-deletion"/);
  assert.match(request, /confirmation: true/);
  assert.match(request, /currentPassword/);
  assert.match(request, /idempotencyKeyRef\.current \?\?= window\.crypto\.randomUUID\(\)/);
  assert.doesNotMatch(request, /name="email"|type="email"/);
  assert.doesNotMatch(request, /계정이 존재|가입된 이메일|등록된 이메일/);
  assert.match(legal, /PUBLIC_ACCOUNT_DELETION_PATH = "\/account-deletion"/);
  assert.match(legal, /PUBLIC_ACCOUNT_DELETION_URL/);
  assert.match(legal, /\{ href: PUBLIC_ACCOUNT_DELETION_PATH, label: "계정 삭제 요청" \}/);
});

test("login return path is restricted to owner routes and the canonical deletion page", () => {
  const helper = read("src/lib/auth/login-return-path.ts");
  const loginPage = read("src/app/login/page.tsx");

  assert.match(helper, /candidate === PUBLIC_ACCOUNT_DELETION_PATH/);
  assert.match(helper, /candidate === OWNER_ROUTE_PREFIX/);
  assert.match(helper, /candidate\.startsWith\(`\$\{OWNER_ROUTE_PREFIX\}\/`\)/);
  assert.match(helper, /return OWNER_ROUTE_PREFIX/);
  assert.match(loginPage, /getSafeOwnerLoginReturnPath/);
  assert.doesNotMatch(loginPage, /params\.next.*startsWith\("\/"\)/);
  assert.equal(getSafeOwnerLoginReturnPath("/account-deletion"), "/account-deletion");
  assert.equal(getSafeOwnerLoginReturnPath("/owner?initialSetup=1"), "/owner?initialSetup=1");
  assert.equal(getSafeOwnerLoginReturnPath("//example.com/account-deletion"), "/owner");
  assert.equal(getSafeOwnerLoginReturnPath("/account-deletion?return=https://example.com"), "/owner");
  assert.equal(getSafeOwnerLoginReturnPath("/privacy"), "/owner");
});

test("public deletion controls keep explicit confirmation and 44px targets", () => {
  const request = read("src/components/account-deletion/account-deletion-request.tsx");
  const page = read("src/app/account-deletion/page.tsx");

  assert.match(request, /type="checkbox"/);
  assert.match(request, /복구되지 않는다는 내용을 확인했습니다/);
  assert.match(request, /disabled=\{submitting \|\| !confirmed \|\| !currentPassword\}/);
  assert.ok((request.match(/min-h-11/g) ?? []).length >= 5);
  assert.doesNotMatch(`${page}\n${request}`, /font-(?:bold|extrabold|black)|font-weight:\s*(?:700|800|900)/);
});

test("public privacy copy matches current data flows without guessing provider guarantees", () => {
  const privacy = read("src/lib/legal/privacy-policy.ts");

  assert.match(privacy, /시행일자: 2026년 9월 21일/);
  assert.match(privacy, /https:\/\/www\.petmanager\.co\.kr\/privacy/);
  assert.match(privacy, /고객: 보호자 이름, 휴대폰번호/);
  assert.match(privacy, /반려동물: 이름, 품종, 체중/);
  assert.match(privacy, /Android 앱은 PC·서버에서 확정된 플랜/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /코리아포트원|privacyTrusteeName/);
  assert.match(privacy, /NHN KCP|paymentProvider/);
  assert.match(privacy, /Firebase Cloud Messaging/);
  assert.match(privacy, /알림톡 발송 사업자\(쏘다·카카오\)/);
  assert.match(privacy, /Cloudflare R2: 실제 미디어 저장 provider로 선택된 경우/);
  assert.match(privacy, /OpenAI Responses에 한 번 전송/);
  assert.match(privacy, /store:false/);
  assert.match(privacy, /DeepSeek에 서비스명, 실제 소요 시간/);
  assert.match(privacy, /사진과 원음은 보내지 않으며/);
  assert.match(privacy, /hard purge/);
  assert.match(privacy, /60일 동안 보관하며, 보관기간 만료 후 일일 자동 정리 작업에서 삭제/);
  assert.match(privacy, /직접 삭제하거나 해당 매장·계정을 삭제할 때까지 보관/);
  assert.match(privacy, /근거 없이 공유 없음으로 표시하지 않습니다/);
  assert.match(privacy, /전송 암호화는 별도 운영 증거 확인 전 포괄적으로 보장하지 않습니다/);
  assert.match(privacy, /공개 계정 삭제 요청 페이지 https:\/\/www\.petmanager\.co\.kr\/account-deletion/);
  assert.match(privacy, /이메일 주소만으로 계정 존재 여부를 확인하거나 삭제하지 않습니다/);
  assert.match(privacy, /backup purge SLA는 실제 운영·계약 증거 확인 전 확정하지 않습니다/);
});
