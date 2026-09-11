import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(request: NextRequest, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return ownerMobileCorsJson(request, body, { ...init, headers });
}

export async function GET(request: NextRequest) {
  try {
    const requestedShopId = new URL(request.url).searchParams.get("shopId") || undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return jsonNoStore(request, { notifications: [] });
    }

    const result = await supabase
      .from("notifications")
      .select("id,appointment_id")
      .eq("shop_id", owner.shopId)
      .eq("type", "owner_booking_requested")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(50);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return jsonNoStore(request, {
      notifications: (result.data ?? []).map((notification) => ({
        id: notification.id,
        appointmentId: notification.appointment_id,
      })),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 알림을 확인하지 못했습니다.";
    return jsonNoStore(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
