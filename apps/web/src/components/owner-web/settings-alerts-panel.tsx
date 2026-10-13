"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { BookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { publishBookingPolicyChange, subscribeBookingPolicyChange } from "@/lib/booking-policy-events";

import { SettingsRevisitReminderDefault } from "@/components/owner-web/settings-revisit-reminder-default";
import { OWNER_SETTINGS_TAB_HEADER_CLASS, OWNER_SETTINGS_TABBAR_CLASS, OWNER_SETTINGS_TAB_CLASS } from "@/components/owner-web/owner-settings-tab-header";
import { OwnerAlimtalkTemplateEditor } from "@/components/owner-web/owner-alimtalk-template-editor";
import { AlimtalkKakaoChatPreview } from "@/components/owner-web/alimtalk-kakao-chat-preview";
import { AlertSettingsSwitch } from "@/components/owner-web/settings-alert-switch";
import { getAlimtalkPreviewAppointmentTime } from "@/lib/alimtalk-preview-sample";
import { ALIMTALK_NOTIFICATION_REGISTRY, renderNotificationTemplateBody } from "@/lib/notification-registry";
import type { AlimtalkTemplateAlias } from "@/lib/notification-registry";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AlimtalkSenderMode,
  AlimtalkShopChannelStatus,
  NotificationDeliveryMode,
  NotificationType,
} from "@/types/domain";

