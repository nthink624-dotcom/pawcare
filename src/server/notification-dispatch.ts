import { randomUUID } from "node:crypto";

import { hasAlimtalkServerEnv, hasSupabaseServerEnv, resolveAlimtalkTemplateKey, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatClockTime, nowIso, phoneNormalize, shortDate } from "@/lib/utils";
import { buildBookingManageUrl, createBookingAccessToken } from "@/server/booking-access-token";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { sendAlimtalkMessage } from "@/server/alimtalk-provider";
import type {
  Appointment,
  BootstrapPayload,
  ChannelType,
  Notification,
  NotificationStatus,
  NotificationType,
} from "@/types/domain";

type NotificationMetadata = Record<string, string | boolean | number | null | undefined>;

type DispatchNotificationInput = {
  shopId: string;
  type: NotificationType;
  channel?: ChannelType;
  appointmentId?: string | null;
  guardianId?: string | null;
  petId?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  templateKey?: string | null;
  templateType?: string | null;
  message?: string | null;
  metadata?: NotificationMetadata | null;
  scheduledAt?: string | null;
  skipIfExists?: boolean;
  force?: boolean;
};

type DispatchNotificationResult = {
  notification: Notification;
  skipped: boolean;
  alreadyExists: boolean;
};

function normalizePhone(value: string) {
  return phoneNormalize(value).slice(0, 11);
}

function getPhoneTail(value: string | null | undefined) {
  const normalized = phoneNormalize(value ?? "");
  return normalized ? normalized.slice(-4) : null;
}

function logNotificationSkipped(params: {
  reason: string;
  type: NotificationType;
  appointmentId: string | null | undefined;
}) {
  console.log("[notification-dispatch] skipped", {
    reason: params.reason,
    type: params.type,
    appointmentId: params.appointmentId ?? null,
  });
}

function getTemplateKey(type: NotificationType) {
  switch (type) {
    case "booking_received":
    case "booking_confirmed":
    case "owner_booking_requested":
    case "booking_rejected":
    case "booking_cancelled":
    case "booking_rescheduled_confirmed":
    case "appointment_reminder_10m":
    case "grooming_started":
    case "grooming_almost_done":
    case "grooming_completed":
    case "revisit_notice":
    case "birthday_greeting":
      return type;
    default:
      return null;
  }
}

function shouldSendNotification(shop: BootstrapPayload["shop"], type: NotificationType) {
  if (!shop.notification_settings.enabled) return false;

  switch (type) {
    case "booking_received":
    case "owner_booking_requested":
      return true;
    case "booking_confirmed":
      return shop.notification_settings.booking_confirmed_enabled;
    case "booking_rejected":
      return shop.notification_settings.booking_rejected_enabled;
    case "booking_cancelled":
      return shop.notification_settings.booking_cancelled_enabled;
    case "booking_rescheduled_confirmed":
      return shop.notification_settings.booking_rescheduled_enabled;
    case "grooming_almost_done":
      return shop.notification_settings.grooming_almost_done_enabled;
    case "grooming_completed":
      return shop.notification_settings.grooming_completed_enabled;
    case "appointment_reminder_10m":
    case "grooming_started":
    case "revisit_notice":
    case "birthday_greeting":
      return true;
    default:
      return false;
  }
}

function shouldSendGuardianNotification(
  guardian: BootstrapPayload["guardians"][number] | null,
  type: NotificationType,
) {
  if (!guardian) return true;
  if (!guardian.notification_settings.enabled) return false;

  switch (type) {
    case "revisit_notice":
      return guardian.notification_settings.revisit_enabled;
    default:
      return true;
  }
}

