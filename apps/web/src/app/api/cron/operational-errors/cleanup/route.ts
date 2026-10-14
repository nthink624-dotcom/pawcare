import { NextRequest, NextResponse } from "next/server";
import { getReleaseId } from "@/lib/observability";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("No connection");
    const result = await admin.rpc("cleanup_operational_error_events_v1");
    if (result.error) throw new Error("Cleanup failed");
    return NextResponse.json({ ok: true, deletedCount: result.data, release: getReleaseId() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "오류 기록 정리를 완료하지 못했습니다." }, { status: 503 });
  }
}
