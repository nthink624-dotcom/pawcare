import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import type { ChannelType, NotificationStatus, NotificationType } from "@/types/domain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedShopId = body?.shopId as string | undefined;

    if (!requestedShopId) {
      return NextResponse.json({ message: "매장 정보가 필요합니다." }, { status: 400 });
    }

    if (hasSupabaseServerEnv()) {
      await requireOwnerShop(request, requestedShopId);
    }

    const type = (body?.type as NotificationType | undefined) ?? "booking_confirmed";
    const channel = (body?.channel as ChannelType | undefined) ?? "alimtalk";
    const status = (body?.status as NotificationStatus | undefined) ?? "queued";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ message: "알림 내용을 입력해 주세요." }, { status: 400 });
    }

    if (!hasSupabaseServerEnv()) {
      return NextResponse.json({
        id: `mock-${Date.now()}`,
        shop_id: requestedShopId,
        appointment_id: body?.appointmentId ?? null,
        pet_id: body?.petId ?? null,
        guardian_id: body?.guardianId ?? null,
        type,
        channel,
        message,
        status: "mocked",
        template_key: body?.templateKey ?? null,
        provider: "mock",
        metadata: body?.metadata ?? null,
        sent_at: null,
        created_at: new Date().toISOString(),
      });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ message: "알림 연결을 확인할 수 없습니다." }, { status: 503 });
    }

    const insertPayload = {
      shop_id: requestedShopId,
      appointment_id: body?.appointmentId ?? null,
      pet_id: body?.petId ?? null,
      guardian_id: body?.guardianId ?? null,
      type,
      channel,
      message,
      status,
      template_key: body?.templateKey ?? null,
      provider: body?.provider ?? (channel === "alimtalk" ? "kakao" : "manual"),
      metadata: body?.metadata ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    };

    const result = await admin.from("notifications").insert(insertPayload).select("*").single();
    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "알림 발송을 처리하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
