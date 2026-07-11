import type { BootstrapPayload, Guardian, GuardianNotificationSettings, Shop, ShopNotificationSettings } from "@/types/domain";

export const defaultShopNotificationSettings: ShopNotificationSettings = {
  enabled: true,
  alimtalk_sender_mode: "petmanager",
  alimtalk_shop_channel_status: "not_requested",
  alimtalk_shop_channel_name: "",
  alimtalk_shop_channel_url: "",
  alimtalk_sender_profile_key: "",
  alimtalk_channel_requested_at: null,
  alimtalk_channel_admin_note: "",
  alimtalk_business_channel_verified: false,
  alimtalk_template_request_note: "",
  alimtalk_template_request_updated_at: null,
  revisit_enabled: true,
  booking_confirmed_enabled: true,
  booking_rejected_enabled: true,
  booking_cancelled_enabled: true,
  booking_rescheduled_enabled: true,
  appointment_reminder_10m_enabled: true,
  appointment_reminder_10m_mode: "auto",
  visit_reminder_offset_minutes: 10,
  grooming_started_enabled: true,
  grooming_almost_done_enabled: true,
  pickup_ready_eta_minutes: 5,
  grooming_completed_enabled: true,
  grooming_start_without_photo_enabled: false,
  grooming_complete_without_photo_enabled: false,
};

export const defaultGuardianNotificationSettings: GuardianNotificationSettings = {
  enabled: true,
  revisit_enabled: true,
  booking_confirmed_enabled: true,
  booking_cancelled_enabled: true,
  booking_rescheduled_enabled: true,
  appointment_reminder_10m_enabled: true,
  grooming_started_enabled: true,
  grooming_almost_done_enabled: true,
  grooming_completed_enabled: true,
  birthday_greeting_enabled: true,
};

function normalizeMinuteValue(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 0), 180);
}

export function normalizeShopNotificationSettings(settings: Partial<ShopNotificationSettings> | null | undefined): ShopNotificationSettings {
  const senderMode = settings?.alimtalk_sender_mode === "shop_channel" ? "shop_channel" : "petmanager";
  const channelStatus = ["requested", "reviewing", "active", "rejected"].includes(
    settings?.alimtalk_shop_channel_status ?? "",
  )
    ? settings?.alimtalk_shop_channel_status
    : "not_requested";

  return {
    ...defaultShopNotificationSettings,
    ...(settings ?? {}),
    alimtalk_sender_mode: senderMode,
    alimtalk_shop_channel_status: channelStatus ?? "not_requested",
    alimtalk_shop_channel_name: settings?.alimtalk_shop_channel_name?.trim() ?? "",
    alimtalk_shop_channel_url: settings?.alimtalk_shop_channel_url?.trim() ?? "",
    alimtalk_sender_profile_key: settings?.alimtalk_sender_profile_key?.trim() ?? "",
    alimtalk_channel_requested_at: settings?.alimtalk_channel_requested_at ?? null,
    alimtalk_channel_admin_note: settings?.alimtalk_channel_admin_note?.trim() ?? "",
    alimtalk_business_channel_verified: Boolean(settings?.alimtalk_business_channel_verified),
    alimtalk_template_request_note: settings?.alimtalk_template_request_note?.trim() ?? "",
    alimtalk_template_request_updated_at: settings?.alimtalk_template_request_updated_at ?? null,
    appointment_reminder_10m_mode:
      settings?.appointment_reminder_10m_mode === "manual" ? "manual" : "auto",
    visit_reminder_offset_minutes: normalizeMinuteValue(
      settings?.visit_reminder_offset_minutes,
      defaultShopNotificationSettings.visit_reminder_offset_minutes,
    ),
    pickup_ready_eta_minutes: normalizeMinuteValue(settings?.pickup_ready_eta_minutes, defaultShopNotificationSettings.pickup_ready_eta_minutes),
  };
}

export function coerceEnabledShopNotificationSettings(settings: ShopNotificationSettings): ShopNotificationSettings {
  if (!settings.enabled) return settings;

  const hasAnyDetailedNotificationEnabled =
    settings.revisit_enabled ||
    settings.booking_confirmed_enabled ||
    settings.booking_rejected_enabled ||
    settings.booking_cancelled_enabled ||
    settings.booking_rescheduled_enabled ||
    settings.appointment_reminder_10m_enabled ||
    settings.grooming_started_enabled ||
    settings.grooming_almost_done_enabled ||
    settings.grooming_completed_enabled;

  if (hasAnyDetailedNotificationEnabled) {
    return settings;
  }

  return {
    ...settings,
    revisit_enabled: true,
    booking_confirmed_enabled: true,
    booking_rejected_enabled: true,
    booking_cancelled_enabled: true,
    booking_rescheduled_enabled: true,
    appointment_reminder_10m_enabled: true,
    grooming_started_enabled: true,
    grooming_almost_done_enabled: true,
    grooming_completed_enabled: true,
  };
}

export function normalizeGuardianNotificationSettings(settings: Partial<GuardianNotificationSettings> | null | undefined): GuardianNotificationSettings {
  const merged = {
    ...defaultGuardianNotificationSettings,
    ...(settings ?? {}),
  };

  return {
    enabled: merged.enabled,
    revisit_enabled: merged.revisit_enabled,
    booking_confirmed_enabled: merged.booking_confirmed_enabled,
    booking_cancelled_enabled: merged.booking_cancelled_enabled,
    booking_rescheduled_enabled: merged.booking_rescheduled_enabled,
    appointment_reminder_10m_enabled: merged.appointment_reminder_10m_enabled,
    grooming_started_enabled: merged.grooming_started_enabled,
    grooming_almost_done_enabled: merged.grooming_almost_done_enabled,
    grooming_completed_enabled: merged.grooming_completed_enabled,
    birthday_greeting_enabled: merged.birthday_greeting_enabled,
  };
}

export function normalizeShopNotifications<T extends Pick<Shop, "notification_settings">>(shop: T): T {
  return {
    ...shop,
    notification_settings: normalizeShopNotificationSettings(shop.notification_settings),
  };
}

export function normalizeGuardianNotifications<T extends Pick<Guardian, "notification_settings">>(guardian: T): T {
  return {
    ...guardian,
    notification_settings: normalizeGuardianNotificationSettings(guardian.notification_settings),
  };
}

export function normalizeBootstrapNotifications(payload: BootstrapPayload): BootstrapPayload {
  return {
    ...payload,
    shop: normalizeShopNotifications(payload.shop),
    guardians: payload.guardians.map((guardian) => normalizeGuardianNotifications(guardian)),
  };
}
