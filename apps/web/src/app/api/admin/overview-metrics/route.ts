import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

function kstToday() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("Supabase 설정을 확인해 주세요.", 503);

    const today = kstToday();
    const [appointments, inquiries] = await Promise.all([
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_date", today)
        .in("status", ["confirmed", "in_progress", "almost_done", "completed"]),
      admin
        .from("owner_support_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["answered", "resolved", "closed"]),
    ]);

    if (appointments.error) throw new AdminApiError(appointments.error.message, 503);
    if (inquiries.error) throw new AdminApiError(inquiries.error.message, 503);

    return NextResponse.json({
      todayVisitorCount: appointments.count ?? 0,
      confirmedInquiryCount: inquiries.count ?? 0,
      today,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "관리자 요약 정보를 불러오지 못했습니다." }, { status: 503 });
  }
}
