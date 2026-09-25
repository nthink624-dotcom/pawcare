import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "50", 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, parsed));
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() ?? "";
    if (!shopId) throw new OwnerApiError("매장 정보가 필요합니다.", 400);

    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("콜아이디 데이터를 확인할 수 없습니다.", 503);

    let query = admin
      .from("call_events")
      .select("id,integration_id,provider_event_id,event_type,direction,phone_tail,occurred_at,match_status,matched_guardian:guardians(id,name)")
      .eq("shop_id", owner.shopId)
      .order("occurred_at", { ascending: false })
      .limit(parseLimit(request.nextUrl.searchParams.get("limit")));

    const matchStatus = request.nextUrl.searchParams.get("matchStatus")?.trim();
    if (matchStatus && ["matched", "unmatched", "ambiguous"].includes(matchStatus)) {
      query = query.eq("match_status", matchStatus);
    }

    const result = await query;
    if (result.error) throw new OwnerApiError("콜아이디 기록을 확인하지 못했습니다.", 500);

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
        matchedGuardian: matchedGuardian
          ? { id: matchedGuardian.id, name: matchedGuardian.name }
          : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "콜아이디 기록을 확인하지 못했습니다." }, { status: 500 });
  }
}
