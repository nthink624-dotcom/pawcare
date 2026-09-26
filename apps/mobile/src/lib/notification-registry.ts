import type {
  GuardianNotificationSettings,
  NotificationType,
  ShopNotificationSettings,
} from "@/types/domain";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";

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
  | "grooming_completed_without_report"
  | "revisit_notice"
  | "birthday_greeting";

export type AlimtalkTemplateConfigKey =
  | "templateBookingReceived"
  | "templateBookingConfirmed"
  | "templateBookingManageLinkRequested"
  | "templateBookingCancelled"
  | "templateBookingTimeProposed"
  | "templateBookingRescheduledConfirmed"
  | "templateAppointmentReminder10m"
  | "templateVisitScheduleNotice"
  | "templateVisitReminderNotice"
  | "templateGroomingStarted"
  | "templateGroomingAlmostDone"
  | "templateGroomingCompleted"
  | "templateGroomingCompletedWithoutReport"
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
    title: "예약 완료",
    target: "guardian",
    channel: "alimtalk",
    trigger: "고객이 예약을 접수하면 즉시 발송",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: "booking_received",
    templateConfigKey: "templateBookingReceived",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "고객 예약 완료 안내용으로 사용",
    draftBody:
      "[#{매장명}] #{반려동물명} 예약이 접수되었어요.\n방문 일정: #{예약일시}\n\n매장에서 예약을 확인한 뒤 확정 알림을 보내드릴게요.\n\n예약 정보는 아래 링크에서 확인하실 수 있어요.\n#{예약관리링크}",
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
    guardianSettingKey: "enabled",
    notes: null,
    draftBody: APPROVED_ALIMTALK_CONTRACTS.booking_confirmed.body,
  },
  {
    type: "owner_booking_requested",
    title: "새 예약",
    target: "owner",
    channel: "in_app",
    trigger: "고객 예약 확정 시 오너 인앱 알림 생성",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: "enabled",
    guardianSettingKey: null,
    notes: "알림톡이 아니라 오너용 인앱 알림",
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
    guardianSettingKey: "enabled",
    notes: null,
    draftBody: APPROVED_ALIMTALK_CONTRACTS.booking_cancelled.body,
  },
  {
    type: "appointment_reminder_10m",
    title: "방문 10분 전",
    target: "guardian",
    channel: "alimtalk",
    trigger: "방문 10분 전 스케줄러 또는 수동 발송에서 발송",
    dispatchSource: "src/server/notification-dispatch.ts / src/components/owner/owner-app.tsx",
    templateAlias: "appointment_reminder_10m",
    templateConfigKey: "templateAppointmentReminder10m",
    shopSettingKey: "appointment_reminder_10m_enabled",
    guardianSettingKey: "appointment_reminder_10m_enabled",
    notes: "수동 버튼은 force 전송, 자동 발송은 예약 10분 전 조건 사용",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.appointment_reminder_10m.body,
  },
  {
    type: "visit_schedule_notice",
    title: "예약 안내 - 내일",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 하루 전 발송",
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
    guardianSettingKey: "enabled",
    notes: "현재는 전체 알림 ON이면 발송",
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
    guardianSettingKey: "enabled",
    notes: null,
    draftBody: APPROVED_ALIMTALK_CONTRACTS.grooming_almost_done.body,
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
    guardianSettingKey: "enabled",
    notes: null,
    draftBody:
      APPROVED_ALIMTALK_CONTRACTS.grooming_completed.body,
  },
  {
    type: "grooming_completed",
    title: "미용 완료 - 케어리포트 없음",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 completed가 되고 최종 발행된 케어리포트가 없을 때 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "grooming_completed_without_report",
    templateConfigKey: "templateGroomingCompletedWithoutReport",
    shopSettingKey: "grooming_completed_enabled",
    guardianSettingKey: "enabled",
    notes: "케어리포트가 최종 발행된 경우에는 grooming_completed 템플릿을 사용",
    draftBody: APPROVED_ALIMTALK_CONTRACTS.grooming_completed_without_report.body,
  },
  {
    type: "revisit_notice",
    title: "재방문 안내",
    target: "guardian",
    channel: "alimtalk",
    trigger: "재방문 대상 스케줄러 또는 자동화에서 발송",
    dispatchSource: "future automation / dispatchNotification",
    templateAlias: "revisit_notice",
    templateConfigKey: "templateRevisitNotice",
    shopSettingKey: "revisit_enabled",
    guardianSettingKey: "revisit_enabled",
    notes: "매장과 고객 양쪽 revisit 설정이 모두 켜져야 함",
    draftBody: "[#{매장명}]\n#{반려동물명}의 다음 케어 시기가 다가왔어요.\n\n마지막 방문: #{마지막방문일}\n권장 관리 주기: #{관리주기}\n\n예약 링크\n#{예약 링크}",
  },
  {
    type: "birthday_greeting",
    title: "생일 축하",
    target: "guardian",
    channel: "alimtalk",
    trigger: "생일 대상 스케줄러 또는 자동화에서 발송",
    dispatchSource: "future automation / dispatchNotification",
    templateAlias: "birthday_greeting",
    templateConfigKey: "templateBirthdayGreeting",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "현재는 전체 알림 ON이면 발송",
    draftBody: "[#{매장명}] #{반려동물명} 생일을 축하드려요.",
  },
  {
    type: "landing_feedback",
    title: "랜딩 피드백",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 피드백 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_feedback table",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림톡 발송 타입이 아니라 데이터 기록용",
    draftBody: null,
  },
  {
    type: "waitlist_interest",
    title: "랜딩 대기수요",
    target: "system",
    channel: "data_only",
    trigger: "랜딩 대기수요 저장",
    dispatchSource: "src/server/bootstrap.ts / landing_interests table",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: null,
    guardianSettingKey: null,
    notes: "알림톡 발송 타입이 아니라 데이터 기록용",
    draftBody: null,
  },
] as const;

