import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import {
  attachOwnerLoginSessionCookie,
  recordOwnerLoginSession,
  resolveOwnerLoginSessionTrackingId,
} from "@/server/owner-login-sessions";

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

type OwnerLoginProfile = {
  user_id: string;
  shop_id: string | null;
  login_id: string | null;
};

type OwnerSignInSession = {
  access_token: string;
  refresh_token: string;
};

function getLoginErrorMessage(message?: string) {
  const normalized = (message ?? "").toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("user not found")
  ) {
    return "이메일 또는 비밀번호를 다시 확인해 주세요.";
  }
  if (normalized.includes("rate limit")) {
    return "로그인 요청이 잠시 제한되었어요. 10분 뒤 다시 시도하거나 비밀번호 찾기로 재설정해 주세요.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  return "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

async function signInWithoutEmailConfirmationBlock({
  authClient,
  admin,
  email,
  password,
}: {
  authClient: NonNullable<ReturnType<typeof getSupabaseAuthClient>>;
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  email: string;
  password: string;
}) {
  const firstAttempt = await authClient.auth.signInWithPassword({ email, password });
  if (!firstAttempt.error || !firstAttempt.error.message.toLowerCase().includes("email not confirmed")) {
    return firstAttempt;
  }

  const profileResult = await admin
    .from("owner_profiles")
    .select("user_id,login_id")
    .eq("login_id", email)
    .maybeSingle<{ user_id: string; login_id: string }>();

  if (profileResult.error || !profileResult.data?.user_id) {
    return firstAttempt;
  }

  const confirmationResult = await admin.auth.admin.updateUserById(profileResult.data.user_id, { email_confirm: true });
  if (confirmationResult.error) {
    return firstAttempt;
  }

  return authClient.auth.signInWithPassword({ email, password });
}

function createLoginResponse({
  request,
  profile,
  email,
  session,
  timings,
}: {
  request: NextRequest;
  profile: OwnerLoginProfile;
  email: string;
  session: OwnerSignInSession;
  timings: {
    profileLookupMs: number;
    signInMs: number;
    profileVerifyMs: number;
  };
}) {
  const response = NextResponse.json({
    success: true,
    shopId: profile.shop_id,
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
  });
  const sessionTrackingId = resolveOwnerLoginSessionTrackingId(request);
  response.headers.set(
    "Server-Timing",
    [
      `profile_lookup;dur=${timings.profileLookupMs.toFixed(1)}`,
      `supabase_sign_in;dur=${timings.signInMs.toFixed(1)}`,
      `profile_verify;dur=${timings.profileVerifyMs.toFixed(1)}`,
    ].join(", "),
  );
  attachOwnerLoginSessionCookie(response, request, sessionTrackingId);
  after(() =>
    recordOwnerLoginSession(
      {
        request,
        ownerUserId: profile.user_id,
        shopId: profile.shop_id,
        email,
      },
      sessionTrackingId,
    ),
  );
  return response;
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "로그인 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const body = schema.parse(await request.json());
    const email = normalizeOwnerEmail(body.email);
    if (!isValidOwnerEmail(email)) {
      return NextResponse.json({ message: "이메일 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const authClient = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!authClient || !admin) {
      return NextResponse.json({ message: "로그인 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const signInStartedAt = performance.now();
    const signInResult = await signInWithoutEmailConfirmationBlock({
      authClient,
      admin,
      email,
      password: body.password,
    });
    const signInMs = performance.now() - signInStartedAt;
    if (signInResult.error || !signInResult.data.user || !signInResult.data.session) {
      const profileLookupStartedAt = performance.now();
      const ownerProfileLookup = await admin
        .from("owner_profiles")
        .select("user_id")
        .eq("login_id", email)
        .maybeSingle<{ user_id: string }>();
      const profileLookupMs = performance.now() - profileLookupStartedAt;

      if (ownerProfileLookup.error) {
        const response = NextResponse.json(
          { message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." },
          { status: 503 },
        );
        response.headers.set(
          "Server-Timing",
          `profile_lookup;dur=${profileLookupMs.toFixed(1)}, supabase_sign_in;dur=${signInMs.toFixed(1)}`,
        );
        return response;
      }

      if (!ownerProfileLookup.data?.user_id) {
        const response = NextResponse.json(
          { reason: "email_not_registered", message: "등록되지 않은 이메일입니다. 이메일을 확인하거나 회원가입해 주세요." },
          { status: 401 },
        );
        response.headers.set(
          "Server-Timing",
          `profile_lookup;dur=${profileLookupMs.toFixed(1)}, supabase_sign_in;dur=${signInMs.toFixed(1)}`,
        );
        return response;
      }

      return NextResponse.json(
        { reason: "invalid_password", message: getLoginErrorMessage(signInResult.error?.message) },
        {
          status: 401,
          headers: {
            "Server-Timing": `profile_lookup;dur=${profileLookupMs.toFixed(1)}, supabase_sign_in;dur=${signInMs.toFixed(1)}`,
          },
        },
      );
    }

    const profileVerifyStartedAt = performance.now();
    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id")
      .eq("user_id", signInResult.data.user.id)
      .maybeSingle<OwnerLoginProfile>();
    const profileVerifyMs = performance.now() - profileVerifyStartedAt;

    if (profileResult.error) {
      return NextResponse.json({ message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (!profileResult.data?.user_id || normalizeOwnerEmail(profileResult.data.login_id ?? "") !== email) {
      return NextResponse.json(
        { reason: "email_not_registered", message: "등록되지 않은 이메일입니다. 이메일을 확인하거나 회원가입해 주세요." },
        { status: 401 },
      );
    }

    return createLoginResponse({
      request,
      profile: profileResult.data,
      email,
      session: signInResult.data.session,
      timings: {
        profileLookupMs: 0,
        signInMs,
        profileVerifyMs,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : undefined;
    console.error("[auth/login] unexpected login error", error);
    return NextResponse.json({ message: getLoginErrorMessage(message) }, { status: 400 });
  }
}