function buildNotificationMessage(params: {
  type: NotificationType;
  shopName: string;
  appointment: Appointment | null;
  petName: string;
  rejectionReason: string | null;
  bookingManageUrl: string | null;
}) {
  const dateLabel =
    params.appointment
      ? `${shortDate(params.appointment.appointment_date)} ${formatClockTime(params.appointment.appointment_time)}`
      : "";

  switch (params.type) {
    case "booking_received":
      return [
        `[${params.shopName}] ${params.petName} 예약이 접수되었어요.`,
        `방문 일정: ${dateLabel}`,
        "",
        "매장에서 예약을 확인한 뒤 확정 알림을 보내드릴게요.",
        "",
        "예약 정보는 아래 링크에서 확인하실 수 있어요.",
        params.bookingManageUrl ?? "",
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "owner_booking_requested":
      return `새 예약이 접수되었어요.\n${params.petName}\n${dateLabel}`;
    case "booking_confirmed":
      return `[${params.shopName}] ${params.petName} 예약이 확정되었어요.\n방문 일정: ${dateLabel}`;
    case "booking_rejected":
      return `[${params.shopName}] ${params.petName} 예약이 접수되지 않았어요.${params.rejectionReason ? `\n사유: ${params.rejectionReason}` : ""}`;
    case "booking_cancelled":
      return `[${params.shopName}] ${params.petName} 예약이 취소되었어요.`;
    case "booking_rescheduled_confirmed":
      return `[${params.shopName}] ${params.petName} 예약 일정이 변경되었어요.\n변경 일정: ${dateLabel}`;
    case "appointment_reminder_10m":
      return `[${params.shopName}] ${params.petName} 예약이 곧 시작돼요.\n방문 일정: ${dateLabel}`;
    case "grooming_started":
      return `[${params.shopName}] ${params.petName} 미용이 시작되었어요.`;
    case "grooming_almost_done":
      return [
        `[${params.shopName}]`,
        `${params.petName} 미용이 곧 끝나요`,
        "",
        "마무리 단계라 곧 픽업 가능하세요.",
        "",
        "잠시 후 픽업하실 수 있어요.",
        "",
        "예약 정보는 아래 링크에서 확인하실 수 있어요.",
        params.bookingManageUrl ?? "",
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "grooming_completed":
      return `[${params.shopName}] ${params.petName} 미용이 완료되었어요.\n지금 픽업하실 수 있어요.`;
    case "revisit_notice":
      return `[${params.shopName}] ${params.petName} 재방문 시기가 가까워졌어요.`;
    case "birthday_greeting":
      return `[${params.shopName}] ${params.petName}의 생일을 축하드려요.`;
    default:
      return `[${params.shopName}] 알림을 확인해 주세요.`;
  }
}

function hasExistingNotification(
  notifications: Notification[],
  input: Pick<DispatchNotificationInput, "type" | "appointmentId" | "guardianId" | "petId">,
) {
  return notifications.some((item) => {
    const sameType = item.type === input.type;
    const sameAppointment = (item.appointment_id ?? null) === (input.appointmentId ?? null);
    const sameGuardian = (item.guardian_id ?? null) === (input.guardianId ?? null);
    const samePet = (item.pet_id ?? null) === (input.petId ?? null);
    const alreadyHandled = item.status === "sent" || item.status === "queued" || item.status === "mocked";
    return sameType && sameAppointment && sameGuardian && samePet && alreadyHandled;
  });
}

export async function dispatchNotification(input: DispatchNotificationInput): Promise<DispatchNotificationResult> {
  const bootstrap = await getBootstrap(input.shopId);
  const appointment =
    input.appointmentId ? bootstrap.appointments.find((item) => item.id === input.appointmentId) ?? null : null;
  const guardian =
    input.guardianId
      ? bootstrap.guardians.find((item) => item.id === input.guardianId) ?? null
      : appointment
        ? bootstrap.guardians.find((item) => item.id === appointment.guardian_id) ?? null
        : null;
  const pet =
    input.petId
      ? bootstrap.pets.find((item) => item.id === input.petId) ?? null
      : appointment
        ? bootstrap.pets.find((item) => item.id === appointment.pet_id) ?? null
        : null;
  const service =
    appointment ? bootstrap.services.find((item) => item.id === appointment.service_id) ?? null : null;
  const target = input.type === "owner_booking_requested" || (input.channel ?? "alimtalk") === "in_app" ? "owner" : "guardian";
  const initialPhoneTail = getPhoneTail(input.recipientPhone) ?? getPhoneTail(guardian?.phone ?? null);

  console.log("[notification-dispatch] called", {
    type: input.type,
    appointmentId: input.appointmentId ?? appointment?.id ?? null,
    target,
    phoneTail: initialPhoneTail,
  });

  if (input.skipIfExists && hasExistingNotification(bootstrap.notifications, input)) {
    logNotificationSkipped({
      reason: "already exists",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
    const existing = bootstrap.notifications.find(
      (item) =>
        item.type === input.type &&
        (item.appointment_id ?? null) === (input.appointmentId ?? null) &&
        (item.guardian_id ?? null) === (input.guardianId ?? guardian?.id ?? null) &&
        (item.pet_id ?? null) === (input.petId ?? pet?.id ?? null),
    );

    return {
      notification:
        existing ??
        ({
          id: "existing",
          shop_id: input.shopId,
          appointment_id: input.appointmentId ?? null,
          pet_id: input.petId ?? pet?.id ?? null,
          guardian_id: input.guardianId ?? guardian?.id ?? null,
          type: input.type,
          channel: input.channel ?? "alimtalk",
          message: input.message ?? "",
          status: "skipped",
          created_at: nowIso(),
          sent_at: null,
        } as Notification),
      skipped: true,
      alreadyExists: true,
    };
  }

  const recipientPhone = input.recipientPhone?.trim()
    ? normalizePhone(input.recipientPhone)
    : guardian?.phone
      ? normalizePhone(guardian.phone)
      : "";
  const recipientName = input.recipientName?.trim() ? input.recipientName.trim() : guardian?.name ?? null;
  const templateAlias = (input.channel ?? "alimtalk") === "in_app" ? null : input.templateKey ?? getTemplateKey(input.type);
  const templateKey = resolveAlimtalkTemplateKey(templateAlias);
  const templateType = input.templateType ?? "alimtalk";
  const usesAlimtalkRelay = Boolean(serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret);
  const bookingAccessToken =
    guardian?.id && pet?.id
      ? createBookingAccessToken({
          shopId: input.shopId,
          guardianId: guardian.id,
          petId: pet.id,
        })
      : null;
  const bookingManageUrl =
    bookingAccessToken ? buildBookingManageUrl(input.shopId, bookingAccessToken) : null;
  const message =
    input.message?.trim() ||
    buildNotificationMessage({
      type: input.type,
      shopName: bootstrap.shop.name,
      appointment,
      petName: pet?.name ?? "pet",
      rejectionReason: appointment?.rejection_reason ?? null,
      bookingManageUrl,
    });

  let status: NotificationStatus = "queued";
  let provider = input.channel === "mock" ? "mock" : bootstrap.mode === "supabase" ? "kakao" : "mock";
  let sentAt: string | null = null;
  let failReason: string | null = null;
  let providerMessageId: string | null = null;
  const scheduledAt = input.scheduledAt ?? null;
  const shouldSendNow = !scheduledAt || new Date(scheduledAt).getTime() <= Date.now();
  const canSendShop = input.force ? true : shouldSendNotification(bootstrap.shop, input.type);
  const canSendGuardian = input.force ? true : shouldSendGuardianNotification(guardian, input.type);
  const canSend = canSendShop && canSendGuardian;

  if (input.appointmentId && !appointment) {
    logNotificationSkipped({
      reason: "missing appointment",
      type: input.type,
      appointmentId: input.appointmentId,
    });
  }

  if ((input.guardianId || appointment?.guardian_id) && !guardian) {
    logNotificationSkipped({
      reason: "missing guardian",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  }

  if ((input.channel ?? "alimtalk") !== "in_app" && !templateAlias) {
    logNotificationSkipped({
      reason: "unsupported notification type",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  }

  if (!canSend) {
    status = "skipped";
    failReason = !canSendShop
      ? "Notification disabled by shop settings."
      : input.type === "revisit_notice"
        ? "Notification disabled by guardian revisit settings."
        : "Notification disabled by guardian settings.";
    logNotificationSkipped({
      reason: !canSendShop ? "notification disabled" : "customer notification setting off",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  } else if ((input.channel ?? "alimtalk") !== "in_app" && !recipientPhone) {
    status = "failed";
    failReason = "Recipient phone number not found.";
    logNotificationSkipped({
      reason: "missing phone",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  } else if ((input.channel ?? "alimtalk") === "in_app") {
    status = "sent";
    provider = "in_app";
    sentAt = nowIso();
  } else if (
    (input.channel ?? "alimtalk") === "alimtalk" &&
    serverEnv.alimtalkProvider === "ssodaa" &&
    !usesAlimtalkRelay &&
    !templateKey
  ) {
    status = "failed";
    failReason = `Missing Alimtalk template mapping for ${input.type}.`;
    logNotificationSkipped({
      reason: "missing template alias",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  } else if (!shouldSendNow) {
    status = "queued";
  } else if ((input.channel ?? "alimtalk") === "alimtalk") {
    if (bootstrap.mode !== "supabase") {
      status = "mocked";
      provider = "mock";
      sentAt = nowIso();
    } else if (hasAlimtalkServerEnv()) {
      try {
        const delivery = await sendAlimtalkMessage({
          to: recipientPhone,
          message,
          templateAlias,
          templateKey,
          templateType,
          recipientName,
          metadata: input.metadata ?? null,
        });
        status = "sent";
        provider = delivery.provider;
        providerMessageId = delivery.providerMessageId;
        sentAt = nowIso();
      } catch (error) {
        status = "failed";
        failReason = error instanceof Error ? error.message : "Alimtalk send failed.";
      }
    } else {
      status = "queued";
      failReason = "Alimtalk server environment is not configured yet.";
      logNotificationSkipped({
        reason: "no alimtalk payload",
        type: input.type,
        appointmentId: input.appointmentId ?? appointment?.id ?? null,
      });
    }
  } else {
    status = bootstrap.mode === "supabase" ? "queued" : "mocked";
    sentAt = status === "mocked" ? nowIso() : null;
  }

  const notification: Notification = {
    id: randomUUID(),
    shop_id: input.shopId,
    appointment_id: input.appointmentId ?? appointment?.id ?? null,
    pet_id: input.petId ?? pet?.id ?? null,
    guardian_id: input.guardianId ?? guardian?.id ?? null,
    type: input.type,
    channel: input.channel ?? "alimtalk",
    message,
    status,
    template_key: templateKey ?? null,
    template_type: templateType,
    provider,
    provider_message_id: providerMessageId,
    recipient_phone: recipientPhone || null,
    fail_reason: failReason,
    scheduled_at: scheduledAt,
    metadata: {
      ...(input.metadata ?? {}),
      recipientName,
      serviceName: service?.name ?? null,
      bookingManageUrl,
    },
    sent_at: sentAt,
    created_at: nowIso(),
  };

  if (!hasSupabaseServerEnv() || bootstrap.mode !== "supabase") {
    const store = getMockStore();
    store.notifications = [notification, ...store.notifications];
    setMockStore(store);
    return { notification, skipped: status === "skipped", alreadyExists: false };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Notification server connection is unavailable.");
  }

  const insertPayload = {
    id: notification.id,
    shop_id: notification.shop_id,
    appointment_id: notification.appointment_id,
    pet_id: notification.pet_id,
    guardian_id: notification.guardian_id,
    type: notification.type,
    channel: notification.channel,
    message: notification.message,
    status: notification.status,
    template_key: notification.template_key ?? null,
    template_type: notification.template_type ?? null,
    provider: notification.provider ?? null,
    provider_message_id: notification.provider_message_id ?? null,
    recipient_phone: notification.recipient_phone ?? null,
    fail_reason: notification.fail_reason ?? null,
    scheduled_at: notification.scheduled_at ?? null,
    metadata: notification.metadata ?? null,
    sent_at: notification.sent_at,
    created_at: notification.created_at,
  };

  const result = await admin.from("notifications").insert(insertPayload).select("*").single();
  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    notification: result.data as Notification,
    skipped: status === "skipped",
    alreadyExists: false,
  };
}

export async function runScheduledNotificationDispatch() {
  if (!hasSupabaseServerEnv()) {
    return {
      reminderQueued: 0,
      almostDoneQueued: 0,
      processed: 0,
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Notification scheduler server connection is unavailable.");
  }

  const shopsResult = await admin.from("shops").select("id");
  if (shopsResult.error) {
    throw new Error(shopsResult.error.message);
  }

  const now = Date.now();
  const reminderDeadline = now + 10 * 60 * 1000;
  const almostDoneDeadline = now + 5 * 60 * 1000;

  let reminderQueued = 0;
  let almostDoneQueued = 0;

  for (const shop of shopsResult.data ?? []) {
    const bootstrap = await getBootstrap(shop.id);

    for (const appointment of bootstrap.appointments) {
      const startTime = new Date(appointment.start_at).getTime();
      const endTime = new Date(appointment.end_at).getTime();

      if (
        ["pending", "confirmed"].includes(appointment.status) &&
        startTime > now &&
        startTime <= reminderDeadline
      ) {
        const result = await dispatchNotification({
          shopId: bootstrap.shop.id,
          type: "appointment_reminder_10m",
          appointmentId: appointment.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
          scheduledAt: appointment.start_at,
          skipIfExists: true,
        });
        if (!result.skipped && !result.alreadyExists) reminderQueued += 1;
      }

      if (
        appointment.status === "in_progress" &&
        endTime > now &&
        endTime <= almostDoneDeadline
      ) {
        const result = await dispatchNotification({
          shopId: bootstrap.shop.id,
          type: "grooming_almost_done",
          appointmentId: appointment.id,
          guardianId: appointment.guardian_id,
          petId: appointment.pet_id,
          scheduledAt: appointment.end_at,
          skipIfExists: true,
        });
        if (!result.skipped && !result.alreadyExists) almostDoneQueued += 1;
      }
    }
  }

  return {
    reminderQueued,
    almostDoneQueued,
    processed: reminderQueued + almostDoneQueued,
  };
}
