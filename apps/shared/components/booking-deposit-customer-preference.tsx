"use client";
import { useEffect, useState } from "react";
import type { DepositException } from "../contracts/booking-deposit-ledger";
export type DepositCustomerPreference = { deposit_exception: DepositException; established_customer: boolean };
export default function BookingDepositCustomerPreference({ load, persist }: { load: () => Promise<DepositCustomerPreference>; persist: (value: DepositCustomerPreference) => Promise<unknown> }) {
  const [value, setValue] = useState<{ deposit_exception: DepositException; established_customer: boolean } | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => { let active = true; setValue(null); void load().then(v => { if (active) setValue(v); }).catch(() => { if (active) setMessage("예약금 고객 설정을 불러오지 못했습니다."); }); return () => { active = false; }; }, [load]);
  async function save(next: NonNullable<typeof value>) {
    if (busy) return; setBusy(true); setMessage("");
    try { await persist(next); setValue(next); setMessage("저장됐습니다."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); } finally { setBusy(false); }
  }
  return <section aria-label="고객별 예약금 설정" className="space-y-2 border-t border-slate-200 py-4 text-[16px] leading-6">
    <div className="flex items-center justify-between gap-3"><p>예약금 · {value ? ({inherit:"매장 기준 적용",always:"항상 요청",exempt:"면제"})[value.deposit_exception] : "불러오는 중"}</p><button type="button" className="min-h-11 rounded-[10px] border border-slate-300 px-3 font-medium" disabled={!value || busy} aria-expanded={editing} onClick={() => setEditing(v=>!v)}>{editing ? "닫기" : "변경"}</button></div>
    {value && editing && <fieldset disabled={busy} className="space-y-2">
      <select aria-label="고객별 예약금 예외" className="min-h-11 w-full rounded-[10px] border border-slate-300 bg-white px-3" value={value.deposit_exception} onChange={e => void save({ ...value, deposit_exception: e.target.value as DepositException })}><option value="inherit">매장 기본 정책 따르기</option><option value="always">항상 요청</option><option value="exempt">예약금 면제</option></select>
      <details><summary className="min-h-11 cursor-pointer py-2">이전 방문 기록 보정</summary><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={value.established_customer} onChange={e => void save({ ...value, established_customer: e.target.checked })} />기존 방문 고객으로 지정</label></details>
      <p className="text-[13px] leading-5 text-slate-600">새 예약부터 적용됩니다. 예약 제한·승인 설정은 바뀌지 않습니다.</p>
    </fieldset>}
    {message && <p role="status" className="text-[13px] leading-5 text-slate-600">{message}</p>}
  </section>;
}
