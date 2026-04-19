import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminAccountError, getAdminAccountByLoginId, verifyAdminPassword } from "@/server/admin-account";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionCookieOptions } from "@/server/admin-session";

const schema = z.object({
  loginId: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "관리자 로그인 정보를 다시 확인해 주세요." }, { status: 400 });
  }

  try {
    const { loginId, password } = parsed.data;
    const account = await getAdminAccountByLoginId(loginId);

    if (!account || !account.is_active || !verifyAdminPassword(password, account.password_hash)) {
      return NextResponse.json({ message: "관리자 아이디 또는 비밀번호를 다시 확인해 주세요." }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      account: {
        id: account.id,
        loginId: account.login_id,
        fullName: account.full_name,
      },
    });

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      createAdminSessionToken({
        accountId: account.id,
        loginId: account.login_id,
      }),
      getAdminSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    if (error instanceof AdminAccountError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "관리자 로그인을 완료하지 못했습니다." }, { status: 500 });
  }
}
