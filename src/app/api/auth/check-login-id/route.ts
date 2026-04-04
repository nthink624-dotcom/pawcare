import { NextRequest, NextResponse } from "next/server";

import { isValidOwnerLoginId, normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

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

  return "아이디 확인 중 문제가 발생했습니다. Supabase 테이블과 서비스 키를 확인해 주세요.";
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json(
        { available: false, message: "Supabase 환경 변수가 설정되지 않았습니다." },
        { status: 503 },
      );
    }

    const loginId = normalizeOwnerLoginId(request.nextUrl.searchParams.get("loginId") ?? "");
    if (!loginId) {
      return NextResponse.json({ available: false, message: "아이디를 입력해 주세요." }, { status: 400 });
    }

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json(
        { available: false, message: "아이디는 영문 소문자, 숫자, ., -, _ 조합으로 4자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ available: false, message: "Supabase 연결을 확인할 수 없습니다." }, { status: 503 });
    }

    const duplicate = await supabase
      .from("owner_profiles")
      .select("login_id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (duplicate.error) {
      return NextResponse.json(
        { available: false, message: mapSupabaseLookupError(duplicate.error.details || duplicate.error.message) },
        { status: 400 },
      );
    }

    if (duplicate.data?.login_id) {
      return NextResponse.json({ available: false, message: "이미 사용 중인 아이디입니다." });
    }

    return NextResponse.json({ available: true, message: "사용 가능한 아이디입니다." });
  } catch (error) {
    const message = error instanceof Error ? mapSupabaseLookupError(error.message) : "아이디 확인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ available: false, message }, { status: 400 });
  }
}
