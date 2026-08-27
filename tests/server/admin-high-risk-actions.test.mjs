import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ADMIN_HIGH_RISK_ACTIONS_READY, ADMIN_HIGH_RISK_SCOPE_MATRIX, canDispatchProvider, claimOperationOnce, hashHighRiskApprovalPayload, resolveHighRiskAuthorization, validateHighRiskApproval } from "../../src/lib/admin-high-risk-contract.ts";

const routePaths = [
  "../../src/app/api/admin/owners/refund/route.ts",
  "../../src/app/api/admin/owners/withdraw/route.ts",
  "../../src/app/api/admin/owners/temporary-password/route.ts",
  "../../src/app/api/admin/owners/payment-method/reset/route.ts",
];
const routes = routePaths.map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));
const migration = readFileSync(new URL("../../supabase/migrations/202608270001_admin_high_risk_action_hardening.sql", import.meta.url), "utf8");
const passwordPanel = readFileSync(new URL("../../src/components/admin/owner-admin-password-panel.tsx", import.meta.url), "utf8");
const ownerDetail = readFileSync(new URL("../../src/components/admin/owner-admin-detail-panel.tsx", import.meta.url), "utf8");

test("all high-risk actions are disabled after authentication until backend gates exist", () => {
  assert.equal(ADMIN_HIGH_RISK_ACTIONS_READY, false);
  assert.deepEqual(Object.keys(ADMIN_HIGH_RISK_SCOPE_MATRIX), ["refund", "withdraw", "credential_reset", "payment_method_reset"]);
  for (const source of routes) {
    assert.ok(source.indexOf("requireAdminSession") < source.indexOf("assertAdminHighRiskActionReady"));
    assert.doesNotMatch(source, /refundOwner|deleteUser|updateUserById|resetOwnerPaymentMethod|temporaryPassword/);
  }
});

test("authorization order is 401 then known 403 then authenticated readiness 503", () => {
  assert.equal(resolveHighRiskAuthorization({ authenticated: false, scopeStoreAvailable: false, hasRequiredScope: false, readinessReady: false }), 401);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, scopeStoreAvailable: false, hasRequiredScope: false, readinessReady: false }), 503);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, scopeStoreAvailable: true, hasRequiredScope: false, readinessReady: false }), 403);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, scopeStoreAvailable: true, hasRequiredScope: true, readinessReady: false }), 503);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, scopeStoreAvailable: true, hasRequiredScope: true, readinessReady: true }), 200);
});

test("approval hash fixes exact refund scope and invalidates mutation, self approval, and expiry", () => {
  const first = hashHighRiskApprovalPayload({ action: "refund", scope: { paymentOperationRef: "opaque-pay", refundOperationRef: "opaque-refund", amount: 29000, currency: "KRW", reasonScope: "duplicate" }, version: 1, expiresAt: "2026-08-27T12:00:00Z" });
  const reordered = hashHighRiskApprovalPayload({ action: "refund", scope: { currency: "KRW", amount: 29000, reasonScope: "duplicate", refundOperationRef: "opaque-refund", paymentOperationRef: "opaque-pay" }, version: 1, expiresAt: "2026-08-27T12:00:00Z" });
  const changed = hashHighRiskApprovalPayload({ action: "refund", scope: { paymentOperationRef: "opaque-pay", refundOperationRef: "opaque-refund", amount: 28000, currency: "KRW", reasonScope: "duplicate" }, version: 2, expiresAt: "2026-08-27T12:00:00Z" });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-a", expectedHash: first, actualHash: first, expectedVersion: 1, actualVersion: 1, expiresAt: "2026-08-27T12:00:00Z", now: "2026-08-27T11:00:00Z" }), { ok: false, reason: "self_approval" });
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-b", expectedHash: first, actualHash: changed, expectedVersion: 1, actualVersion: 2, expiresAt: "2026-08-27T12:00:00Z", now: "2026-08-27T11:00:00Z" }), { ok: false, reason: "approval_changed" });
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-b", expectedHash: first, actualHash: first, expectedVersion: 1, actualVersion: 1, expiresAt: "2026-08-27T10:00:00Z", now: "2026-08-27T11:00:00Z" }), { ok: false, reason: "approval_expired" });
});

