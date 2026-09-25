import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import {
  OWNER_LOGIN_ROUTE_TIMEOUT_MS,
  OwnerLoginTimeoutError,
  withOwnerLoginTimeout,
} from "@/lib/auth/owner-login-timeout";
import { getSupabaseAuthClient } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getCanonicalApiOrigin } from "@/server/owner-api-auth";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

function toLoginMessage(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  }

  return "이메일 또는 비밀번호를 다시 확인해 주세요.";
}

async function verifyCanonicalShopMembership(accessToken: string, signal: AbortSignal) {
  let origin: string;
  try {
    origin = getCanonicalApiOrigin();
  } catch {
    return { ok: false as const, status: 503, message: "매장 연결 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요." };
  }

  let response: Response;
  try {
    response = await fetch(new URL("/api/owner/shops", `${origin}/`), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
    });
  } catch {
    return { ok: false as const, status: 503, message: "매장 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : response.status === 403
          ? "이 계정에 연결된 매장이 없습니다."
          : "매장 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return { ok: false as const, status: response.status, message };
  }

  if (!Array.isArray(body) || body.length === 0) {
    return { ok: false as const, status: 403, message: "이 계정에 연결된 매장이 없습니다." };
  }

  return { ok: true as const };
}

async function executeLogin(request: NextRequest, signal: AbortSignal) {
  if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "로그인 환경이 준비되지 않았습니다." }, { status: 503 });
  }

  const body = schema.parse(await request.json());
  const email = normalizeOwnerEmail(body.email);
  if (!isValidOwnerEmail(email)) {
      return NextResponse.json({ message: "이메일 형식을 확인해 주세요." }, { status: 400 });
  }

  const supabase = getSupabaseAuthClient(signal);
  if (!supabase) {
      return NextResponse.json({ message: "로그인 환경이 준비되지 않았습니다." }, { status: 503 });
  }
  // The auth client and canonical fetch both receive this signal directly; there is no owner DB query to call abortSignal(signal) on.

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password });
  if (
      error ||
      !data.user ||
      !data.session?.access_token ||
      !data.session.refresh_token
  ) {
      return NextResponse.json({ message: toLoginMessage(error?.message) }, { status: 401 });
  }

  const membership = await verifyCanonicalShopMembership(data.session.access_token, signal);
  if (!membership.ok) {
    return NextResponse.json({ message: membership.message }, { status: membership.status });
  }

  return NextResponse.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    return await withOwnerLoginTimeout((signal) => executeLogin(request, signal), OWNER_LOGIN_ROUTE_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof OwnerLoginTimeoutError) {
      return NextResponse.json(
        { message: "로그인 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요." },
        { status: 504 },
      );
    }
    return NextResponse.json({ message: "이메일과 비밀번호를 다시 확인해 주세요." }, { status: 400 });
  }
}
