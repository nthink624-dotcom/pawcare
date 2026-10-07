import { Capacitor, registerPlugin } from "@capacitor/core";

import { fetchApiJsonWithAuth, getAccessTokenWithRecovery } from "@/lib/api";
import { getMobileApiOrigin } from "@/lib/env";

type OwnerCallScreeningPlugin = {
  getStatus(): Promise<{ available: boolean; enabled: boolean; active: boolean; phoneStateGranted: boolean; deviceId: string }>;
  requestPhoneStateAccess(): Promise<{ granted: boolean }>;
  requestNotificationAccess(): Promise<{ granted: boolean }>;
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  requestRole(): Promise<{ enabled: boolean }>;
  configure(options: { shopId: string; integrationId: string; apiOrigin: string; accessToken: string }): Promise<{ configured: boolean }>;
  setPhoneAllowlist(options: { phoneNumbers: string[] }): Promise<{ configured: boolean }>;
  getPendingEvents(): Promise<{ events: Array<Record<string, unknown>> }>;
  acknowledgeEvents(options: { eventIds: string[] }): Promise<void>;
  getPendingChoices(): Promise<{ choices: Array<Record<string, unknown>> }>;
  acknowledgeChoices(options: { providerCallIds: string[] }): Promise<void>;
  getPendingReservationAction(): Promise<{ pending: boolean; providerCallId: string; callerNumber: string }>;
  clearPendingReservationAction(): Promise<void>;
  getPendingIncomingCallChoice(): Promise<{ pending: boolean; providerCallId: string; callerNumber: string; action?: "choose" | "new-customer" }>;
  clearPendingIncomingCallChoice(): Promise<void>;
  addListener(eventName: "reservationAction" | "incomingCallChoice", listenerFunc: (action: { pending: boolean; providerCallId: string; callerNumber: string; action?: "choose" | "new-customer" }) => void): Promise<{ remove: () => Promise<void> }>;
};

const OwnerCallScreening = registerPlugin<OwnerCallScreeningPlugin>("OwnerCallScreening");

export function isOwnerCallScreeningAvailable() {
  return Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("OwnerCallScreening");
}

export async function getOwnerCallScreeningStatus() {
  if (!isOwnerCallScreeningAvailable()) return { available: false, enabled: false, active: false, phoneStateGranted: false, deviceId: "" };
  return OwnerCallScreening.getStatus();
}

export async function requestOwnerCallScreeningRole() {
  if (!isOwnerCallScreeningAvailable()) throw new Error("Android 앱에서만 자동 통화 확인을 켤 수 있습니다.");
  return OwnerCallScreening.requestRole();
}

export type OwnerCallReservationAction = {
  pending: boolean;
  providerCallId: string;
  callerNumber: string;
};

export type OwnerIncomingCallChoice = {
  pending: boolean;
  providerCallId: string;
  callerNumber: string;
  action?: "choose" | "new-customer";
};

export async function requestOwnerCallNotificationAccess() {
  if (!isOwnerCallScreeningAvailable()) return { granted: false };
  return OwnerCallScreening.requestNotificationAccess();
}

export async function setOwnerCallScreeningEnabled(enabled: boolean) {
  if (!isOwnerCallScreeningAvailable()) return { enabled: false };
  return OwnerCallScreening.setEnabled({ enabled });
}

export async function getOwnerCallReservationAction(): Promise<OwnerCallReservationAction> {
  if (!isOwnerCallScreeningAvailable()) return { pending: false, providerCallId: "", callerNumber: "" };
  return OwnerCallScreening.getPendingReservationAction();
}

export async function clearOwnerCallReservationAction() {
  if (!isOwnerCallScreeningAvailable()) return;
  await OwnerCallScreening.clearPendingReservationAction();
}

export async function addOwnerCallReservationActionListener(
  listener: (action: OwnerCallReservationAction) => void,
) {
  if (!isOwnerCallScreeningAvailable()) return null;
  const handle = await OwnerCallScreening.addListener("reservationAction", listener);
  return () => handle.remove();
}

export async function getOwnerIncomingCallChoice(): Promise<OwnerIncomingCallChoice> {
  if (!isOwnerCallScreeningAvailable()) return { pending: false, providerCallId: "", callerNumber: "" };
  return OwnerCallScreening.getPendingIncomingCallChoice();
}

export async function clearOwnerIncomingCallChoice() {
  if (!isOwnerCallScreeningAvailable()) return;
  await OwnerCallScreening.clearPendingIncomingCallChoice();
}

export async function addOwnerIncomingCallChoiceListener(
  listener: (action: OwnerIncomingCallChoice) => void,
) {
  if (!isOwnerCallScreeningAvailable()) return null;
  const handle = await OwnerCallScreening.addListener("incomingCallChoice", listener);
  return () => handle.remove();
}

export async function configureOwnerCallScreening(shopId: string, phoneNumbers: string[]) {
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
  await OwnerCallScreening.setPhoneAllowlist({ phoneNumbers });
  await OwnerCallScreening.requestPhoneStateAccess();
  await OwnerCallScreening.requestNotificationAccess();
  await syncOwnerCallScreeningEvents(shopId);
  return { available: status.available, enabled: status.enabled };
}

export async function syncOwnerCallScreeningPhoneAllowlist(phoneNumbers: string[]) {
  if (!isOwnerCallScreeningAvailable()) return;
  await OwnerCallScreening.setPhoneAllowlist({ phoneNumbers });
}

export async function syncOwnerCallScreeningEvents(shopId: string) {
  if (!isOwnerCallScreeningAvailable()) return { sent: 0 };
  const status = await OwnerCallScreening.getStatus();
  if (!status.enabled || !status.active) return { sent: 0 };
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

  const pendingChoices = await OwnerCallScreening.getPendingChoices();
  const acknowledgedChoices: string[] = [];
  for (const choice of pendingChoices.choices ?? []) {
    const providerCallId = typeof choice.providerCallId === "string" ? choice.providerCallId : "";
    const choiceShopId = typeof choice.shopId === "string" ? choice.shopId : shopId;
    const action = choice.action === "reservation_selected" || choice.action === "phone_only_selected" ? choice.action : "";
    if (!providerCallId || !choiceShopId || !action) continue;
    try {
      await fetchApiJsonWithAuth("/api/owner/call-events/android/choices", {
        method: "POST",
        body: JSON.stringify({ shopId: choiceShopId, providerCallId, action }),
      });
      acknowledgedChoices.push(providerCallId);
    } catch {
      // Retry after the incoming event is uploaded and authentication/network are available.
    }
  }
  if (acknowledgedChoices.length > 0) await OwnerCallScreening.acknowledgeChoices({ providerCallIds: acknowledgedChoices });
  return { sent: acknowledged.length, choicesSent: acknowledgedChoices.length };
}
