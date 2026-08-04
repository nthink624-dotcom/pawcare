import { NextRequest, NextResponse } from "next/server";

import { isValidOwnerEmail, normalizeOwnerEmail } from "@/lib/auth/owner-credentials";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function mapSupabaseLookupError(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("owner_profiles") && normalized.includes("does not exist")) {
    return "Supabase에 owner_profiles 테이블이 없습니다. 회원가입 관련 SQL을 먼저 적용해 주세요.";
  }
  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "owner_profiles 조회 권한이 없습니다. service_role 키 또는 RLS 설정을 확인해 주세요.";
  }
  if (normalized.includes("invalid api key") || normalized.includes("jwt")) {
    return "Supabase 서비스 키가 올바르지 않습니다. SUPABASE_SERVICE_ROLE_KEY를 다시 확인해 주세요.";
  }
  if (normalized.includes("enotfound") || normalized.includes("fetch failed")) {
    return "Supabase 서버에 연결할 수 없습니다. 인터넷 연결과 Supabase URL을 확인해 주세요.";
  }

  return "이메일 확인 중 문제가 발생했습니다. Supabase 테이블과 서비스 키를 확인해 주세요.";
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({ available: false, message: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 503 });
    }

    const email = normalizeOwnerEmail(request.nextUrl.searchParams.get("email") ?? "");
    if (!email) {
      return NextResponse.json({ available: false, message: "이메일을 입력해 주세요." }, { status: 400 });
    }
    if (!isValidOwnerEmail(email)) {
      return NextResponse.json({ available: false, message: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ available: false, message: "Supabase 연결을 확인할 수 없습니다." }, { status: 503 });
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", email).maybeSingle();
    if (duplicate.error) {
      return NextResponse.json(
        { available: false, message: mapSupabaseLookupError(duplicate.error.details || duplicate.error.message) },
        { status: 400 },
      );
    }
    if (duplicate.data?.login_id) {
      return NextResponse.json({ available: false, message: "이미 사용 중인 이메일입니다." });
    }

    return NextResponse.json({ available: true, message: "사용 가능한 이메일입니다." });
  } catch (error) {
    const message = error instanceof Error ? mapSupabaseLookupError(error.message) : "이메일 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ available: false, message }, { status: 400 });
  }
}
