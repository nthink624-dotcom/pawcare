"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BookingDepositLedger } from "../contracts/booking-deposit-ledger";
const money = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const input = "min-h-11 min-w-0 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6";
const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4778c7] disabled:opacity-50";
const primary = `${button} w-full !border-[#111a30] !bg-[#111a30] !text-white`;
const helper = "text-[13px] leading-5 text-[#64748b]";
const disclosure = "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[10px] px-3 py-2 hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4778c7] [&::-webkit-details-marker]:hidden";
function DisclosureArrow() {
  return <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-open:rotate-90"><path d="m9 6 6 6-6 6" /></svg></span>;
}
export default function OwnerDepositControls({ d, busy, appointmentStatus, remainingAmount, serviceAmount, act, loadDetails, additionalDetails, schedule, onReschedule, sectionRef }: {
  d: BookingDepositLedger; busy: boolean; appointmentStatus: string; remainingAmount?: number | null; serviceAmount?: number | null;
  act: (action: string, fields: Record<string, unknown>) => Promise<void>; onRefresh: () => Promise<void>; loadDetails: () => Promise<void>;
  additionalDetails?: ReactNode; schedule?: { date: string; time: string }; onReschedule?: (date: string, time: string, transfer?: boolean) => Promise<void>; sectionRef: RefObject<HTMLElement | null>;
}) {
  const cancelled = ["cancelled", "noshow"].includes(appointmentStatus), complete = appointmentStatus === "completed";
  const confirmNeeded = !cancelled && (d.state === "pending" || d.state === "reported" || d.unverified);
  const [step, setStep] = useState<"confirm" | "refund" | null>(null), [amount, setAmount] = useState(""), [note, setNote] = useState(""), [sent, setSent] = useState(false);
  const [name, setName] = useState(d.payerName), [editName, setEditName] = useState(false), [operation, setOperation] = useState("");
  const [error, setError] = useState(""), [loading, setLoading] = useState(false), [expanded, setExpanded] = useState(false);
  const detailsFlight = useRef<Promise<void> | null>(null), detailsId = useId();
  const operationRef = useRef<HTMLFieldSetElement | null>(null);
  useEffect(() => { setStep(null); setAmount(""); setNote(""); setSent(false); setName(d.payerName); setEditName(false); setOperation(""); setExpanded(false); }, [d.id, d.version]);
  async function details() {
    if (d.historyLoaded !== false) return;
    if (detailsFlight.current) return detailsFlight.current;
    setLoading(true); setError("");
    const task = loadDetails().catch(() => { setError("내역을 불러오지 못했습니다. 다시 펼쳐 주세요."); }).finally(() => { setLoading(false); if (detailsFlight.current === task) detailsFlight.current = null; });
    detailsFlight.current = task; return task;
  }
  useEffect(() => { if (expanded && d.historyLoaded === false && !busy) void details(); }, [expanded, d.id, d.version, d.historyLoaded, busy]);
  useEffect(() => {
    if (!operation) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!operationRef.current?.contains(event.target as Node)) setOperation("");
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [operation]);
  const manualOnly = d.usedTotal > 0 || d.refundedTotal > 0 || d.forfeitedTotal > 0 || d.receivedTotal !== d.receiptTotal;
  const status = d.refundDue > 0 ? "환불 필요" : d.unverified ? "입금 미확인" : d.confirmationReviewRequired ? "입금 재확인" : confirmNeeded ? d.reportValid ? "입금 확인 필요" : "입금 대기" : d.refundedTotal > 0 && d.availableTotal === 0 ? "환불 완료" : d.state === "waived" ? "예약금 면제" : cancelled ? "예약 취소" : "입금 확인 완료";
  const title = operation === "late" ? "취소 후 입금 확인" : operation === "revoke" ? "입금 확인 취소" : operation === "retry" ? "입금 재요청" : operation === "waive" ? "이번 예약금 면제" : "";
  const corrections = [
    ...(cancelled && d.receiptTotal === 0 ? [["late", "취소 후 입금 확인"]] : []),
    ...(!complete && !cancelled ? [...(confirmNeeded || d.confirmationReviewRequired ? [["retry", "입금 재요청"]] : []), ...(d.receivedTotal === d.refundedTotal ? [["waive", "이번 예약금 면제"]] : [])] : []),
  ];
  const canRevokeConfirmation = status === "입금 확인 완료" && d.receiptTotal > 0 && !manualOnly && ["pending", "confirmed"].includes(appointmentStatus);
  const showBody = confirmNeeded || d.confirmationReviewRequired || d.refundDue > 0 || step !== null || expanded;
  const availableCorrections = corrections;
  return <section ref={sectionRef} aria-label="공유 예약금" aria-busy={busy} className="pm-deposit-controls flex min-w-0 flex-col overflow-hidden rounded-[12px] border border-[#e5e8ec] bg-white text-[16px] leading-6 text-[#15213b] [overflow-wrap:anywhere]">
    <header className={`pm-deposit-header flex min-h-14 items-center justify-between gap-3 px-3.5 ${showBody ? "border-b border-[#f0f2f4]" : ""}`}><h3 className="font-semibold">예약금</h3><div className="flex items-center gap-1">
      <span role="status" className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${status === "입금 확인 완료" ? "bg-[#f0f8f4] text-[color:var(--success,#1f6b5b)]" : d.refundDue > 0 || confirmNeeded ? "bg-[#fffaf0] text-[#8a5b11]" : "bg-[#f1f5f9] text-[#475569]"}`}>{status}</span>
      <button type="button" disabled={busy} aria-label={`예약금 상세 내역 ${expanded ? "닫기" : "열기"}`} aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4778c7]"><span className={`inline-flex ${expanded ? "rotate-90" : ""}`}><DisclosureArrow /></span></button>
    </div></header>
    <div data-deposit-body hidden={!showBody} className="space-y-3 bg-white px-3.5 py-3">
    {d.unverified && <p role="status" className="rounded-[10px] bg-[#fffaf0] p-3 text-[#8a5b11]">예약은 확정됐지만 실제 입금은 미확인입니다. 확인 전에는 요금에서 차감하지 않습니다.</p>}
    {d.confirmationReviewRequired && <p role="status" className={helper}>입금을 다시 확인하거나 재요청하기 전까지 자동 확정·취소가 보류됩니다.</p>}
    {confirmNeeded && <p>{d.payerName ? `입금자 ${d.payerName} · ` : ""}요청 예약금 {money(d.requestedAmount)}</p>}
    {d.refundDue > 0 && <p className="flex justify-between gap-3"><span>환불할 금액</span><span className="tabular-nums">{money(d.refundDue)}</span></p>}
    {!step && (d.refundDue > 0 ? <button type="button" className={primary} disabled={busy} onClick={() => { setSent(false); setStep("refund"); }}>환불 완료</button> : confirmNeeded ? <button type="button" className={primary} disabled={busy} onClick={() => { setAmount(""); setStep("confirm"); }}>입금 확인</button> : null)}
    {step === "confirm" && <fieldset disabled={busy} data-deposit-form className="space-y-3">
      <label className="grid gap-1.5">계좌에서 확인한 입금 총액 (원)<input autoFocus aria-label="실제 입금 총액" className={input} type="number" inputMode="numeric" min={1} max={10000000} value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <p className={helper}>실제 계좌 내역을 확인해 입력하세요. 나눠 입금했다면 합계만 입력합니다.</p>
      {(!d.payerName || editName) ? <label className="grid gap-1.5">입금자명<input aria-label="오너 확인 입금자명" className={input} value={name} maxLength={50} onChange={e => setName(e.target.value)} /></label> : <button type="button" className={`${button} !text-[#64748b]`} onClick={() => setEditName(true)}>입금자명 수정</button>}
      <button type="button" data-deposit-confirm className={primary} disabled={!amount || !Number.isInteger(Number(amount)) || Number(amount) <= 0 || Number(amount) > 10000000 || !name.trim()} onClick={() => void act("confirm_deposit", { amount: Number(amount), payerName: name, note: "실제 계좌 내역 확인" })}>입금 확인 완료</button>
      <button type="button" className={`${button} w-full`} onClick={() => setStep(null)}>닫기</button>
    </fieldset>}
    {step === "refund" && <fieldset disabled={busy} data-deposit-form className="space-y-3">
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={sent} onChange={e => setSent(e.target.checked)} />{money(d.refundDue)}을 고객에게 직접 송금했습니다.</label>
      <p className={helper}>이 버튼은 은행 송금을 실행하지 않습니다.</p><button type="button" className={primary} disabled={!sent} onClick={() => void act("refund_record", { amount: d.refundDue, note: "고객에게 직접 송금 완료 확인" })}>환불 완료 기록</button><button type="button" className={`${button} w-full`} onClick={() => setStep(null)}>닫기</button>
    </fieldset>}
    <div id={detailsId} data-deposit-details hidden={!expanded} className="space-y-1">
      {loading && <p className={helper}>내역을 불러오는 중입니다.</p>}{error && <p role="status" className={helper}>{error}</p>}
      <div data-deposit-breakdown className="space-y-1 tabular-nums">
        {d.movements?.filter(movement => movement.direction === "in").map((movement, index) => <p key={index}>{movement.date} 예약금 {money(movement.amount)}을 이어서 사용{movement.petName ? ` · ${movement.petName}` : ""}</p>)}
        {d.usedTotal > 0 && <p>→ 미용 요금에 {money(d.usedTotal)} 사용{d.bookingCount > 1 ? " (같은 날 예약 합계)" : ""}</p>}
        {d.forfeitedTotal > 0 && <p>→ 취소·노쇼 수수료 {money(d.forfeitedTotal)}</p>}
        {d.refundedTotal > 0 && <p>→ {money(d.refundedTotal)} 환불 완료</p>}
        {d.refundDue > 0 && <p>→ {money(d.refundDue)} 환불 필요</p>}
        {d.receivedTotal > 0 && d.availableTotal - d.refundDue > 0 && (d.usedTotal > 0 || d.refundedTotal > 0 || d.forfeitedTotal > 0 || d.receivedTotal !== d.receiptTotal) && <p>보관 중인 예약금 {money(d.availableTotal - d.refundDue)}</p>}
        {d.bookingCount > 1 && <p className={helper}>같은 날 예약 {d.bookingCount}건이 이 예약금을 함께 사용합니다.</p>}
        {d.relatedBookings?.filter(booking => booking.usedAmount > 0).map(booking => <p key={booking.id} className={helper}>{booking.date} {booking.time} · {booking.petName} 예약에 {money(booking.usedAmount)} 사용</p>)}
        {d.movements?.filter(movement => movement.direction === "out").map((movement, index) => <p key={index} className={helper}>→ {movement.date} 예약으로 {money(movement.amount)} 이동{movement.petName ? ` · ${movement.petName}` : ""}</p>)}
        {!cancelled && remainingAmount != null && remainingAmount > 0 && <p>남은 결제 {money(remainingAmount)}</p>}
      </div>
      {availableCorrections.length > 0 && <div role="group" aria-label="예약금 수정" className="flex flex-wrap gap-2">{availableCorrections.map(([action, label]) => <button key={action} type="button" aria-pressed={operation === action} disabled={busy} className={`${button} !rounded-full px-4`} onClick={() => { setOperation(operation === action ? "" : action); setAmount(String(d.receiptTotal)); setNote(""); setSent(false); }}>{label}</button>)}</div>}
      {operation && operation !== "revoke" && <fieldset ref={operationRef} disabled={busy} className="space-y-3">
        {operation === "late" && <label className="grid gap-1.5">확인한 입금자명<input aria-label="취소 후 확인한 입금자명" className={input} maxLength={50} value={name} onChange={e => setName(e.target.value)} /></label>}
        {operation === "late" && <label className="grid gap-1.5">확인된 입금 총액 (원)<input aria-label="확인된 입금 총액" className={input} type="number" inputMode="numeric" min={1} max={10000000} value={amount} onChange={e => setAmount(e.target.value)} /></label>}
        <label className="grid gap-1.5">처리 사유<input aria-label="입금 변경 사유" className={input} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
        <button type="button" className={button} disabled={!note.trim() || (operation === "late" && (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0))} onClick={() => void act(({ late: "confirm_deposit", revoke: "revoke_deposit", retry: "retry_deposit", waive: "waive_deposit" } as Record<string,string>)[operation], { amount: Number(amount), payerName: name, note })}>{title}</button>
      </fieldset>}
      {additionalDetails}
      <details className="group"><summary className={disclosure}><span>취소·환불</span><DisclosureArrow /></summary><div className="space-y-2 px-3 pb-2 pt-1"><ul className={helper}>{[...d.refundRules].sort((a,b)=>b.hoursBefore-a.hoursBefore).map((r,i,all)=><li key={i}>{r.hoursBefore}시간 이상{ i > 0 ? ` ${all[i-1].hoursBefore}시간 미만` : "" } 전 취소 {r.percent}% 환불</li>)}<li>노쇼 {d.noShowRefundPercent}% 환불 · 매장 귀책 취소 전액 환불</li></ul>{canRevokeConfirmation && <button type="button" disabled={busy} className="min-h-11 px-3 text-[14px] font-medium text-[#64748b] hover:text-[#15213b] focus-visible:outline-2 focus-visible:outline-[#4778c7] disabled:opacity-50" onClick={() => { setOperation("revoke"); setAmount(String(d.receiptTotal)); setNote(""); setSent(false); }}>입금 확인 취소</button>}{operation === "revoke" && <fieldset ref={operationRef} disabled={busy} className="space-y-3"><label className="grid gap-1.5">처리 사유<input aria-label="입금 변경 사유" className={input} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><button type="button" className={button} disabled={!note.trim()} onClick={() => void act("revoke_deposit", { amount: Number(amount), payerName: name, note })}>입금 확인 취소</button></fieldset>}</div></details>
      <details className="group"><summary className={disclosure}><span>처리 이력</span><DisclosureArrow /></summary><ol className={`space-y-2 px-3 pb-2 pt-1 ${helper}`}>{d.history.map(e=><li key={e.id}>{new Date(e.at).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"numeric",minute:"2-digit",timeZone:"Asia/Seoul"})} · {({ report:"입금 신고",confirm:"입금 확인",correct:"입금액 정정",revoke:"입금 확인 취소",refund:"환불 완료",retry:"입금 재요청",waive:"예약금 면제",requested:"예약금 요청",linked:"예약 연결",cancellation_assessed:"취소 정산",start_auto_confirmed:"시작 시 자동 확정",review_reminder:"입금 확인 재알림",date_moved_in:"예약금 이동",date_moved_out:"예약금 이동",noshow_corrected:"노쇼 정정",service_price_corrected:"미용 요금 정정" } as Record<string,string>)[e.action]??"예약금 처리"}</li>)}</ol></details>
    </div>
    </div>
  </section>;
}
