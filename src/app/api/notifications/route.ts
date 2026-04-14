import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { ChannelType, NotificationType } from "@/types/domain";

function normalizePhone(value: string) {
  return value.replace(/[^0-9]/g, "");
}

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
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message && !body?.appointmentId && !body?.guardianId && !body?.petId) {
      return NextResponse.json({ message: "알림 내용을 입력해 주세요." }, { status: 400 });
    }

    const result = await dispatchNotification({
      shopId: requestedShopId,
      appointmentId: body?.appointmentId ?? null,
      guardianId: body?.guardianId ?? null,
      petId: body?.petId ?? null,
      type,
      channel,
      recipientPhone:
        typeof body?.recipientPhone === "string" && body.recipientPhone.trim()
          ? normalizePhone(body.recipientPhone)
          : null,
      recipientName:
        typeof body?.recipientName === "string" && body.recipientName.trim() ? body.recipientName.trim() : null,
      templateKey: body?.templateKey ?? null,
      templateType: body?.templateType ?? null,
      message: message || null,
      metadata: body?.metadata ?? null,
      scheduledAt: body?.scheduledAt ?? null,
      force: body?.force === true || body?.status === "sent" || !hasSupabaseServerEnv(),
      skipIfExists: body?.skipIfExists === true,
    });

    return NextResponse.json(result.notification);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "알림 발송을 처리하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
