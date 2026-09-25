import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADMIN_HIGH_RISK_ACTIONS_READY,
  ADMIN_HIGH_RISK_SCOPE_MATRIX,
  canDispatchProvider,
  hashHighRiskApprovalPayload,
  resolveHighRiskAuthorization,
  validateHighRiskApproval,
} from "../../src/lib/admin-high-risk-contract.ts";

const routePaths = [
  "../../src/app/api/admin/owners/refund/route.ts",
  "../../src/app/api/admin/owners/withdraw/route.ts",
  "../../src/app/api/admin/owners/temporary-password/route.ts",
  "../../src/app/api/admin/owners/payment-method/reset/route.ts",
];
const routes = routePaths.map((file) => readFileSync(new URL(file, import.meta.url), "utf8"));
const helper = readFileSync(new URL("../../src/server/admin-high-risk-actions.ts", import.meta.url), "utf8");
const passwordPanel = readFileSync(new URL("../../src/components/admin/owner-admin-password-panel.tsx", import.meta.url), "utf8");
const ownerDetail = readFileSync(new URL("../../src/components/admin/owner-admin-detail-panel.tsx", import.meta.url), "utf8");
const ownerScreen = readFileSync(new URL("../../src/components/admin/owner-admin-screen.tsx", import.meta.url), "utf8");

test("authorization fails closed in the required order", () => {
  assert.equal(ADMIN_HIGH_RISK_ACTIONS_READY, false);
  assert.deepEqual(Object.keys(ADMIN_HIGH_RISK_SCOPE_MATRIX), ["refund", "withdraw", "credential_reset", "payment_method_reset"]);
  assert.equal(resolveHighRiskAuthorization({ authenticated: false, active: false, superAdmin: false, recentlyReauthenticated: false, twoPersonApprovalReady: false }), 401);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, active: false, superAdmin: true, recentlyReauthenticated: false, twoPersonApprovalReady: false }), 403);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, active: true, superAdmin: false, recentlyReauthenticated: false, twoPersonApprovalReady: false }), 403);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, active: true, superAdmin: true, recentlyReauthenticated: false, twoPersonApprovalReady: false }), 503);
  assert.equal(resolveHighRiskAuthorization({ authenticated: true, active: true, superAdmin: true, recentlyReauthenticated: true, twoPersonApprovalReady: false }), 503);
});

test("all four routes authenticate, authorize, and contain no mutation dependency", () => {
  for (const source of routes) {
    assert.ok(source.indexOf("requireAdminSession") < source.indexOf("assertAdminHighRiskActionReady"));
    assert.doesNotMatch(source, /getSupabaseAdmin|owner-billing|refundOwner|deleteUser|updateUserById|resetOwnerPaymentMethod|randomBytes|temporaryPassword/);
    assert.doesNotMatch(source, /request\.json\(/);
  }
  assert.match(helper, /!account\.isActive \|\| !account\.isSuperAdmin/);
  assert.match(helper, /503/);
});

test("approval payload is exact, expires, and rejects self approval", () => {
  const first = hashHighRiskApprovalPayload({ action: "refund", scope: { paymentRef: "opaque-payment", amount: 29000, currency: "KRW", reasonCode: "duplicate" }, version: 1, expiresAt: "2026-08-29T12:00:00Z" });
  const reordered = hashHighRiskApprovalPayload({ action: "refund", scope: { reasonCode: "duplicate", currency: "KRW", amount: 29000, paymentRef: "opaque-payment" }, version: 1, expiresAt: "2026-08-29T12:00:00Z" });
  const changed = hashHighRiskApprovalPayload({ action: "refund", scope: { paymentRef: "opaque-payment", amount: 28000, currency: "KRW", reasonCode: "duplicate" }, version: 2, expiresAt: "2026-08-29T12:00:00Z" });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-a", expectedHash: first, actualHash: first, expectedVersion: 1, actualVersion: 1, expiresAt: "2026-08-29T12:00:00Z", now: "2026-08-29T11:00:00Z" }), { ok: false, reason: "self_approval" });
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-b", expectedHash: first, actualHash: changed, expectedVersion: 1, actualVersion: 2, expiresAt: "2026-08-29T12:00:00Z", now: "2026-08-29T11:00:00Z" }), { ok: false, reason: "approval_changed" });
  assert.deepEqual(validateHighRiskApproval({ requesterRef: "actor-a", approverRef: "actor-b", expectedHash: first, actualHash: first, expectedVersion: 1, actualVersion: 1, expiresAt: "2026-08-29T10:00:00Z", now: "2026-08-29T11:00:00Z" }), { ok: false, reason: "approval_expired" });
});

test("unknown provider outcome is reconcile-only", () => {
  assert.equal(canDispatchProvider("leased"), true);
  for (const state of ["provider_pending", "provider_unknown", "reconciling", "succeeded", "failed", "needs_review"]) {
    assert.equal(canDispatchProvider(state), false);
  }
});

test("UI exposes no execution control or temporary password material", () => {
  assert.doesNotMatch(passwordPanel, /temporaryPassword|clipboard|임시비밀번호 발급|onClick=/);
  assert.doesNotMatch(ownerDetail, /onClick=\{\(\) => void (withdrawOwner|resetOwnerPaymentMethod|refundOwner)/);
  assert.doesNotMatch(ownerDetail, />결제수단 초기화<|>이 결제 취소<|취소 사유/);
  assert.match(ownerDetail, /보안 승인 정책 결정 필요/);
  assert.doesNotMatch(ownerScreen, /\/api\/admin\/owners\/(refund|withdraw|temporary-password|payment-method\/reset)|temporaryPassword/);
});