export const ALIMTALK_NOTIFICATION_REGISTRY = NOTIFICATION_REGISTRY.filter(
  (item): item is NotificationRegistryItem & {
    channel: "alimtalk";
    templateAlias: AlimtalkTemplateAlias;
    templateConfigKey: AlimtalkTemplateConfigKey;
    draftBody: string;
  } =>
    item.channel === "alimtalk" &&
    Boolean(item.templateAlias) &&
    Boolean(item.templateConfigKey) &&
    typeof item.draftBody === "string",
);

export function getNotificationRegistryItem(type: NotificationType) {
  return NOTIFICATION_REGISTRY.find((item) => item.type === type) ?? null;
}

export function getNotificationTitle(type: NotificationType) {
  return getNotificationRegistryItem(type)?.title ?? type;
}

export function getNotificationDraftBody(type: NotificationType) {
  return getNotificationRegistryItem(type)?.draftBody ?? null;
}

export function getNotificationDraftBodyByAlias(alias: AlimtalkTemplateAlias) {
  return ALIMTALK_NOTIFICATION_REGISTRY.find((item) => item.templateAlias === alias)?.draftBody ?? null;
}

export function renderNotificationTemplateAliasBody(alias: AlimtalkTemplateAlias, values: NotificationTemplateVariables) {
  const template = getNotificationDraftBodyByAlias(alias);
  if (!template) return null;
  return fillNotificationTemplate(template, values);
}

export function fillNotificationTemplate(template: string, values: NotificationTemplateVariables) {
  return Object.entries(values).reduce((message, [key, value]) => {
    const resolvedValue = value ?? "";
    return message.replaceAll(`#{${key}}`, resolvedValue);
  }, template);
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
      return true;
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
    case "revisit_notice":
      return settings.revisit_enabled;
    case "birthday_greeting":
      return true;
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
