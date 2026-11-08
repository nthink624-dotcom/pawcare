"use client";
import { useState, useSyncExternalStore } from "react";
import { DEPOSIT_ALIMTALK_REVIEW_CONTRACTS } from "@petmanager/shared/contracts/deposit-alimtalk-review";
import { OwnerAlimtalkTemplateEditor } from "@/components/owner-web/owner-alimtalk-template-editor";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias } from "@/lib/notification-registry";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import type { AlimtalkSenderMode, AlimtalkShopChannelStatus, NotificationDeliveryMode } from "@/types/domain";

export type AlertSettingsDraft = {
  enabled: boolean;
  alimtalkTypeEnabled?: Record<string, boolean>;
  alimtalkSenderMode: AlimtalkSenderMode;
  alimtalkShopChannelStatus: AlimtalkShopChannelStatus;
  alimtalkShopChannelName: string;
  alimtalkShopChannelUrl: string;
  alimtalkSenderProfileKey: string;
  alimtalkChannelRequestedAt: string | null;
  alimtalkChannelAdminNote: string;
  alimtalkBusinessChannelVerified: boolean;
  alimtalkTemplateRequestNote: string;
  alimtalkTemplateRequestUpdatedAt: string | null;
  revisitEnabled: boolean;
  revisitReminderDefaultDays: number;
  bookingConfirmedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingConsentRequestEnabled?: boolean;
  bookingDepositRequestEnabled?: boolean;
  bookingRescheduledEnabled: boolean;
  appointmentReminder10mEnabled: boolean;
  appointmentReminder10mMode: NotificationDeliveryMode;
  visitReminderOffsetMinutes: number;
  groomingStartedEnabled: boolean;
  groomingAlmostDoneEnabled: boolean;
  pickupReadyEtaMinutes: number;
  groomingCompletedEnabled: boolean;
  groomingStartWithoutPhotoEnabled: boolean;
  groomingCompleteWithoutPhotoEnabled: boolean;
};


type AlertToggleKey = "bookingConfirmedEnabled" | "bookingCancelledEnabled" | "appointmentReminder10mEnabled" | "groomingStartedEnabled" | "groomingAlmostDoneEnabled" | "groomingCompletedEnabled" | "revisitEnabled";
const reservationNoticeTypes = ["appointment_reminder_10m", "visit_reminder_notice", "visit_schedule_notice"];
const toggleKeys: Partial<Record<AlimtalkTemplateAlias, AlertToggleKey>> = {
 booking_confirmed: "bookingConfirmedEnabled", booking_cancelled: "bookingCancelledEnabled",
 appointment_reminder_10m: "appointmentReminder10mEnabled", visit_reminder_notice: "appointmentReminder10mEnabled", visit_schedule_notice: "appointmentReminder10mEnabled",
 grooming_started: "groomingStartedEnabled", grooming_almost_done: "groomingAlmostDoneEnabled", grooming_completed: "groomingCompletedEnabled", grooming_completed_without_report: "groomingCompletedEnabled", revisit_notice: "revisitEnabled",
};
const subscribeLocation = (onChange: () => void) => { window.addEventListener("popstate", onChange); return () => window.removeEventListener("popstate", onChange); };
const readLocation = () => window.location.search;
const serverLocation = () => "";
export default function SettingsAlertsPanel({ value, onChange, shopId, shopName, automaticVisitReminderAvailable = true, demoMode = false }: {
 value: AlertSettingsDraft; onChange: (value: AlertSettingsDraft) => void | Promise<void>; shopId: string; shopName: string; automaticVisitReminderAvailable?: boolean; demoMode?: boolean;
}) {
 const query = useSyncExternalStore(subscribeLocation, readLocation, serverLocation);
 const params = new URLSearchParams(query), routeAlias = params.get("templateAlias");
 const [chosenAlias, setSelectedTemplateAlias] = useState<AlimtalkTemplateAlias | null>(null);
 const selectedTemplateAlias = chosenAlias ?? ((!params.get("shopId") || params.get("shopId") === shopId) && routeAlias !== "revisit_notice" && ALIMTALK_NOTIFICATION_REGISTRY.some(item => item.templateAlias === routeAlias) ? routeAlias as AlimtalkTemplateAlias : "booking_confirmed");
  const templateGroupOrder = ["내 문안 작성 가능", "내용 고정"];
  const templateOptions = ALIMTALK_NOTIFICATION_REGISTRY
    .filter((item) => item.templateAlias !== "booking_received" && item.templateAlias !== "revisit_notice")
    .map((item) => ({
    alias: item.templateAlias,
    type: item.type,
    title: item.templateAlias === "grooming_completed" ? "미용완료 - 케어리포트 있음" : item.templateAlias === "grooming_completed_without_report" ? "미용완료 - 케어리포트 없음" : item.templateAlias === "booking_deposit_request" ? "예약금 안내" : item.title,
    group: item.templateAlias === "booking_consent_request" || item.templateAlias in DEPOSIT_ALIMTALK_REVIEW_CONTRACTS
      ? "내용 고정"
      : "내 문안 작성 가능",
  })).sort((left, right) => templateGroupOrder.indexOf(left.group) - templateGroupOrder.indexOf(right.group));


 function deliveryState(alias: AlimtalkTemplateAlias) {
   const key = toggleKeys[alias];
   const legacyEnabled = key === "appointmentReminder10mEnabled" ? value.appointmentReminder10mEnabled && value.appointmentReminder10mMode === "auto" : key ? Boolean(value[key]) : true;
   return { enabled: value.enabled && (value.alimtalkTypeEnabled?.[alias] ?? legacyEnabled), disabled: !value.enabled || (reservationNoticeTypes.includes(alias) && !automaticVisitReminderAvailable) };
 }
 function toggleDelivery(alias: AlimtalkTemplateAlias) {
   const state = deliveryState(alias); if (state.disabled) return;
   void onChange({ ...value, alimtalkTypeEnabled: { ...value.alimtalkTypeEnabled, [alias]: !state.enabled } });
 }
 return <section data-pc-alerts-surface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] bg-white">
   <OwnerAlimtalkTemplateEditor key={shopId} shopId={shopId} shopName={shopName} senderName={value.alimtalkSenderMode === "petmanager" ? PETMANAGER_SERVICE_NAME : value.alimtalkShopChannelName || shopName} demoMode={demoMode}
    selectedAlias={selectedTemplateAlias} options={templateOptions} onSelectAlias={setSelectedTemplateAlias} globalAlimtalkEnabled={value.enabled} onGlobalAlimtalkEnabledChange={enabled => onChange({ ...value, enabled })} deliveryState={deliveryState} onToggleDelivery={toggleDelivery}
   />
 </section>;
}
