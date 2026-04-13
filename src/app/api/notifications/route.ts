import { NextRequest, NextResponse } from "next/server";

import { hasAlimtalkServerEnv, hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";
import { getBootstrap } from "@/server/bootstrap";
import { sendAlimtalkMessage } from "@/server/alimtalk-provider";
import type { ChannelType, NotificationStatus, NotificationType } from "@/types/domain";

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
    const requestedStatus = (body?.status as NotificationStatus | undefined) ?? "queued";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ message: "알림 내용을 입력해 주세요." }, { status: 400 });
    }

    const bootstrap = await getBootstrap(requestedShopId, false);
    const guardian = body?.guardianId ? bootstrap.guardians.find((item) => item.id === body.guardianId) : null;
    const recipientPhone =
      typeof body?.recipientPhone === "string" && body.recipientPhone.trim()
        ? normalizePhone(body.recipientPhone)
        : guardian?.phone
          ? normalizePhone(guardian.phone)
          : "";
    const recipientName =
      typeof body?.recipientName === "string" && body.recipientName.trim()
        ? body.recipientName.trim()
        : guardian?.name ?? null;

    let status: NotificationStatus = requestedStatus;
    let provider = body?.provider ?? (channel === "alimtalk" ? "kakao" : "manual");
    let sentAt: string | null = status === "sent" ? new Date().toISOString() : null;
    let providerMessageId: string | null = null;
    let deliveryError: string | null = null;

    if (channel === "alimtalk") {
      if (!recipientPhone) {
        status = "failed";
        provider = "kakao";
        deliveryError = "알림톡을 보낼 연락처를 찾지 못했습니다.";
      } else if (hasAlimtalkServerEnv()) {
        try {
          const delivery = await sendAlimtalkMessage({
            to: recipientPhone,
            message,
            templateKey: body?.templateKey ?? null,
            recipientName,
            metadata: body?.metadata ?? null,
          });
          status = "sent";
          provider = delivery.provider;
          sentAt = new Date().toISOString();
          providerMessageId = delivery.providerMessageId;
        } catch (error) {
          status = "failed";
          provider = "kakao";
          deliveryError = error instanceof Error ? error.message : "알림톡 발송에 실패했습니다.";
        }
      } else {
        status = hasSupabaseServerEnv() ? "queued" : "mocked";
        provider = "kakao";
      }
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
        status,
        template_key: body?.templateKey ?? null,
        provider,
        metadata: {
          ...(body?.metadata ?? {}),
          recipientPhone: recipientPhone || null,
          recipientName,
          providerMessageId,
          deliveryError,
        },
        sent_at: sentAt,
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
      provider,
      metadata: {
        ...(body?.metadata ?? {}),
        recipientPhone: recipientPhone || null,
        recipientName,
        providerMessageId,
        deliveryError,
      },
      sent_at: sentAt,
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
