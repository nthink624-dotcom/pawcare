import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

type LoginSessionRow = {
  id: string;
  device_type: string;
  browser_name: string;
  os_name: string;
  first_seen_at: string;
  last_seen_at: string;
  last_login_at: string;
  revoked_at: string | null;
};

function isMissingLoginSessionTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes("owner_login_sessions") && (message.includes("schema cache") || message.includes("does not exist")))
  );
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request);
    const supabase = getSupabaseAdmin();
    if (!supabase || !owner.userId) {
      return NextResponse.json({ sessions: [] });
    }

    const result = await supabase
      .from("owner_login_sessions")
      .select("id, device_type, browser_name, os_name, first_seen_at, last_seen_at, last_login_at, revoked_at")
      .eq("owner_user_id", owner.userId)
      .order("last_login_at", { ascending: false })
      .limit(20);

    if (result.error) {
      if (isMissingLoginSessionTableError(result.error)) {
        return NextResponse.json({ sessions: [] });
      }
      throw new OwnerApiError(result.error.message, 500);
    }

    const sessions = ((result.data ?? []) as LoginSessionRow[]).map((session) => ({
      id: session.id,
      deviceType: session.device_type,
      browserName: session.browser_name,
      osName: session.os_name,
      firstSeenAt: session.first_seen_at,
      lastSeenAt: session.last_seen_at,
      lastLoginAt: session.last_login_at,
      revokedAt: session.revoked_at,
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "로그인 기기 목록을 확인하지 못했습니다." }, { status: 400 });
  }
}
