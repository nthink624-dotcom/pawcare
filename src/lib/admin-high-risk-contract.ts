import { createHash } from "node:crypto";

export const ADMIN_HIGH_RISK_ACTIONS_READY = false;

export const ADMIN_HIGH_RISK_SCOPE_MATRIX = {
  refund: "billing.refund.execute",
  withdraw: "account.withdraw.execute",
  credential_reset: "account.credential_reset.execute",
  payment_method_reset: "billing.payment_method_reset.execute",
} as const;

export type AdminHighRiskAction = keyof typeof ADMIN_HIGH_RISK_SCOPE_MATRIX;
export type HighRiskOperationState = "approved" | "leased" | "provider_pending" | "provider_unknown" | "reconciling" | "succeeded" | "failed" | "needs_review";

export function resolveHighRiskAuthorization(input: { authenticated: boolean; active: boolean; superAdmin: boolean; recentlyReauthenticated: boolean; twoPersonApprovalReady: boolean }) {
  if (!input.authenticated) return 401 as const;
  if (!input.active || !input.superAdmin) return 403 as const;
  if (!input.recentlyReauthenticated || !input.twoPersonApprovalReady) return 503 as const;
  return 200 as const;
}

export function canDispatchProvider(state: HighRiskOperationState) {
  return state === "leased";
}

export function hashHighRiskApprovalPayload(input: { action: AdminHighRiskAction; scope: Record<string, unknown>; version: number; expiresAt: string }) {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

export function validateHighRiskApproval(input: { requesterRef: string; approverRef: string; expectedHash: string; actualHash: string; expectedVersion: number; actualVersion: number; expiresAt: string; now: string }) {
  if (input.requesterRef === input.approverRef) return { ok: false as const, reason: "self_approval" as const };
  if (input.expectedVersion !== input.actualVersion || input.expectedHash !== input.actualHash) return { ok: false as const, reason: "approval_changed" as const };
  if (Date.parse(input.expiresAt) <= Date.parse(input.now)) return { ok: false as const, reason: "approval_expired" as const };
  return { ok: true as const };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}
