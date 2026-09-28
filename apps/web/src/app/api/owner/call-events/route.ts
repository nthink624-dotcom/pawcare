import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const CALL_EVENTS_CORS = { methods: "GET, OPTIONS" } as const;

function responseMessage(request: NextRequest, message: string, status: number) {
  return ownerMobileCorsJson(request, { message }, { status }, CALL_EVENTS_CORS);
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "50", 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, parsed));
}

function isCatchCallLinkSchemaMissing(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST204" || error?.code === "PGRST205" || message.includes("appointment_id") || message.includes("reservation_status");
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
      .select("id,integration_id,provider_event_id,event_type,direction,phone_tail,occurred_at,match_status,appointment_id,reservation_status,notification_status,matched_guardian:guardians(id,name)")
      .eq("shop_id", owner.shopId)
      .order("occurred_at", { ascending: false })
      .limit(parseLimit(request.nextUrl.searchParams.get("limit")));

    const matchStatus = request.nextUrl.searchParams.get("matchStatus")?.trim();
    if (matchStatus && ["matched", "unmatched", "ambiguous"].includes(matchStatus)) {
      query = query.eq("match_status", matchStatus);
    }

    let result = await query;
    if (result.error && isCatchCallLinkSchemaMissing(result.error)) {
      result = await admin
        .from("call_events")
        .select("id,integration_id,provider_event_id,event_type,direction,phone_tail,occurred_at,match_status,matched_guardian:guardians(id,name)")
        .eq("shop_id", owner.shopId)
        .order("occurred_at", { ascending: false })
        .limit(parseLimit(request.nextUrl.searchParams.get("limit"))) as typeof result;
    }
    if (result.error) throw new OwnerApiError("콜아이디 기록을 확인하지 못했습니다.", 500);

    return ownerMobileCorsJson(request, {
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
        matchedGuardian: matchedGuardian
          ? { id: matchedGuardian.id, name: matchedGuardian.name }
          : null,
        };
      }),
    }, undefined, CALL_EVENTS_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) return responseMessage(request, error.message, error.status);
    return responseMessage(request, "콜아이디 기록을 확인하지 못했습니다.", 500);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, CALL_EVENTS_CORS);
}
