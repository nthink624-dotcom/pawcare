import { NextRequest, NextResponse } from "next/server";

import { isValidOwnerLoginId, normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json(
        { available: false, message: "Supabase ?? ??? ???? ?????." },
        { status: 503 },
      );
    }

    const loginId = normalizeOwnerLoginId(request.nextUrl.searchParams.get("loginId") ?? "");
    if (!loginId) {
      return NextResponse.json({ available: false, message: "???? ??? ???." }, { status: 400 });
    }

    if (!isValidOwnerLoginId(loginId)) {
      return NextResponse.json(
        { available: false, message: "???? ?? ???, ??, ., -, _ ???? 4? ?? ??? ???." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ available: false, message: "Supabase ??? ??? ? ????." }, { status: 503 });
    }

    const duplicate = await supabase.from("owner_profiles").select("login_id").eq("login_id", loginId).maybeSingle();
    if (duplicate.error) {
      return NextResponse.json({ available: false, message: "??? ?? ? ??? ??????." }, { status: 400 });
    }

    if (duplicate.data?.login_id) {
      return NextResponse.json({ available: false, message: "?? ?? ?? ??????." });
    }

    return NextResponse.json({ available: true, message: "?? ??? ??????." });
  } catch {
    return NextResponse.json({ available: false, message: "??? ?? ? ??? ??????." }, { status: 400 });
  }
}
