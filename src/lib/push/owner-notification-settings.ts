import { Capacitor, registerPlugin } from "@capacitor/core";

type OwnerNotificationSettingsPlugin = {
  getAppNotificationState(): Promise<{ enabled: boolean }>;
  openAppNotificationSettings(): Promise<void>;
  openChannelNotificationSettings(options: { channelId: string }): Promise<void>;
};

const NotificationSettings = registerPlugin<OwnerNotificationSettingsPlugin>("OwnerNotificationSettings");
const allowedChannelIds = new Set([
  "owner-bookings-sound-v1",
  "owner-bookings-vibrate-v1",
  "owner-bookings-silent-v1",
]);

export async function openOwnerAppNotificationSettings() {
  if (Capacitor.getPlatform() !== "android") {
    window.location.assign("app-settings:");
    return;
  }
  await NotificationSettings.openAppNotificationSettings();
}

export async function readOwnerAppNotificationsEnabled() {
  if (Capacitor.getPlatform() !== "android") return true;
  const state = await NotificationSettings.getAppNotificationState();
  return state.enabled;
}

export async function openOwnerChannelNotificationSettings(channelId: string) {
  if (!allowedChannelIds.has(channelId)) throw new Error("알림 채널을 확인하지 못했습니다.");
  if (Capacitor.getPlatform() !== "android") {
    window.location.assign("app-settings:");
    return;
  }
  await NotificationSettings.openChannelNotificationSettings({ channelId });
}