export type AlertSettingsDraft = {
  enabled: boolean;
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
  bookingConsentRequestEnabled: boolean;
  bookingDepositRequestEnabled: boolean;
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

type AlertToggleKey = Exclude<
  keyof AlertSettingsDraft,
  | "enabled"
  | "alimtalkSenderMode"
  | "alimtalkShopChannelStatus"
  | "alimtalkShopChannelName"
  | "alimtalkShopChannelUrl"
  | "alimtalkSenderProfileKey"
  | "alimtalkChannelRequestedAt"
  | "alimtalkChannelAdminNote"
  | "alimtalkBusinessChannelVerified"
  | "alimtalkTemplateRequestNote"
  | "alimtalkTemplateRequestUpdatedAt"
  | "revisitReminderDefaultDays"
  | "visitReminderOffsetMinutes"
  | "pickupReadyEtaMinutes"
  | "groomingStartWithoutPhotoEnabled"
  | "groomingCompleteWithoutPhotoEnabled"
>;

type AlertItem = {
  key: AlertToggleKey;
  title: string;
  type: NotificationType;
  role: string;
};

type AlimtalkTemplatePreview = {
  type: NotificationType;
  title: string;
  templateCode: string | null;
  templateName: string | null;
  body: string;
  buttons: Array<{ name: string }>;
  inspectionStatus: string | null;
  serviceStatus: string | null;
  source: "ssodaa_approved" | "draft";
  usesExampleValues: boolean;
};

type AlimtalkTemplatePreviewResponse = {
  shopId: string;
  shopName: string;
  templates: AlimtalkTemplatePreview[];
};

function AlertHelp({
  label,
  children,
  align = "left",
}: {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span className="group/help relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`${label} 도움말`}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-11 w-11 items-center justify-center text-[#94a3b8] transition hover:text-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbd5e1]"
      >
        <CircleHelp className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute top-[calc(100%+8px)] z-30 w-[240px] max-w-[calc(100vw-48px)] whitespace-normal break-words rounded-[6px] border border-[#dbe2ea] bg-white px-3 py-2 text-left text-[14px] font-normal leading-5 text-[#475569] opacity-0 shadow-[0_8px_22px_rgba(15,23,42,0.12)] transition group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100 sm:w-max sm:whitespace-nowrap",
          align === "right" ? "right-0" : "right-0 sm:left-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}

const alertItems: AlertItem[] = [
  {
    key: "bookingConfirmedEnabled",
    title: "예약 확정",
    type: "booking_confirmed",
    role: "오너가 직접 추가한 예약에만 발송되며, 고객에게 방문 일시와 예약 내용을 안내합니다.",
  },
  {
    key: "bookingCancelledEnabled",
    title: "예약 취소",
    type: "booking_cancelled",
    role: "예약을 취소했을 때 고객에게 취소 사실과 다른 시간 조율 안내를 함께 보냅니다.",
  },
  {
    key: "bookingConsentRequestEnabled",
    title: "동의서 작성 요청",
    type: "booking_consent_request",
    role: "예약 확정 뒤 필수 동의서가 미작성 상태면 요청합니다. 이미 작성했거나 선택 동의서만 있으면 보내지 않습니다.",
  },
  {
    key: "bookingDepositRequestEnabled",
    title: "예약금 안내",
    type: "booking_deposit_request",
    role: "예약금이 필요한 예약에만 입금 안내를 보냅니다. 예약금과 계좌, 납부 기한은 예약 확인 버튼에서 확인합니다. 승인된 템플릿 연결 후 사용할 수 있습니다.",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "직전 안내",
    type: "appointment_reminder_10m",
    role: "예약 시간이 가까워졌을 때 방문 시간, 길찾기, 예약 확인 링크를 짧게 안내합니다.",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "오늘 안내",
    type: "visit_reminder_notice",
    role: "당일 예약이거나 예약 당일에 시간이 충분히 남아 있을 때 오늘 방문 일정을 다시 안내합니다.",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "내일 안내",
    type: "visit_schedule_notice",
    role: "예약일 하루 전에 방문 일정과 준비 사항을 미리 안내합니다.",
  },
  {
    key: "groomingStartedEnabled",
    title: "미용 시작",
    type: "grooming_started",
    role: "현장에서 미용을 시작했을 때 보호자에게 진행 시작을 알려줍니다.",
  },
  {
    key: "groomingAlmostDoneEnabled",
    title: "픽업 준비",
    type: "grooming_almost_done",
    role: "미용 마무리 전 보호자가 데리러 올 시간을 준비하도록 안내합니다.",
  },
  {
    key: "groomingCompletedEnabled",
    title: "미용 완료",
    type: "grooming_completed",
    role: "미용이 끝났을 때 완료 상태와 픽업 가능 상태를 안내합니다.",
  },
  {
    key: "revisitEnabled",
    title: "재예약 알림",
    type: "revisit_notice",
    role: "미용 완료 후 설정한 시점에 다음 방문을 안내합니다.",
  },
];

type AlertGroupKey = "reservation" | "reservationPrep" | "reservationGuide" | "grooming";

const alertGroups: Array<{ key: AlertGroupKey; title: string; help?: string; items: AlertItem[] }> = [
  {
    key: "reservation",
    title: "\uC608\uC57D",
    items: alertItems.filter((item) =>
      [
        "booking_confirmed",
        "booking_cancelled",
        "revisit_notice",
      ].includes(item.type),
    ),
  },
  {
    key: "reservationPrep",
    title: "예약 전 준비",
    items: alertItems.filter((item) => ["booking_consent_request", "booking_deposit_request"].includes(item.type)),
  },
  {
    key: "reservationGuide",
    title: "\uC608\uC57D\uC548\uB0B4",
    help:
      "\uC608\uC57D \uC2DC\uC810\uC5D0 \uB530\uB77C \uC9C1\uC804, \uC624\uB298, \uB0B4\uC77C \uC548\uB0B4 \uC911 \uD544\uC694\uD55C \uC548\uB0B4\uB9CC \uD55C \uBC88 \uBC1C\uC1A1\uB429\uB2C8\uB2E4.",
    items: alertItems.filter((item) =>
      [
        "appointment_reminder_10m",
        "visit_reminder_notice",
        "visit_schedule_notice",
      ].includes(item.type),
    ),
  },
  {
    key: "grooming",
    title: "\uBBF8\uC6A9\uC9C4\uD589",
    items: alertItems.filter((item) =>
      ["groomingStartedEnabled", "groomingAlmostDoneEnabled", "groomingCompletedEnabled"].includes(item.key),
    ),
  },
];

const reservationNoticeTypes: NotificationType[] = [
  "appointment_reminder_10m",
  "visit_reminder_notice",
  "visit_schedule_notice",
];

function isReservationNoticeType(type: NotificationType) {
  return reservationNoticeTypes.includes(type);
}

function TimingOptionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-[8px] border px-4 text-[16px] font-medium leading-6 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]",
        selected
          ? "border-[#202020] bg-[#f5f5f5] text-[#111827] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.03)]"
          : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#cbd5e1] hover:bg-[#fafafa]",
      )}
    >
      {children}
    </button>
  );
}

function clampMinuteValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function MinuteTimingControl({
  title,
  value,
  unitLabel,
  options,
  min = 1,
  max = 180,
  onChange,
}: {
  title: string;
  value: number;
  unitLabel: string;
  options: readonly number[];
  min?: number;
  max?: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="rounded-[10px] border border-[#e5e7eb] bg-[#fbfbfb] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[18px] font-semibold leading-[26px] text-[#15213b]">{title}</p>
        <label className="flex h-11 items-center overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              if (!Number.isFinite(nextValue)) {
                return;
              }
              onChange(clampMinuteValue(nextValue, min, max));
            }}
            onBlur={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);
              onChange(clampMinuteValue(Number.isFinite(nextValue) ? nextValue : value, min, max));
            }}
            className="h-full w-[76px] border-0 bg-transparent px-3 text-right text-[16px] font-medium leading-6 text-[#111827] outline-none"
            aria-label={`${title} 분 단위 입력`}
          />
          <span className="border-l border-[#e5e7eb] px-3 text-[14px] font-normal leading-5 text-[#475569]">{unitLabel}</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((minutes) => (
          <TimingOptionButton key={minutes} selected={value === minutes} onClick={() => onChange(minutes)}>
            {minutes}{unitLabel}
          </TimingOptionButton>
        ))}
      </div>
    </div>
  );
}

function KakaoAlimtalkPreview({
  item,
  preview,
  loading,
  error,
  shopName,
  senderName,
  pickupReadyEtaMinutes,
}: {
  item: AlertItem;
  preview: AlimtalkTemplatePreview | null;
  loading: boolean;
  error: string;
  shopName: string;
  senderName: string;
  pickupReadyEtaMinutes: number;
}) {
  const defaultMessage = renderNotificationTemplateBody(item.type, {
    매장명: shopName || "내 매장",
    반려동물명: "반려동물",
    보호자명: "보호자",
    예약일시: getAlimtalkPreviewAppointmentTime(),
    제안일시: getAlimtalkPreviewAppointmentTime(),
    서비스명: "전체 미용",
    매장주소: "매장 주소",
    "예약 링크": "예약 링크",
    "예약 확인 링크": "예약 확인 링크",
    예약관리링크: "예약관리 링크",
    길찾기링크: "길찾기 링크",
    방문전알림분: "10",
    방문전알림안내: "방문 전 안내",
    픽업예상분: String(pickupReadyEtaMinutes),
    픽업예상시간: String(pickupReadyEtaMinutes),
    픽업안내: "픽업 안내",
  });
  const message = preview?.body || defaultMessage || "";

  return (
    <div className="min-w-0">
      <AlimtalkKakaoChatPreview
        message={message || (loading ? "불러오는 중…" : "미리보기 문안이 없습니다.")}
        buttons={preview?.buttons.map((button) => button.name) ?? (item.type === "booking_received" ? ["예약 확인"] : [])}
        senderName={senderName}
      />
    </div>
  );
}

const shopChannelStatusLabels: Record<AlimtalkShopChannelStatus, string> = {
  not_requested: "신청 전",
  requested: "신청 접수",
  reviewing: "심사 중",
  active: "사용 가능",
  rejected: "보완 필요",
};

