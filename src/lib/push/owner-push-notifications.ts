"use client";

import { Capacitor } from "@capacitor/core";
import type { PermissionState, PluginListenerHandle } from "@capacitor/core";
import type { PushNotificationSchema, PushNotificationsPlugin } from "@capacitor/push-notifications";

import { fetchApiJsonWithAuth } from "@/lib/api";

export type OwnerPushAlertMode = "sound" | "vibrate" | "silent";

export type OwnerPushPreferences = {
  enabled: boolean;
  bookingRequestedEnabled: boolean;
  alertMode: OwnerPushAlertMode;
};

export type OwnerPushRuntimeState = {
  supported: boolean;
  permission: PermissionState | "unsupported";
  registered: boolean;
  message: string;
};

export type OwnerPushRegistrationContext = {
  shopId: string;
  staffMemberId: string | null;
  appRole: "owner" | "staff";
};

export type OwnerPushReceivedEventDetail = {
  kind: "owner_booking_requested";
  shopId: string | null;
  appointmentId: string | null;
  opened: boolean;
};

export const OWNER_PUSH_STATE_CHANGED_EVENT = "petmanager:owner-push-state-changed";
export const OWNER_PUSH_RECEIVED_EVENT = "petmanager:owner-push-received";

const PREFERENCES_STORAGE_KEY = "petmanager.ownerPushPreferences.v1";
const DEVICE_ID_STORAGE_KEY = "petmanager.ownerPushDeviceId.v1";
const APP_ID = "kr.petmanager.owner";

const alertModeChannelIds: Record<OwnerPushAlertMode, string> = {
  sound: "owner-bookings-sound-v1",
  vibrate: "owner-bookings-vibrate-v1",
  silent: "owner-bookings-silent-v1",
};

const defaultPreferences: OwnerPushPreferences = {
  enabled: false,
  bookingRequestedEnabled: true,
  alertMode: "sound",
};

const initialRuntimeState: OwnerPushRuntimeState = {
  supported: false,
  permission: "unsupported",
  registered: false,
  message: "앱을 설치한 휴대폰에서 설정할 수 있어요.",
};

let runtimeState = initialRuntimeState;
let activeContext: OwnerPushRegistrationContext | null = null;
let activePushToken: string | null = null;
let pushPluginPromise: Promise<PushNotificationsPlugin> | null = null;
let listenerSetupPromise: Promise<void> | null = null;
let listenerHandles: PluginListenerHandle[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAlertMode(value: unknown): value is OwnerPushAlertMode {
  return value === "sound" || value === "vibrate" || value === "silent";
}

function emitRuntimeState(nextState: OwnerPushRuntimeState) {
  runtimeState = nextState;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<OwnerPushRuntimeState>(OWNER_PUSH_STATE_CHANGED_EVENT, { detail: nextState }));
  }
}

function getLocale() {
  return typeof navigator !== "undefined" ? navigator.language : "ko-KR";
}

function getTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

function createDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getDeviceId() {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)?.trim();
  if (stored) return stored;

  const next = createDeviceId();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

function getAndroidChannelId(alertMode: OwnerPushAlertMode) {
  return alertModeChannelIds[alertMode];
}

async function getPushPlugin() {
  if (!pushPluginPromise) {
    pushPluginPromise = import("@capacitor/push-notifications").then((module) => module.PushNotifications);
  }
  return pushPluginPromise;
}

async function createAndroidChannels(plugin: PushNotificationsPlugin) {
  if (Capacitor.getPlatform() !== "android") return;

  await Promise.all([
    plugin.createChannel({
      id: alertModeChannelIds.sound,
      name: "새 예약 알림 - 소리",
      description: "고객이 새 예약을 접수했을 때 소리와 진동으로 알려드려요.",
      importance: 4,
      vibration: true,
    }),
    plugin.createChannel({
      id: alertModeChannelIds.vibrate,
      name: "새 예약 알림 - 진동",
      description: "고객이 새 예약을 접수했을 때 진동으로 알려드려요.",
      importance: 3,
      vibration: true,
    }),
    plugin.createChannel({
      id: alertModeChannelIds.silent,
      name: "새 예약 알림 - 무음",
      description: "고객이 새 예약을 접수했을 때 소리와 진동 없이 표시해요.",
      importance: 2,
      vibration: false,
    }),
  ]);
}

async function registerPushToken(pushToken: string) {
  if (!activeContext) return;

  const preferences = getOwnerPushPreferences();
  if (!preferences.enabled) return;

  const platform = Capacitor.getPlatform();
  const provider = platform === "ios" ? "apns" : "fcm";

  await fetchApiJsonWithAuth("/api/owner/push-tokens", {
    method: "POST",
    body: JSON.stringify({
      shopId: activeContext.shopId,
      staffMemberId: activeContext.staffMemberId,
      provider,
      platform,
      pushToken,
      deviceId: getDeviceId(),
      appId: APP_ID,
      locale: getLocale(),
      timezone: getTimeZone(),
      metadata: {
        appRole: activeContext.appRole,
        bookingRequestedEnabled: preferences.bookingRequestedEnabled,
        alertMode: preferences.alertMode,
        androidChannelId: getAndroidChannelId(preferences.alertMode),
      },
    }),
  });

  activePushToken = pushToken;
  emitRuntimeState({
    supported: true,
    permission: "granted",
    registered: true,
    message: "이 휴대폰이 앱 알림 수신 기기로 연결되었습니다.",
  });
}

