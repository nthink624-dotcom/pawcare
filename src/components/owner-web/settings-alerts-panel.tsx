"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { Switch } from "@/components/ui/switch";
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
  groomingStartWithoutPhotoEnabled: boolean;
  groomingCompleteWithoutPhotoEnabled: boolean;
};

type AlertToggleKey = Exclude<keyof AlertSettingsDraft, "groomingStartWithoutPhotoEnabled" | "groomingCompleteWithoutPhotoEnabled">;

type AlertItem = {
  key: AlertToggleKey;
  title: string;
  preview: string;
};

const alertItems: AlertItem[] = [
  {
    key: "bookingConfirmedEnabled",
    title: "예약 확정",
    preview: "[우유 미용실] 우유 예약이 확정됐어요. 방문 일정: 5월 20일 11:00",
  },
  {
    key: "bookingRejectedEnabled",
    title: "예약 거절",
    preview: "[우유 미용실] 요청하신 예약은 일정상 확정이 어려워요.",
  },
  {
    key: "bookingCancelledEnabled",
    title: "예약 취소",
    preview: "[우유 미용실] 예약 취소가 처리됐어요. 다음에 다시 만나요.",
  },
  {
    key: "bookingRescheduledEnabled",
    title: "예약 변경 확정",
    preview: "[우유 미용실] 예약 시간이 변경 확정됐어요. 새 일정: 5월 20일 14:00",
  },
  {
    key: "appointmentReminder10mEnabled",
    title: "방문 10분 전",
    preview: "[우유 미용실] 예약 시간 10분 전이에요. 편하게 방문해 주세요.",
  },
  {
    key: "groomingStartedEnabled",
    title: "미용 시작",
    preview: "[우유 미용실] 우유 미용을 시작했어요. 예쁘게 진행할게요.",
  },
  {
    key: "groomingAlmostDoneEnabled",
    title: "픽업 안내",
    preview: "[우유 미용실] 우유 미용이 거의 끝났어요. 픽업 준비 부탁드려요.",
  },
  {
    key: "groomingCompletedEnabled",
    title: "미용 완료",
    preview: "[우유 미용실] 우유 미용이 완료됐어요. 편하신 시간에 픽업 부탁드립니다.",
  },
  {
    key: "revisitEnabled",
    title: "재방문 안내",
    preview: "[우유 미용실] 우유 재방문 시기가 가까워졌어요.",
  },
];

const alertGroups: Array<{ title: string; items: AlertItem[] }> = [
  {
    title: "예약 안내",
    items: alertItems.filter((item) =>
      ["bookingConfirmedEnabled", "bookingRejectedEnabled", "bookingCancelledEnabled", "bookingRescheduledEnabled", "appointmentReminder10mEnabled"].includes(item.key),
    ),
  },
  {
    title: "미용 진행",
    items: alertItems.filter((item) => ["groomingStartedEnabled", "groomingAlmostDoneEnabled", "groomingCompletedEnabled"].includes(item.key)),
  },
  {
    title: "고객 관리",
    items: alertItems.filter((item) => ["revisitEnabled"].includes(item.key)),
  },
];

function getAlimtalkPreviewMessage(item: AlertItem) {
  if (item.key === "bookingConfirmedEnabled") {
    return [
      "[우유]",
      "우유 보호자님, 예약이 확정되었어요. 😄",
      "",
      "방문 일시: 5/11(월) 10:00",
      "예약 서비스: 전체 미용",
      "",
      "방문 당일 편하게 와 주세요. 기다리고 있겠습니다.",
      "",
      "예약 링크",
      "https://www.petmanager.co.kr/entry/shop-f512d347",
      "예약 확인 링크",
      "https://www.petmanager.co.kr/m?s=shop-f512d347",
    ].join("\n");
  }

  return [
    "[우유]",
    item.preview.replace(/^\[[^\]]+\]\s*/, ""),
    "",
    "예약 링크",
    "https://www.petmanager.co.kr/entry/shop-f512d347",
    "예약 확인 링크",
    "https://www.petmanager.co.kr/m?s=shop-f512d347",
  ].join("\n");
}

function KakaoAlimtalkPreview({ item }: { item: AlertItem }) {
  const message = getAlimtalkPreviewMessage(item);

  return (
    <div className="rounded-[12px] border border-[#dbe2ea] bg-[#fbfcfd] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-normal text-[#111827]">알림톡 미리보기</p>
          <p className="mt-1 text-[13px] text-[#64748b]">{item.title}</p>
        </div>
        <MessageCircle className="h-4 w-4 text-[#2f7866]" />
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[282px] overflow-hidden rounded-[2px] border border-[#a9bdcc] bg-[#bdd2e2] px-3.5 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.10)]">
          <div className="flex items-center gap-2">
            <img src="/images/brand/ododok-petmanager-logo.png" alt="" className="h-9 w-9 rounded-full bg-white object-contain p-1" />
            <p className="min-w-0 truncate text-[12px] font-normal text-[#0f172a]">오도독상회-펫매니저</p>
          </div>

          <div className="relative ml-[35px] mt-1 w-[198px] rounded-[2px] bg-white text-[#111827] shadow-sm">
            <div className="rounded-t-[2px] bg-[#ffe500] px-2.5 py-2 text-[11px] font-normal leading-none text-[#111827]">알림톡 도착</div>
            <span className="absolute -right-3 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#3b3328] text-[8px] font-normal text-white">kakao</span>
            <div className="px-2.5 py-3 text-[11px] leading-[1.55]">
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
  const [selectedAlertKey, setSelectedAlertKey] = useState<AlertItem["key"]>(alertItems[0].key);
  const previewItem = alertItems.find((item) => item.key === selectedAlertKey) ?? alertItems[0];

  function update(key: AlertItem["key"], checked: boolean) {
    setSelectedAlertKey(key);
    onChange({ ...value, [key]: checked });
  }

  return (
    <section className="rounded-[16px] border border-[#e5e7eb] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,0.035)]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[#111827]">알림톡 전체 사용</p>
                <p className="mt-1 text-[13px] leading-5 text-[#64748b]">
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
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">{group.title}</p>
                </div>
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-normal text-[#64748b]">{group.items.length}개</span>
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
                        "flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border bg-white p-3 text-left transition",
                        selected ? "border-[#2f7866] shadow-[0_6px_16px_rgba(47,120,102,0.08)]" : checked ? "border-[#b9d8cc]" : "border-[#dbe2ea]",
                        value.enabled ? "hover:border-[#2f7866]" : "opacity-55",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-normal text-[#111827]">{item.title}</span>
                      </span>
                      <span onClick={(event) => event.stopPropagation()}>
                        <Switch checked={checked} disabled={!value.enabled} aria-label={`${item.title} 알림`} onCheckedChange={(nextChecked) => update(item.key, nextChecked)} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <KakaoAlimtalkPreview item={previewItem} />
        </div>
      </div>
    </section>
  );
}
