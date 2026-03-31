import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ownerPasswordResetSchema } from "@/lib/auth/owner-password-reset";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 필요합니다." }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 연결을 확인해 주세요." }, { status: 503 });
    }

    const payload = ownerPasswordResetSchema.parse(await request.json());
    const profileResult = await supabase
      .from("owner_profiles")
      .select("user_id, name, birth_date")
      .eq("login_id", payload.loginId)
      .maybeSingle();

    if (profileResult.error) {
      return NextResponse.json({ message: "계정 정보를 찾는 중 문제가 발생했습니다." }, { status: 400 });
    }

    const profile = profileResult.data;
    if (!profile || profile.name.trim() !== payload.name || profile.birth_date !== payload.birthDate) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했습니다." }, { status: 404 });
    }

    const updated = await supabase.auth.admin.updateUserById(profile.user_id, {
      password: payload.password,
    });

    if (updated.error) {
      return NextResponse.json(
        { message: updated.error.message || "비밀번호를 변경하지 못했습니다." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "비밀번호 변경에 실패했습니다." },
      { status: 400 },
    );
  }
}
