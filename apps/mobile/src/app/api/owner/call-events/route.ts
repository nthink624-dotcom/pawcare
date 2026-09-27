import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "50", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : 50;
}

function isCatchCallLinkSchemaMissing(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST204" || error?.code === "PGRST205" || message.includes("appointment_id") || message.includes("reservation_status");
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined);
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ message: "캐치콜 데이터베이스 설정을 확인해 주세요." }, { status: 503 });

    let query = admin
      .from("call_events")
      .select("id,integration_id,provider_event_id,event_type,direction,phone_tail,occurred_at,match_status,appointment_id,reservation_status,notification_status,matched_guardian:guardians(id,name)")
      .eq("shop_id", owner.shopId)
      .order("occurred_at", { ascending: false })
      .limit(parseLimit(request.nextUrl.searchParams.get("limit")));
    const matchStatus = request.nextUrl.searchParams.get("matchStatus")?.trim();
    if (matchStatus && ["matched", "unmatched", "ambiguous"].includes(matchStatus)) query = query.eq("match_status", matchStatus);

    let result = await query;
    if (result.error && isCatchCallLinkSchemaMissing(result.error)) {
      result = await admin
        .from("call_events")
        .select("id,integration_id,provider_event_id,event_type,direction,phone_tail,occurred_at,match_status,matched_guardian:guardians(id,name)")
        .eq("shop_id", owner.shopId)
        .order("occurred_at", { ascending: false })
        .limit(parseLimit(request.nextUrl.searchParams.get("limit"))) as typeof result;
    }
    if (result.error) return NextResponse.json({ message: "캐치콜 기록을 확인하지 못했습니다." }, { status: 500 });
    return NextResponse.json({
      events: (result.data ?? []).map((row) => {
        const matchedGuardian = Array.isArray(row.matched_guardian) ? row.matched_guardian[0] : row.matched_guardian;
        return {
          id: row.id,
          integrationId: row.integration_id,
          providerEventId: row.provider_event_id,
          eventType: row.event_type,
          direction: row.direction,
          phoneTail: row.phone_tail,
          occurredAt: row.occurred_at,
          matchStatus: row.match_status,
          appointmentId: row.appointment_id,
          reservationStatus: row.reservation_status,
          notificationStatus: row.notification_status,
          matchedGuardian: matchedGuardian ? { id: matchedGuardian.id, name: matchedGuardian.name } : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "캐치콜 기록을 확인하지 못했습니다." }, { status: 500 });
  }
}
