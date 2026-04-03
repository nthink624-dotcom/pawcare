import { revisitInfo } from "@/lib/availability";
import { nowIso } from "@/lib/utils";
import { normalizeGuardianNotificationSettings, normalizeShopNotificationSettings } from "@/lib/notification-settings";
import { sendNotification } from "@/server/notifications";
import type { Appointment, BootstrapPayload, Guardian, NotificationType, Pet } from "@/types/domain";

const EVENT_SETTINGS_KEY: Record<NotificationType, keyof BootstrapPayload["shop"]["notification_settings"] | null> = {
  booking_confirmed: "booking_confirmed_enabled",
  booking_rejected: "booking_rejected_enabled",
  booking_cancelled: "booking_cancelled_enabled",
  booking_rescheduled_confirmed: "booking_rescheduled_enabled",
  grooming_started: null,
  grooming_almost_done: "grooming_almost_done_enabled",
  grooming_completed: "grooming_completed_enabled",
  revisit_notice: "revisit_enabled",
  landing_feedback: null,
  waitlist_interest: null,
  birthday_greeting: null,
};

function canSend(store: BootstrapPayload, guardian: Guardian | undefined, type: NotificationType) {
  const shopSettings = normalizeShopNotificationSettings(store.shop?.notification_settings);
  const guardianSettings = normalizeGuardianNotificationSettings(guardian?.notification_settings);
  const settingsKey = EVENT_SETTINGS_KEY[type];
  if (!shopSettings.enabled) return false;
  if (settingsKey && !shopSettings[settingsKey]) return false;
  if (!guardian) return false;
  if (!guardianSettings.enabled) return false;
  if (type === "revisit_notice" && !guardianSettings.revisit_enabled) return false;
  return true;
}

function buildMessage(params: {
  type: NotificationType;
  petName?: string;
  shopName: string;
  serviceName?: string;
  appointmentTime?: string;
  rejectionReason?: string | null;
}) {
  const { type, petName = "반려견", serviceName = "예약", appointmentTime, rejectionReason } = params;
  if (type === "booking_confirmed") return `${petName} 예약이 확정되었어요.`;
  if (type === "booking_rejected") return rejectionReason ? `${petName} 예약이 미승인되었어요. 사유: ${rejectionReason}` : `${petName} 예약이 미승인되었어요.`;
  if (type === "booking_cancelled") return `${petName} 예약이 취소되었어요.`;
  if (type === "booking_rescheduled_confirmed") return `${petName} 예약 변경이 확정되었어요.`;
  if (type === "grooming_almost_done") return `${petName} 미용이 곧 끝나요. ${appointmentTime ? `${appointmentTime} 예약` : "예약"} 픽업 준비 부탁드려요.`;
  if (type === "grooming_completed") return `${petName} 미용이 완료되었어요. 픽업 부탁드려요.`;
  if (type === "revisit_notice") return `${petName} 재방문 시기가 다가왔어요. ${serviceName} 예약을 편하게 남겨주세요.`;
  return `${petName} 관련 알림이 도착했어요.`;
}

export async function queueEventNotification(params: {
  store: BootstrapPayload;
  type: NotificationType;
  appointment?: Appointment | null;
  guardian?: Guardian | undefined;
  pet?: Pet | undefined;
  serviceName?: string;
  rejectionReason?: string | null;
  metadata?: Record<string, string | boolean | null>;
}) {
  const { store, type, appointment, guardian, pet, serviceName, rejectionReason, metadata } = params;
  if (!canSend(store, guardian, type)) return null;
  const notice = await sendNotification({
    shop_id: store.shop.id,
    appointment_id: appointment?.id ?? null,
    pet_id: pet?.id ?? appointment?.pet_id ?? null,
    guardian_id: guardian?.id ?? appointment?.guardian_id ?? null,
    type,
    channel: "mock",
    message: buildMessage({
      type,
      petName: pet?.name,
      shopName: store.shop.name,
      serviceName,
      appointmentTime: appointment?.appointment_time,
      rejectionReason,
    }),
    status: "mocked",
    sent_at: nowIso(),
    template_key: type,
    provider: "mock-dispatcher",
    metadata,
  });
  store.notifications = [notice, ...store.notifications];
  return notice;
}

export async function queueAutomaticRevisitNotifications(store: BootstrapPayload) {
  const sentTodayKeys = new Set(
    store.notifications
      .filter((item) => item.type === "revisit_notice" && item.sent_at?.slice(0, 10) === nowIso().slice(0, 10))
      .map((item) => `${item.guardian_id}:${item.pet_id}`),
  );

  for (const pet of store.pets) {
    const guardian = store.guardians.find((item) => item.id === pet.guardian_id);
    const lastRecord = store.groomingRecords
      .filter((record) => record.pet_id === pet.id)
      .sort((a, b) => b.groomed_at.localeCompare(a.groomed_at))[0];
    const revisit = revisitInfo(pet, lastRecord?.groomed_at);
    const shouldNotify = revisit.status === "overdue" || revisit.status === "soon";
    const dedupeKey = `${guardian?.id}:${pet.id}`;
    if (!guardian || !shouldNotify || sentTodayKeys.has(dedupeKey)) continue;
    const serviceName = lastRecord ? store.services.find((service) => service.id === lastRecord.service_id)?.name : undefined;
    const notice = await queueEventNotification({
      store,
      type: "revisit_notice",
      guardian,
      pet,
      serviceName,
      metadata: { dueDate: revisit.dueDate, revisitStatus: revisit.status },
    });
    if (notice) sentTodayKeys.add(dedupeKey);
  }
}
