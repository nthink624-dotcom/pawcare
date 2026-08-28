import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260827020524_secure_signup_ai_price_guide.sql", import.meta.url);
const meteringMigrationPath = new URL("../../supabase/migrations/20260827031414_secure_signup_ai_price_guide_metering.sql", import.meta.url);
const previewRoutePath = new URL("../../src/app/api/auth/signup/price-guide-preview/route.ts", import.meta.url);
const signupPricingContractPath = new URL("../../src/lib/auth/signup-service-pricing.ts", import.meta.url);
const signupPricingComponentPath = new URL("../../src/components/auth/signup-service-pricing-step.tsx", import.meta.url);
const multipartPath = new URL("../../src/server/signup-price-guide-multipart.ts", import.meta.url);
const rollbackPath = new URL("../../supabase/rollback/20260827020524_secure_signup_ai_price_guide.rollback.sql", import.meta.url);
const meteringRollbackPath = new URL("../../supabase/rollback/20260827031414_secure_signup_ai_price_guide_metering.rollback.sql", import.meta.url);
const providerPath = new URL("../../src/server/price-guide-photo-import.ts", import.meta.url);
const membershipMigrationPath = new URL("../../supabase/migrations/20260826034028_secure_owner_shop_memberships.sql", import.meta.url);
const membershipRollbackPath = new URL("../../supabase/rollback/20260826034028_secure_owner_shop_memberships.rollback.sql", import.meta.url);
const atomicContractPath = new URL("../../src/lib/auth/atomic-signup-contract.ts", import.meta.url);
const signupRoutePath = new URL("../../src/app/api/auth/signup/route.ts", import.meta.url);
const signupFormPath = new URL("../../src/components/auth/signup-form.tsx", import.meta.url);
const signupJsonBodyPath = new URL("../../src/server/signup-json-body.ts", import.meta.url);

test("migration은 KCP consume, Credit, canonical service를 complete_owner_signup_v2 transaction에 둔다", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.complete_owner_signup_v2/);
  assert.match(sql, /update public\.owner_identity_verifications/);
  assert.match(sql, /insert into public\.shop_alimtalk_credit_balances/);
  assert.match(sql, /complete_owner_signup_v1/);
  assert.match(sql, /claim_owner_signup_v2/);
  assert.match(sql, /pg_advisory_xact_lock/);
});

test("분산 분석 gate는 요청 제한, 비용 한도, dedupe, circuit breaker 계약을 포함한다", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /signup_price_guide_analysis_requests/);
  assert.match(sql, /RATE_LIMITED/);
  assert.match(sql, /CIRCUIT_OPEN/);
  assert.match(sql, /cache_source_jti/);
  assert.match(sql, /p_daily_cost_cap_microusd/);
  assert.match(sql, /revoke all on table public\.signup_price_guide_analysis_requests from public, anon, authenticated/);
  assert.match(sql, /cleanup_signup_price_guide_analysis_v1/);
  assert.match(sql, /purge_signup_price_guide_analysis_v1/);
  assert.match(sql, /status in \('processing', 'completed', 'failed', 'tombstoned'\)/);
  assert.match(sql, /cache_ciphertext = null/);
  assert.match(sql, /file_hash = null/);
  assert.match(sql, /cleanup_after/);
});

