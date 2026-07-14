import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getOwnerApiConfig } from "@/services/ownerApiConfig";

export type OwnerPushPayload = {
  kind: "owner_booking_requested";
  notificationId?: string | null;
  shopId?: string | null;
  appointmentId?: string | null;
  guardianId?: string | null;
  petId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  title?: string | null;
  body?: string | null;
  route?: {
    tab?: "Reservations" | "Today";
    screen?: "ReservationDetail" | "ReservationList";
    params?: {
      reservationId?: string;
    };
  };
};

export type OwnerPushRegistrationInput = {
  accessToken: string;
  shopId: string;
  ownerId: string;
  staffMemberId?: string | null;
};

export type OwnerPushRegistrationResult =
  | {
      status: "registered";
      pushToken: string;
    }
  | {
      status: "unsupported" | "permission-denied" | "config-missing" | "api-error";
      message: string;
    };

export type OwnerPushListenerCleanup = {
  remove(): void;
};

type StoredPushRegistration = {
  pushToken: string;
  shopId: string;
  provider: "expo";
  platform: "ios" | "android" | "web" | "unknown";
};

const PUSH_REGISTRATION_STORAGE_KEY = "petmanager.ownerPushRegistration.v1";

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }) as Notifications.NotificationBehavior,
});

function readEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
}

function resolveOwnerApiBaseUrl() {
  return getOwnerApiConfig().apiBaseUrl.replace(/\/+$/, "");
}

function resolveExpoProjectId() {
  return readEnv("EXPO_PUBLIC_EAS_PROJECT_ID") || readEnv("EXPO_PUBLIC_EXPO_PROJECT_ID") || "";
}

function getPlatform() {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") return Platform.OS;
  return "unknown";
}

async function getDeviceId() {
  if (Platform.OS === "android") {
    return Application.getAndroidId();
  }

  if (Platform.OS === "ios") {
    return Application.getIosIdForVendorAsync();
  }

  return null;
}

async function readStoredPushRegistration(): Promise<StoredPushRegistration | null> {
  const raw = await SecureStore.getItemAsync(PUSH_REGISTRATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredPushRegistration;
  } catch {
    await SecureStore.deleteItemAsync(PUSH_REGISTRATION_STORAGE_KEY);
    return null;
  }
}

async function storePushRegistration(registration: StoredPushRegistration) {
  await SecureStore.setItemAsync(PUSH_REGISTRATION_STORAGE_KEY, JSON.stringify(registration));
}

async function clearStoredPushRegistration() {
  await SecureStore.deleteItemAsync(PUSH_REGISTRATION_STORAGE_KEY);
}

async function requestPushPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return current;

  return Notifications.requestPermissionsAsync();
}

export async function registerOwnerPushDevice(input: OwnerPushRegistrationInput): Promise<OwnerPushRegistrationResult> {
  const apiBaseUrl = resolveOwnerApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      status: "config-missing",
      message: "Owner API base URL is required before registering push notifications.",
    };
  }

  if (Platform.OS === "web") {
    return {
      status: "unsupported",
      message: "Web runtime does not register native push tokens.",
    };
  }

  if (!Device.isDevice) {
    return {
      status: "unsupported",
      message: "Push notifications require a physical device.",
    };
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    return {
      status: "config-missing",
      message: "EXPO_PUBLIC_EAS_PROJECT_ID is required before requesting an Expo push token.",
    };
  }

  const permission = await requestPushPermission();
  if (!permission.granted) {
    return {
      status: "permission-denied",
      message: "Push notification permission was not granted.",
    };
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  const pushToken = tokenResult.data;
  const deviceId = await getDeviceId();
  const platform = getPlatform();
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const response = await fetch(`${apiBaseUrl}/api/owner/push-tokens`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shopId: input.shopId,
      staffMemberId: input.staffMemberId ?? null,
      provider: "expo",
      platform,
      pushToken,
      deviceId,
      deviceName: Device.deviceName ?? null,
      appId: Application.applicationId ?? null,
      appVersion: Application.nativeApplicationVersion ?? null,
      locale,
      timezone,
      metadata: {
        ownerId: input.ownerId,
        installationSource: Application.getInstallReferrerAsync ? await Application.getInstallReferrerAsync().catch(() => null) : null,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return {
      status: "api-error",
      message:
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : "Failed to register push token.",
    };
  }

  await storePushRegistration({
    pushToken,
    shopId: input.shopId,
    provider: "expo",
    platform,
  });

  return {
    status: "registered",
    pushToken,
  };
}

export async function deactivateOwnerPushDevice(input: { accessToken: string | null; shopId?: string | null }) {
  const apiBaseUrl = resolveOwnerApiBaseUrl();
  const stored = await readStoredPushRegistration();

  if (!apiBaseUrl || !input.accessToken || !stored) {
    await clearStoredPushRegistration();
    return;
  }

  await fetch(`${apiBaseUrl}/api/owner/push-tokens`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shopId: input.shopId || stored.shopId,
      pushToken: stored.pushToken,
    }),
  }).catch(() => undefined);

  await clearStoredPushRegistration();
}

export function extractOwnerPushPayload(data: unknown): OwnerPushPayload | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  const kind = payload.kind;

  if (kind !== "owner_booking_requested") return null;

  const appointmentId = typeof payload.appointmentId === "string" ? payload.appointmentId : null;
  const route =
    payload.route && typeof payload.route === "object" && !Array.isArray(payload.route)
      ? (payload.route as OwnerPushPayload["route"])
      : undefined;

  return {
    kind,
    notificationId: typeof payload.notificationId === "string" ? payload.notificationId : null,
    shopId: typeof payload.shopId === "string" ? payload.shopId : null,
    appointmentId,
    guardianId: typeof payload.guardianId === "string" ? payload.guardianId : null,
    petId: typeof payload.petId === "string" ? payload.petId : null,
    serviceId: typeof payload.serviceId === "string" ? payload.serviceId : null,
    staffId: typeof payload.staffId === "string" ? payload.staffId : null,
    title: typeof payload.title === "string" ? payload.title : null,
    body: typeof payload.body === "string" ? payload.body : null,
    route:
      route ??
      (appointmentId
        ? {
            tab: "Reservations",
            screen: "ReservationDetail",
            params: { reservationId: appointmentId },
          }
        : {
            tab: "Reservations",
            screen: "ReservationList",
          }),
  };
}

export function addOwnerPushListeners({
  onNotificationReceived,
  onNotificationResponse,
}: {
  onNotificationReceived: (payload: OwnerPushPayload) => void;
  onNotificationResponse: (payload: OwnerPushPayload) => void;
}): OwnerPushListenerCleanup {
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const payload = extractOwnerPushPayload(notification.request.content.data);
    if (payload) onNotificationReceived(payload);
  });
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = extractOwnerPushPayload(response.notification.request.content.data);
    if (payload) onNotificationResponse(payload);
  });

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      const payload = response ? extractOwnerPushPayload(response.notification.request.content.data) : null;
      if (payload) onNotificationResponse(payload);
    })
    .catch(() => undefined);

  return {
    remove() {
      receivedSubscription.remove();
      responseSubscription.remove();
    },
  };
}
