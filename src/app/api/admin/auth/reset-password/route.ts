import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSecret, ServerEnvError, serverEnv } from "@/lib/server-env";
import {
  assertAdminAuthAttemptAllowed,
  buildAdminAuthAttemptKey,
  clearAdminAuthFailures,
  getAdminAuthClientAddress,
  recordAdminAuthFailure,
  safeAdminSecretEqual,
} from "@/lib/admin-auth-rate-limit";
import { AdminAccountError, resetAdminPassword } from "@/server/admin-account";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionCookieOptions } from "@/server/admin-session";

const schema = z.object({
  setupKey: z.string().trim().min(1),
  loginId: z.string().trim().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "비밀번호 재설정 정보를 다시 확인해 주세요." }, { status: 400 });
  }

  const attemptKey = buildAdminAuthAttemptKey({
    action: "reset",
    loginId: parsed.data.loginId,
    clientAddress: getAdminAuthClientAddress(request.headers),
  });

  try {
    assertAdminAuthAttemptAllowed(attemptKey);
    const adminSetupKey = requireServerSecret(serverEnv.adminSetupKey, "ADMIN_SETUP_KEY");
    if (!safeAdminSecretEqual(parsed.data.setupKey, adminSetupKey)) {
      recordAdminAuthFailure(attemptKey);
      return NextResponse.json({ message: "운영자 등록 키를 다시 확인해 주세요." }, { status: 401 });
    }

    const account = await resetAdminPassword({
      loginId: parsed.data.loginId,
      password: parsed.data.password,
    });
    clearAdminAuthFailures(attemptKey);

    const response = NextResponse.json({
      success: true,
      account: {
        id: account.id,
        loginId: account.loginId,
        fullName: account.fullName,
      },
    });

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createAdminSessionToken({
        accountId: account.id,
        loginId: account.loginId,
      }),
      getAdminSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    if (error instanceof Error && "retryAfterSeconds" in error && typeof error.retryAfterSeconds === "number") {
      return NextResponse.json(
        { message: "인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof ServerEnvError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof AdminAccountError) {
      if (error.status === 404) {
        recordAdminAuthFailure(attemptKey);
      }
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "비밀번호 재설정을 완료하지 못했습니다." }, { status: 500 });
  }
}
