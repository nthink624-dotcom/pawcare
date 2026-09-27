import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createAppointment } from "@/server/owner-mutations";
import { dispatchCatchCallReservationNotification } from "@/server/catch-call";
import type { CatchCallNotificationStatus } from "@petmanager/shared/contracts/catch-call";

const reservationSchema = z.object({
  shopId: z.string().trim().min(1),
  petId: z.string().trim().min(1),
  serviceId: z.string().trim().min(1),
  staffId: z.string().trim().nullable().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  memo: z.string().max(2000).optional().default(""),
});

type RouteContext = { params: Promise<{ eventId: string }> };

function errorResponse(request: NextRequest, message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const body = reservationSchema.parse(await request.json());
    const { eventId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) return errorResponse(request, "통화 이벤트를 찾을 수 없습니다.", 404);

    const owner = await requireOwnerShop(request, body.shopId);
    const admin = getSupabaseAdmin();
    if (!admin) return errorResponse(request, "캐치콜 서버 설정을 확인해 주세요.", 503);

    const eventResult = await admin
      .from("call_events")
      .select("id,shop_id,event_type,match_status,matched_guardian_id,appointment_id,reservation_status,notification_status")
      .eq("id", eventId)
      .eq("shop_id", owner.shopId)
      .maybeSingle();
    if (eventResult.error || !eventResult.data) return errorResponse(request, "통화 이벤트를 찾을 수 없습니다.", 404);
    const event = eventResult.data;
    if (event.match_status !== "matched" || !event.matched_guardian_id) {
      return errorResponse(request, "연결된 보호자를 확인한 뒤 예약을 저장해 주세요.", 409);
    }
    if (event.appointment_id) {
      if (event.event_type === "ended" && event.notification_status === "failed") {
        const existingAppointment = await admin
          .from("appointments")
          .select("id,shop_id,guardian_id,pet_id")
          .eq("id", event.appointment_id)
          .eq("shop_id", owner.shopId)
          .maybeSingle();
        if (!existingAppointment.error && existingAppointment.data) {
          const notification = await dispatchCatchCallReservationNotification(existingAppointment.data);
          await admin.from("call_events").update({ notification_status: notification.status, notification_id: notification.notificationId }).eq("id", event.id).eq("shop_id", owner.shopId);
          return NextResponse.json({ ok: true, replayed: true, callEventId: event.id, appointmentId: event.appointment_id, notificationStatus: notification.status });
        }
      }
      return NextResponse.json({
        ok: true,
        replayed: true,
        callEventId: event.id,
        appointmentId: event.appointment_id,
        notificationStatus: event.notification_status ?? "not_requested",
      });
    }

    const claim = await admin
      .from("call_events")
      .update({ reservation_status: "in_progress" })
      .eq("id", event.id)
      .eq("shop_id", owner.shopId)
      .is("appointment_id", null)
      .in("reservation_status", ["not_started", "failed"])
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) return errorResponse(request, "이미 다른 화면에서 통화 예약을 저장하고 있습니다. 잠시 후 다시 확인해 주세요.", 409);

    let appointment;
    try {
      appointment = await createAppointment({
        shopId: owner.shopId,
        guardianId: event.matched_guardian_id,
        petId: body.petId,
        serviceId: body.serviceId,
        staffId: body.staffId ?? null,
        appointmentDate: body.appointmentDate,
        appointmentTime: body.appointmentTime,
        memo: body.memo,
        source: "catchcall",
      });
    } catch (error) {
      await admin.from("call_events").update({ reservation_status: "failed" }).eq("id", event.id).eq("shop_id", owner.shopId).eq("reservation_status", "in_progress");
      throw error;
    }

    const linked = await admin
      .from("call_events")
      .update({ appointment_id: appointment.id, reservation_status: "confirmed", reservation_confirmed_at: new Date().toISOString() })
      .eq("id", event.id)
      .eq("shop_id", owner.shopId)
      .is("appointment_id", null)
      .select("id")
      .maybeSingle();
    if (linked.error || !linked.data) {
      await admin.from("call_events").update({ reservation_status: "failed" }).eq("id", event.id).eq("shop_id", owner.shopId).eq("reservation_status", "in_progress");
      return errorResponse(request, "통화 예약 연결 상태를 확인하지 못했습니다. 예약 중복 여부를 확인해 주세요.", 409);
    }

    let notificationStatus: CatchCallNotificationStatus = "not_requested";
    if (event.event_type === "ended") {
      const notification = await dispatchCatchCallReservationNotification(appointment);
      notificationStatus = notification.status;
      await admin.from("call_events").update({ notification_status: notificationStatus, notification_id: notification.notificationId }).eq("id", event.id).eq("shop_id", owner.shopId);
    }

    return NextResponse.json({ ok: true, replayed: false, callEventId: event.id, appointmentId: appointment.id, notificationStatus });
  } catch (error) {
    if (error instanceof OwnerApiError) return errorResponse(request, error.message, error.status);
    if (error instanceof z.ZodError) return errorResponse(request, "통화 예약 입력 내용을 확인해 주세요.", 400);
    return errorResponse(request, error instanceof Error ? error.message : "통화 예약을 저장하지 못했습니다.", 400);
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
}
