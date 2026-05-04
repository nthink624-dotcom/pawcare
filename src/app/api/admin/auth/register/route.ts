import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSecret, ServerEnvError, serverEnv } from "@/lib/server-env";
import { AdminAccountError, createInitialAdminAccount } from "@/server/admin-account";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionCookieOptions } from "@/server/admin-session";

const schema = z.object({
  setupKey: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phoneNumber: z.string().trim().min(1),
  loginId: z.string().trim().min(4),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "관리자 등록 정보를 다시 확인해 주세요." }, { status: 400 });
  }

  try {
    const adminSetupKey = requireServerSecret(serverEnv.adminSetupKey, "ADMIN_SETUP_KEY");
    if (parsed.data.setupKey !== adminSetupKey) {
      return NextResponse.json({ message: "운영자 등록 키를 다시 확인해 주세요." }, { status: 401 });
    }

    const account = await createInitialAdminAccount(parsed.data);
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
    if (error instanceof ServerEnvError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof AdminAccountError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "관리자 등록을 완료하지 못했습니다." }, { status: 500 });
  }
}
