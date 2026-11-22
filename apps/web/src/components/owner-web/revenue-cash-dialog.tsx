"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { revenuePaymentMethods, type RevenueCashMutation, type RevenuePaymentMethod, type RevenueTransaction } from "@petmanager/shared/contracts/revenue-analytics";
import { ApiResponseError, fetchApiJsonWithAuth } from "@/lib/api";
import { formatRevenueWon, paymentMethodLabels } from "@/lib/revenue-analytics";
import { clearRevenueCashAttempt, persistRevenueCashAttempt, restoreRevenueCashAttempt } from "@/lib/revenue-cash-attempt";

const field = "min-h-11 min-w-0 rounded-lg border border-[#dfe5ec] bg-white px-3 text-[14px] text-[#172033] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]";
export default function RevenueCashDialog({ shopId, transaction, onClose, onSaved }: { shopId: string; transaction: RevenueTransaction; onClose: () => void; onSaved: () => void }) {
  const refund = transaction.eventType === "payment";
  const limit = refund ? transaction.refundableAmount : transaction.amount;
  const scope = { shopId, entryId: transaction.entryId, type: refund ? "refund" as const : "payment" as const, ...(refund ? { paymentEventId: transaction.id } : {}) };
  const [restored] = useState(() => {
    try { return { request: restoreRevenueCashAttempt(sessionStorage, scope), error: "" }; }
    catch { return { request: null, error: "이전 저장 요청을 확인할 수 없습니다. 브라우저의 세션 저장소를 사용할 수 있는지 확인한 뒤 다시 열어 주세요." }; }
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const attempt = useRef<RevenueCashMutation | null>(restored.request);
  const [tenders, setTenders] = useState<Array<{ method: RevenuePaymentMethod; amount: string }>>(() => restored.request?.tenders.map(row => ({ method: row.method, amount: String(row.amount) })) ?? [{ method: refund ? transaction.paymentMethod : "card", amount: String(limit) }]);
  const [at, setAt] = useState(() => new Date(restored.request?.occurredAt ?? Date.now()).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).replace(" ", "T").slice(0, 16));
  const [confirmed, setConfirmed] = useState(Boolean(restored.request));
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(Boolean(restored.request));
  const [error, setError] = useState(restored.error || (restored.request ? "이전에 저장 결과를 확인하지 못한 요청이 있습니다." : ""));
  const total = tenders.reduce((sum, tender) => sum + Number(tender.amount || 0), 0);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  function changeTender(index: number, patch: Partial<(typeof tenders)[number]>) { setTenders(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); attempt.current = null; }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || saving || restored.error || (!uncertain && (total <= 0 || total > limit))) return;
    setSaving(true); setError("");
    let sent = false;
    try {
      const occurredAt = new Date(`${at}:00+09:00`).toISOString();
      const payload: RevenueCashMutation = attempt.current ?? { requestId: crypto.randomUUID(), entryId: transaction.entryId, type: refund ? "refund" : "payment", occurredAt, tenders: tenders.map(row => ({ method: row.method, amount: Number(row.amount) })), ...(refund ? { paymentEventId: transaction.id } : {}) };
      attempt.current = payload;
      persistRevenueCashAttempt(sessionStorage, scope, payload);
      sent = true;
      await fetchApiJsonWithAuth(`/api/owner/revenue/cash?shopId=${encodeURIComponent(shopId)}`, { method: "POST", body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
      try { clearRevenueCashAttempt(sessionStorage, scope, payload.requestId); } catch { /* A retained identifier is safe to acknowledge again. */ }
      onSaved();
    } catch (reason) {
      const rejected = reason instanceof ApiResponseError && reason.status >= 400 && reason.status < 500 && ![401, 403, 408, 429].includes(reason.status);
      const ambiguous = !rejected && (sent || Boolean(restored.request));
      setUncertain(ambiguous);
      if (!ambiguous) { if (attempt.current) try { clearRevenueCashAttempt(sessionStorage, scope, attempt.current.requestId); } catch { /* Preserve unresolved metadata if the store is unavailable. */ } attempt.current = null; }
      setError(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    } finally { setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="revenue-cash-title" onCancel={event => { if (saving) event.preventDefault(); }} onClose={() => { const element = dialog.current; if (element && !element.open) onClose(); }} className="m-auto max-h-[90dvh] w-[min(94vw,520px)] overflow-auto rounded-[14px] border border-[#e8edf3] bg-white p-5 text-[#172033] backdrop:bg-[#101a31]/40">
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 id="revenue-cash-title" className="text-[20px] font-semibold">{refund ? "환불 기록" : "수금 확인"}</h2><button data-owner-control-size="content" type="button" disabled={saving} onClick={onClose} className={`${field} min-w-11`}>닫기</button></div>
      <p className="text-[14px] leading-5">{transaction.title} · {transaction.petName ?? transaction.guardianName ?? "고객 미입력"}<br />{refund ? "환불 가능" : "확인할 금액"} {formatRevenueWon(limit)}</p>
      <p className="text-[14px] leading-5 text-[#64748b]">{refund ? "실제 환불을 완료한 뒤 기록해 주세요. 카드 취소나 송금을 실행하는 기능은 아닙니다." : "예약금·잔금을 포함해 실제로 받은 금액만 기록해 주세요. 미용 완료만으로 수금 처리하지 않습니다."}</p>
      <label className="flex flex-col gap-1 text-[14px]">{refund ? "환불" : "수금"} 날짜·시간 (한국)<input type="datetime-local" required value={at} disabled={saving || uncertain} onChange={event => { setAt(event.target.value); attempt.current = null; }} className={field} /></label>
      <fieldset disabled={saving || uncertain} className="space-y-2"><legend className="mb-1 text-[14px]">{refund ? "원래 결제수단" : "결제수단별 받은 금액"}</legend>
        {tenders.map((row, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
          <select aria-label={`결제수단 ${index + 1}`} value={row.method} disabled={refund} onChange={event => changeTender(index, { method: event.target.value as RevenuePaymentMethod })} className={field}>{revenuePaymentMethods.map(method => <option key={method} value={method}>{paymentMethodLabels[method]}</option>)}</select>
          <input aria-label={`금액 ${index + 1}`} type="number" inputMode="numeric" min={1} max={Math.min(limit, 999_999_999)} step={1} required value={row.amount} onChange={event => changeTender(index, { amount: event.target.value })} className={field} />
          {!refund && tenders.length > 1 && <button data-owner-control-size="content" type="button" aria-label={`결제수단 ${index + 1} 삭제`} onClick={() => { setTenders(items => items.filter((_, i) => i !== index)); attempt.current = null; }} className={field}>−</button>}
        </div>)}
        {!refund && tenders.length < 6 && <button data-owner-control-size="content" type="button" onClick={() => { setTenders(items => [...items, { method: "cash", amount: "" }]); attempt.current = null; }} className={`${field} w-full`}>복합결제 수단 추가</button>}
      </fieldset>
      <p className="text-[16px] font-medium tabular-nums">기록 금액 {formatRevenueWon(total)}</p>
      <label className="flex min-h-11 items-start gap-2 text-[14px] leading-5"><input type="checkbox" required checked={confirmed} disabled={saving || uncertain} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />실제로 {refund ? "환불한" : "받은"} 금액과 날짜가 맞는지 확인했습니다.</label>
      {error && <p role="alert" className="text-[14px] leading-5 text-[#9a5e4e]">{error}{uncertain ? " 저장 결과가 불확실합니다. 내용을 바꾸지 않고 다시 확인하면 같은 요청으로 중복 없이 확인합니다." : ""}</p>}
      <button data-owner-control-size="content" type="submit" disabled={saving || !confirmed || Boolean(restored.error) || (!uncertain && (total <= 0 || total > limit))} className="min-h-11 w-full rounded-lg bg-[#111a30] px-4 text-[14px] font-medium text-white disabled:opacity-50">{saving ? "저장 결과 확인 중…" : uncertain ? "같은 요청으로 결과 다시 확인" : refund ? "환불 기록 저장" : "수금 기록 저장"}</button>
    </form>
  </dialog>;
}