function getNextShopChannelSettings(value: AlertSettingsDraft): AlertSettingsDraft {
  const now = new Date().toISOString();
  const nextStatus =
    value.alimtalkShopChannelStatus === "active" || value.alimtalkShopChannelStatus === "reviewing"
      ? value.alimtalkShopChannelStatus
      : "requested";

  return {
    ...value,
    alimtalkSenderMode: "shop_channel",
    alimtalkShopChannelStatus: nextStatus,
    alimtalkChannelRequestedAt: value.alimtalkChannelRequestedAt ?? now,
  };
}

export default function SettingsAlertsPanel({
  value,
  onChange,
  shopId,
  shopName,
  automaticVisitReminderAvailable = true,
}: {
  value: AlertSettingsDraft;
  onChange: (value: AlertSettingsDraft) => void | Promise<void>;
  shopId: string;
  shopName: string;
  automaticVisitReminderAvailable?: boolean;
}) {
  const [activeAlertsPage, setActiveAlertsPage] = useState<"settings" | "templates">("settings");
  const [templatesPageVisited, setTemplatesPageVisited] = useState(false);
  const [depositPolicy, setDepositPolicy] = useState<{ shopId: string; policy: BookingPolicy; version: number } | null>(null);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState("");
  const depositReadVersion = useRef(0);
  const currentDepositPolicy = depositPolicy?.shopId === shopId ? depositPolicy : null;
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const readVersion = ++depositReadVersion.current;
      void fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" }).then(result => {
        if (active && readVersion === depositReadVersion.current) { setDepositPolicy({ shopId, ...result }); setDepositError(""); }
      }).catch(() => { if (active && readVersion === depositReadVersion.current) { setDepositPolicy(null); setDepositError("예약금 설정을 불러오지 못했습니다."); } });
    };
    refresh();
    const unsubscribe = subscribeBookingPolicyChange(shopId, refresh);
    return () => { active = false; unsubscribe(); };
  }, [shopId]);
  async function updateDepositMode(depositMode: BookingPolicy["depositMode"]) {
    if (!currentDepositPolicy || depositSaving) return;
    setDepositSaving(true); setDepositError("");
    try {
      const result = await fetchApiJsonWithAuth<{ policy: BookingPolicy; version: number }>("/api/owner/booking-policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, version: currentDepositPolicy.version, depositMode }) });
      depositReadVersion.current++; setDepositPolicy({ shopId, ...result }); publishBookingPolicyChange(shopId);
    } catch (cause) { setDepositError(cause instanceof Error ? cause.message : "예약금 설정을 저장하지 못했습니다."); }
    finally { setDepositSaving(false); }
  }
  const [selectedAlertType, setSelectedAlertType] = useState<NotificationType>("appointment_reminder_10m");
  const [selectedTemplateAlias, setSelectedTemplateAlias] = useState<AlimtalkTemplateAlias>("appointment_reminder_10m");
  const [templatePreviewState, setTemplatePreviewState] = useState<{
    shopId: string;
    previews: Partial<Record<NotificationType, AlimtalkTemplatePreview>>;
    error: string;
  }>({ shopId: "", previews: {}, error: "" });
  const templatePreviews =
    templatePreviewState.shopId === shopId ? templatePreviewState.previews : {};
  const templatePreviewsLoading = templatePreviewState.shopId !== shopId;
  const templatePreviewsError =
    templatePreviewState.shopId === shopId ? templatePreviewState.error : "";
  const previewItem = alertItems.find((item) => item.type === selectedAlertType) ?? alertItems[0];
  const visitReminderEnabled =
    automaticVisitReminderAvailable && value.appointmentReminder10mEnabled && value.appointmentReminder10mMode === "auto";
  // Keep the legacy deposit alias available to dispatch, not as a duplicate editor option.
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

  useEffect(() => {
    if (activeAlertsPage !== "settings") return;
    let cancelled = false;

    void fetchApiJsonWithAuth<AlimtalkTemplatePreviewResponse>(
      `/api/owner/alimtalk-template-previews?shopId=${encodeURIComponent(shopId)}`,
      { cache: "no-store" },
    )
      .then((result) => {
        if (cancelled) return;
        setTemplatePreviewState({
          shopId,
          previews: Object.fromEntries(
            result.templates.map((template) => [template.type, template]),
          ) as Partial<Record<NotificationType, AlimtalkTemplatePreview>>,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplatePreviewState({
          shopId,
          previews: {},
          error: error instanceof Error
            ? error.message
            : "승인된 템플릿을 불러오지 못했습니다.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeAlertsPage, shopId]);

  function update(key: AlertToggleKey, checked: boolean) {
    if (key === "appointmentReminder10mEnabled") {
      onChange({
        ...value,
        appointmentReminder10mEnabled: automaticVisitReminderAvailable ? checked : false,
        appointmentReminder10mMode: automaticVisitReminderAvailable && checked ? "auto" : "manual",
      });
      return;
    }

    onChange({ ...value, [key]: checked });
  }

  const showSenderChannelSettings = false;

  return (
    <section data-pc-alerts-surface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] bg-white">
      <div className={OWNER_SETTINGS_TAB_HEADER_CLASS}>
        <div className={OWNER_SETTINGS_TABBAR_CLASS} role="tablist" aria-label="알림톡 관리">
          <button type="button" role="tab" id="alerts-settings-tab" aria-selected={activeAlertsPage === "settings"} aria-controls="alerts-settings-panel" onClick={() => setActiveAlertsPage("settings")} data-owner-control-size="content" className={OWNER_SETTINGS_TAB_CLASS}>알림 설정</button>
          <button type="button" role="tab" id="alerts-templates-tab" aria-selected={activeAlertsPage === "templates"} aria-controls="alerts-templates-panel" onClick={() => { setTemplatesPageVisited(true); setActiveAlertsPage("templates"); }} data-owner-control-size="content" className={OWNER_SETTINGS_TAB_CLASS}>내 문구 작성</button>
        </div>
      </div>
      <div id="alerts-settings-panel" role="tabpanel" aria-labelledby="alerts-settings-tab" hidden={activeAlertsPage !== "settings"} className="no-scrollbar mx-3 my-3 grid min-h-0 min-w-0 flex-1 gap-3 overflow-y-auto overscroll-contain sm:mx-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
        <div data-settings-body-container className="no-scrollbar min-w-0 overflow-hidden rounded-[14px] border border-[#e1e4ea] bg-white xl:overflow-y-auto xl:overscroll-contain">
          {showSenderChannelSettings ? (
          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-semibold leading-[26px] text-[#15213b]">알림톡 발신 채널</p>
                <p className="mt-1 text-[14px] font-normal leading-5 text-[#475569]">
                  알림톡 발송 설정과 이력은 {PETMANAGER_SERVICE_NAME}에서 관리하고, 발신자만 매장 채널로
                  바꿀 수 있습니다.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium leading-[18px]",
                  value.alimtalkShopChannelStatus === "active"
                    ? "bg-[#e9f5f0] text-[#287667]"
                    : value.alimtalkShopChannelStatus === "rejected"
                      ? "bg-[#fff1f2] text-[#a04455]"
                      : value.alimtalkShopChannelStatus === "requested" ||
                          value.alimtalkShopChannelStatus === "reviewing"
                        ? "bg-[#fff7ed] text-[#9a6619]"
                        : "bg-[#f1f5f9] text-[#64748b]",
                )}
              >
                {shopChannelStatusLabels[value.alimtalkShopChannelStatus]}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, alimtalkSenderMode: "petmanager" })}
                className={cn(
                  "rounded-[10px] border px-4 py-3 text-left transition",
                  value.alimtalkSenderMode === "petmanager"
                    ? "border-[#2f7d68] bg-[#f6fbf9]"
                    : "border-[#dbe2ea] bg-white hover:border-[#cbd5e1]",
                )}
              >
                <span className="block text-[16px] font-medium leading-6 text-[#111827]">{PETMANAGER_SERVICE_NAME} 기본 채널</span>
                <span className="mt-1 block text-[14px] leading-5 text-[#475569]">
                  바로 사용합니다. 고객에게는 {PETMANAGER_SERVICE_NAME} 기본 발신 채널로 보입니다.
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChange(getNextShopChannelSettings(value))}
                className={cn(
                  "rounded-[10px] border px-4 py-3 text-left transition",
                  value.alimtalkSenderMode === "shop_channel"
                    ? "border-[#2f7d68] bg-[#f6fbf9]"
                    : "border-[#dbe2ea] bg-white hover:border-[#cbd5e1]",
                )}
              >
                <span className="block text-[16px] font-medium leading-6 text-[#111827]">내 매장 채널 사용 신청</span>
                <span className="mt-1 block text-[14px] leading-5 text-[#475569]">
                  카카오 채널/발신 프로필 심사 후 고객에게 매장명으로 알림톡이 보입니다.
                </span>
              </button>
            </div>
            {value.alimtalkSenderMode === "shop_channel" ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[14px] font-medium leading-5 text-[#334155]">카카오 채널명</span>
                    <input
                      value={value.alimtalkShopChannelName}
                      onChange={(event) =>
                        onChange({
                          ...getNextShopChannelSettings(value),
                          alimtalkShopChannelName: event.target.value,
                        })
                      }
                      placeholder="예: 우진만세"
                      className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7d68]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[14px] font-medium leading-5 text-[#334155]">채널 URL 또는 검색명</span>
                    <input
                      value={value.alimtalkShopChannelUrl}
                      onChange={(event) =>
                        onChange({
                          ...getNextShopChannelSettings(value),
                          alimtalkShopChannelUrl: event.target.value,
                        })
                      }
                      placeholder="카카오 채널 링크 또는 검색 가능한 이름"
                      className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#2f7d68]"
                    />
                  </label>
                </div>
                <label className="flex items-start gap-3 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={value.alimtalkBusinessChannelVerified}
                    onChange={(event) =>
                      onChange({
                        ...getNextShopChannelSettings(value),
                        alimtalkBusinessChannelVerified: event.target.checked,
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-[#cbd5e1] text-[#2f7d68] focus:ring-[#2f7d68]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium leading-5 text-[#111827]">카카오 비즈니스 채널 인증 완료</span>
                    <span className="mt-1 block text-[14px] leading-5 text-[#64748b]">
                      알림톡은 비즈니스 채널/발신프로필 심사 후 사용할 수 있어요. 아직 인증 전이면 체크하지 않고 신청해 주세요.
                    </span>
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[14px] font-medium leading-5 text-[#334155]">희망 알림톡 문구 / 요청사항</span>
                  <textarea
                    value={value.alimtalkTemplateRequestNote}
                    onChange={(event) =>
                      onChange({
                        ...getNextShopChannelSettings(value),
                        alimtalkTemplateRequestNote: event.target.value,
                        alimtalkTemplateRequestUpdatedAt: new Date().toISOString(),
                      })
                    }
                    rows={4}
                    placeholder="원하는 말투, 꼭 들어갔으면 하는 문구, 매장명 표기 방식 등을 적어주세요. 실제 발송 문구는 카카오 템플릿 심사 기준에 맞춰 조정될 수 있어요."
                    className="w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2.5 text-[16px] leading-6 text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7d68]"
                  />
                  <span className="mt-1 block text-right text-[12px] text-[#94a3b8]">
                    {value.alimtalkTemplateRequestNote.length} / 1500
                  </span>
                </label>
              </div>
            ) : null}
              <p className="mt-3 text-[14px] leading-5 text-[#64748b]">
              매장 채널을 사용해도 알림톡 발송 설정과 발송 이력은 {PETMANAGER_SERVICE_NAME}에서 그대로
              관리됩니다.
            </p>
          </div>
          ) : null}

          <div data-alerts-section="global" className="border-b border-[#e8edf3] bg-[#f8fafc] px-3 py-2">
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <p className="min-w-0 break-words text-[18px] font-semibold leading-[26px] text-[#15213b]">알림톡 전체 사용</p>
                <AlertHelp label="알림톡 전체 사용">
                  끄면 예약 안내와 미용 진행 알림톡 발송이 전체 중지됩니다.
                </AlertHelp>
              </div>
              <AlertSettingsSwitch
                checked={value.enabled}
                aria-label="알림톡 전체 사용"
                onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
              />
            </div>
          </div>

          {alertGroups.map((group) => {
            const isReservationGroup = group.key === "reservation";

            return (
            <section
              key={group.key}
              data-alerts-group={group.key}
              className="mt-2 min-w-0 border-t border-[#dce4ed] px-3 pb-1 pt-2.5"
            >
              <div className="mb-0.5 flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <p className="min-w-0 break-words text-[18px] font-semibold leading-[26px] text-[#15213b]">
                    {isReservationGroup ? "예약 알림" : group.title}
                  </p>
                  {group.help ? (
                    <AlertHelp label={group.title}>{group.help}</AlertHelp>
                  ) : null}
                </div>
                {!isReservationGroup ? (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-medium leading-[18px] text-[#64748b]">
                      {group.items.length}개
                    </span>
                    {group.key === "reservationGuide" ? (
                      <AlertSettingsSwitch
                        checked={visitReminderEnabled}
                        disabled={!value.enabled || !automaticVisitReminderAvailable}
                        aria-label="예약 안내 자동 발송"
                        onCheckedChange={(checked) =>
                          onChange({
                            ...value,
                            appointmentReminder10mEnabled: automaticVisitReminderAvailable ? checked : false,
                            appointmentReminder10mMode: automaticVisitReminderAvailable && checked ? "auto" : "manual",
                          })
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "min-w-0",
                  isReservationGroup
                    ? "grid gap-x-5 gap-y-1.5 sm:grid-cols-2"
                    : "grid gap-x-5 gap-y-1.5 lg:grid-cols-2",
                )}
              >
                {group.items.map((item, itemIndex) => {
                  if (item.type === "revisit_notice") return null;
                  if (item.key === "bookingDepositRequestEnabled") return <div key={item.type} className="space-y-2 py-2 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[16px] leading-6">예약금 사용</span><select aria-label="예약금 사용" value={currentDepositPolicy?.policy.depositMode ?? "off"} disabled={!currentDepositPolicy || depositSaving} onChange={event => void updateDepositMode(event.target.value as BookingPolicy["depositMode"])} className="min-h-11 max-w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6"><option value="off">사용 안 함</option><option value="optional">예약별 선택</option><option value="required">대상 고객에게 필수</option></select></div>
                    <p className="text-[13px] leading-5 text-[#64748b]">{depositSaving ? "저장 중입니다." : "예약금 페이지와 같은 설정입니다. 변경하면 바로 저장됩니다."}</p>
                    {depositError && <p role="alert" className="text-[13px] leading-5 text-[#9a5e4e]">{depositError}</p>}
                  </div>;
                  const reservationNotice = isReservationNoticeType(item.type);
                  const checked =
                    item.key === "appointmentReminder10mEnabled"
                      ? visitReminderEnabled
                      : Boolean(value[item.key]);
                  const selected = previewItem.type === item.type;
                  const disabled =
                    !value.enabled || (item.key === "appointmentReminder10mEnabled" && !automaticVisitReminderAvailable);
                  const compactReservationSwitch = isReservationGroup;
                  return (
                      <div
                        key={`${item.key}-${item.type}`}
                        aria-expanded={selected}
                        onClick={() => setSelectedAlertType(item.type)}
                        className={cn(
                          compactReservationSwitch
                            ? "flex min-h-11 min-w-0 cursor-pointer items-center gap-4 px-0 py-0 text-left transition hover:bg-[#fafafa]"
                            : "flex min-h-11 min-w-0 cursor-pointer flex-row items-center gap-4 py-0 text-left transition hover:bg-[#fafafa]",
                          compactReservationSwitch
                            ? selected
                              ? "bg-[#fafafa]"
                              : ""
                            : selected
                              ? "bg-[#fafafa]"
                              : checked
                                ? ""
                                : "",
                          !disabled || reservationNotice ? "" : "opacity-55",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            data-owner-control-size="content"
                            onClick={() => setSelectedAlertType(item.type)}
                            className={cn(
                              "inline-flex min-h-11 min-w-0 items-center whitespace-normal break-words text-left text-[16px] font-normal leading-6 text-[#475569] focus-visible:outline-none focus-visible:underline",
                            )}
                          >
                            {item.title}
                          </button>
                          <AlertHelp label={item.title} align={itemIndex % 2 === 1 ? "right" : "left"}>
                            {item.role}
                          </AlertHelp>
                        </div>
                        {reservationNotice ? (
                          <span
                            className={cn(
                              "ml-auto shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium leading-[18px]",
                              visitReminderEnabled ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f1f5f9] text-[#64748b]",
                            )}
                          >
                            {visitReminderEnabled ? "자동 ON" : "자동 OFF"}
                          </span>
                        ) : (
                          <span className="ml-auto flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
                            <AlertSettingsSwitch
                              checked={checked}
                              disabled={disabled}
                              aria-label={`${item.title} 알림`}
                              onCheckedChange={(nextChecked) => {
                                setSelectedAlertType(item.type);
                                update(item.key, nextChecked);
                              }}
                            />
                          </span>
                        )}
                      </div>
                  );
                })}
                {isReservationGroup ? (
                  <div className="sm:col-span-2" data-alerts-section="revisit" onClick={() => setSelectedAlertType("revisit_notice")}>
                    <SettingsRevisitReminderDefault
                      enabled={value.revisitEnabled}
                      disabled={!value.enabled}
                      days={value.revisitReminderDefaultDays}
                      onEnabledChange={(enabled) => onChange({ ...value, revisitEnabled: enabled })}
                      onDaysChange={(days) => onChange({ ...value, revisitReminderDefaultDays: days })}
                    />
                  </div>
                ) : null}
              </div>
            </section>
            );
          })}
        </div>

        <aside data-alerts-preview className="no-scrollbar min-w-0 rounded-[14px] border border-[#e1e4ea] bg-white px-3 py-3 xl:overflow-y-auto">
          <KakaoAlimtalkPreview
            item={previewItem}
            preview={templatePreviews[previewItem.type] ?? null}
            loading={templatePreviewsLoading}
            error={templatePreviewsError}
            shopName={shopName}
            pickupReadyEtaMinutes={value.pickupReadyEtaMinutes}
            senderName={value.alimtalkSenderMode === "petmanager" ? PETMANAGER_SERVICE_NAME : value.alimtalkShopChannelName || shopName}
          />
        </aside>
      </div>
      <div id="alerts-templates-panel" role="tabpanel" aria-labelledby="alerts-templates-tab" hidden={activeAlertsPage !== "templates"} className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {templatesPageVisited ? <OwnerAlimtalkTemplateEditor
          shopId={shopId}
          shopName={shopName}
          selectedAlias={selectedTemplateAlias}
          options={templateOptions}
          onSelectAlias={(alias) => {
            setSelectedTemplateAlias(alias);
            const selected = templateOptions.find((item) => item.alias === alias);
            if (selected) setSelectedAlertType(selected.type);
          }}
        /> : null}
      </div>
    </section>
  );
}
