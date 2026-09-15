import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import {
  OWNER_LOGIN_ROUTE_TIMEOUT_MS,
  OwnerLoginTimeoutError,
  withOwnerLoginTimeout,
} from "@/lib/auth/owner-login-timeout";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

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

async function traceLoginServerStep<T>(step: string, work: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    const result = await work();
    console.info("[owner-login]", { step, outcome: "success", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    console.warn("[owner-login]", {
      step,
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
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
  const admin = getSupabaseAdmin();
  if (!supabase || !admin) {
      return NextResponse.json({ message: "로그인 환경이 준비되지 않았습니다." }, { status: 503 });
  }

  const [profileResult, authResult] = await Promise.all([
    traceLoginServerStep("owner-profile", async () =>
      await admin
        .from("owner_profiles")
        .select("user_id, login_id")
        .eq("login_id", email)
        .abortSignal(signal)
        .maybeSingle<{ user_id: string; login_id: string }>(),
    ),
    traceLoginServerStep("password-auth", () =>
      supabase.auth.signInWithPassword({ email, password: body.password }),
    ),
  ]);
  if (profileResult.error) {
      return NextResponse.json({ message: "로그인 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (!profileResult.data?.user_id) {
      return NextResponse.json({ message: "등록되지 않은 이메일입니다. 이메일을 확인해 주세요." }, { status: 401 });
  }

  const { data, error } = authResult;
  if (
      error ||
      !data.user ||
      data.user.id !== profileResult.data.user_id ||
      !data.session?.access_token ||
      !data.session.refresh_token
  ) {
      return NextResponse.json({ message: toLoginMessage(error?.message) }, { status: 401 });
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
