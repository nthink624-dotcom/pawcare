import { createHash, randomUUID } from "node:crypto";

import {
  getAlimtalkTemplateAlias,
  shouldSendByGuardianSettings,
  shouldSendByShopSettings,
} from "@/lib/notification-registry";
import {
  getConfiguredAlimtalkTemplateKey,
  hasAlimtalkServerEnv,
  hasSupabaseServerEnv,
  resolveAlimtalkTemplateKey,
  serverEnv,
} from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { formatClockTime, nowIso, phoneNormalize, shortDate } from "@/lib/utils";
import { renderNotificationTemplateBodyWithOverrides } from "@/server/alimtalk-template-overrides";
import {
  buildBookingEntryUrl,
  buildBookingManageUrl,
  createBookingAccessToken,
} from "@/server/booking-access-token";
import { getBootstrap } from "@/server/bootstrap";
import { getMockStore, setMockStore } from "@/server/mock-store";
import { sendAlimtalkMessage, type AlimtalkButton, type AlimtalkMediaAttachment } from "@/server/alimtalk-provider";
import {
  refundShopAlimtalkCredit,
  reserveShopAlimtalkCredit,
  type AlimtalkCreditReservation,
} from "@/server/alimtalk-credit-service";
import { markNotificationMediaDeliveryResult } from "@/server/media-delivery-service";
import { attachMediaToNotification, getOwnerMediaSignedUrl } from "@/server/media-service";
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
  mediaAssetIds?: string[] | null;
  scheduledAt?: string | null;
  skipIfExists?: boolean;
  force?: boolean;
};

type DispatchNotificationResult = {
  notification: Notification;
  skipped: boolean;
  alreadyExists: boolean;
};

const abuseHandledStatuses = new Set<NotificationStatus>(["queued", "sent", "mocked"]);

const oneShotAppointmentNotificationTypes = new Set<NotificationType>([
  "booking_received",
  "booking_confirmed",
  "owner_booking_requested",
  "booking_rejected",
  "booking_cancelled",
  "appointment_reminder_10m",
  "grooming_started",
  "grooming_almost_done",
  "grooming_completed",
]);

const snapshotAppointmentNotificationTypes = new Set<NotificationType>([
  "booking_rescheduled_confirmed",
  "booking_time_proposed",
]);

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

function getNotificationMetadata(item: Notification) {
  return item.metadata ?? {};
}

function getAppointmentSnapshotKey(appointment: Appointment | null) {
  if (!appointment) return "no-appointment";
  return [
    appointment.appointment_date,
    appointment.appointment_time,
    appointment.service_id,
    appointment.staff_id ?? "no-staff",
  ].join("|");
}

function getMessageFingerprint(message: string) {
  return createHash("sha256").update(message.trim().replace(/\s+/g, " ")).digest("hex").slice(0, 16);
}

function buildAbuseDedupeKey(params: {
  type: NotificationType;
  appointment: Appointment | null;
  guardianId: string | null;
  petId: string | null;
  recipientPhone: string;
  message: string;
  scheduledAt: string | null;
}) {
  const appointmentId = params.appointment?.id ?? null;
  if (appointmentId && oneShotAppointmentNotificationTypes.has(params.type)) {
    return `appointment:${appointmentId}:type:${params.type}`;
  }

  if (appointmentId && snapshotAppointmentNotificationTypes.has(params.type)) {
    return `appointment:${appointmentId}:type:${params.type}:snapshot:${getAppointmentSnapshotKey(params.appointment)}`;
  }

  if (appointmentId) {
    return `appointment:${appointmentId}:type:${params.type}:scheduled:${params.scheduledAt ?? "now"}`;
  }

  const recipientKey = params.guardianId || params.petId || params.recipientPhone;
  if (!recipientKey || !params.message.trim()) return null;
  return `manual:${params.type}:recipient:${recipientKey}:message:${getMessageFingerprint(params.message)}`;
}

