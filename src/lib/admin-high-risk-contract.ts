import { createHash } from "node:crypto";

export const ADMIN_HIGH_RISK_ACTIONS_READY = false;

export const ADMIN_HIGH_RISK_SCOPE_MATRIX = {
  refund: { request: "billing.refund.request", approve: "billing.refund.approve", execute: "billing.refund.execute" },
  withdraw: { request: "account.withdraw.request", approve: "account.withdraw.approve", execute: "account.withdraw.execute" },
  credential_reset: { request: "account.credential_reset.request", approve: "account.credential_reset.approve", execute: "account.credential_reset.execute" },
  payment_method_reset: { request: "billing.payment_method_reset.request", approve: "billing.payment_method_reset.approve", execute: "billing.payment_method_reset.execute" },
} as const;

export type AdminHighRiskAction = keyof typeof ADMIN_HIGH_RISK_SCOPE_MATRIX;
export type HighRiskSagaState = "requested" | "approved" | "queued" | "leased" | "provider_pending" | "provider_unknown" | "retry_wait" | "reconciling" | "succeeded" | "failed" | "needs_review";

export function resolveHighRiskAuthorization(input: { authenticated: boolean; scopeStoreAvailable: boolean; hasRequiredScope: boolean; readinessReady: boolean }) {
  if (!input.authenticated) return 401 as const;
  if (!input.scopeStoreAvailable) return 503 as const;
  if (!input.hasRequiredScope) return 403 as const;
  if (!input.readinessReady) return 503 as const;
  return 200 as const;
}

export function canDispatchProvider(state: HighRiskSagaState) {
  return state === "leased";
}

export function claimOperationOnce(claimed: Set<string>, operationId: string) {
  if (claimed.has(operationId)) return false;
  claimed.add(operationId);
  return true;
}

export function hashHighRiskApprovalPayload(input: {
  action: AdminHighRiskAction;
  scope: Record<string, unknown>;
  version: number;
  expiresAt: string;
}) {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

export function validateHighRiskApproval(input: {
  requesterRef: string;
  approverRef: string;
  expectedHash: string;
  actualHash: string;
  expectedVersion: number;
  actualVersion: number;
  expiresAt: string;
  now: string;
}) {
  if (input.requesterRef === input.approverRef) return { ok: false as const, reason: "self_approval" as const };
  if (input.expectedVersion !== input.actualVersion || input.expectedHash !== input.actualHash) return { ok: false as const, reason: "approval_changed" as const };
  if (Date.parse(input.expiresAt) <= Date.parse(input.now)) return { ok: false as const, reason: "approval_expired" as const };
  return { ok: true as const };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}
