"use client";

import { BellRing, MessageCircle, Phone, Send } from "lucide-react";
import { useState } from "react";

const notificationScenarios = [
  {
    id: "tomorrow",
    label: "두부 보호자님",
    action: "내일 예약 확인",
    time: "09:12",
    badge: undefined,
    kind: "phone",
    title: "내일 예약 안내",
    trigger: "내일 방문 예약이 있는 고객",
    body: <>두부 보호자님, 안녕하세요 🐾<br />내일(8/19) 오후 2시 예약이 있어요.<br />목욕 + 부분미용 · 도윤 디자이너</>,
    sentAt: "예약 전날 자동 발송",
  },
  {
    id: "same-day",
    label: "모카 보호자님",
    action: "부재중",
    time: "09:40",
    badge: "3회",
    kind: "phone",
    title: "오늘 예약 안내",
    trigger: "당일 예약이고 방문까지 여유가 있는 고객",
    body: <>모카 보호자님, 오늘 오후 4시 예약이 있어요.<br />매장 위치와 예약 내용을 다시 확인해 주세요.</>,
    sentAt: "방문 전 자동 발송",
  },
  {
    id: "question",
    label: "“몇 시에 오시나요?”",
    action: "문자 문의",
    time: "11:05",
    badge: undefined,
    kind: "message",
    title: "직전 예약 안내",
    trigger: "예약 시작 시간이 가까워진 고객",
    body: <>두리 보호자님, 오늘 예약 시간은<br />오후 2시입니다. 곧 만나요 😊</>,
    sentAt: "직전 안내 자동 발송",
  },
  {
    id: "pickup",
    label: "두리 보호자님",
    action: "픽업 시간 문의",
    time: "14:30",
    badge: undefined,
    kind: "phone",
    title: "픽업 준비 안내",
    trigger: "미용이 끝나고 픽업 준비가 된 고객",
    body: <>두리 미용이 모두 끝났어요!<br />지금 픽업하러 오셔도 좋아요 😊</>,
    sentAt: "미용 완료 시 자동 발송",
  },
] as const;

export function AutomaticNotificationPreview() {
  const [selectedId, setSelectedId] = useState<(typeof notificationScenarios)[number]["id"]>("tomorrow");
  const selected = notificationScenarios.find((scenario) => scenario.id === selectedId) ?? notificationScenarios[0];

  return (
    <div className="mt-9 grid overflow-hidden rounded-[24px] border border-[#e3e8ee] bg-white lg:grid-cols-2">
      <div className="bg-[#fbf8f1] p-7 md:p-9">
        <p className="text-[14px] font-semibold text-[#b28b4a]">지금 · 전화 돌리기</p>
        <div className="mt-6 space-y-2">
          {notificationScenarios.map((scenario) => {
            const selectedItem = scenario.id === selectedId;
            const Icon = scenario.kind === "message" ? MessageCircle : Phone;

            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setSelectedId(scenario.id)}
                aria-pressed={selectedItem}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[15px] transition ${selectedItem ? "bg-white text-[#5d503e] shadow-[0_5px_15px_rgba(91,71,38,0.08)]" : "text-[#766956] hover:bg-white/60"}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0eadc] text-[#967a50]"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 truncate font-semibold">{scenario.label} <span className="font-medium">— {scenario.action}</span>{scenario.badge ? <span className="ml-2 rounded-full bg-[#fde4d6] px-1.5 py-0.5 text-[11px] font-bold text-[#dc7c53]">{scenario.badge}</span> : null}</span>
                <time className="text-[12px] font-semibold text-[#b6aa93]">{scenario.time}</time>
              </button>
            );
          })}
        </div>
        <p className="mt-7 rounded-xl border border-dashed border-[#dfcfb4] bg-white/55 px-4 py-3 text-[14px] font-medium text-[#9a805b]">※ 오늘도 예약 확인 전화만 6통째…</p>
      </div>

      <div className="bg-[#eaf3ff] p-7 md:p-9">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[#3775be]"><BellRing className="h-4 w-4" aria-hidden="true" /> 보호자에게 자동으로 전달되는 알림톡</p>
        <div className="mx-auto mt-5 max-w-[360px] rounded-[20px] border border-[#cfe0f3] bg-white p-4 shadow-[0_16px_30px_rgba(47,86,129,0.12)]">
          <div className="flex items-center gap-2 border-b border-[#e4edf7] pb-3 text-[13px] font-semibold text-[#475569]"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#ffe500] text-[11px]">●</span> 카카오 알림톡</div>
          <div className="mt-3 rounded-2xl bg-[#f8fbff] p-4 text-[#172033]">
            <p className="text-[12px] font-bold text-[#4279c5]">펫매니저</p>
            <p className="mt-2 text-[14px] font-semibold leading-6">{selected.body}</p>
            <p className="mt-3 text-right text-[11px] text-[#94a3b8]">{selected.sentAt}</p>
          </div>
          <div className="mt-3 rounded-xl bg-[#eaf3ff] px-3 py-2.5 text-[12px] font-semibold text-[#4279c5]">
            <p className="flex items-center justify-between gap-3"><span>{selected.title}</span><span className="flex shrink-0 items-center gap-1"><Send className="h-3 w-3" aria-hidden="true" /> 자동 발송</span></p>
            <p className="mt-1 font-medium text-[#607b9b]">발송 조건 · {selected.trigger}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
