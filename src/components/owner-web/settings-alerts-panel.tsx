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
import type { NotificationType } from "@/types/domain";

export type AlertSettingsDraft = {
  enabled: boolean;
  revisitEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  bookingRejectedEnabled: boolean;
  bookingCancelledEnabled: boolean;
  bookingRescheduledEnabled: boolean;
  appointmentReminder10mEnabled: boolean;
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
    title: "픽업 안내",
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
          ? "border-[#2f7866] bg-[#f1f7f4] text-[#2f7866]"
          : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#b9c3cf]",
      )}
    >
      {children}
    </button>
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
        <MessageCircle className="h-5 w-5 text-[#2f7866]" />
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[300px] overflow-hidden rounded-[2px] border border-[#a9bdcc] bg-[#bdd2e2] px-3.5 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
          <div className="flex items-center gap-2">
            <img
              src="/images/brand/ododok-petmanager-logo.png"
              alt=""
              className="h-9 w-9 rounded-full bg-white object-contain p-1"
            />
            <p className="min-w-0 truncate text-[14px] text-[#0f172a]">오도독상회 펫매니저</p>
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

export default function SettingsAlertsPanel({
  value,
  onChange,
}: {
  value: AlertSettingsDraft;
  onChange: (value: AlertSettingsDraft) => void | Promise<void>;
}) {
  const [selectedAlertType, setSelectedAlertType] = useState<NotificationType>("appointment_reminder_10m");
  const previewItem = alertItems.find((item) => item.type === selectedAlertType) ?? alertItems[0];

  function update(key: AlertToggleKey, checked: boolean) {
    onChange({ ...value, [key]: checked });
  }

  return (
    <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
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

          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="mb-4">
              <p className="text-[16px] font-semibold text-[#111827]">기본 발송 시간</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[16px] text-[#475569]">방문 전 안내</p>
                <div className="flex flex-wrap gap-2">
                  {visitReminderOptions.map((minutes) => (
                    <TimingOptionButton
                      key={minutes}
                      selected={value.visitReminderOffsetMinutes === minutes}
                      onClick={() =>
                        onChange({
                          ...value,
                          visitReminderOffsetMinutes: minutes,
                        })
                      }
                    >
                      {minutes}분 전
                    </TimingOptionButton>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[16px] text-[#475569]">픽업 예상 시간</p>
                <div className="flex flex-wrap gap-2">
                  {pickupReadyOptions.map((minutes) => (
                    <TimingOptionButton
                      key={minutes}
                      selected={value.pickupReadyEtaMinutes === minutes}
                      onClick={() =>
                        onChange({
                          ...value,
                          pickupReadyEtaMinutes: minutes,
                        })
                      }
                    >
                      {minutes}분 뒤
                    </TimingOptionButton>
                  ))}
                </div>
              </div>
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
                            ? "border-[#2f7866] shadow-[0_6px_16px_rgba(47,120,102,0.08)]"
                            : checked
                              ? "border-[#b9d8cc]"
                              : "border-[#dbe2ea]",
                          value.enabled ? "hover:border-[#2f7866]" : "opacity-55",
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
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <KakaoAlimtalkPreview item={previewItem} value={value} />
        </div>
      </div>
    </section>
  );
}
