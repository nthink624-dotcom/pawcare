import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";

import {
  buildOwnerAuthEmailCandidates,
  isValidOwnerLoginId,
  normalizeOwnerLoginId,
} from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv, serverEnv } from "@/lib/server-env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const schema = z.object({
  loginId: z.string().trim().min(1),
  password: z.string().min(1),
});

type OwnerLoginProfile = {
  user_id: string;
  login_id: string | null;
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
    return "로그인 요청이 잠시 제한됐어요. 잠시 후 다시 시도해 주세요.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  return "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
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

    const cookieStore = await cookies();
    const authCookies: Array<{
      name: string;
      value: string;
      options?: Parameters<NextResponse["cookies"]["set"]>[2];
    }> = [];
    const authClient = createServerClient(serverEnv.supabaseUrl!, serverEnv.supabasePublishableKey!, {
      cookieOptions: getSupabaseCookieOptions({ secure: request.nextUrl.protocol === "https:" }),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
            authCookies.push({ name, value, options });
          });
        },
      },
    });

    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id, login_id")
      .eq("login_id", loginId)
      .maybeSingle<OwnerLoginProfile>();

    if (profileResult.error) {
      return NextResponse.json({ message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400 });
    }

    if (!profileResult.data?.user_id) {
      return NextResponse.json({ message: "아이디 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const userResult = await admin.auth.admin.getUserById(profileResult.data.user_id);
    const existingEmail = userResult.data.user?.email ?? null;
    const candidates = buildOwnerAuthEmailCandidates(loginId, existingEmail);
    let lastErrorMessage = "";

    for (const email of candidates) {
      const signInResult = await authClient.auth.signInWithPassword({
        email,
        password: body.password,
      });

      if (signInResult.error) {
        lastErrorMessage = signInResult.error.message;
        continue;
      }

      if (signInResult.data.user?.id !== profileResult.data.user_id || !signInResult.data.session) {
        lastErrorMessage = "invalid login credentials";
        continue;
      }

      const response = NextResponse.json({
        success: true,
      });
      authCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    }

    return NextResponse.json({ message: getLoginErrorMessage(lastErrorMessage) }, { status: 401 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : undefined;
    return NextResponse.json({ message: getLoginErrorMessage(message) }, { status: 400 });
  }
}
