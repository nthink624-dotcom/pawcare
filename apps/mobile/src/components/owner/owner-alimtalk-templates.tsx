"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fetchAppApiJson, getAccessTokenWithRecovery } from "@/lib/api";
import type { ShopNotificationSettings } from "@/types/domain";

type Template = { code: string; name: string; content: string; buttons: string[] };
export type OwnerAlimtalkTemplateItem = {
  alias: string;
  title: string;
  current: Template | null;
  blocked: boolean;
  options: Template[];
};

const groupOrder = ["예약 전 준비", "예약 알림", "예약 안내", "미용 진행"];
const legacyKeys: Record<string, keyof ShopNotificationSettings> = {
  booking_confirmed: "booking_confirmed_enabled",
  booking_cancelled: "booking_cancelled_enabled",
  revisit_notice: "revisit_enabled",
  appointment_reminder_10m: "appointment_reminder_10m_enabled",
  visit_schedule_notice: "appointment_reminder_10m_enabled",
  visit_reminder_notice: "appointment_reminder_10m_enabled",
  grooming_started: "grooming_started_enabled",
  grooming_almost_done: "grooming_almost_done_enabled",
  grooming_completed: "grooming_completed_enabled",
  grooming_completed_without_report: "grooming_completed_enabled",
};

function groupFor(alias: string) {
  if (["booking_deposit_request", "booking_consent_request"].includes(alias)) return "예약 전 준비";
  if (["booking_confirmed", "booking_cancelled", "revisit_notice"].includes(alias)) return "예약 알림";
  if (["appointment_reminder_10m", "visit_schedule_notice", "visit_reminder_notice"].includes(alias)) return "예약 안내";
  return "미용 진행";
}

function titleFor(item: OwnerAlimtalkTemplateItem) {
  if (item.alias === "booking_deposit_request") return "예약금 안내";
  if (item.alias === "grooming_completed") return "미용 완료 · 케어리포트 있음";
  if (item.alias === "grooming_completed_without_report") return "미용 완료 · 케어리포트 없음";
  return item.title;
}

export default function OwnerAlimtalkTemplates({ shopId, settings }: {
  shopId: string;
  settings: ShopNotificationSettings;
}) {
  const [items, setItems] = useState<OwnerAlimtalkTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setItems([]);
    setSelected(null);
    void getAccessTokenWithRecovery().then(accessToken => fetchAppApiJson<{ items: OwnerAlimtalkTemplateItem[] }>(
      `/api/owner/alimtalk-template-selection?shopId=${encodeURIComponent(shopId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    )).then(result => {
      if (active) setItems(result.items.filter(item => item.alias !== "booking_received"));
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [shopId, attempt]);

  const perType = (settings as ShopNotificationSettings & { alimtalk_type_enabled?: Record<string, boolean> }).alimtalk_type_enabled;
  function statusFor(item: OwnerAlimtalkTemplateItem) {
    if (item.blocked || !item.current) return "연결 필요";
    const key = legacyKeys[item.alias];
    const enabled = perType?.[item.alias] ?? (key ? settings[key] !== false : true);
    return settings.enabled && enabled ? "사용" : "미사용";
  }

  return <section aria-label="알림톡 템플릿" data-owner-alimtalk-templates className="min-w-0 space-y-5">
    {loading ? <p role="status" className="text-[14px] text-[#64748b]">템플릿을 불러오는 중입니다.</p> : error ?
      <div role="alert" className="space-y-2">
        <p className="text-[14px] text-[#9a5e4e]">템플릿을 불러오지 못했습니다.</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 rounded-[10px] border border-[#e1e4ea] px-4 text-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">다시 불러오기</button>
      </div> : !items.length ? <p className="text-[14px] text-[#64748b]">표시할 알림톡 템플릿이 없습니다.</p> :
      groupOrder.map(group => {
        const rows = items.filter(item => groupFor(item.alias) === group);
        if (!rows.length) return null;
        return <section key={group} className="min-w-0 space-y-2">
          <h3 className="text-[18px] font-semibold text-[#15213b]">{group}</h3>
          {rows.map(item => {
            const open = selected === item.alias;
            const status = statusFor(item);
            const panelId = `${id}-${item.alias}`;
            const templates = [item.current, ...item.options].filter((value, index, all): value is Template => Boolean(value) && all.findIndex(other => other?.code === value?.code) === index);
            return <div key={item.alias} className="min-w-0">
              <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setSelected(open ? null : item.alias)}
                className={`flex min-h-[52px] w-full min-w-0 items-center gap-2 rounded-[10px] border px-3.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${open ? "border-[#8ca9d0] bg-[#f1f5fa]" : "border-[#e1e7ef] bg-white"}`}>
                <span className="min-w-0 flex-1 break-words text-[16px] font-medium text-[#15213b]">{titleFor(item)}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] ${status === "사용" ? "bg-[#edf7f2] text-[#1f6b5b]" : "bg-[#f1f3f5] text-[#64748b]"}`}>{status}</span>
                <ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-[#64748b] ${open ? "rotate-180" : ""}`} />
              </button>
              <div id={panelId} hidden={!open} className="space-y-4 px-2 py-4">
                {templates.length ? templates.map(template => <article key={template.code} className="min-w-0 space-y-2">
                  <h4 className="break-words text-[14px] font-medium text-[#64748b]">{template.code === item.current?.code ? "현재 문구" : "사용 가능한 문구"} · {template.name}</h4>
                  <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-[#15213b] [overflow-wrap:anywhere]">{template.content}</p>
                  {template.buttons.length ? <p className="text-[14px] text-[#64748b] [overflow-wrap:anywhere]">버튼 · {template.buttons.join(" · ")}</p> : null}
                </article>) : <p className="text-[14px] text-[#64748b]">연결된 문구가 없습니다.</p>}
              </div>
            </div>;
          })}
        </section>;
      })}
  </section>;
}
