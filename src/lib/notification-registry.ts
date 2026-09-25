import type {
  GuardianNotificationSettings,
  NotificationType,
  ShopNotificationSettings,
} from "@/types/domain";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager-contract/index";

export type NotificationTarget = "guardian" | "owner" | "system";
export type NotificationChannel = "alimtalk" | "in_app" | "data_only";

export type ShopSettingKey =
  | "enabled"
  | "revisit_enabled"
  | "booking_confirmed_enabled"
  | "booking_cancelled_enabled"
  | "booking_rescheduled_enabled"
  | "appointment_reminder_10m_enabled"
  | "grooming_started_enabled"
  | "grooming_almost_done_enabled"
  | "grooming_completed_enabled"
  | null;

export type GuardianSettingKey = keyof GuardianNotificationSettings | null;

export type AlimtalkTemplateAlias =
  | "booking_received"
  | "booking_confirmed"
  | "booking_cancelled"
  | "appointment_reminder_10m"
  | "visit_schedule_notice"
  | "visit_reminder_notice"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "birthday_greeting";

export type AlimtalkTemplateConfigKey =
  | "templateBookingReceived"
  | "templateBookingConfirmed"
  | "templateBookingCancelled"
  | "templateBookingRescheduledConfirmed"
  | "templateAppointmentReminder10m"
  | "templateVisitScheduleNotice"
  | "templateVisitReminderNotice"
  | "templateGroomingStarted"
  | "templateGroomingAlmostDone"
  | "templateGroomingCompleted"
  | "templateRevisitNotice"
  | "templateBirthdayGreeting";

export type NotificationRegistryItem = {
  type: NotificationType;
  title: string;
  target: NotificationTarget;
  channel: NotificationChannel;
  trigger: string;
  dispatchSource: string;
  templateAlias: AlimtalkTemplateAlias | null;
  templateConfigKey: AlimtalkTemplateConfigKey | null;
  shopSettingKey: ShopSettingKey;
  guardianSettingKey: GuardianSettingKey;
  notes: string | null;
  draftBody: string | null;
};

export type NotificationTemplateVariables = Record<string, string | null | undefined>;

