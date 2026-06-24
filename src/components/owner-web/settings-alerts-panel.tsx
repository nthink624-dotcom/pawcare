"use client";

import { MessageCircle } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  renderNotificationTemplateBody,
  type NotificationTemplateVariables,
} from "@/lib/notification-registry";
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
  alimtalkTemplateRequestNote: string;
  alimtalkTemplateRequestUpdatedAt: string | null;
  revisitEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  bookingRejectedEnabled: boolean;
  bookingCancelledEnabled: boolean;
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
  | "alimtalkTemplateRequestNote"
  | "alimtalkTemplateRequestUpdatedAt"
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

const visitReminderOptions = [10, 20, 30, 60] as const;
const pickupReadyOptions = [5, 10, 15, 20] as const;

const alertItems: AlertItem[] = [
  {
    key: "bookingConfirmedEnabled",
    title: "예약 확정",
    type: "booking_confirmed",
    role: "오너가 예약을 확정했을 때 고객에게 방문 일시와 예약 내용을 안내합니다.",
  },
  {
    key: "bookingRejectedEnabled",
    title: "예약 거절",
    type: "booking_rejected",
    role: "요청받은 예약을 받을 수 없을 때 고객에게 확정 불가 상태를 안내합니다.",
  },
  {
    key: "bookingCancelledEnabled",
    title: "예약 취소",
    type: "booking_cancelled",
    role: "확정된 예약이 취소되었을 때 고객에게 취소 사실을 안내합니다.",
  },
  {
    key: "bookingRescheduledEnabled",
    title: "다른 시간 안내",
    type: "booking_time_proposed",
    role: "요청 시간 확정이 어려울 때 오너가 가능한 다른 시간을 제안합니다.",
  },
  {
    key: "bookingRescheduledEnabled",
    title: "예약 변경 확정",
    type: "booking_rescheduled_confirmed",
    role: "고객 또는 오너가 변경한 예약 시간이 최종 확정되었음을 안내합니다.",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "방문 전 안내",
    type: "appointment_reminder_10m",
    role: "예약 시간 전 고객에게 방문 준비와 도착 시간을 다시 안내합니다.",
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
    title: "재방문 안내",
    type: "revisit_notice",
    role: "이전 미용 주기를 기준으로 다음 방문 시점을 고객에게 안내합니다.",
  },
];

const alertGroups: Array<{ title: string; items: AlertItem[] }> = [
  {
    title: "예약 안내",
    items: alertItems.filter((item) =>
      [
        "bookingConfirmedEnabled",
        "bookingRejectedEnabled",
        "bookingCancelledEnabled",
        "bookingRescheduledEnabled",
        "appointmentReminder10mEnabled",
      ].includes(item.key),
    ),
  },
  {
    title: "미용 진행",
    items: alertItems.filter((item) =>
      ["groomingStartedEnabled", "groomingAlmostDoneEnabled", "groomingCompletedEnabled"].includes(item.key),
    ),
  },
  {
    title: "고객 관리",
    items: alertItems.filter((item) => item.key === "revisitEnabled"),
  },
];

function buildPreviewValues(value: AlertSettingsDraft): NotificationTemplateVariables {
  const pickupGuide = `약 ${value.pickupReadyEtaMinutes}분 뒤 미용이 완료될 예정입니다. 준비되시는 대로 편하게 방문해 주세요.`;

  return {
    매장명: "우유 미용실",
    반려동물명: "우유",
    보호자명: "보호자님",
    예약일시: "2026년 6월 7일 14:00",
    서비스명: "전체 미용",
    매장주소: "서울시 성북구 삼선교로 24길 3",
    "예약 링크": "https://www.petmanager.co.kr/s/shop-demo",
    "예약 확인 링크": "https://www.petmanager.co.kr/book/shop-demo/manage?t=demo",
    예약관리링크: "https://www.petmanager.co.kr/book/shop-demo/manage?t=demo",
    예약시간변경링크: "https://www.petmanager.co.kr/book/shop-demo/manage?t=demo",
    예약시간변경토큰: "demo-token",
    bookingRescheduleToken: "demo-token",
    bookingRescheduleUrl: "https://www.petmanager.co.kr/book/shop-demo/manage?t=demo",
    길찾기링크: "https://map.naver.com",
    방문전알림분: String(value.visitReminderOffsetMinutes),
    방문전알림안내: `예약 시간 ${value.visitReminderOffsetMinutes}분 전 안내드립니다.`,
    픽업예상분: String(value.pickupReadyEtaMinutes),
    픽업안내: pickupGuide,
    pickupReadyEtaMinutes: String(value.pickupReadyEtaMinutes),
    pickupGuide,
  };
}