test("v0.3은 purgeable 분석 행과 비식별 회전 HMAC 보안 원장을 분리한다", async () => {
  const sql = await readFile(meteringMigrationPath, "utf8");
  assert.match(sql, /signup_price_guide_security_meter_buckets/);
  assert.match(sql, /bucket_kind in \('ip_10m', 'session_day', 'device_day', 'provider_day', 'provider_circuit_5m'\)/);
  assert.match(sql, /rotation_id/);
  assert.match(sql, /bucket_hmac text not null check \(length\(bucket_hmac\) = 64\)/);
  assert.match(sql, /reserved_cost_microusd/);
  assert.match(sql, /actual_cost_microusd/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_ip_count >= 10/);
  assert.match(sql, /v_session_count >= 6/);
  assert.match(sql, /v_device_count >= 8/);
  assert.match(sql, /create or replace function public\.claim_signup_price_guide_analysis_v2/);
  assert.match(sql, /create or replace function public\.complete_signup_price_guide_analysis_v2/);
  assert.match(sql, /create or replace function public\.purge_signup_price_guide_analysis_v2/);
  assert.match(sql, /create or replace function public\.cleanup_signup_price_guide_security_meter_v1/);
  assert.match(sql, /alter table public\.signup_price_guide_security_meter_buckets enable row level security/);
  assert.match(sql, /revoke all on table public\.signup_price_guide_security_meter_buckets from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.claim_signup_price_guide_analysis_v2[\s\S]+to service_role/);
  assert.match(sql, /ip_hash = null[\s\S]+session_hash = null[\s\S]+device_hash = null[\s\S]+file_hash = null[\s\S]+cache_ciphertext = null/);
  const purgeBody = sql.slice(
    sql.indexOf("create or replace function public.purge_signup_price_guide_analysis_v2"),
    sql.indexOf("create or replace function public.cleanup_signup_price_guide_analysis_v2"),
  );
  assert.doesNotMatch(purgeBody, /delete from public\.signup_price_guide_security_meter_buckets/);
});

