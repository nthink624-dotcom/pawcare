import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ownerPasswordResetSchema } from "@/lib/auth/owner-password-reset";
import { readVerifiedIdentityToken } from "@/lib/auth/owner-identity";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = ownerPasswordResetSchema.parse(await request.json());
    const verifiedIdentity = readVerifiedIdentityToken(body.identityVerificationToken);
    if (!verifiedIdentity) {
      return NextResponse.json({ message: "본인인증이 만료되었어요. 다시 인증해 주세요." }, { status: 400 });
    }

    if (
      verifiedIdentity.name !== body.name ||
      verifiedIdentity.birthDate !== body.birthDate ||
      verifiedIdentity.phoneNumber !== body.phoneNumber
    ) {
      return NextResponse.json({ message: "본인인증 정보와 입력한 정보가 일치하지 않습니다." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 관리자 클라이언트를 만들 수 없습니다." }, { status: 503 });
    }

    const profile = await supabase
      .from("owner_profiles")
      .select("user_id")
      .eq("login_id", body.loginId)
      .eq("name", verifiedIdentity.name)
      .eq("birth_date", verifiedIdentity.birthDate)
      .eq("phone_number", verifiedIdentity.phoneNumber)
      .maybeSingle();

    if (profile.error) {
      return NextResponse.json({ message: profile.error.message || "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status: 400 });
    }

    if (!profile.data?.user_id) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 계정을 찾지 못했어요." }, { status: 404 });
    }

    const updated = await supabase.auth.admin.updateUserById(profile.data.user_id, { password: body.password });
    if (updated.error) {
      return NextResponse.json({ message: updated.error.message || "비밀번호를 변경하지 못했어요." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "비밀번호가 변경되었습니다. 다시 로그인해 주세요." });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "비밀번호 재설정 중 문제가 발생했습니다." }, { status: 400 });
  }
}