test("prepared migration models a locked durable saga and reconcile-only unknown state", () => {
  const definerCount = migration.match(/security definer/gi)?.length ?? 0;
  const lockedDefinerCount = migration.match(/security definer set search_path = ''/gi)?.length ?? 0;
  assert.equal(lockedDefinerCount, definerCount);
  assert.doesNotMatch(migration, /set search_path = public/i);
  assert.match(migration, /extensions\.digest\(/);
  assert.doesNotMatch(migration, /(?<![.])\bdigest\(/);
  assert.match(migration, /operation_id uuid not null unique/);
  assert.match(migration, /payload_hash/);
  assert.match(migration, /request_version/);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /provider_pending/);
  assert.match(migration, /provider_unknown/);
  assert.match(migration, /create_admin_high_risk_request/);
  assert.match(migration, /insert into public\.admin_high_risk_requests[\s\S]+insert into public\.admin_high_risk_outbox/);
  assert.match(migration, /approve_admin_high_risk_request/);
  assert.match(migration, /admin_high_risk_required_scope/);
  assert.match(migration, /unknown high-risk action/);
  assert.match(migration, /admin_high_risk_current_actor/);
  assert.doesNotMatch(migration, /create_admin_high_risk_request\([\s\S]{0,180}p_requester_ref/);
  assert.doesNotMatch(migration, /finish_admin_high_risk_operation\([\s\S]{0,160}p_(requester|approver|executor|scope)/);
  assert.match(migration, /approval_row\.approver_ref/);
  assert.match(migration, /request_row\.payload_hash/);
  assert.match(migration, /lease_token uuid/);
  assert.match(migration, /stale or foreign execution lease/);
  assert.match(migration, /schedule_admin_high_risk_retry/);
  assert.match(migration, /pg_catalog\.now\(\) \+ pg_catalog\.make_interval/);
  assert.match(migration, /state = 'leased' and lease_expires_at is not null and lease_expires_at <= pg_catalog\.now\(\)/);
  assert.match(migration, /state = 'retry_wait' and next_attempt_at is not null and next_attempt_at <= pg_catalog\.now\(\)/);
  assert.match(migration, /state <> 'provider_unknown' or next_attempt_at is null/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all[\s\S]+from anon, authenticated/);
  assert.match(migration, /do not atomicize PortOne or Auth external effects/);
  assert.match(migration, /self approval denied/);
  assert.match(migration, /stale approval denied/);
  assert.match(migration, /expired approval denied/);
  assert.match(migration, /before update or delete on public\.admin_high_risk_approvals/);
  assert.match(migration, /before update or delete on public\.admin_high_risk_receipts/);
});

test("same operation id claims exactly once across 20 concurrent attempts", async () => {
  const claimed = new Set();
  const results = await Promise.all(Array.from({ length: 20 }, async () => claimOperationOnce(claimed, "operation-opaque")));
  assert.equal(results.filter(Boolean).length, 1);
});

test("provider unknown is reconcile-only and cannot be blindly dispatched", () => {
  assert.equal(canDispatchProvider("leased"), true);
  for (const state of ["provider_pending", "provider_unknown", "retry_wait", "reconciling", "succeeded", "failed", "needs_review"]) assert.equal(canDispatchProvider(state), false);
});

test("UI and credential endpoint expose no high-risk execution or password material", () => {
  assert.doesNotMatch(passwordPanel, /temporaryPassword|clipboard|발급된 임시비밀번호|onIssue/);
  assert.doesNotMatch(ownerDetail, /onClick=\{\(\) => void (withdrawOwner|resetOwnerPaymentMethod|refundOwner)/);
  assert.doesNotMatch(ownerDetail, />결제수단 초기화<|>이 결제 취소<|취소 사유/);
  assert.match(ownerDetail, /보안 승인 흐름 준비 중/);
  const credentialRoute = routes[2];
  assert.doesNotMatch(credentialRoute, /password|email|updateUserById|randomBytes/);
});

test("receipt contract is PII-free", () => {
  const receiptSection = migration.slice(migration.indexOf("create table if not exists public.admin_high_risk_receipts"), migration.indexOf("alter table public.admin_high_risk_actor_scopes"));
  assert.match(receiptSection, /requester_ref/);
  assert.match(receiptSection, /approver_ref/);
  assert.match(receiptSection, /scope_hash/);
  assert.doesNotMatch(receiptSection, /payload jsonb|email|password|billing_key|payment_id|user_id|shop_id/);
});
