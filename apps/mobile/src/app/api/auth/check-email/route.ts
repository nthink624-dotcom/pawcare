import { NextRequest, NextResponse } from "next/server";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

export async function GET(request: NextRequest) {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ available: false, message: "이메일 확인 환경이 준비되지 않았습니다." }, { status: 503 });
  }

  const email = normalizeOwnerEmail(request.nextUrl.searchParams.get("email") ?? "");
  if (!isValidOwnerEmail(email)) {
    return NextResponse.json({ available: false, message: "이메일 형식을 확인해 주세요." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ available: false, message: "이메일 확인 환경이 준비되지 않았습니다." }, { status: 503 });
  }

  const existing = await supabase.from("owner_profiles").select("user_id").eq("login_id", email).maybeSingle();
  if (existing.error) {
    return NextResponse.json({ available: false, message: "이메일 확인 중 문제가 발생했습니다." }, { status: 400 });
  }

  if (existing.data?.user_id) {
    return NextResponse.json({ available: false, message: "이미 가입된 이메일입니다." });
  }

  return NextResponse.json({ available: true, message: "사용 가능한 이메일입니다." });
}
