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

const APP_ACCOUNT_NOT_PROVISIONED_MESSAGE =
  "Google Play 테스트 참여 계정과 앱 로그인 계정은 별개입니다. 이 이메일에는 펫매니저 앱 계정이 등록되어 있지 않습니다.";

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

function traceLoginDecision(outcome: "credentials-rejected" | "profile-unavailable" | "profile-missing" | "success", status: number) {
  console.info("[owner-login]", { step: "decision", outcome, status });
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
  const { data, error } = authResult;
  if (
      error ||
      !data.user ||
      !data.session?.access_token ||
      !data.session.refresh_token
  ) {
      traceLoginDecision("credentials-rejected", 401);
      return NextResponse.json({ message: toLoginMessage(error?.message) }, { status: 401 });
  }

  if (profileResult.error) {
      traceLoginDecision("profile-unavailable", 503);
      return NextResponse.json({ message: "앱 계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  if (!profileResult.data?.user_id || data.user.id !== profileResult.data.user_id) {
      traceLoginDecision("profile-missing", 403);
      return NextResponse.json({ message: APP_ACCOUNT_NOT_PROVISIONED_MESSAGE }, { status: 403 });
  }

  traceLoginDecision("success", 200);

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
