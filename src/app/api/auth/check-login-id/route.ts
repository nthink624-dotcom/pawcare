import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";
import { isValidOwnerLoginId, normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseEnv()) {
      return NextResponse.json({ message: "Supabase 환경 변수가 필요합니다." }, { status: 503 });
    }

    const loginId = normalizeOwnerLoginId(new URL(request.url).searchParams.get("loginId") || "");
    if (!loginId) {
      return NextResponse.json({ available: false, message: "아이디를 입력해 주세요." }, { status: 400 });
    }

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json({ available: false, message: "아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: "Supabase 연결을 확인해 주세요." }, { status: 503 });
    }

    const { data, error } = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (error) {
      return NextResponse.json({ available: false, message: "아이디 확인 중 문제가 발생했습니다." }, { status: 400 });
    }

    if (data?.login_id) {
      return NextResponse.json({ available: false, message: "이미 사용 중인 아이디입니다." });
    }

    return NextResponse.json({ available: true, message: "사용 가능한 아이디입니다." });
  } catch (error) {
    return NextResponse.json({ available: false, message: error instanceof Error ? error.message : "아이디 확인에 실패했습니다." }, { status: 400 });
  }
}
