import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { ownerFindLoginIdSchema } from "@/lib/auth/owner-find-login-id";
import { readVerifiedIdentityToken } from "@/lib/auth/owner-identity";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const body = ownerFindLoginIdSchema.parse(await request.json());
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

    const result = await supabase
      .from("owner_profiles")
      .select("login_id")
      .eq("name", body.name)
      .eq("birth_date", body.birthDate)
      .eq("phone_number", body.phoneNumber)
      .maybeSingle();

    if (result.error) {
      return NextResponse.json({ message: result.error.message || "아이디를 찾지 못했습니다." }, { status: 400 });
    }

    if (!result.data?.login_id) {
      return NextResponse.json({ message: "입력한 정보와 일치하는 아이디를 찾지 못했어요." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      loginId: result.data.login_id,
      message: `가입된 아이디는 ${result.data.login_id} 입니다.`,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "입력값을 다시 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ message: "아이디 찾기 중 문제가 발생했습니다." }, { status: 400 });
  }
}
