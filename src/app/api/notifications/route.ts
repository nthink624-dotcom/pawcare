import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { getMockStore, setMockStore } from "@/server/mock-store";
import { sendNotification } from "@/server/notifications";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getOwnerRouteAccess } from "@/server/owner-auth";

export async function POST(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const notice = await sendNotification({
      shop_id: access.context.shopId,
      appointment_id: body.appointmentId || null,
      pet_id: body.petId || null,
      guardian_id: body.guardianId || null,
      type: body.type,
      channel: "mock",
      message: body.message,
      status: "mocked",
      sent_at: null,
    });

    if (!hasSupabaseEnv()) {
      const store = getMockStore();
      store.notifications = [notice, ...store.notifications];
      setMockStore(store);
      return NextResponse.json(notice);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase 연결이 없습니다.");
    const payload = { ...notice, id: randomUUID() };
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) throw new Error(error.message);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "알림을 저장하지 못했습니다." }, { status: 400 });
  }
}
