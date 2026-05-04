import type {
  GuardianNotificationSettings,
  NotificationType,
  ShopNotificationSettings,
} from "@/types/domain";

export type NotificationTarget = "guardian" | "owner" | "system";
export type NotificationChannel = "alimtalk" | "in_app" | "data_only";

export type ShopSettingKey =
  | "enabled"
  | "revisit_enabled"
  | "booking_confirmed_enabled"
  | "booking_rejected_enabled"
  | "booking_cancelled_enabled"
  | "booking_rescheduled_enabled"
  | "grooming_almost_done_enabled"
  | "grooming_completed_enabled"
  | null;

export type GuardianSettingKey = keyof GuardianNotificationSettings | null;

export type AlimtalkTemplateAlias =
  | "booking_received"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_rescheduled_confirmed"
  | "appointment_reminder_10m"
  | "grooming_started"
  | "grooming_almost_done"
  | "grooming_completed"
  | "revisit_notice"
  | "birthday_greeting";

export type AlimtalkTemplateConfigKey =
  | "templateBookingReceived"
  | "templateBookingConfirmed"
  | "templateBookingRejected"
  | "templateBookingCancelled"
  | "templateBookingRescheduledConfirmed"
  | "templateAppointmentReminder10m"
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

export const NOTIFICATION_REGISTRY: readonly NotificationRegistryItem[] = [
  {
    type: "booking_received",
    title: "예약 접수",
    target: "guardian",
    channel: "alimtalk",
    trigger: "고객이 예약을 접수하면 즉시 발송",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: "booking_received",
    templateConfigKey: "templateBookingReceived",
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "수동 승인 매장에서도 예약 접수 완료 안내용으로 사용",
    draftBody:
      "[#{매장명}] #{반려동물명} 예약이 접수되었어요.\n방문 일정: #{예약일시}\n\n매장에서 예약을 확인한 뒤 확정 알림을 보내드릴게요.\n\n예약 정보는 아래 링크에서 확인하실 수 있어요.\n#{예약관리링크}",
  },
  {
    type: "booking_confirmed",
    title: "예약 확정",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 confirmed가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "booking_confirmed",
    templateConfigKey: "templateBookingConfirmed",
    shopSettingKey: "booking_confirmed_enabled",
    guardianSettingKey: "enabled",
    notes: null,
    draftBody:
      "[#{매장명}]\n#{반려동물명} 보호자님, 예약이 확정되었어요. (방긋)\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n방문 당일 편하게 와 주세요. 기다리고 있겠습니다.\n\n#{예약관리링크}",
  },
  {
    type: "owner_booking_requested",
    title: "새 예약 접수",
    target: "owner",
    channel: "in_app",
    trigger: "고객 예약 접수 시 오너 인앱 알림 생성",
    dispatchSource: "src/server/customer-bookings.ts",
    templateAlias: null,
    templateConfigKey: null,
    shopSettingKey: "enabled",
    guardianSettingKey: null,
    notes: "알림톡이 아니라 오너용 인앱 알림",
    draftBody: null,
  },
  {
    type: "booking_rejected",
    title: "예약 거절",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 상태가 rejected가 되면 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "booking_rejected",
    templateConfigKey: "templateBookingRejected",
    shopSettingKey: "booking_rejected_enabled",
    guardianSettingKey: "enabled",
    notes: null,
    draftBody:
      "[#{매장명}] 예약 거절 안내\n\n#{반려동물명} 보호자님께서 요청하신 예약은 매장 사정으로 인해 확정이 어렵게 되어 양해 부탁드립니다.\n\n불편을 드려 죄송합니다.\n\n해당 구간 외 다른 일정으로 예약이 가능하니, 아래 링크에서 다시 확인 부탁드립니다.\n\n#{예약관리링크}",
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
    draftBody:
      "[#{매장명}]\n#{반려동물명} 보호자님, 예약 취소가 처리되었어요.\n\n취소된 예약: #{예약일시}\n\n아쉽지만 다음에 또 뵙길 바랄게요.\n언제든지 다시 예약하고 싶으시면 아래 링크를 이용해 주세요.\n\n#{예약관리링크}",
  },
  {
    type: "booking_rescheduled_confirmed",
    title: "예약 변경 확정",
    target: "guardian",
    channel: "alimtalk",
    trigger: "예약 변경 완료 시 발송",
    dispatchSource: "src/server/owner-mutations.ts",
    templateAlias: "booking_rescheduled_confirmed",
    templateConfigKey: "templateBookingRescheduledConfirmed",
    shopSettingKey: "booking_rescheduled_enabled",
    guardianSettingKey: "enabled",
    notes: null,
    draftBody:
      "[#{매장명}]\n#{반려동물명} 보호자님, 예약 변경이 확정되었어요.\n\n기존 예약은 취소되고, 아래 일정으로 새로 확정되었어요.\n\n새로운 일정: #{예약일시}\n예약 서비스: #{서비스명}\n\n변경된 일정에 맞춰 뵙겠습니다.\n추가 변경이 필요하시면 아래 링크에서 예약 정보를 확인해 주세요.\n\n#{예약관리링크}",
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
    shopSettingKey: "enabled",
    guardianSettingKey: "enabled",
    notes: "수동 버튼은 force 전송, 자동 발송은 예약 10분 전 조건 사용",
    draftBody:
      "[#{매장명}]\n#{반려동물명} 보호자님, 이제 곧 만나요! (방긋)\n\n방문 일시: #{예약일시}\n예약 서비스: #{서비스명}\n\n준비 마치고 기다리고 있을게요.\n오시는 길 조심히 오세요.\n\n#{예약관리링크}",
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
    draftBody:
      "[#{매장명}]\n#{반려동물명} 보호자님, 미용이 시작되었어요.\n\n#{반려동물명}은 예쁘게 변신 중이니 안심해 주세요.\n예쁘게 마무리해서 보내드릴게요!",
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
    draftBody:
      "[#{매장명}]\n#{반려동물명} 미용이 곧 끝나요.\n\n마무리 단계라 곧 픽업 가능하세요.\n\n잠시 후 픽업하실 수 있어요.\n\n예약 정보는 아래 링크에서 확인하실 수 있어요.\n#{예약관리링크}",
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
      "[#{매장명}]\n#{반려동물명} 미용이 모두 완료되었어요.\n\n오늘도 믿고 맡겨주셔서 감사해요.\n#{반려동물명}이 기다리고 있으니 편하신 시간에 와주세요.\n\n#{예약관리링크}",
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
    draftBody: "[#{매장명}] #{반려동물명} 재방문 시기가 가까워졌어요.",
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
    case "grooming_started":
    case "birthday_greeting":
      return true;
    case "booking_confirmed":
      return settings.booking_confirmed_enabled;
    case "booking_rejected":
      return settings.booking_rejected_enabled;
    case "booking_cancelled":
      return settings.booking_cancelled_enabled;
    case "booking_rescheduled_confirmed":
      return settings.booking_rescheduled_enabled;
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
