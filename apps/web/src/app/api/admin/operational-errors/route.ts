import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("오류 기록 연결을 확인하지 못했습니다.", 503);
    const result = await admin.from("operational_error_events")
      .select("id,project_name,event_name,http_status,release_id,created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (result.error) throw new AdminApiError("오류 기록을 불러오지 못했습니다.", 503);
    return NextResponse.json({ ok: true, events: result.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof AdminApiError ? error.message : "오류 기록을 불러오지 못했습니다." }, { status: error instanceof AdminApiError ? error.status : 500 });
  }
}
