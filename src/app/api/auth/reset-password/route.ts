import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ownerPasswordResetSchema } from "@/lib/auth/owner-password-reset";
import { buildOwnerAuthEmail } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 아직 설정되지 않았습니다." }, { status: 503 });
    }

    const body = ownerPasswordResetSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    const authEmail = buildOwnerAuthEmail(body.loginId);
    const users = await supabase.auth.admin.listUsers();
    const matchedUser = users.data.users.find((user) => user.email == authEmail);

    if (!matchedUser) {
      return NextResponse.json({ message: "일치하는 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    const updated = await supabase.auth.admin.updateUserById(matchedUser.id, { password: body.password });
    if (updated.error) {
      return NextResponse.json({ message: updated.error.message || "비밀번호 변경에 실패했습니다." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력 값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "비밀번호 변경 중 문제가 발생했습니다." }, { status: 400 });
  }
}