test("preview route는 원본과 sanitized buffer를 모든 경로에서 zeroize한다", async () => {
  const source = await readFile(previewRoutePath, "utf8");
  assert.match(source, /finally\s*\{/);
  assert.match(source, /originalBytes\?\.fill\(0\)/);
  assert.match(source, /sanitizedBytes\?\.fill\(0\)/);
  assert.doesNotMatch(source, /console\.(log|error)/);
  assert.doesNotMatch(source, /request\.formData\(\)/);
  assert.match(source, /parseBoundedSignupPriceGuideMultipart/);
  assert.match(source, /export async function DELETE/);
  assert.match(source, /completeSignupPriceGuideAnalysis/);
  assert.doesNotMatch(source, /\.from\("signup_price_guide_analysis_requests"\)\.update/);
});

test("Vision 비용은 13,000 micro-USD를 예약하고 provider usage 또는 fail-closed 상한으로 완료한다", async () => {
  const route = await readFile(previewRoutePath, "utf8");
  const provider = await readFile(providerPath, "utf8");
  assert.match(provider, /PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD\s*=\s*13_000/);
  assert.match(provider, /usage\.input_tokens|input_tokens/);
  assert.match(provider, /usage\.output_tokens|output_tokens/);
  assert.match(provider, /usage\.inputTokens \* 0\.15/);
  assert.match(provider, /usage\.outputTokens \* 0\.6/);
  assert.match(route, /estimatedCostMicroUsd:\s*fixtureMode \? 0 : PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD/);
  assert.match(route, /actualCostMicroUsd:\s*fixtureMode \? 0 : actualCostMicroUsd \|\| PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD/);
  assert.doesNotMatch(route, /ESTIMATED_REQUEST_COST_MICRO_USD\s*=\s*1_200/);
});

test("membership rollback은 row count뿐 아니라 SHA-256 내용 fingerprint가 같아야 실행된다", async () => {
  const migration = await readFile(membershipMigrationPath, "utf8");
  const rollback = await readFile(membershipRollbackPath, "utf8");
  assert.match(migration, /row_fingerprint_after text/);
  assert.match(migration, /extensions\.digest[\s\S]+sha256/);
  assert.match(rollback, /v_current_fingerprint is distinct from v_expected_fingerprint/);
  assert.match(rollback, /PM_MEMBERSHIP_ROLLBACK_BLOCKED_CONTENT_CHANGED/);
});

test("main signup은 exact contract header를 body parse 전에 검사하고 PC caller도 같은 버전을 보낸다", async () => {
  const contract = await readFile(atomicContractPath, "utf8");
  const route = await readFile(signupRoutePath, "utf8");
  const form = await readFile(signupFormPath, "utf8");
  const boundedBody = await readFile(signupJsonBodyPath, "utf8");
  assert.match(contract, /SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0\.1/);
  assert.match(contract, /value\.length > 128/);
  assert.match(contract, /value\.includes\(\",\"\)/);
  assert.match(contract, /value === ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION/);
  assert.ok(route.indexOf("acceptsAtomicOwnerSignupContract(request.headers)") < route.indexOf("parseBoundedAtomicSignupJson(request)"));
  assert.doesNotMatch(route, /request\.json\(\)/);
  assert.match(boundedBody, /MAX_ATOMIC_SIGNUP_JSON_BYTES = 64 \* 1024/);
  assert.match(boundedBody, /request\.body\.getReader\(\)/);
  assert.match(route, /SIGNUP_CONTRACT_VERSION_UNSUPPORTED/);
  assert.match(route, /status: 426/);
  assert.match(form, /\[ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER\]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION/);
});

test("AI 요금표 검토 문구는 web과 API가 한 계약을 사용하고 Draft를 노출하지 않는다", async () => {
  const [contract, component, route] = await Promise.all([
    readFile(signupPricingContractPath, "utf8"),
    readFile(signupPricingComponentPath, "utf8"),
    readFile(previewRoutePath, "utf8"),
  ]);
  assert.match(contract, /AI가 읽은 임시 목록/);
  assert.match(contract, /틀린 내용을 고친 뒤 저장하세요\. 저장 전에는 공개되지 않습니다\./);
  assert.match(component, /signupPriceGuideReviewCopy\.label/);
  assert.match(component, /signupPriceGuideReviewCopy\.supporting/);
  assert.match(component, /검토 완료하고 저장/);
  assert.doesNotMatch(component, /Draft/);
  assert.match(route, /reviewCopy: signupPriceGuideReviewCopy/);
});

test("multipart parser는 formData 전에 header와 stream hard limit을 적용한다", async () => {
  const source = await readFile(multipartPath, "utf8");
  assert.match(source, /content-length/);
  assert.match(source, /totalBytes > maxBytes/);
  assert.match(source, /reader\.cancel/);
  assert.match(source, /REQUEST_BODY_TOO_LARGE/);
  assert.match(source, /REQUEST_BODY_TIMEOUT/);
  assert.ok(source.indexOf("readBoundedSignupPriceGuideBody(request)") < source.indexOf("response.formData()"));
});

test("rollback은 RPC 권한과 cache/hash/rate state를 함께 제거한다", async () => {
  const sql = await readFile(rollbackPath, "utf8");
  assert.match(sql, /revoke all on function public\.purge_signup_price_guide_analysis_v1/);
  assert.match(sql, /drop function if exists public\.cleanup_signup_price_guide_analysis_v1/);
  assert.match(sql, /drop function if exists public\.claim_signup_price_guide_analysis_v1/);
  assert.match(sql, /drop table if exists public\.signup_price_guide_analysis_requests/);
  assert.match(sql, /PM_SIGNUP_ROLLBACK_BLOCKED_ACTIVE_REQUESTS/);
  assert.match(sql, /status in \('processing', 'completed', 'compensation_pending', 'failed_compensated'\)/);
});

test("v0.3 rollback은 활성 분석을 차단하고 meter/RPC를 제거한 뒤 v1을 복원하지 않는다", async () => {
  const sql = await readFile(meteringRollbackPath, "utf8");
  assert.match(sql, /PM_PRICE_GUIDE_METER_ROLLBACK_BLOCKED_ACTIVE_ANALYSIS/);
  assert.match(sql, /revoke all on function public\.claim_signup_price_guide_analysis_v2/);
  assert.match(sql, /drop function if exists public\.cleanup_signup_price_guide_security_meter_v1/);
  assert.match(sql, /drop table if exists public\.signup_price_guide_security_meter_buckets/);
  assert.match(sql, /delete from public\.signup_price_guide_analysis_requests/);
  assert.doesNotMatch(sql, /grant execute on function public\.claim_signup_price_guide_analysis_v1/);
});
