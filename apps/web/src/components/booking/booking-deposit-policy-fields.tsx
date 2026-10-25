"use client";
import { useId, useRef, useState } from "react";
import type { BookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
const input = "min-h-11 min-w-0 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-[16px] font-normal text-[#15213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500";
const helper = "text-[13px] font-normal leading-5 text-slate-600";
type RefundRule = NonNullable<BookingPolicy["depositRefundRules"]>[number];
export function sortedRefundRows(rules: RefundRule[]) {
  // Sort the view, not the stored policy; edits retain each original index.
  return rules.map((rule, index) => ({ ...rule, index })).sort((a, b) => b.hoursBefore - a.hoursBefore);
}
export function addRefundTime(rules: RefundRule[]): RefundRule[] {
  const rows = sortedRefundRows(rules);
  let hours = Math.min(8760, (rows[0]?.hoursBefore ?? 0) + 24);
  if (rules.some(r => r.hoursBefore === hours)) { hours = 1; while (rules.some(r => r.hoursBefore === hours)) hours++; }
  // Inherit the existing interval, rather than invent a new refund percentage.
  return [...rules, { hoursBefore: hours, percent: rows.find(r => hours >= r.hoursBefore)?.percent ?? 100 }];
}
export function reminderTimeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return `${hours ? `${hours}시간` : ""}${hours && rest ? " " : ""}${rest || !hours ? `${rest}분` : ""} 후`;
}
function NumberChoice({ label, value, options, onChange, max, unit }: {
  label: string; value: number; options: { value: number; label: string }[]; onChange: (value: number) => void; max: number; unit: string;
}) {
  const [custom, setCustom] = useState(false), isCustom = custom || !options.some(option => option.value === value);
  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <select aria-label={label} className={`${input} max-w-[220px]`} value={isCustom ? "custom" : value} onChange={event => {
      const next = event.target.value; setCustom(next === "custom"); if (next !== "custom") onChange(Number(next));
    }}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="custom">직접 입력</option></select>
    {isCustom && <><input aria-label={`${label} 직접 입력`} className={`${input} max-w-[104px]`} type="number" min={1} max={max} step={1} value={value} onChange={event => { if (event.target.value !== "") onChange(Number(event.target.value)); }} /><span className="shrink-0">{unit}</span></>}
  </div>;
}
function RefundChoice({ label, percent, amount, onChange }: { label: string; percent: number; amount: number; onChange: (percent: number) => void }) {
  const [editPartial, setEditPartial] = useState(false);
  const mode = editPartial || (percent > 0 && percent < 100) ? "partial" : percent === 100 ? "all" : "none";
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={label} className={`${input} max-w-[240px]`} value={mode} onChange={event => {
        const next = event.target.value; setEditPartial(next === "partial");
        // Opening the percentage editor alone never changes the existing ratio.
        if (next !== "partial") onChange(next === "all" ? 100 : 0);
      }}><option value="all">전액 돌려주기</option><option value="partial">일부 돌려주기</option><option value="none">돌려주지 않기</option></select>
      {mode === "partial" && <><input aria-label={`${label} 비율`} className={`${input} max-w-[88px]`} type="number" min={0} max={100} step={1} value={percent} onChange={event => { if (event.target.value !== "") onChange(Number(event.target.value)); }} onBlur={() => setEditPartial(false)} /><span>%</span></>}
    </div>
    <p className={helper}>{percent === 100 ? "전액 돌려주기" : percent === 0 ? "돌려주지 않기" : `${Math.floor(amount * percent / 100).toLocaleString("ko-KR")}원 돌려주기`} · 예약금 {amount.toLocaleString("ko-KR")}원 기준</p>
  </div>;
}
export default function BookingDepositPolicyFields({ policy, change, refund = false }: {
  policy: BookingPolicy; change: <K extends keyof BookingPolicy>(key: K, value: BookingPolicy[K]) => void; refund?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false), helpId = useId(), helpButton = useRef<HTMLButtonElement>(null);
  const rules = policy.depositRefundRules ?? [{ hoursBefore: 24, percent: 100 }, { hoursBefore: 0, percent: 100 }];
  const rows = sortedRefundRows(rules);
  const base = policy.depositBase ?? (policy.depositAudience === "new" ? "first_visit" : policy.depositAudience === "noshow" ? "none" : "all");
  const noShow = policy.depositNoShowEnabled ?? policy.depositAudience === "noshow";
  if (refund) return <div className="pm-deposit-controls space-y-4 text-[16px] leading-6">
    <h4 className="font-medium">고객이 취소하면 얼마를 돌려줄까요?</h4>
    <div className="divide-y divide-slate-200">{rows.map((rule, position) => <div key={rule.index} className="space-y-3 py-4 first:pt-0">
      <div className="flex items-start gap-2"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {rule.hoursBefore === 0 ? <span>{position ? "그 이후에 취소하면" : "언제 취소하든"}</span> : <><span>{position ? "그 이후, 예약" : "예약"}</span><input aria-label={`취소 시점 ${rule.index + 1} 시간 전`} className={`${input} max-w-[88px]`} type="number" min={1} max={8760} step={1} value={rule.hoursBefore} onChange={event => {
          if (event.target.value !== "") change("depositRefundRules", rules.map((r, n) => n === rule.index ? { ...r, hoursBefore: Number(event.target.value) } : r));
        }} /><span>시간 전까지 취소하면</span></>}
        </div>{rules.length > 1 && <button type="button" aria-label={`취소 시점 ${rule.index + 1} 삭제`} className="ml-auto min-h-11 shrink-0 rounded-[8px] px-3 text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => change("depositRefundRules", rules.filter((_, n) => n !== rule.index))}>삭제</button>}
      </div>
      <RefundChoice label={`취소 시점 ${rule.index + 1} 돌려줄 금액`} percent={rule.percent} amount={policy.depositAmount} onChange={percent => change("depositRefundRules", rules.map((r, n) => n === rule.index ? { ...r, percent } : r))} />
    </div>)}</div>
    {!rules.some(r => r.hoursBefore === 0) && <p className={helper}>그 이후에 취소하면 전액 돌려줍니다.</p>}
    {rules.length < 8 && <button type="button" className="min-h-11 rounded-[8px] border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => change("depositRefundRules", addRefundTime(rules))}>취소 시점 추가</button>}
    <div className="space-y-3 border-t border-slate-200 pt-4"><h4 className="font-medium">예약하고 오지 않으면?</h4><RefundChoice label="예약하고 오지 않을 때 돌려줄 금액" percent={policy.depositNoShowRefundPercent ?? 0} amount={policy.depositAmount} onChange={percent => change("depositNoShowRefundPercent", percent)} /></div>
    <p className={helper}>입금 전 고객에게 안내합니다. 매장 사정으로 취소하거나 취소 후 입금되면 전액 환불합니다.</p>
  </div>;
  return <div className="pm-deposit-controls space-y-4 border-b border-slate-200 pb-4 text-[16px] leading-6">
    <label className="grid gap-2 font-medium">누구에게 예약금을 받을까요?<select aria-label="누구에게 예약금을 받을까요?" className={input} value={base} onChange={event => change("depositBase", event.target.value as BookingPolicy["depositBase"])}><option value="all">모든 고객에게 받기</option><option value="first_visit">처음 오는 고객에게만 받기</option><option value="none">따로 정한 고객에게만 받기</option></select></label>
    {base === "none" && <p className={helper}>고객별로 예약금 필수로 정했거나 아래 조건에 해당하는 고객에게 받아요.</p>}
    <label className="flex min-h-11 items-start gap-2"><input className="mt-1.5 h-4 w-4 shrink-0" type="checkbox" checked={noShow} onChange={event => change("depositNoShowEnabled", event.target.checked)} /><span>예약하고 오지 않은 고객에게도 받기</span></label>
    {noShow && <div className="space-y-2"><div className="flex flex-wrap items-center gap-2">
      <span>최근</span><NumberChoice label="예약하고 오지 않은 기간" value={policy.depositNoShowDays ?? 180} max={3650} unit="일" options={[{ value: 30, label: "1개월" }, { value: 90, label: "3개월" }, { value: 180, label: "6개월" }, { value: 365, label: "1년" }]} onChange={value => change("depositNoShowDays", value)} /><span>동안</span>
      <input aria-label="예약하고 오지 않은 횟수" className={`${input} max-w-[72px]`} type="number" min={1} max={100} step={1} value={policy.depositNoShowCount ?? 1} onChange={event => { if (event.target.value !== "") change("depositNoShowCount", Number(event.target.value)); }} /><span>번 이상 예약하고 오지 않은 고객</span>
    </div><p className={helper}>1개월은 30일 기준이에요.</p></div>}
    <div className="space-y-2" onKeyDown={event => { if (event.key === "Escape" && helpOpen) { setHelpOpen(false); helpButton.current?.focus(); } }}>
      <div className="flex items-center justify-between gap-2"><h4 className="font-medium">입금 확인 알림</h4><button ref={helpButton} type="button" aria-label="입금 확인 알림 도움말" aria-expanded={helpOpen} aria-controls={helpId} onClick={() => setHelpOpen(open => !open)} className="grid min-h-11 min-w-11 place-items-center rounded-[8px] text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 1.7-2.5 3.5M12 16h.01" strokeLinecap="round" /></svg></button></div>
      <p id={helpId} hidden={!helpOpen} className={`${helper} rounded-[10px] bg-slate-50 p-3`}>고객이 “입금했어요”를 눌렀는데 사장님이 아직 확인하지 않았다면, 정한 시간 뒤에 사장님께 알려드려요. 예약이 취소되는 시간은 아니에요.</p>
      <div className="space-y-2"><p>언제 알려드릴까요?</p><NumberChoice label="입금 확인 알림 시간" value={policy.depositReviewMinutes ?? 30} max={1440} unit="분 후" options={[15, 30, 60, 120, 240, 720, 1440].map(value => ({ value, label: reminderTimeLabel(value) }))} onChange={value => change("depositReviewMinutes", value)} /></div>
    </div>
    <p className={helper}>새 예약부터 자동 적용합니다. 특정 고객만 바꾸려면 고객 정보에서 설정하세요.</p>
  </div>;
}
