import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PORTONE_REQUEST_BINDING_TTL_MS = 5 * 60 * 1000;
export const PORTONE_REQUEST_STATE_MIN_LENGTH = 32;
export const PORTONE_REQUEST_STATE_MAX_LENGTH = 128;

export type PortoneRequestBindingStatus = "requested" | "verified" | "consumed" | "failed";

export type PortoneRequestBindingRecord = {
  id: string;
  purpose: string;
  verification_method: string;
  status: PortoneRequestBindingStatus;
  consumed_at: string | null;
  provider_identity_verification_id: string | null;
  provider_request_state_hash: string | null;
  provider_request_expires_at: string | null;
};

export type PortoneRequestBindingFailure =
  | "invalid_request"
  | "binding_mismatch"
  | "expired"
  | "already_used";

export type PortoneRequestBindingCheck =
  | { ok: true }
  | { ok: false; reason: PortoneRequestBindingFailure };

export function hashPortoneRequestState(state: string) {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function createPortoneRequestBinding(input: {
  verificationRequestId: string;
  now?: number;
}) {
  const compactRequestId = input.verificationRequestId.replace(/-/g, "");
  if (!/^[A-Fa-f0-9]{32}$/.test(compactRequestId)) {
    throw new Error("본인인증 요청 식별자가 올바르지 않습니다.");
  }

  const requestState = randomBytes(32).toString("base64url");
  return {
    providerIdentityVerificationId: `pm${compactRequestId}`,
    requestState,
    requestStateHash: hashPortoneRequestState(requestState),
    requestExpiresAt: new Date((input.now ?? Date.now()) + PORTONE_REQUEST_BINDING_TTL_MS).toISOString(),
  };
}

function stateHashesMatch(expectedHash: string, providedState: string) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  if (
    providedState.length < PORTONE_REQUEST_STATE_MIN_LENGTH ||
    providedState.length > PORTONE_REQUEST_STATE_MAX_LENGTH
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashPortoneRequestState(providedState), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function checkPortoneRequestBinding(input: {
  row: PortoneRequestBindingRecord | null;
  verificationRequestId: string;
  purpose: string;
  identityVerificationId: string;
  verificationState: string;
  allowedStatuses: readonly PortoneRequestBindingStatus[];
  now?: number;
}): PortoneRequestBindingCheck {
  const { row } = input;
  if (!row || row.id !== input.verificationRequestId || row.purpose !== input.purpose) {
    return { ok: false, reason: "invalid_request" };
  }
  if (row.verification_method !== "portone") {
    return { ok: false, reason: "invalid_request" };
  }
  if (row.consumed_at || row.status === "consumed") {
    return { ok: false, reason: "already_used" };
  }
  if (!input.allowedStatuses.includes(row.status)) {
    return { ok: false, reason: "already_used" };
  }
  if (
    row.provider_identity_verification_id !== input.identityVerificationId ||
    !row.provider_request_state_hash ||
    !stateHashesMatch(row.provider_request_state_hash, input.verificationState)
  ) {
    return { ok: false, reason: "binding_mismatch" };
  }

  const expiresAt = row.provider_request_expires_at
    ? new Date(row.provider_request_expires_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= (input.now ?? Date.now())) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

export function readPortoneCustomDataState(identityVerification: Record<string, unknown> | undefined) {
  const rawCustomData = identityVerification?.customData;
  if (rawCustomData == null) return null;

  let parsed: unknown = rawCustomData;
  if (typeof rawCustomData === "string") {
    try {
      parsed = JSON.parse(rawCustomData);
    } catch {
      return "";
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const state = (parsed as Record<string, unknown>).petmanagerIdentityState;
  return typeof state === "string" ? state : "";
}
