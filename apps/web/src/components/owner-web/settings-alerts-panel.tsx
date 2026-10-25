"use client";
import { useState, useSyncExternalStore } from "react";
import { SettingsRevisitReminderDefault } from "@/components/owner-web/settings-revisit-reminder-default";
import { OwnerAlimtalkTemplateEditor } from "@/components/owner-web/owner-alimtalk-template-editor";
import { AlertSettingsSwitch } from "@/components/owner-web/settings-alert-switch";
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
 const selectedTemplateAlias = chosenAlias ?? ((!params.get("shopId") || params.get("shopId") === shopId) && ALIMTALK_NOTIFICATION_REGISTRY.some(item => item.templateAlias === routeAlias) ? routeAlias as AlimtalkTemplateAlias : "booking_confirmed");
  const templateGroupOrder = ["예약 전 준비", "예약 알림", "예약 안내", "미용 진행"];
  const templateOptions = ALIMTALK_NOTIFICATION_REGISTRY
    .filter((item) => item.templateAlias !== "booking_received")
    .map((item) => ({
    alias: item.templateAlias,
    type: item.type,
    title: item.templateAlias === "grooming_completed" ? "미용완료- 케어리포트 있음" : item.templateAlias === "booking_deposit_request" ? "예약금 안내" : item.title,
    group: ["booking_consent_request", "booking_deposit_request"].includes(item.templateAlias)
      ? "예약 전 준비"
      : ["booking_confirmed", "booking_cancelled", "revisit_notice"].includes(item.templateAlias)
      ? "예약 알림"
      : reservationNoticeTypes.includes(item.type)
        ? "예약 안내"
        : "미용 진행",
  })).sort((left, right) => templateGroupOrder.indexOf(left.group) - templateGroupOrder.indexOf(right.group));


 function deliveryState(alias: AlimtalkTemplateAlias) {
   const key = toggleKeys[alias];
   const legacyEnabled = key === "appointmentReminder10mEnabled" ? value.appointmentReminder10mEnabled && value.appointmentReminder10mMode === "auto" : key ? Boolean(value[key]) : true;
   return { enabled: value.alimtalkTypeEnabled?.[alias] ?? legacyEnabled, disabled: !value.enabled || (reservationNoticeTypes.includes(alias) && !automaticVisitReminderAvailable) };
 }
 function toggleDelivery(alias: AlimtalkTemplateAlias) {
   const state = deliveryState(alias); if (state.disabled) return;
   void onChange({ ...value, alimtalkTypeEnabled: { ...value.alimtalkTypeEnabled, [alias]: !state.enabled } });
 }
 return <section data-pc-alerts-surface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] bg-white">
   <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e8edf3] px-4 py-2 sm:px-5">
     <span className="text-[16px] font-medium text-[#15213b]">알림톡 전체 사용</span>
     <AlertSettingsSwitch checked={value.enabled} aria-label="알림톡 전체 사용" onCheckedChange={enabled => onChange({ ...value, enabled })} />
   </header>
   <OwnerAlimtalkTemplateEditor key={shopId} shopId={shopId} shopName={shopName} senderName={value.alimtalkSenderMode === "petmanager" ? PETMANAGER_SERVICE_NAME : value.alimtalkShopChannelName || shopName} demoMode={demoMode}
    selectedAlias={selectedTemplateAlias} options={templateOptions} onSelectAlias={setSelectedTemplateAlias} deliveryState={deliveryState} onToggleDelivery={toggleDelivery}
     deliverySettings={selectedTemplateAlias === "revisit_notice" ? <SettingsRevisitReminderDefault enabled={deliveryState("revisit_notice").enabled} disabled={!value.enabled} days={value.revisitReminderDefaultDays} onEnabledChange={enabled => onChange({ ...value, revisitEnabled: enabled })} onDaysChange={revisitReminderDefaultDays => onChange({ ...value, revisitReminderDefaultDays })} showEnabledControl={false} /> : undefined}
   />
 </section>;
}