export const NOTIFICATION_REGISTRY: readonly NotificationRegistryItem[] = [
  {
    type: "booking_received",
    title: "예약 접수",
    target: "guardian",
    channel: "alimtalk",
    trigger: "고객이 예약을 신청하면 즉시 발송",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: "booking_received",
    templateConfigKey: "templateBookingReceived",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "자동 승인 매장에서도 접수 안내용으로 사용",
    draftBody: [
      "[#{매장명}] #{반려동물명} 예약이 접수되었어요.",
      "방문 일정: #{예약일시}",
      "",
      "매장에서 예약을 확인한 뒤 승인 알림을 보내드릴게요.",
      "",
      "예약 링크",
      "#{예약 링크}",
      "예약 확인 링크",
      "#{예약 확인 링크}",
    ].join("\n"),
  },
  {
    type: "booking_confirmed",
    title: "예약 확정",
    target: "guardian",
    channel: "alimtalk",
    trigger: "오너가 직접 등록한 예약을 확정할 때만 발송. 고객이 직접 신청한 예약에는 발송하지 않음",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "booking_confirmed",
    templateConfigKey: "templateBookingConfirmed",
    shopSettingKey: "booking_confirmed_enabled",
    guardianSettingKey: "booking_confirmed_enabled",
    notes: null,
    draftBody: APPROVED_ALIMTALK_CONTRACTS.booking_confirmed.body,
  },
  {
    type: "owner_booking_requested",
    title: "오너 예약 접수",
    target: "owner",
    channel: "in_app",
    trigger: "고객 예약 접수 시 오너 앱 알림 생성",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: "enabled",
    guardianSettingKey: null,
    notes: "알림톡이 아니라 오너 인앱 알림",
    draftBody: null,
  },
  {
    type: "booking_cancelled",
    title: "예약 취소",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 cancelled가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "booking_cancelled",
    templateConfigKey: "templateBookingCancelled",
    shopSettingKey: "booking_cancelled_enabled",
    guardianSettingKey: "booking_cancelled_enabled",
    notes: null,
    draftBody: APPROVED_ALIMTALK_CONTRACTS.booking_cancelled.body,
  },
  {
    type: "appointment_reminder_10m",
    title: "예약 안내 - 직전",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 시간이 가까워졌을 때 발송",
    dispatchSource: "src/server/notification-dispatch.ts",
    templateAlias: "appointment_reminder_10m",
    templateConfigKey: "templateAppointmentReminder10m",
    shopSettingKey: "appointment_reminder_10m_enabled",
    guardianSettingKey: "enabled",
    notes: "예약 안내 3종 중 방문 직전 안내에 사용",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.appointment_reminder_10m.body,
  },
  {
    type: "visit_schedule_notice",
    title: "예약 안내 - 내일",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약일 하루 전 발송",
    dispatchSource: "src/server/visit-reminder-processor.ts",
    templateAlias: "visit_schedule_notice",
    templateConfigKey: "templateVisitScheduleNotice",
    shopSettingKey: "appointment_reminder_10m_enabled",
    guardianSettingKey: "appointment_reminder_10m_enabled",
    notes: "예약 안내 3종 중 내일 예약 안내에 사용",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.visit_schedule_notice.body,
  },
  {
    type: "visit_reminder_notice",
    title: "예약 안내 - 오늘",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 당일 여유 시간이 남아 있을 때 발송",
    dispatchSource: "src/server/visit-reminder-processor.ts",
    templateAlias: "visit_reminder_notice",
    templateConfigKey: "templateVisitReminderNotice",
    shopSettingKey: "appointment_reminder_10m_enabled",
    guardianSettingKey: "appointment_reminder_10m_enabled",
    notes: "예약 안내 3종 중 오늘 예약 안내에 사용",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.visit_reminder_notice.body,
  },
  {
    type: "grooming_started",
    title: "미용 시작",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 in_progress가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "grooming_started",
    templateConfigKey: "templateGroomingStarted",
    shopSettingKey: "enabled",
    guardianSettingKey: "grooming_started_enabled",
    notes: "전체 알림이 켜져 있으면 발송",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.grooming_started.body,
  },
  {
    type: "grooming_almost_done",
    title: "픽업 준비",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 almost_done이 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "grooming_almost_done",
    templateConfigKey: "templateGroomingAlmostDone",
    shopSettingKey: "grooming_almost_done_enabled",
    guardianSettingKey: "grooming_almost_done_enabled",
    notes: null,
    draftBody: [
      "[#{매장명}]",
      "#{반려동물명} 미용을 마무리하고 있어요.",
      "",
      "#{픽업안내}",
    ].join("\n"),
  },
  {
    type: "grooming_completed",
    title: "미용 완료",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 completed가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "grooming_completed",
    templateConfigKey: "templateGroomingCompleted",
    shopSettingKey: "grooming_completed_enabled",
    guardianSettingKey: "grooming_completed_enabled",
    notes: null,
    draftBody: [
      "[#{매장명}]",
      "#{반려동물명} 미용이 완료되었습니다.",
      "",
      "오늘 사진과 케어리포트를 아래에서 바로 확인하실 수 있어요.",
      "편하신 시간에 픽업 부탁드립니다.",
      "",
      "케어리포트 링크",
      "#{예약 확인 링크}",
    ].join("\n"),
  },
  {
    type: "revisit_notice",
    title: "재방문 안내",
    target: "guardian",
    channel: "alimtalk",
    trigger: "케어 완료 때 오너가 선택한 재예약 알림일에 자동 발송",
    dispatchSource: "src/server/revisit-reminder-processor.ts",
    templateAlias: "revisit_notice",
    templateConfigKey: "templateRevisitNotice",
    shopSettingKey: "revisit_enabled",
    guardianSettingKey: "revisit_enabled",
    notes: "매장과 고객 모두 재방문 알림이 켜져 있고, 이후 예약이 없을 때 한 번만 발송",
    draftBody: [
      "[#{매장명}]",
      "#{반려동물명}의 다음 케어 시기가 다가왔어요.",
      "",
      "마지막 방문: #{마지막방문일}",
      "권장 관리 주기: #{관리주기}",
      "",
      "원하시는 날짜와 시간을 편하게 선택해 주세요.",
    ].join("\n"),
  },
  {
    type: "birthday_greeting",
    title: "생일 축하",
    target: "guardian",
    channel: "alimtalk",
    trigger: "오너가 고객 상세에서 직접 발송",
    dispatchSource: "owner manual action / dispatchNotification",
    templateAlias: "birthday_greeting",
    templateConfigKey: "templateBirthdayGreeting",
    shopSettingKey: "enabled",
    guardianSettingKey: "birthday_greeting_enabled",
    notes: "전체 알림이 켜져 있으면 발송",
    draftBody: "[#{매장명}] #{반려동물명} 생일을 축하드려요.",
  },
  {
    type: "landing_feedback",
    title: "랜딩 피드백",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 피드백 제출 시 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_feedback table",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림 발송이 아니라 데이터 기록",
    draftBody: null,
  },
  {
    type: "waitlist_interest",
    title: "랜딩 대기수요",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 대기수요 제출 시 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_interests table",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림 발송이 아니라 데이터 기록",
    draftBody: null,
  },
] as const;