function readPushEventDetail(notification: PushNotificationSchema, opened: boolean): OwnerPushReceivedEventDetail | null {
  const data = isRecord(notification.data) ? notification.data : {};
  const route = isRecord(data.route) ? data.route : null;
  const params = route && isRecord(route.params) ? route.params : null;
  const kind = data.kind;

  if (kind !== "owner_booking_requested") return null;

  const appointmentIdValue = data.appointmentId ?? data.reservationId ?? params?.reservationId;

  return {
    kind,
    shopId: typeof data.shopId === "string" ? data.shopId : null,
    appointmentId: typeof appointmentIdValue === "string" ? appointmentIdValue : null,
    opened,
  };
}

function emitPushEvent(notification: PushNotificationSchema, opened: boolean) {
  if (typeof window === "undefined") return;

  const detail = readPushEventDetail(notification, opened);
  if (!detail) return;

  window.dispatchEvent(new CustomEvent<OwnerPushReceivedEventDetail>(OWNER_PUSH_RECEIVED_EVENT, { detail }));
}

async function ensurePushListeners(plugin: PushNotificationsPlugin) {
  if (listenerSetupPromise) return listenerSetupPromise;

  listenerSetupPromise = (async () => {
    listenerHandles = await Promise.all([
      plugin.addListener("registration", (token) => {
        void registerPushToken(token.value).catch(() => {
          emitRuntimeState({
            supported: true,
            permission: "granted",
            registered: false,
            message: "알림 기기를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          });
        });
      }),
      plugin.addListener("registrationError", () => {
        emitRuntimeState({
          supported: true,
          permission: runtimeState.permission === "unsupported" ? "prompt" : runtimeState.permission,
          registered: false,
          message: "휴대폰 알림 연결을 완료하지 못했습니다. 앱 설정을 확인해 주세요.",
        });
      }),
      plugin.addListener("pushNotificationReceived", (notification) => {
        emitPushEvent(notification, false);
      }),
      plugin.addListener("pushNotificationActionPerformed", (action) => {
        emitPushEvent(action.notification, true);
      }),
    ]);
  })();

  return listenerSetupPromise;
}

export function getOwnerPushPreferences(): OwnerPushPreferences {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || "null");
    if (!isRecord(parsed)) return defaultPreferences;

    return {
      enabled: parsed.enabled === true,
      bookingRequestedEnabled: parsed.bookingRequestedEnabled !== false,
      alertMode: isAlertMode(parsed.alertMode) ? parsed.alertMode : defaultPreferences.alertMode,
    };
  } catch {
    return defaultPreferences;
  }
}

export function getOwnerPushRuntimeState() {
  return runtimeState;
}

export async function syncOwnerPushNotifications(
  context: OwnerPushRegistrationContext,
  options: { requestPermission?: boolean } = {},
) {
  activeContext = context;
  const preferences = getOwnerPushPreferences();

  if (!Capacitor.isNativePlatform()) {
    emitRuntimeState(initialRuntimeState);
    return runtimeState;
  }

  const plugin = await getPushPlugin();
  await ensurePushListeners(plugin);
  await createAndroidChannels(plugin);

  let permission = (await plugin.checkPermissions()).receive;
  if (preferences.enabled && options.requestPermission && permission !== "granted") {
    permission = (await plugin.requestPermissions()).receive;
  }

  if (!preferences.enabled) {
    emitRuntimeState({
      supported: true,
      permission,
      registered: false,
      message: "앱 알림이 꺼져 있습니다.",
    });
    return runtimeState;
  }

  if (permission !== "granted") {
    emitRuntimeState({
      supported: true,
      permission,
      registered: false,
      message:
        permission === "denied"
          ? "휴대폰 설정에서 알림 권한을 허용해 주세요."
          : "앱 알림을 켜면 휴대폰 알림 권한을 요청합니다.",
    });
    return runtimeState;
  }

  emitRuntimeState({
    supported: true,
    permission,
    registered: false,
    message: "휴대폰을 알림 수신 기기로 연결하고 있습니다.",
  });
  await plugin.register();
  return runtimeState;
}

export async function updateOwnerPushPreferences(
  preferences: OwnerPushPreferences,
  context: OwnerPushRegistrationContext,
) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }

  if (!preferences.enabled) {
    await deactivateOwnerPushNotifications(context);
    return runtimeState;
  }

  if (activePushToken) {
    activeContext = context;
    await registerPushToken(activePushToken);
    return runtimeState;
  }

  return syncOwnerPushNotifications(context, { requestPermission: true });
}

export async function deactivateOwnerPushNotifications(context: OwnerPushRegistrationContext) {
  activeContext = context;
  const deviceId = getDeviceId();
  let deactivationError: unknown = null;

  if (deviceId) {
    try {
      await fetchApiJsonWithAuth("/api/owner/push-tokens", {
        method: "DELETE",
        body: JSON.stringify({ shopId: context.shopId, deviceId }),
      });
    } catch (error) {
      deactivationError = error;
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const plugin = await getPushPlugin();
      await plugin.unregister();
    } catch (error) {
      deactivationError ??= error;
    }
  }

  activePushToken = null;
  emitRuntimeState({
    supported: Capacitor.isNativePlatform(),
    permission: runtimeState.permission,
    registered: false,
    message: "앱 알림이 꺼져 있습니다.",
  });

  if (deactivationError) throw deactivationError;
  return runtimeState;
}

export async function removeOwnerPushListenersForTests() {
  await Promise.all(listenerHandles.map((handle) => handle.remove()));
  listenerHandles = [];
  listenerSetupPromise = null;
  activeContext = null;
  activePushToken = null;
}
