import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildOwnerAuthEmail,
  isLegacyOwnerAuthEmail,
  isValidOwnerLoginId,
  normalizeOwnerLoginId,
} from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { attachOwnerLoginSessionCookie, recordOwnerLoginSession } from "@/server/owner-login-sessions";

const schema = z.object({
  loginId: z.string().trim().min(1),
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
    normalized.includes("email not confirmed") ||
    normalized.includes("user not found")
  ) {
    return "아이디 또는 비밀번호를 다시 확인해 주세요.";
  }
  if (normalized.includes("rate limit")) {
    return "로그인 요청이 잠시 제한되었어요. 10분 뒤 다시 시도하거나 비밀번호 찾기로 재설정해 주세요.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  return "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

async function createLoginResponse({
  request,
  profile,
  loginId,
  session,
}: {
  request: NextRequest;
  profile: OwnerLoginProfile;
  loginId: string;
  session: OwnerSignInSession;
}) {
  const response = NextResponse.json({
    success: true,
    session: {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
  });
  const recordedSession = await recordOwnerLoginSession({
    request,
    ownerUserId: profile.user_id,
    shopId: profile.shop_id,
    loginId,
  });
  attachOwnerLoginSessionCookie(response, request, recordedSession.sessionTrackingId);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "로그인 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const body = schema.parse(await request.json());
    const loginId = normalizeOwnerLoginId(body.loginId);

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json({ message: "아이디 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "로그인 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const authClient = getSupabaseAuthClient();
    if (!authClient) {
      return NextResponse.json({ message: "로그인 환경이 아직 준비되지 않았어요." }, { status: 503 });
    }

    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id")
      .eq("login_id", loginId)
      .maybeSingle<OwnerLoginProfile>();

    if (profileResult.error) {
      return NextResponse.json({ message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (!profileResult.data?.user_id) {
      return NextResponse.json({ message: "아이디 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const canonicalEmail = buildOwnerAuthEmail(loginId);
    const signInResult = await authClient.auth.signInWithPassword({
      email: canonicalEmail,
      password: body.password,
    });

    if (!signInResult.error && signInResult.data.user?.id === profileResult.data.user_id && signInResult.data.session) {
      return createLoginResponse({
        request,
        profile: profileResult.data,
        loginId,
        session: signInResult.data.session,
      });
    }

    let lastErrorMessage = signInResult.error?.message ?? "invalid login credentials";

    const userResult = await admin.auth.admin.getUserById(profileResult.data.user_id);
    const existingEmail = userResult.data.user?.email?.trim().toLowerCase() ?? null;

    if (existingEmail && isLegacyOwnerAuthEmail(existingEmail) && existingEmail !== canonicalEmail) {
      const legacySignInResult = await authClient.auth.signInWithPassword({
        email: existingEmail,
        password: body.password,
      });

      if (
        !legacySignInResult.error &&
        legacySignInResult.data.user?.id === profileResult.data.user_id &&
        legacySignInResult.data.session
      ) {
        const updatedUser = await admin.auth.admin.updateUserById(profileResult.data.user_id, {
          email: canonicalEmail,
          email_confirm: true,
          user_metadata: {
            ...(userResult.data.user?.user_metadata ?? {}),
            login_id: loginId,
          },
        });

        if (updatedUser.error) {
          console.error("[auth/login] failed to canonicalize owner auth email", updatedUser.error.message);
        }

        return createLoginResponse({
          request,
          profile: profileResult.data,
          loginId,
          session: legacySignInResult.data.session,
        });
      }

      lastErrorMessage = legacySignInResult.error?.message ?? "invalid login credentials";
    }

    return NextResponse.json({ message: getLoginErrorMessage(lastErrorMessage) }, { status: 401 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : undefined;
    console.error("[auth/login] unexpected login error", error);
    return NextResponse.json({ message: getLoginErrorMessage(message) }, { status: 400 });
  }
}
