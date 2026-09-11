import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: NextRequest) {
  try {
    const requestedShopId = new URL(request.url).searchParams.get("shopId") || undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return jsonNoStore({ notifications: [] });
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

    return jsonNoStore({
      notifications: (result.data ?? []).map((notification) => ({
        id: notification.id,
        appointmentId: notification.appointment_id,
      })),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 알림을 확인하지 못했습니다.";
    return jsonNoStore({ message }, { status: 500 });
  }
}
