import type { CatchCallNotificationStatus } from "@petmanager/shared/contracts/catch-call";

import { dispatchAppointmentNotificationWithLogs } from "@/server/owner-mutations";

type CatchCallAppointment = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
};

type CatchCallNotificationResult = {
  notification: {
    id: string;
    status: string;
  };
  skipped?: boolean;
  alreadyExists?: boolean;
} | null;

export function normalizeCatchCallNotificationStatus(
  result: CatchCallNotificationResult,
): CatchCallNotificationStatus {
  if (!result) return "failed";
  if (result.skipped) return "skipped";
  if (result.notification.status === "sent") return "sent";
  if (result.notification.status === "queued") return "queued";
  if (result.notification.status === "failed") return "failed";
  return result.alreadyExists ? "sent" : "skipped";
}

export async function dispatchCatchCallReservationNotification(appointment: CatchCallAppointment) {
  const result = await dispatchAppointmentNotificationWithLogs({
    shopId: appointment.shop_id,
    appointment,
    type: "booking_confirmed",
    skipIfExists: true,
  });

  return {
    result,
    status: normalizeCatchCallNotificationStatus(result),
    notificationId: result?.notification.id ?? null,
  };
}

/**
 * 공급사가 같은 providerCallId로 보낸 ended 이벤트를 예약 이벤트와 연결합니다.
 * 전화번호·녹음·전사 원문은 조회하지 않습니다.
 */
export async function finalizeCatchCallEndedEvent(params: {
  admin: any;
  shopId: string;
  integrationId: string;
  providerCallId: string;
  endedEventId: string;
}) {
  if (!params.providerCallId) return null;
  const prior = await params.admin
    .from("call_events")
    .select("id,appointment_id,notification_status")
    .eq("shop_id", params.shopId)
    .eq("integration_id", params.integrationId)
    .eq("metadata->>providerCallId", params.providerCallId)
    .neq("id", params.endedEventId)
    .not("appointment_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prior.error || !prior.data?.appointment_id) return null;

  const currentStatus = prior.data.notification_status as CatchCallNotificationStatus | null;
  if (currentStatus === "sent" || currentStatus === "queued" || currentStatus === "skipped") {
    await params.admin
      .from("call_events")
      .update({ appointment_id: prior.data.appointment_id, reservation_status: "confirmed", notification_status: currentStatus })
      .eq("id", params.endedEventId)
      .eq("shop_id", params.shopId);
    return { status: currentStatus, notificationId: null };
  }

  const appointmentResult = await params.admin
    .from("appointments")
    .select("id,shop_id,guardian_id,pet_id")
    .eq("id", prior.data.appointment_id)
    .eq("shop_id", params.shopId)
    .maybeSingle();
  if (appointmentResult.error || !appointmentResult.data) return null;

  const notification = await dispatchCatchCallReservationNotification(appointmentResult.data);
  await params.admin
    .from("call_events")
    .update({ notification_status: notification.status, notification_id: notification.notificationId })
    .eq("id", prior.data.id)
    .eq("shop_id", params.shopId);
  await params.admin
    .from("call_events")
    .update({
      appointment_id: prior.data.appointment_id,
      reservation_status: "confirmed",
      notification_status: notification.status,
      notification_id: notification.notificationId,
    })
    .eq("id", params.endedEventId)
    .eq("shop_id", params.shopId);
  return { status: notification.status, notificationId: notification.notificationId };
}