export const ACTIVE_ALIMTALK_TEMPLATE_ALIASES: readonly AlimtalkTemplateAlias[] = [
  "booking_confirmed",
  "booking_cancelled",
  "appointment_reminder_10m",
  "visit_schedule_notice",
  "visit_reminder_notice",
  "grooming_started",
  "grooming_almost_done",
  "grooming_completed",
  "revisit_notice",
];

const activeAlimtalkTemplateAliases = new Set<AlimtalkTemplateAlias>(ACTIVE_ALIMTALK_TEMPLATE_ALIASES);

export const ALIMTALK_NOTIFICATION_REGISTRY = NOTIFICATION_REGISTRY.filter(
  (item): item is NotificationRegistryItem & {
    channel: "alimtalk";
    templateAlias: AlimtalkTemplateAlias;
    templateConfigKey: AlimtalkTemplateConfigKey;
    draftBody: string;
  } =>
    item.channel === "alimtalk" &&
    Boolean(item.templateAlias) &&
    activeAlimtalkTemplateAliases.has(item.templateAlias as AlimtalkTemplateAlias) &&
    Boolean(item.templateConfigKey) &&
    typeof item.draftBody === "string",
);

export function fillNotificationTemplate(template: string, values: NotificationTemplateVariables) {
  return Object.entries(values).reduce((message, [key, value]) => {
    const resolvedValue = value ?? "";
    return message.replaceAll(`#{${key}}`, resolvedValue);
  }, template);
}

export function getNotificationRegistryItem(type: NotificationType) {
  return NOTIFICATION_REGISTRY.find((item) => item.type === type) ?? null;
}

export function getNotificationTitle(type: NotificationType) {
  return getNotificationRegistryItem(type)?.title ?? type;
}

export function getNotificationDraftBody(type: NotificationType) {
  return getNotificationRegistryItem(type)?.draftBody ?? null;
}

export function renderNotificationTemplateBody(type: NotificationType, values: NotificationTemplateVariables) {
  const template = getNotificationDraftBody(type);
  if (!template) return null;
  return fillNotificationTemplate(template, values);
}

export function getAlimtalkTemplateAlias(type: NotificationType) {
  const spec = getNotificationRegistryItem(type);
  return spec?.channel === "alimtalk" ? spec.templateAlias : null;
}

export function getShopSettingEnabled(
  settings: ShopNotificationSettings | null,
  key: ShopSettingKey,
) {
  if (!settings || !key) return null;
  return settings[key];
}

export function getGuardianSettingEnabled(
  settings: GuardianNotificationSettings | null,
  key: GuardianSettingKey,
) {
  if (!settings || !key) return null;
  return settings[key];
}

export function shouldSendByShopSettings(
  settings: ShopNotificationSettings | null,
  type: NotificationType,
) {
  if (!settings) return null;
  if (!settings.enabled) return false;

  switch (type) {
    case "booking_received":
    case "owner_booking_requested":
    case "appointment_reminder_10m":
    case "visit_schedule_notice":
    case "visit_reminder_notice":
      return settings.appointment_reminder_10m_enabled;
    case "grooming_started":
      return settings.grooming_started_enabled;
    case "birthday_greeting":
      return true;
    case "booking_confirmed":
      return settings.booking_confirmed_enabled;
    case "booking_cancelled":
      return settings.booking_cancelled_enabled;
    case "grooming_almost_done":
      return settings.grooming_almost_done_enabled;
    case "grooming_completed":
      return settings.grooming_completed_enabled;
    case "revisit_notice":
      return settings.revisit_enabled;
    case "landing_feedback":
    case "waitlist_interest":
      return null;
    default:
      return false;
  }
}

export function shouldSendByGuardianSettings(
  settings: GuardianNotificationSettings | null,
  type: NotificationType,
) {
  if (!settings) return null;
  if (!settings.enabled) return false;

  switch (type) {
    case "booking_confirmed":
      return settings.booking_confirmed_enabled;
    case "booking_cancelled":
      return settings.booking_cancelled_enabled;
    case "appointment_reminder_10m":
    case "visit_schedule_notice":
    case "visit_reminder_notice":
      return settings.appointment_reminder_10m_enabled;
    case "grooming_started":
      return settings.grooming_started_enabled;
    case "grooming_almost_done":
      return settings.grooming_almost_done_enabled;
    case "grooming_completed":
      return settings.grooming_completed_enabled;
    case "birthday_greeting":
      return settings.birthday_greeting_enabled;
    case "revisit_notice":
      return settings.revisit_enabled;
    case "landing_feedback":
    case "waitlist_interest":
    case "owner_booking_requested":
      return null;
    default:
      return true;
  }
}