function getDuplicateBlockMessage(type: NotificationType) {
  switch (type) {
    case "grooming_started":
      return "이미 이 예약의 미용 시작 알림을 보냈거나 발송 대기 중입니다. 미용 시작은 예약 건당 한 번만 보낼 수 있어요.";
    case "grooming_almost_done":
      return "이미 이 예약의 픽업 준비 알림을 보냈거나 발송 대기 중입니다. 픽업 준비 알림은 예약 건당 한 번만 보낼 수 있어요.";
    case "grooming_completed":
      return "이미 이 예약의 미용 완료 알림을 보냈거나 발송 대기 중입니다. 완료 알림은 예약 건당 한 번만 보낼 수 있어요.";
    case "booking_confirmed":
      return "이미 이 예약의 확정 알림을 보냈거나 발송 대기 중입니다. 같은 예약 확정 알림은 반복 발송할 수 없어요.";
    case "booking_rescheduled_confirmed":
      return "이미 같은 예약 일정으로 변경 완료 알림을 보냈거나 발송 대기 중입니다. 일정이 실제로 바뀐 경우에만 다시 보낼 수 있어요.";
    case "booking_rejected":
      return "이미 이 예약의 거절 알림을 보냈거나 발송 대기 중입니다.";
    case "booking_cancelled":
      return "이미 이 예약의 취소 알림을 보냈거나 발송 대기 중입니다.";
    default:
      return "이미 같은 예약/고객/내용의 알림을 보냈거나 발송 대기 중입니다. 중복 발송은 차단했어요.";
  }
}

function evaluateNotificationAbusePolicy(params: {
  notifications: Notification[];
  type: NotificationType;
  appointment: Appointment | null;
  guardianId: string | null;
  petId: string | null;
  recipientPhone: string;
  message: string;
  scheduledAt: string | null;
}) {
  const dedupeKey = buildAbuseDedupeKey({
    type: params.type,
    appointment: params.appointment,
    guardianId: params.guardianId,
    petId: params.petId,
    recipientPhone: params.recipientPhone,
    message: params.message,
    scheduledAt: params.scheduledAt,
  });

  if (!dedupeKey) {
    return { blocked: false, dedupeKey: null, reason: null, existingNotificationId: null };
  }

  const duplicate: Notification | undefined = params.notifications.find((item) => {
    if (!abuseHandledStatuses.has(item.status)) return false;
    const metadata = getNotificationMetadata(item);
    if (metadata.abuseDedupeKey === dedupeKey) return true;

    const appointmentId = params.appointment?.id ?? null;
    if (!appointmentId || item.type !== params.type) return false;
    if ((item.appointment_id ?? null) !== appointmentId) return false;

    if (snapshotAppointmentNotificationTypes.has(params.type)) {
      return metadata.appointmentSnapshotKey === getAppointmentSnapshotKey(params.appointment);
    }

    return oneShotAppointmentNotificationTypes.has(params.type);
  });

  if (!duplicate) {
    return { blocked: false, dedupeKey, reason: null, existingNotificationId: null };
  }

  return {
    blocked: true,
    dedupeKey,
    reason: getDuplicateBlockMessage(params.type),
    existingNotificationId: duplicate.id,
  };
}

function getTemplateKey(type: NotificationType) {
  return getAlimtalkTemplateAlias(type);
}

function shouldSendNotification(shop: BootstrapPayload["shop"], type: NotificationType) {
  return shouldSendByShopSettings(shop.notification_settings, type) ?? false;
}

function shouldSendGuardianNotification(
  guardian: BootstrapPayload["guardians"][number] | null,
  type: NotificationType,
) {
  if (!guardian) return true;
  return shouldSendByGuardianSettings(guardian.notification_settings, type) ?? true;
}

