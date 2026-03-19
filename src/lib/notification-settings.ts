import type { BootstrapPayload, Guardian, GuardianNotificationSettings, Shop, ShopNotificationSettings } from "@/types/domain";

export const defaultShopNotificationSettings: ShopNotificationSettings = {
  enabled: false,
  revisit_enabled: false,
  booking_confirmed_enabled: false,
  booking_rejected_enabled: false,
  booking_cancelled_enabled: false,
  booking_rescheduled_enabled: false,
  grooming_almost_done_enabled: false,
  grooming_completed_enabled: false,
};

export const defaultGuardianNotificationSettings: GuardianNotificationSettings = {
  enabled: false,
  revisit_enabled: false,
};

export function normalizeShopNotificationSettings(settings: Partial<ShopNotificationSettings> | null | undefined): ShopNotificationSettings {
  return {
    ...defaultShopNotificationSettings,
    ...(settings ?? {}),
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
