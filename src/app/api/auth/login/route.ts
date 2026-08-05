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

  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았어요. 받은 메일의 인증 링크를 연 뒤 로그인해 주세요.";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("email not confirmed") ||
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

function createLoginResponse({
  request,
  profile,
  email,
  session,
}: {
  request: NextRequest;
  profile: OwnerLoginProfile;
  email: string;
  session: OwnerSignInSession;
}) {
  const response = NextResponse.json({
    success: true,
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
  });
  const sessionTrackingId = resolveOwnerLoginSessionTrackingId(request);
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

    const signInResult = await authClient.auth.signInWithPassword({ email, password: body.password });
    if (signInResult.error || !signInResult.data.user || !signInResult.data.session) {
      const isEmailConfirmationRequired = (signInResult.error?.message ?? "").toLowerCase().includes("email not confirmed");
      return NextResponse.json(
        {
          message: getLoginErrorMessage(signInResult.error?.message),
          ...(isEmailConfirmationRequired ? { code: "email-confirmation-required" } : {}),
        },
        { status: isEmailConfirmationRequired ? 403 : 401 },
      );
    }

    if (!signInResult.data.user.email_confirmed_at) {
      return NextResponse.json(
        {
          code: "email-confirmation-required",
          message: "이메일 인증이 아직 완료되지 않았어요. 받은 메일의 인증 링크를 연 뒤 로그인해 주세요.",
        },
        { status: 403 },
      );
    }

    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id")
      .eq("user_id", signInResult.data.user.id)
      .maybeSingle<OwnerLoginProfile>();

    if (profileResult.error) {
      return NextResponse.json({ message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (!profileResult.data?.user_id || normalizeOwnerEmail(profileResult.data.login_id ?? "") !== email) {
      return NextResponse.json({ message: "이메일 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    return createLoginResponse({
      request,
      profile: profileResult.data,
      email,
      session: signInResult.data.session,
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
