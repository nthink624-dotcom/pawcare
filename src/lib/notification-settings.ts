import type { BootstrapPayload, Guardian, GuardianNotificationSettings, Shop, ShopNotificationSettings } from "@/types/domain";

export const defaultShopNotificationSettings: ShopNotificationSettings = {
  enabled: true,
  revisit_enabled: true,
  booking_confirmed_enabled: true,
  booking_rejected_enabled: true,
  booking_cancelled_enabled: true,
  booking_rescheduled_enabled: true,
  appointment_reminder_10m_enabled: true,
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
  booking_rejected_enabled: true,
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
  return {
    ...defaultShopNotificationSettings,
    ...(settings ?? {}),
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
  return {
    ...defaultGuardianNotificationSettings,
    ...(settings ?? {}),
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