function getAlimtalkSenderConfig(shop: BootstrapPayload["shop"]) {
  const settings = shop.notification_settings;
  const canUseShopChannel =
    settings.alimtalk_sender_mode === "shop_channel" &&
    settings.alimtalk_shop_channel_status === "active" &&
    Boolean(settings.alimtalk_sender_profile_key?.trim());

  return {
    mode: canUseShopChannel ? "shop_channel" : "petmanager",
    requestedMode: settings.alimtalk_sender_mode,
    status: settings.alimtalk_shop_channel_status,
    senderProfileKey: canUseShopChannel ? settings.alimtalk_sender_profile_key?.trim() ?? null : null,
    channelName: settings.alimtalk_shop_channel_name?.trim() || shop.name,
    channelUrl: settings.alimtalk_shop_channel_url?.trim() || null,
  } as const;
}

function normalizeMediaAssetIds(value: string[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))).slice(0, 10);
}

function getRelayEndpointUrl(pathname: string) {
  if (!serverEnv.alimtalkRelayUrl) return null;

  const parsed = new URL(serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl);
  parsed.pathname = pathname;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function isRelayTemplateConfigured(alias: string | null | undefined) {
  if (!alias || !serverEnv.alimtalkRelayUrl || !serverEnv.alimtalkRelaySecret) return false;

  const url = getRelayEndpointUrl("/debug/templates");
  if (!url) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-relay-secret": serverEnv.alimtalkRelaySecret,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const body = (await response.json()) as {
      templates?: Record<string, { configured?: boolean } | undefined>;
    };
    return Boolean(body.templates?.[alias]?.configured);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildNotificationMediaAttachments(params: {
  shopId: string;
  mediaAssetIds: string[];
}) {
  const attachments: AlimtalkMediaAttachment[] = [];

  for (const mediaAssetId of params.mediaAssetIds) {
    const signed = await getOwnerMediaSignedUrl(
      {
        shopId: params.shopId,
        userId: null,
      },
      {
        mediaAssetId,
        variantKey: "provider_ready",
      },
    );

    attachments.push({
      mediaAssetId: signed.mediaAsset.id,
      role:
        signed.mediaAsset.media_kind === "grooming_before"
          ? "before_photo"
          : signed.mediaAsset.media_kind === "grooming_after"
            ? "after_photo"
            : "result_photo",
      url: signed.signedUrl,
      contentType: signed.variant?.content_type ?? signed.mediaAsset.content_type,
      byteSize: signed.variant?.byte_size ?? signed.mediaAsset.byte_size,
      variantKey: signed.variant?.variant_key ?? "original",
      expiresInSeconds: signed.expiresInSeconds,
      metadata: {
        width: signed.variant?.width ?? signed.mediaAsset.width,
        height: signed.variant?.height ?? signed.mediaAsset.height,
      },
    });
  }

  return attachments;
}

function legacyBuildBookingLinksBlock(params: {
  bookingEntryUrl: string | null;
  bookingManageUrl: string | null;
}) {
  const lines: string[] = [];

  if (params.bookingEntryUrl) {
    lines.push("예약 링크", params.bookingEntryUrl);
  }

  if (params.bookingManageUrl) {
    lines.push("예약 확인 링크", params.bookingManageUrl);
  }

  return lines.join("\n");
}

function legacyBuildNotificationMessage(params: {
  type: NotificationType;
  shopName: string;
  appointment: Appointment | null;
  petName: string;
  recipientName: string | null;
  serviceName: string | null;
  rejectionReason: string | null;
  bookingEntryUrl: string | null;
  bookingManageUrl: string | null;
}) {
  const dateLabel =
    params.appointment
      ? `${shortDate(params.appointment.appointment_date)} ${formatClockTime(params.appointment.appointment_time)}`
      : "";
  const bookingLinksBlock = legacyBuildBookingLinksBlock({
    bookingEntryUrl: params.bookingEntryUrl,
    bookingManageUrl: params.bookingManageUrl,
  });

  switch (params.type) {
    case "booking_received":
      return [
        `[${params.shopName}] ${params.petName} 예약이 접수되었어요.`,
        `방문 일정: ${dateLabel}`,
        "",
        "매장에서 예약을 확인한 뒤 확정 알림을 보내드릴게요.",
        "",
        "예약 정보는 아래 링크에서 확인하실 수 있어요.",
        bookingLinksBlock,
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
      return [
        `[${params.shopName}]`,
        `${params.petName} 보호자님, 예약이 확정되었어요. (방긋)`,
        "",
        `방문 일시: ${dateLabel}`,
        ` 예약 서비스: ${params.serviceName ?? ""}`,
        "",
        "방문 당일 편하게 와 주세요. 기다리고 있겠습니다.",
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "booking_rejected":
      return [
        `[${params.shopName}] 예약 거절 안내`,
        "",
        `${params.petName} 보호자님께서 신청하신 예약은 매장 사정으로 인해 확정이 어려운 점 양해 부탁드립니다.`,
        "",
        "불편을 드려 죄송합니다.",
        "",
        "해당 시간 외 다른 일정으로 예약이 가능하오니,  아래 링크에서 다시 확인 부탁드립니다.",
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "booking_cancelled":
      return [
        `[${params.shopName}]`,
        `${params.petName} 보호자님, 예약 취소가 처리되었어요.`,
        "",
        `취소된 예약: ${dateLabel}`,
        "",
        "아쉽지만 다음에 또 뵐 수 있길 바라요.",
        "언제든 다시 예약하고 싶으실 때 아래 링크를 이용해 주세요.",
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "booking_rescheduled_confirmed":
      return [
        `[${params.shopName}]`,
        `${params.petName} 보호자님, 예약 변경이 확정되었어요`,
        "",
        "기존 예약은 취소되고, 아래 일정으로 새로 잡혔어요.",
        "",
        ` 새로운 일정: ${dateLabel}`,
        ` 예약 서비스: ${params.serviceName ?? ""}`,
        "",
        "새 일정에 맞춰 뵐게요!",
        "추가 변경이 필요하시면 아래 링크에서 편하게 해주세요.",
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "appointment_reminder_10m":
      return [
        `[${params.shopName}]`,
        `${params.petName} 보호자님, 이제 곧 만나요! (방긋)`,
        "",
        ` 방문 일시: ${dateLabel}`,
        ` 예약 서비스: ${params.serviceName ?? ""}`,
        "",
        "준비 마치고 기다리고 있을게요.",
        "오시는 길 조심히 오세요 ",
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "grooming_started":
      return [
        `[${params.shopName}]`,
        `${params.petName} 보호자님, 미용을 시작했어요 `,
        "",
        `${params.petName}은 저희가 잘 돌보고 있으니 안심하세요 `,
        "예쁘게 단장해서 보내드릴게요!",
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
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
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "grooming_completed":
      return [
        `[${params.shopName}]`,
        ` ${params.petName} 미용이 모두 완료되었어요.`,
        "",
        "오늘도 믿고 맡겨주셔서 감사해요.",
        `${params.petName}이 기다리고 있으니 편하신 시간에 와주세요.`,
        "",
        bookingLinksBlock,
      ]
        .filter((line, index, lines) => {
          if (line) return true;
          const previous = lines[index - 1];
          return previous !== "";
        })
        .join("\n");
    case "revisit_notice":
      return `[${params.shopName}] ${params.petName} 재방문 시기가 가까워졌어요.`;
    case "birthday_greeting":
      return `[${params.shopName}] ${params.petName}의 생일을 축하드려요.`;
    default:
      return `[${params.shopName}] 알림을 확인해 주세요.`;
  }
}

function buildOwnerBookingRequestedMessage(params: {
  petName: string;
  appointment: Appointment | null;
}) {
  const dateLabel =
    params.appointment
      ? `${shortDate(params.appointment.appointment_date)} ${formatClockTime(params.appointment.appointment_time)}`
      : "";

  return ["새 예약이 접수되었어요.", params.petName, dateLabel].filter(Boolean).join("\n");
}

function buildNotificationTemplateValues(params: {
  appointment: Appointment | null;
  bookingAccessToken: string | null;
  bookingEntryUrl: string | null;
  bookingManageUrl: string | null;
  directionsUrl: string | null;
  petName: string;
  recipientName: string | null;
  serviceName: string | null;
  shopAddress: string | null;
  shopName: string;
}) {
  const appointmentDateTime =
    params.appointment
      ? `${shortDate(params.appointment.appointment_date)} ${formatClockTime(params.appointment.appointment_time)}`
      : "";
  const visitReminderOffsetMinutes = params.appointment?.visit_reminder_offset_minutes ?? 10;
  const pickupReadyEtaMinutes = params.appointment?.pickup_ready_eta_minutes ?? 5;
  const pickupGuide = `약 ${pickupReadyEtaMinutes}분 뒤 미용이 완료될 예정입니다. 준비되시는 대로 편하게 방문해 주세요.`;

  return {
    매장명: params.shopName,
    반려동물명: params.petName,
    보호자명: params.recipientName?.trim() || "",
    예약일시: appointmentDateTime,
    서비스명: params.serviceName?.trim() || "",
    매장주소: params.shopAddress?.trim() || "",
    "예약 링크": params.bookingEntryUrl ?? "",
    "예약 확인 링크": params.bookingManageUrl ?? "",
    예약관리링크: params.bookingManageUrl ?? "",
    예약시간변경링크: params.bookingManageUrl ?? "",
    예약시간변경토큰: params.bookingAccessToken ?? "",
    bookingRescheduleToken: params.bookingAccessToken ?? "",
    bookingRescheduleUrl: params.bookingManageUrl ?? "",
    길찾기링크: params.directionsUrl ?? "",
    방문전알림분: String(visitReminderOffsetMinutes),
    방문전알림안내: `예약 시간 ${visitReminderOffsetMinutes}분 전 안내드립니다.`,
    픽업예상분: String(pickupReadyEtaMinutes),
    픽업안내: pickupGuide,
    pickupReadyEtaMinutes: String(pickupReadyEtaMinutes),
    pickupGuide,
  };
}

async function buildNotificationMessage(params: {
  type: NotificationType;
  shopName: string;
  appointment: Appointment | null;
  petName: string;
  recipientName: string | null;
  serviceName: string | null;
  shopAddress: string | null;
  rejectionReason: string | null;
  bookingAccessToken: string | null;
  bookingEntryUrl: string | null;
  bookingManageUrl: string | null;
  directionsUrl: string | null;
}) {
  const rendered = await renderNotificationTemplateBodyWithOverrides(
    params.type,
    buildNotificationTemplateValues({
      appointment: params.appointment,
      bookingAccessToken: params.bookingAccessToken,
      bookingEntryUrl: params.bookingEntryUrl,
      bookingManageUrl: params.bookingManageUrl,
      directionsUrl: params.directionsUrl,
      petName: params.petName,
      recipientName: params.recipientName,
      serviceName: params.serviceName,
      shopAddress: params.shopAddress,
      shopName: params.shopName,
    }),
  );

  if (rendered) {
    return rendered;
  }

  if (params.type === "owner_booking_requested") {
    return buildOwnerBookingRequestedMessage({
      petName: params.petName,
      appointment: params.appointment,
    });
  }

  return params.serviceName ? `${params.petName} / ${params.serviceName}` : params.petName;
}

function buildPhotoLessGroomingCompletedMessage(params: {
  shopName: string;
  petName: string;
  bookingManageUrl: string | null;
}) {
  return [
    `[${params.shopName}]`,
    `${params.petName} 미용이 완료됐어요.`,
    "",
    "오늘도 믿고 맡겨주셔서 감사합니다.",
    "편하신 시간에 픽업 부탁드립니다.",
    "",
    params.bookingManageUrl ? "예약 확인 링크" : "",
    params.bookingManageUrl ?? "",
  ].filter(Boolean).join("\n");
}

function buildNaverMapSearchUrl(shopName: string, shopAddress: string | null | undefined) {
  const query = [shopName, shopAddress?.trim()].filter(Boolean).join(" ");
  if (!query) return null;
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

function buildNotificationButtons(params: {
  type: NotificationType;
  bookingManageUrl: string | null;
  directionsUrl: string | null;
  hasMediaAttachments: boolean;
}): AlimtalkButton[] {
  if (params.type === "booking_time_proposed") {
    if (!params.bookingManageUrl) return [];
    return [
      {
        type: "WL",
        name: "예약 시간 변경",
        linkMobile: params.bookingManageUrl,
        linkPc: params.bookingManageUrl,
      },
    ];
  }

  if (params.type === "appointment_reminder_10m") {
    const buttons: AlimtalkButton[] = [];
    if (params.directionsUrl) {
      buttons.push({
        type: "WL",
        name: "길찾기",
        linkMobile: params.directionsUrl,
        linkPc: params.directionsUrl,
      });
    }
    if (params.bookingManageUrl) {
      buttons.push({
        type: "WL",
        name: "예약확인",
        linkMobile: params.bookingManageUrl,
        linkPc: params.bookingManageUrl,
      });
    }
    return buttons;
  }

  if (params.type === "booking_rescheduled_confirmed") {
    if (!params.bookingManageUrl) return [];
    return [
      {
        type: "WL",
        name: "예약 확인",
        linkMobile: params.bookingManageUrl,
        linkPc: params.bookingManageUrl,
      },
      {
        type: "WL",
        name: "예약 다시 변경",
        linkMobile: params.bookingManageUrl,
        linkPc: params.bookingManageUrl,
      },
    ];
  }

  if (
    params.type === "booking_confirmed" ||
    params.type === "booking_rejected"
  ) {
    const buttons: AlimtalkButton[] = [];
    if (params.bookingManageUrl) {
      buttons.push({
        type: "WL",
        name: params.type === "booking_rejected" ? "예약 변경" : "예약 확인",
        linkMobile: params.bookingManageUrl,
        linkPc: params.bookingManageUrl,
      });
    }
    if (params.type === "booking_confirmed" && params.directionsUrl) {
      buttons.push({
        type: "WL",
        name: "길찾기",
        linkMobile: params.directionsUrl,
        linkPc: params.directionsUrl,
      });
    }
    return buttons;
  }

  if (params.type !== "grooming_completed" || !params.hasMediaAttachments || !params.bookingManageUrl) {
    return [];
  }

  return [
    {
      type: "WL",
      name: "사진 확인",
      linkMobile: params.bookingManageUrl,
      linkPc: params.bookingManageUrl,
    },
  ];
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
  const usesAlimtalkRelay = Boolean(serverEnv.alimtalkRelayUrl && serverEnv.alimtalkRelaySecret);
  const configuredTemplateKey = getConfiguredAlimtalkTemplateKey(templateAlias);
  const templateKey = usesAlimtalkRelay ? configuredTemplateKey : resolveAlimtalkTemplateKey(templateAlias);
  const templateType = input.templateType ?? "alimtalk";
  const isBookingTimeProposal = input.type === "booking_time_proposed";
  const bookingAccessToken =
    guardian?.id && pet?.id
      ? createBookingAccessToken({
          shopId: input.shopId,
          guardianId: guardian.id,
          petId: pet.id,
          appointmentId: isBookingTimeProposal ? appointment?.id ?? input.appointmentId ?? undefined : undefined,
          action: isBookingTimeProposal ? "reschedule" : undefined,
          expiresInHours: isBookingTimeProposal ? 24 * 14 : undefined,
        })
      : null;
  const bookingEntryUrl = buildBookingEntryUrl(input.shopId);
  const bookingManageUrl =
    bookingAccessToken ? buildBookingManageUrl(input.shopId, bookingAccessToken) : null;
  const directionsUrl = buildNaverMapSearchUrl(bootstrap.shop.name, bootstrap.shop.address);
  const mediaAssetIds = normalizeMediaAssetIds(input.mediaAssetIds);
  const message =
    input.message?.trim() ||
    (input.type === "grooming_completed" && mediaAssetIds.length === 0
      ? buildPhotoLessGroomingCompletedMessage({
          shopName: bootstrap.shop.name,
          petName: pet?.name ?? "pet",
          bookingManageUrl,
        })
      : await buildNotificationMessage({
          type: input.type,
          shopName: bootstrap.shop.name,
          shopAddress: bootstrap.shop.address ?? null,
          appointment,
          petName: pet?.name ?? "pet",
          recipientName,
          serviceName: service?.name ?? null,
          rejectionReason: appointment?.rejection_reason ?? null,
          bookingAccessToken,
          bookingEntryUrl,
          bookingManageUrl,
          directionsUrl,
        }));
  const abusePolicy = evaluateNotificationAbusePolicy({
    notifications: bootstrap.notifications,
    type: input.type,
    appointment,
    guardianId: input.guardianId ?? guardian?.id ?? null,
    petId: input.petId ?? pet?.id ?? null,
    recipientPhone,
    message,
    scheduledAt: input.scheduledAt ?? null,
  });

  let status: NotificationStatus = "queued";
  let provider = input.channel === "mock" ? "mock" : bootstrap.mode === "supabase" ? "kakao" : "mock";
  let sentAt: string | null = null;
  let failReason: string | null = null;
  let providerMessageId: string | null = null;
  let creditReservation: AlimtalkCreditReservation | null = null;
  let creditRefunded = false;
  const alimtalkSenderConfig = getAlimtalkSenderConfig(bootstrap.shop);
  const scheduledAt = input.scheduledAt ?? null;
  const shouldSendNow = !scheduledAt || new Date(scheduledAt).getTime() <= Date.now();
  const canSendShop = input.force ? true : shouldSendNotification(bootstrap.shop, input.type);
  const canSendGuardian = input.force ? true : shouldSendGuardianNotification(guardian, input.type);
  const canSend = canSendShop && canSendGuardian;
  const mediaAttachments =
    bootstrap.mode === "supabase" && mediaAssetIds.length > 0
      ? await buildNotificationMediaAttachments({
          shopId: input.shopId,
          mediaAssetIds,
        })
      : [];
  const alimtalkButtons = buildNotificationButtons({
    type: input.type,
    bookingManageUrl,
    directionsUrl,
    hasMediaAttachments: mediaAttachments.length > 0,
  });
  const isPhotoAlimtalkRequest =
    (input.channel ?? "alimtalk") === "alimtalk" &&
    input.type === "grooming_completed" &&
    mediaAssetIds.length > 0;
  const hasConfiguredPhotoAlimtalkTemplate =
    Boolean(serverEnv.alimtalkTemplateGroomingCompleted) ||
    (isPhotoAlimtalkRequest ? await isRelayTemplateConfigured(templateAlias) : false);
  const templateKeyForDelivery =
    isPhotoAlimtalkRequest && usesAlimtalkRelay && !configuredTemplateKey
      ? null
      : templateKey;

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

  if (abusePolicy.blocked) {
    status = "skipped";
    failReason = abusePolicy.reason;
    logNotificationSkipped({
      reason: "duplicate notification abuse guard",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
  } else if (!canSend) {
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
  } else if (isPhotoAlimtalkRequest && !hasConfiguredPhotoAlimtalkTemplate) {
    status = "queued";
    provider = "pending_template";
    failReason = "완료 사진 알림톡 템플릿 승인 전입니다. 요청만 저장했습니다.";
    logNotificationSkipped({
      reason: "photo alimtalk template not configured",
      type: input.type,
      appointmentId: input.appointmentId ?? appointment?.id ?? null,
    });
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
        creditReservation = await reserveShopAlimtalkCredit({
          shopId: input.shopId,
          appointmentId: input.appointmentId ?? appointment?.id ?? null,
          notificationType: input.type,
          metadata: {
            templateAlias,
            templateKey: templateKeyForDelivery,
          },
        });

        if (!creditReservation.consumed) {
          status = "skipped";
          failReason = "알림톡 잔여 건수가 없습니다.";
          logNotificationSkipped({
            reason: "insufficient alimtalk credits",
            type: input.type,
            appointmentId: input.appointmentId ?? appointment?.id ?? null,
          });
        } else {
          const delivery = await sendAlimtalkMessage({
            to: recipientPhone,
            message,
            templateAlias,
            templateKey: templateKeyForDelivery,
            templateType,
            senderChannelMode: alimtalkSenderConfig.mode,
            senderProfileKey: alimtalkSenderConfig.senderProfileKey,
            senderChannelName: alimtalkSenderConfig.channelName,
            senderChannelUrl: alimtalkSenderConfig.channelUrl,
            recipientName,
            metadata: input.metadata ?? null,
            mediaAttachments,
            buttons: alimtalkButtons,
          });
          status = "sent";
          provider = delivery.provider;
          providerMessageId = delivery.providerMessageId;
          sentAt = nowIso();
        }
      } catch (error) {
        if (creditReservation?.consumed) {
          try {
            await refundShopAlimtalkCredit({
              shopId: input.shopId,
              sourceEventId: creditReservation.eventId,
              appointmentId: input.appointmentId ?? appointment?.id ?? null,
              notificationType: input.type,
              metadata: {
                providerMessageId,
              },
            });
            creditRefunded = true;
          } catch (refundError) {
            console.error("[notification-dispatch] alimtalk credit refund failed", {
              message: refundError instanceof Error ? refundError.message : String(refundError),
              sourceEventId: creditReservation.eventId,
            });
          }
        }
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
      abuseDedupeKey: abusePolicy.dedupeKey,
      abusePolicyVersion: "2026-06-07",
      duplicateOfNotificationId: abusePolicy.existingNotificationId,
      appointmentSnapshotKey: getAppointmentSnapshotKey(appointment),
      recipientName,
      serviceName: service?.name ?? null,
      bookingEntryUrl,
      bookingManageUrl,
      alimtalkCreditEventId: creditReservation?.eventId ?? null,
      alimtalkCreditBucket: creditReservation?.consumedBucket ?? null,
      alimtalkCreditRemaining: creditReservation?.remainingCount ?? null,
      alimtalkCreditConsumed: status === "sent" && Boolean(creditReservation?.consumed),
      alimtalkCreditRefunded: creditRefunded,
      alimtalkSenderMode: alimtalkSenderConfig.mode,
      alimtalkSenderRequestedMode: alimtalkSenderConfig.requestedMode,
      alimtalkShopChannelStatus: alimtalkSenderConfig.status,
      alimtalkShopChannelName: alimtalkSenderConfig.channelName,
      alimtalkShopChannelUrl: alimtalkSenderConfig.channelUrl,
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

  if (creditReservation?.eventId) {
    const creditEventResult = await admin
      .from("shop_alimtalk_credit_events")
      .update({ notification_id: result.data.id })
      .eq("id", creditReservation.eventId);
    if (creditEventResult.error) {
      console.error("[notification-dispatch] alimtalk credit event notification link failed", {
        message: creditEventResult.error.message,
        creditEventId: creditReservation.eventId,
        notificationId: result.data.id,
      });
    }
  }

  if (mediaAssetIds.length > 0) {
    const attached = await attachMediaToNotification(
      {
        shopId: input.shopId,
        userId: null,
      },
      {
        notificationId: result.data.id,
        channel: input.channel ?? "alimtalk",
        media: mediaAssetIds.map((mediaAssetId, index) => ({
          mediaAssetId,
          attachmentRole:
            mediaAttachments[index]?.role === "before_photo"
              ? "before_photo"
              : mediaAttachments[index]?.role === "after_photo"
                ? "after_photo"
                : "result_photo",
          sortOrder: index,
        })),
      },
    );

    if (status === "sent" || status === "failed") {
      await markNotificationMediaDeliveryResult(
        {
          shopId: input.shopId,
          userId: null,
        },
        {
          notificationId: result.data.id,
          status,
          channel: input.channel ?? "alimtalk",
          provider,
          providerMessageId,
          recipientPhone,
          failReason,
          sentAt,
          providerMedia: attached.attachments.map((attachment) => ({
            notificationMediaAttachmentId: attachment.id,
            providerMediaId: null,
          })),
        },
      );
    }
  }

  return {
    notification: result.data as Notification,
    skipped: status === "skipped",
    alreadyExists: false,
  };
}
