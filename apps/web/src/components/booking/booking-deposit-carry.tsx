"use client";
import { useRef, useState } from "react";
import type { AvailableBookingDeposit } from "@petmanager/shared/contracts/booking-deposit-ledger";
export default function BookingDepositCarry({ sources, busy, canCarry, onCarry, onRefund }: {
  sources: AvailableBookingDeposit[]; busy: boolean; onCarry: (source: string, amount: number, requestKey: string) => Promise<void>;
  canCarry: boolean;
  onRefund: (source: string, amount: number, requestKey: string, note: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(""), [amount, setAmount] = useState(0);
  const key = useRef({ identity: "", key: "" });
  const [note, setNote] = useState("");
  const source = sources.find(s => s.id === selected);
  if (!sources.length) return null;
  async function carry(refund = false) {
    const identity = `${refund}:${selected}:${amount}:${note}`;
    if (key.current.identity !== identity) key.current = { identity, key: crypto.randomUUID() };
    if (refund) await onRefund(selected, amount, key.current.key, note); else await onCarry(selected, amount, key.current.key);
  }
  const field = "min-h-11 w-full min-w-0 rounded-[10px] border border-slate-300 bg-white px-3 text-[16px]";
  return <details className="pm-deposit-controls border-b border-slate-200 pb-3">
    <summary className="min-h-11 cursor-pointer py-2 font-medium">다른 날짜의 미사용 예약금</summary>
    <div className="grid gap-2 py-2">
      <p className="text-[13px] leading-5 text-slate-600">같은 보호자의 실제 입금 잔액만 옮깁니다. 이미 차감·환불·수수료 처리한 돈은 사용할 수 없습니다.</p>
      <label className="grid gap-1">기존 예약금<select className={field} aria-label="승계할 기존 예약금" value={selected} onChange={e => { setSelected(e.target.value); setAmount(sources.find(s => s.id === e.target.value)?.available ?? 0); }}><option value="">선택해 주세요</option>{sources.map(s => <option key={s.id} value={s.id}>{s.date} · 잔액 {s.available.toLocaleString()}원</option>)}</select></label>
      <label className="grid gap-1">이 예약에 적용할 금액 (원)<input className={field} aria-label="예약금 승계 금액" type="number" min={1} max={source?.available ?? 0} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      {canCarry && <button type="button" className="min-h-11 rounded-[8px] border border-slate-300 px-3 font-medium disabled:opacity-50" disabled={busy || !source || amount <= 0 || amount > source.available} onClick={() => void carry()}>이 예약에 승계</button>}
      {source && <><label className="grid gap-1">직접 환불한 경우 처리 사유<input aria-label="이전 날짜 예약금 환불 사유" className={field} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label><button type="button" className="min-h-11 rounded-[8px] border border-slate-300 px-3 font-medium disabled:opacity-50" disabled={busy || !note.trim() || amount <= 0 || amount > source.available} onClick={() => void carry(true)}>선택 금액 직접 송금 후 환불 완료 기록</button></>}
    </div>
  </details>;
}
