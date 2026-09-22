import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { phoneNormalize } from "@/lib/utils";
import { requireServerSecret, serverEnv } from "@/lib/server-env";

export const CALL_ID_PROVIDERS = ["kt_call_manager", "generic"] as const;
export type CallIdProvider = (typeof CALL_ID_PROVIDERS)[number];

export const CALL_LINE_TYPES = ["landline", "mobile"] as const;
export type CallLineType = (typeof CALL_LINE_TYPES)[number];

export const CALL_EVENT_TYPES = ["incoming", "missed", "answered", "ended"] as const;
export type CallEventType = (typeof CALL_EVENT_TYPES)[number];

export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_MATCH_STATUSES = ["matched", "unmatched", "ambiguous"] as const;
export type CallMatchStatus = (typeof CALL_MATCH_STATUSES)[number];

export function normalizeCallPhone(value: string) {
  const digits = phoneNormalize(value);
  if (digits.startsWith("82") && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidCallPhone(value: string) {
  const normalized = normalizeCallPhone(value);
  return normalized.length >= 8 && normalized.length <= 15;
}

export function callPhoneTail(value: string) {
  return normalizeCallPhone(value).slice(-4);
}

export function hashCallPhone(value: string) {
  const secret = requireServerSecret(serverEnv.callIdPhoneHmacSecret, "CALL_ID_PHONE_HMAC_SECRET");
  return createHmac("sha256", secret).update(normalizeCallPhone(value), "utf8").digest("hex");
}

export function createCallWebhookToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCallWebhookToken(value: string) {
  const secret = requireServerSecret(serverEnv.callIdWebhookHashSecret, "CALL_ID_WEBHOOK_HASH_SECRET");
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function secureHashEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function normalizeCallOccurredAt(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function sanitizeCallMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const safe: Record<string, string> = {};
  for (const key of ["lineId", "lineLabel", "providerCallId"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0 && candidate.length <= 160) {
      safe[key] = candidate.trim();
    }
  }
  return safe;
}
