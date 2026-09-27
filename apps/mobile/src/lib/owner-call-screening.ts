import { Capacitor, registerPlugin } from "@capacitor/core";

import { fetchApiJsonWithAuth, getAccessTokenWithRecovery } from "@/lib/api";
import { getMobileApiOrigin } from "@/lib/env";

type OwnerCallScreeningPlugin = {
  getStatus(): Promise<{ available: boolean; enabled: boolean; phoneStateGranted: boolean; deviceId: string }>;
  requestPhoneStateAccess(): Promise<{ granted: boolean }>;
  requestRole(): Promise<{ enabled: boolean }>;
  configure(options: { shopId: string; integrationId: string; apiOrigin: string; accessToken: string }): Promise<{ configured: boolean }>;
  getPendingEvents(): Promise<{ events: Array<Record<string, unknown>> }>;
  acknowledgeEvents(options: { eventIds: string[] }): Promise<void>;
};

const OwnerCallScreening = registerPlugin<OwnerCallScreeningPlugin>("OwnerCallScreening");

export function isOwnerCallScreeningAvailable() {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("OwnerCallScreening");
}

export async function getOwnerCallScreeningStatus() {
  if (!isOwnerCallScreeningAvailable()) return { available: false, enabled: false, phoneStateGranted: false, deviceId: "" };
  return OwnerCallScreening.getStatus();
}

export async function requestOwnerCallScreeningRole() {
  if (!isOwnerCallScreeningAvailable()) throw new Error("Android 앱에서만 자동 통화 확인을 켤 수 있습니다.");
  return OwnerCallScreening.requestRole();
}

export async function configureOwnerCallScreening(shopId: string) {
  if (!isOwnerCallScreeningAvailable()) return { available: false, enabled: false };
  const status = await OwnerCallScreening.getStatus();
  if (!status.deviceId) throw new Error("Android 통화 확인 장치 정보를 만들지 못했습니다.");
  const integration = await fetchApiJsonWithAuth<{ ok: true; integrationId: string }>("/api/owner/call-events/android/setup", {
    method: "POST",
    body: JSON.stringify({ shopId, deviceId: status.deviceId }),
  });
  const accessToken = await getAccessTokenWithRecovery();
  await OwnerCallScreening.configure({
    shopId,
    integrationId: integration.integrationId,
    apiOrigin: getMobileApiOrigin(),
    accessToken,
  });
  await OwnerCallScreening.requestPhoneStateAccess();
  await syncOwnerCallScreeningEvents(shopId);
  return { available: status.available, enabled: status.enabled };
}

export async function syncOwnerCallScreeningEvents(shopId: string) {
  if (!isOwnerCallScreeningAvailable()) return { sent: 0 };
  const pending = await OwnerCallScreening.getPendingEvents();
  const acknowledged: string[] = [];
  for (const event of pending.events ?? []) {
    const providerEventId = typeof event.providerEventId === "string" ? event.providerEventId : "";
    if (!providerEventId) continue;
    try {
      await fetchApiJsonWithAuth("/api/owner/call-events/android/events", {
        method: "POST",
        body: JSON.stringify({ ...event, shopId }),
      });
      acknowledged.push(providerEventId);
    } catch {
      // Keep the encrypted native queue for the next authenticated app launch.
    }
  }
  if (acknowledged.length > 0) await OwnerCallScreening.acknowledgeEvents({ eventIds: acknowledged });
  return { sent: acknowledged.length };
}
