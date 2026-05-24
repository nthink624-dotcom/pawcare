import { createHash, randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export const OWNER_LOGIN_SESSION_COOKIE = "petmanager_owner_login_session";

const LOGIN_SESSION_TABLE = "owner_login_sessions";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

type LoginSessionInput = {
  request: NextRequest;
  ownerUserId: string;
  shopId: string | null;
  loginId: string;
};

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || null;
}

function hashIp(ip: string | null) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

function parseDevice(userAgent: string): { deviceType: DeviceType; browserName: string; osName: string } {
  const ua = userAgent.toLowerCase();
  const deviceType: DeviceType = /bot|crawler|spider|slurp/.test(ua)
    ? "bot"
    : /ipad|tablet/.test(ua)
      ? "tablet"
      : /mobile|iphone|android/.test(ua)
        ? "mobile"
        : userAgent
          ? "desktop"
          : "unknown";

  const browserName = /kakaotalk/.test(ua)
    ? "KakaoTalk"
    : /edg\//.test(ua)
      ? "Edge"
      : /samsungbrowser/.test(ua)
        ? "Samsung Internet"
        : /chrome|crios/.test(ua)
          ? "Chrome"
          : /safari/.test(ua)
            ? "Safari"
            : /firefox|fxios/.test(ua)
              ? "Firefox"
              : "Unknown";

  const osName = /android/.test(ua)
    ? "Android"
    : /iphone|ipad|ios/.test(ua)
      ? "iOS"
      : /windows/.test(ua)
        ? "Windows"
        : /mac os|macintosh/.test(ua)
          ? "macOS"
          : "Unknown";

  return { deviceType, browserName, osName };
}

function isMissingLoginSessionTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes(LOGIN_SESSION_TABLE) && (message.includes("schema cache") || message.includes("does not exist")))
  );
}

export function getOwnerLoginSessionCookieOptions(request?: NextRequest) {
  const protocol = request?.headers.get("x-forwarded-proto") ?? request?.nextUrl.protocol.replace(":", "");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: protocol === "https",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export async function recordOwnerLoginSession(input: LoginSessionInput) {
  const cookieValue = input.request.cookies.get(OWNER_LOGIN_SESSION_COOKIE)?.value;
  const sessionTrackingId = isUuid(cookieValue) ? cookieValue! : randomUUID();

  try {
    const userAgent = input.request.headers.get("user-agent") ?? "";
    const now = new Date().toISOString();
    const device = parseDevice(userAgent);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return { sessionTrackingId };
    }

    const result = await supabase.from(LOGIN_SESSION_TABLE).upsert(
      {
        owner_user_id: input.ownerUserId,
        shop_id: input.shopId,
        login_id: input.loginId,
        session_tracking_id: sessionTrackingId,
        device_type: device.deviceType,
        browser_name: device.browserName,
        os_name: device.osName,
        user_agent: userAgent.slice(0, 500),
        ip_hash: hashIp(getClientIp(input.request)),
        last_seen_at: now,
        last_login_at: now,
        updated_at: now,
        revoked_at: null,
      },
      { onConflict: "session_tracking_id" },
    );

    if (result.error) {
      if (!isMissingLoginSessionTableError(result.error)) {
        console.warn("[auth/login] login session record failed", {
          code: result.error.code,
          message: result.error.message,
        });
      }
      return { sessionTrackingId };
    }
  } catch (error) {
    console.warn("[auth/login] login session record skipped", error);
  }

  return { sessionTrackingId };
}

export function attachOwnerLoginSessionCookie(
  response: NextResponse,
  request: NextRequest,
  sessionTrackingId: string,
) {
  response.cookies.set(OWNER_LOGIN_SESSION_COOKIE, sessionTrackingId, getOwnerLoginSessionCookieOptions(request));
}
