import type { BookingDepositPreview } from "../contracts/booking-deposit-preview";
export default function DepositInitialSummary({ preview: d, appointmentStatus, serviceAmount }: {
  preview?: BookingDepositPreview | null; appointmentStatus?: string; serviceAmount?: number | null;
}) {
  if (d === null) return null;
  const active = !["cancelled", "noshow"].includes(appointmentStatus ?? "");
  const needsConfirmation = Boolean(d && active && (["pending", "reported"].includes(d.state) || d.unverified));
  const money = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  const status = !d ? "확인 중" : d.refundDue > 0 ? "환불 필요" : d.unverified ? "입금 미확인" : needsConfirmation ? d.reportValid ? "입금 확인 필요" : "입금 대기" : d.refundedTotal > 0 && d.receivedTotal === d.refundedTotal ? "환불 완료" : d.state === "waived" ? "예약금 면제" : !active ? "예약 취소" : "입금 확인 완료";
  return <section aria-label="예약금 조회 중" aria-busy="true" className="flex min-w-0 flex-col gap-3 pt-3 text-[16px] leading-6 text-[#15213b] [overflow-wrap:anywhere]">
    <header className="pm-deposit-header flex min-h-11 items-center justify-between gap-3 px-3.5"><h3 className="font-semibold">예약금</h3><span role="status" className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${status === "입금 확인 완료" ? "bg-[#f0f8f4] text-[color:var(--success,#1f6b5b)]" : d && (d.refundDue > 0 || needsConfirmation) ? "bg-[#fffaf0] text-[#8a5b11]" : "bg-[#f1f5f9] text-[#475569]"}`}>{status}</span></header>
    <div data-deposit-body hidden={Boolean(d && !needsConfirmation && !d.unverified && d.refundDue <= 0)} className="space-y-3 rounded-[14px] border border-[#e5e8ec] bg-white p-3.5">
    {d?.unverified && <p className="rounded-[10px] bg-[#fffaf0] p-3 text-[#8a5b11]">예약은 확정됐지만 실제 입금은 미확인입니다. 확인 전에는 요금에서 차감하지 않습니다.</p>}
    {needsConfirmation && d && <p>{d.payerName ? `입금자 ${d.payerName} · ` : ""}요청 예약금 {money(d.requestedAmount)}</p>}
    {d && d.refundDue > 0 && <p className="flex justify-between gap-3"><span>환불할 금액</span><span className="tabular-nums">{money(d.refundDue)}</span></p>}
    {d && (d.refundDue > 0 || needsConfirmation) && <button type="button" disabled className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#111a30] px-3 font-medium text-white opacity-50">{d.refundDue > 0 ? "환불 완료" : "입금 확인"}</button>}
    {!d && <p role="status" className="text-[14px] text-[#64748b]">처리 정보 확인 중…</p>}
    </div>
  </section>;
}
