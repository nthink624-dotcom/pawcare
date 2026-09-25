import { createHmac, createHash, timingSafeEqual } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireServerSecret, ServerEnvError, serverEnv } from "@/lib/server-env";

export type AdminAuthRateLimitAction = "login" | "register" | "reset";

const KEY_VERSION = "v1";

export class AdminAuthRateLimitBlockedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("관리자 인증 요청이 잠시 제한되었습니다.");
  }
}

export class AdminAuthRateLimitUnavailableError extends Error {
  constructor() {
    super("관리자 인증 보안 게이트를 확인하지 못했습니다.");
  }
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

export function resolveAdminAuthClientAddress(headers: Headers) {
  if (process.env.VERCEL_ENV === "production") {
    return headers.get("x-vercel-forwarded-for")?.trim() || "vercel-ip-unavailable";
  }

  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local-unknown";
}

export function buildAdminAuthRateLimitHmac(input: {
  secret: string;
  action: AdminAuthRateLimitAction;
  subject: "ip" | "identifier";
  value: string;
}) {
  return createHmac("sha256", input.secret)
    .update(`admin-auth-rate-limit\0${KEY_VERSION}\0${input.action}\0${input.subject}\0${input.value}`)
    .digest("hex");
}

export function safeAdminSecretEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function claimAdminAuthRateLimit(input: {
  action: AdminAuthRateLimitAction;
  loginId: string;
  headers: Headers;
}) {
  try {
    const secret = requireServerSecret(serverEnv.adminAuthRateLimitHmacSecret, "ADMIN_AUTH_RATE_LIMIT_HMAC_SECRET");
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminAuthRateLimitUnavailableError();

    const result = await admin.rpc("claim_admin_auth_rate_limit_v1", {
      p_action: input.action,
      p_ip_hmac: buildAdminAuthRateLimitHmac({
        secret,
        action: input.action,
        subject: "ip",
        value: resolveAdminAuthClientAddress(input.headers),
      }),
      p_identifier_hmac: buildAdminAuthRateLimitHmac({
        secret,
        action: input.action,
        subject: "identifier",
        value: normalizeLoginId(input.loginId),
      }),
      p_key_version: KEY_VERSION,
    });
    if (result.error || !result.data || typeof result.data !== "object") {
      throw new AdminAuthRateLimitUnavailableError();
    }

    const payload = result.data as { allowed?: unknown; retry_after_seconds?: unknown };
    if (payload.allowed === false) {
      const retryAfterSeconds = typeof payload.retry_after_seconds === "number" ? payload.retry_after_seconds : 1;
      throw new AdminAuthRateLimitBlockedError(Math.max(1, Math.ceil(retryAfterSeconds)));
    }
    if (payload.allowed !== true) throw new AdminAuthRateLimitUnavailableError();
  } catch (error) {
    if (error instanceof AdminAuthRateLimitBlockedError || error instanceof AdminAuthRateLimitUnavailableError) throw error;
    if (error instanceof ServerEnvError) throw new AdminAuthRateLimitUnavailableError();
    throw new AdminAuthRateLimitUnavailableError();
  }
}
