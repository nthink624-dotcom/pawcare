import { randomUUID } from "node:crypto";

import { hasAlimtalkServerEnv, hasSupabaseServerEnv } from "@/lib/server-env";
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

function getTemplateKey(type: NotificationType) {
  switch (type) {
    case "booking_confirmed":
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

function buildNotificationMessage(params: {
  type: NotificationType;
  shopName: string;
  appointment: Appointment | null;
  petName: string;
  rejectionReason: string | null;
}) {
  const dateLabel =
    params.appointment
      ? `${shortDate(params.appointment.appointment_date)} ${formatClockTime(params.appointment.appointment_time)}`
      : "";

  switch (params.type) {
    case "booking_confirmed":
      return `[${params.shopName}] ${params.petName} booking confirmed for ${dateLabel}.`;
    case "booking_rejected":
      return `[${params.shopName}] ${params.petName} booking could not be accepted.${params.rejectionReason ? ` Reason: ${params.rejectionReason}` : ""}`;
    case "booking_cancelled":
      return `[${params.shopName}] ${params.petName} booking has been cancelled.`;
    case "booking_rescheduled_confirmed":
      return `[${params.shopName}] ${params.petName} booking changed to ${dateLabel}.`;
    case "appointment_reminder_10m":
      return `[${params.shopName}] ${params.petName} booking starts soon. Please check your visit time: ${dateLabel}.`;
    case "grooming_started":
      return `[${params.shopName}] ${params.petName} grooming has started.`;
    case "grooming_almost_done":
      return `[${params.shopName}] ${params.petName} is almost ready for pickup.`;
    case "grooming_completed":
      return `[${params.shopName}] ${params.petName} grooming is complete. Pickup is available now.`;
    case "revisit_notice":
      return `[${params.shopName}] It may be time to book ${params.petName}'s next visit.`;
    case "birthday_greeting":
      return `[${params.shopName}] Happy birthday to ${params.petName}.`;
    default:
      return `[${params.shopName}] Notification.`;
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
  const bootstrap = await getBootstrap(input.shopId, false);
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

  if (input.skipIfExists && hasExistingNotification(bootstrap.notifications, input)) {
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
  const templateKey = input.templateKey ?? getTemplateKey(input.type);
  const templateType = input.templateType ?? input.type;
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
    });

  let status: NotificationStatus = "queued";
  let provider = input.channel === "mock" ? "mock" : bootstrap.mode === "supabase" ? "kakao" : "mock";
  let sentAt: string | null = null;
  let failReason: string | null = null;
  let providerMessageId: string | null = null;
  const scheduledAt = input.scheduledAt ?? null;
  const shouldSendNow = !scheduledAt || new Date(scheduledAt).getTime() <= Date.now();
  const canSend = input.force ? true : shouldSendNotification(bootstrap.shop, input.type);

  if (!canSend) {
    status = "skipped";
    failReason = "Notification disabled by shop settings.";
  } else if (!recipientPhone) {
    status = "failed";
    failReason = "Recipient phone number not found.";
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
    const bootstrap = await getBootstrap(shop.id, false);

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