function getAlimtalkPreviewMessage(item: AlertItem, value: AlertSettingsDraft) {
  return renderNotificationTemplateBody(item.type, buildPreviewValues(value)) ?? "";
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
        "h-10 rounded-[8px] border px-4 text-[16px] transition",
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
        <p className="text-[16px] font-medium text-[#111827]">{title}</p>
        <label className="flex h-10 items-center overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
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
            className="h-full w-[76px] border-0 bg-transparent px-3 text-right text-[16px] font-medium text-[#111827] outline-none"
            aria-label={`${title} 분 단위 입력`}
          />
          <span className="border-l border-[#e5e7eb] px-3 text-[16px] text-[#475569]">{unitLabel}</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((minutes) => (
          <TimingOptionButton key={minutes} selected={value === minutes} onClick={() => onChange(minutes)}>
            {minutes}분 {unitLabel}
          </TimingOptionButton>
        ))}
      </div>
    </div>
  );
}

function KakaoAlimtalkPreview({ item, value }: { item: AlertItem; value: AlertSettingsDraft }) {
  const message = getAlimtalkPreviewMessage(item, value);

  return (
    <div className="rounded-[12px] border border-[#dbe2ea] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[16px] font-semibold text-[#111827]">쏘다 템플릿 미리보기</p>
          <p className="mt-1 text-[16px] text-[#64748b]">{item.title}</p>
        </div>
        <MessageCircle className="h-5 w-5 text-[#64748b]" />
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[300px] overflow-hidden rounded-[2px] border border-[#a9bdcc] bg-[#bdd2e2] px-3.5 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
          <div className="flex items-center gap-2">
            <img
              src="/icons/logo/넘친 Day 이니셜.svg"
              alt=""
              className="h-9 w-9 rounded-full bg-white object-contain p-1"
            />
            <p className="min-w-0 truncate text-[14px] text-[#0f172a]">넘친 Day</p>
          </div>

          <div className="relative ml-[35px] mt-1 w-[214px] rounded-[2px] bg-white text-[#111827] shadow-sm">
            <div className="rounded-t-[2px] bg-[#ffe500] px-2.5 py-2 text-[13px] leading-none text-[#111827]">
              알림톡 도착
            </div>
            <span className="absolute -right-3 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#3b3328] text-[8px] text-white">
              kakao
            </span>
            <div className="px-2.5 py-3 text-[13px] leading-[1.55]">
              {message.split("\n").map((line, index) => {
                if (!line) {
                  return <div key={`${line}-${index}`} className="h-2.5" />;
                }
                if (line.startsWith("https://")) {
                  return (
                    <p key={line} className="break-all text-[#0066cc] underline underline-offset-2">
                      {line}
                    </p>
                  );
                }
                return <p key={`${line}-${index}`}>{line}</p>;
              })}
            </div>
          </div>
        </div>
      </div>
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
  automaticVisitReminderAvailable = true,
}: {
  value: AlertSettingsDraft;
  onChange: (value: AlertSettingsDraft) => void | Promise<void>;
  automaticVisitReminderAvailable?: boolean;
}) {
  const [selectedAlertType, setSelectedAlertType] = useState<NotificationType>("appointment_reminder_10m");
  const previewItem = alertItems.find((item) => item.type === selectedAlertType) ?? alertItems[0];
  const visitReminderMode = automaticVisitReminderAvailable ? value.appointmentReminder10mMode : "manual";

  function update(key: AlertToggleKey, checked: boolean) {
    onChange({ ...value, [key]: checked });
  }

  return (
    <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[16px] text-[#111827]">알림톡 발신 채널</p>
                <p className="mt-1 text-[15px] leading-6 text-[#64748b]">
                  결제와 잔여 건수는 펫매니저에서 관리하고, 발신자만 매장 채널로 바꿀 수 있습니다.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[14px]",
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
                <span className="block text-[16px] text-[#111827]">펫매니저 기본 채널</span>
                <span className="mt-1 block text-[14px] leading-5 text-[#64748b]">
                  바로 사용합니다. 고객에게는 펫매니저 기본 발신 채널로 보입니다.
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
                <span className="block text-[16px] text-[#111827]">내 매장 채널 사용 신청</span>
                <span className="mt-1 block text-[14px] leading-5 text-[#64748b]">
                  카카오 채널/발신 프로필 심사 후 고객에게 매장명으로 알림톡이 보입니다.
                </span>
              </button>
            </div>
            {value.alimtalkSenderMode === "shop_channel" ? (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[15px] text-[#334155]">카카오 채널명</span>
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
                    <span className="mb-1 block text-[15px] text-[#334155]">채널 URL 또는 검색명</span>
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
                <label className="block">
                  <span className="mb-1 block text-[15px] text-[#334155]">희망 알림톡 문구 / 요청사항</span>
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
                  <span className="mt-1 block text-right text-[13px] text-[#94a3b8]">
                    {value.alimtalkTemplateRequestNote.length} / 1500
                  </span>
                </label>
              </div>
            ) : null}
            <p className="mt-3 text-[14px] leading-5 text-[#64748b]">
              매장 채널을 사용해도 알림톡 결제, 잔여 건수, 발송 이력은 펫매니저에서 그대로 관리됩니다.
            </p>
          </div>

          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-[#111827]">알림톡 전체 사용</p>
                <p className="mt-1 text-[16px] leading-6 text-[#64748b]">
                  끄면 예약, 미용 진행, 재방문 안내 알림톡 발송이 전체 중지됩니다.
                </p>
              </div>
              <Switch
                checked={value.enabled}
                aria-label="알림톡 전체 사용"
                onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
              />
            </div>
          </div>

          {alertGroups.map((group) => (
            <div key={group.title} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[16px] font-semibold text-[#111827]">{group.title}</p>
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[14px] text-[#64748b]">
                  {group.items.length}개
                </span>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {group.items.map((item) => {
                  const checked = Boolean(value[item.key]);
                  const selected = previewItem.type === item.type;
                  return (
                    <Fragment key={`${item.key}-${item.type}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={selected}
                        onClick={() => setSelectedAlertType(item.type)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedAlertType(item.type);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border bg-white p-3 text-left transition",
                          selected
                            ? "border-[#cbd5e1] shadow-[0_6px_16px_rgba(15,23,42,0.06)]"
                            : checked
                              ? "border-[#dbe2ea]"
                              : "border-[#dbe2ea]",
                          value.enabled ? "hover:border-[#cbd5e1] hover:bg-[#fafafa]" : "opacity-55",
                        )}
                      >
                        <span className="min-w-0 text-[16px] text-[#111827]">{item.title}</span>
                        <span onClick={(event) => event.stopPropagation()}>
                          <Switch
                            checked={checked}
                            disabled={!value.enabled}
                            aria-label={`${item.title} 알림`}
                            onCheckedChange={(nextChecked) => {
                              setSelectedAlertType(item.type);
                              update(item.key, nextChecked);
                            }}
                          />
                        </span>
                      </div>
                      {selected ? (
                        <div className="rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2.5 lg:col-span-2">
                          <div className="flex gap-2 text-[15px] leading-6">
                            <span className="shrink-0 text-[#64748b]">역할</span>
                            <p className="min-w-0 text-[#334155]">{item.role}</p>
                          </div>
                        </div>
                      ) : null}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="mb-4">
              <p className="text-[16px] font-semibold text-[#111827]">기본 발송 시간</p>
              <p className="mt-1 text-[15px] leading-6 text-[#64748b]">
                자주 쓰는 시간은 버튼으로 고르고, 필요한 경우 1분 단위로 직접 입력할 수 있어요.
              </p>
            </div>
            <div className="mb-3 rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">방문 전 알림 방식</p>
                  <p className="mt-1 text-[14px] leading-5 text-[#64748b]">
                    수동은 오너가 직접 발송하고, 자동은 예약 시간 기준으로 발송 시간을 사용합니다.
                  </p>
                </div>
                <div className="grid h-9 grid-cols-2 rounded-[9px] border border-[#dbe2ea] bg-white p-0.5">
                  {(["manual", "auto"] as const).map((mode) => {
                    const disabled = mode === "auto" && !automaticVisitReminderAvailable;
                    const active = visitReminderMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          onChange({
                            ...value,
                            appointmentReminder10mMode: mode,
                          })
                        }
                        className={cn(
                          "h-8 rounded-[7px] px-3 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
                          active ? "bg-[#222222] text-white" : "text-[#64748b] hover:bg-[#f1f5f9]",
                        )}
                      >
                        {mode === "manual" ? "수동" : "자동"}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!automaticVisitReminderAvailable ? (
                <p className="mt-2 text-[13px] leading-5 text-[#94a3b8]">자동 방문 전 알림은 스탠다드 플랜부터 사용할 수 있습니다.</p>
              ) : null}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {visitReminderMode === "auto" ? (
                <MinuteTimingControl
                  title="방문 전 안내"
                  value={value.visitReminderOffsetMinutes}
                  unitLabel="전"
                  options={visitReminderOptions}
                  min={1}
                  max={180}
                  onChange={(minutes) =>
                    onChange({
                      ...value,
                      visitReminderOffsetMinutes: minutes,
                    })
                  }
                />
              ) : (
                <div className="rounded-[10px] border border-dashed border-[#dbe2ea] bg-[#fbfcfd] px-4 py-3 text-[14px] leading-6 text-[#64748b]">
                  방문 전 알림은 수동 발송입니다. 수동 모드에서는 10분 전 같은 자동 발송 시간이 표시되지 않습니다.
                </div>
              )}
              <MinuteTimingControl
                title="픽업 예상 시간"
                value={value.pickupReadyEtaMinutes}
                unitLabel="뒤"
                options={pickupReadyOptions}
                min={1}
                max={180}
                onChange={(minutes) =>
                  onChange({
                    ...value,
                    pickupReadyEtaMinutes: minutes,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <KakaoAlimtalkPreview item={previewItem} value={value} />
        </div>
      </div>
    </section>
  );
}
