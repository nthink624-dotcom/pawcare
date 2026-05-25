"use client";

import { Check, MessageCircle } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type AlertSettingsDraft = {
  enabled: boolean;
  revisitEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  bookingRejectedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingRescheduledEnabled: boolean;
  appointmentReminder10mEnabled: boolean;
  groomingStartedEnabled: boolean;
  groomingAlmostDoneEnabled: boolean;
  groomingCompletedEnabled: boolean;
};

type AlertItem = {
  key: keyof AlertSettingsDraft;
  title: string;
  description: string;
  preview: string;
};

const alertItems: AlertItem[] = [
  {
    key: "bookingConfirmedEnabled",
    title: "예약 확정",
    description: "예약이 확정됐을 때 고객에게 보냅니다.",
    preview: "[우유 미용실] 우유 예약이 확정됐어요. 방문 일정: 5월 20일 11:00",
  },
  {
    key: "bookingRejectedEnabled",
    title: "예약 거절",
    description: "예약을 받을 수 없을 때 사유와 함께 안내합니다.",
    preview: "[우유 미용실] 요청하신 예약은 일정상 확정이 어려워요.",
  },
  {
    key: "bookingCancelledEnabled",
    title: "예약 취소",
    description: "예약이 취소되었을 때 고객에게 알려줍니다.",
    preview: "[우유 미용실] 예약 취소가 처리됐어요. 다음에 다시 만나요.",
  },
  {
    key: "bookingRescheduledEnabled",
    title: "예약 변경 확정",
    description: "변경된 예약 시간이 확정되면 보냅니다.",
    preview: "[우유 미용실] 예약 시간이 변경 확정됐어요. 새 일정: 5월 20일 14:00",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "방문 10분 전",
    description: "오너가 현장에서 직접 보낼 때 사용합니다.",
    preview: "[우유 미용실] 예약 시간 10분 전이에요. 편하게 방문해 주세요.",
  },
  {
    key: "groomingStartedEnabled",
    title: "미용 시작",
    description: "미용 시작 상태로 바꿨을 때 보냅니다.",
    preview: "[우유 미용실] 우유 미용을 시작했어요. 예쁘게 진행할게요.",
  },
  {
    key: "groomingAlmostDoneEnabled",
    title: "픽업 안내",
    description: "미용이 거의 끝났을 때 보호자에게 알려줍니다.",
    preview: "[우유 미용실] 우유 미용이 거의 끝났어요. 픽업 준비 부탁드려요.",
  },
  {
    key: "groomingCompletedEnabled",
    title: "미용 완료",
    description: "미용 완료와 사진 안내를 보냅니다.",
    preview: "[우유 미용실] 우유 미용이 완료됐어요. 사진을 확인해 주세요.",
  },
  {
    key: "revisitEnabled",
    title: "재방문 안내",
    description: "고객 상세에서 오너가 직접 보낼 때 사용합니다.",
    preview: "[우유 미용실] 우유 재방문 시기가 가까워졌어요.",
  },
];

const alertGroups: Array<{ title: string; description: string; items: AlertItem[] }> = [
  {
    title: "예약 안내",
    description: "예약 접수, 변경, 취소 상황에서 보호자에게 보내는 알림입니다.",
    items: alertItems.filter((item) =>
      ["bookingConfirmedEnabled", "bookingRejectedEnabled", "bookingCancelledEnabled", "bookingRescheduledEnabled", "appointmentReminder10mEnabled"].includes(item.key),
    ),
  },
  {
    title: "미용 진행",
    description: "미용 시작부터 픽업, 완료까지 현장에서 보내는 알림입니다.",
    items: alertItems.filter((item) => ["groomingStartedEnabled", "groomingAlmostDoneEnabled", "groomingCompletedEnabled"].includes(item.key)),
  },
  {
    title: "고객 관리",
    description: "재방문 안내처럼 고객 상세에서 직접 보내는 알림입니다.",
    items: alertItems.filter((item) => ["revisitEnabled"].includes(item.key)),
  },
];

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#2f7866]" : "bg-[#cbd5e1]",
      )}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition", checked ? "left-6" : "left-1")} />
    </button>
  );
}

export default function SettingsAlertsPanel({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: AlertSettingsDraft;
  saving?: boolean;
  onChange: (value: AlertSettingsDraft) => void;
  onSave: () => void | Promise<void>;
}) {
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertItem["key"]>(alertItems[0].key);
  const previewItem = alertItems.find((item) => item.key === selectedAlertKey) ?? alertItems[0];

  function update(key: keyof AlertSettingsDraft, checked: boolean) {
    setSelectedAlertKey(key);
    onChange({ ...value, [key]: checked });
  }

  return (
    <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[#111827]">알림 설정</h3>
          <p className="mt-1 text-[14px] leading-5 text-[#64748b]">펫매니저 공통 발신 채널로 보내고, 메시지에는 매장명이 표시됩니다.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-10 rounded-[8px] bg-[#2f7866] px-5 text-[14px] font-semibold text-white transition hover:bg-[#276756] disabled:bg-[#cbd5e1]"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>

      <div className="mt-5 rounded-[12px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[16px] font-semibold text-[#111827]">알림톡 전체 사용</p>
            <p className="mt-1 text-[13px] text-[#64748b]">끄면 고객에게 나가는 알림톡을 전체 중지합니다.</p>
          </div>
          <Toggle checked={value.enabled} label="알림톡 전체 사용" onChange={() => update("enabled", !value.enabled)} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {alertGroups.map((group) => (
            <div key={group.title} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">{group.title}</p>
                  <p className="mt-1 text-[12px] leading-4 text-[#64748b]">{group.description}</p>
                </div>
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-semibold text-[#64748b]">{group.items.length}개</span>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {group.items.map((item) => {
                  const checked = Boolean(value[item.key]);
                  const selected = previewItem.key === item.key;
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAlertKey(item.key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedAlertKey(item.key);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-4 rounded-[10px] border bg-white p-3 text-left transition",
                        selected ? "border-[#2f7866] shadow-[0_6px_16px_rgba(47,120,102,0.08)]" : checked ? "border-[#b9d8cc]" : "border-[#dbe2ea]",
                        value.enabled ? "hover:border-[#2f7866]" : "opacity-55",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-[#111827]">{item.title}</span>
                        <span className="mt-1 block text-[12px] leading-4 text-[#64748b]">{item.description}</span>
                      </span>
                      <span onClick={(event) => event.stopPropagation()}>
                        <Toggle checked={checked} disabled={!value.enabled} label={`${item.title} 알림`} onChange={() => update(item.key, !checked)} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-[12px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-[#2f7866]" />
              <p className="text-[15px] font-semibold text-[#111827]">미리보기</p>
            </div>
            <p className="text-[13px] font-medium text-[#64748b]">{previewItem.title}</p>
            <div className="mt-2 rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-3 text-[14px] leading-6 text-[#111827]">
              {previewItem.preview}
            </div>
          </div>

          <div className="rounded-[12px] border border-[#dbe2ea] bg-white p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#2f7866]" />
              <p className="text-[15px] font-semibold text-[#111827]">알림톡 문구 운영 방식</p>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-[#475569]">
              기본 템플릿 문구는 카카오 검수 기준에 맞춰 펫매니저가 관리합니다. 예약 전 안내, 주차 안내, 픽업 안내처럼 템플릿 안에 들어가는 짧은 안내 문구부터 단계적으로 제공합니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
