"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BookingDepositLedger } from "../contracts/booking-deposit-ledger";
import OwnerDepositControls from "./booking-deposit-owner-controls";

const money = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const field = "min-h-11 min-w-0 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal leading-6";
const button = "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} w-full !border-[#111a30] !bg-[#111a30] !text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`;
const helper = "text-[13px] font-normal leading-5 text-[#64748b]";
const stamp = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function BookingDepositLedgerPanel({ ledger: d, owner, busy, appointmentStatus, serviceAmount, remainingAmount, onAct, schedule, onReschedule, onRefresh, onLoadDetails, additionalDetails }: {
  ledger: BookingDepositLedger; owner: boolean; busy: boolean; appointmentStatus: string;
  serviceAmount?: number | null; remainingAmount?: number | null;
  onAct: (action: string, fields: Record<string, unknown>) => Promise<void>;
  schedule?: { date: string; time: string }; onReschedule?: (date: string, time: string, transfer?: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
  onLoadDetails?: () => Promise<void>;
  additionalDetails?: ReactNode;
}) {
  const [name, setName] = useState(d.payerName), [total, setTotal] = useState(d.receivedTotal > 0 ? d.receiptTotal : d.requestedAmount);
  const [refund, setRefund] = useState(d.refundDue), [note, setNote] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState("");
  const detailVersion = useRef("");
  async function loadDetails(open: boolean) {
    const identity = `${d.id}:${d.version}`;
    if (!open || !onLoadDetails || detailLoading || detailVersion.current === identity) return;
    setDetailLoading(true); setDetailError("");
    try { await onLoadDetails(); detailVersion.current = identity; }
    catch { setDetailError("상세 내역을 불러오지 못했습니다. 다시 펼쳐 주세요."); }
    finally { setDetailLoading(false); }
  }
  const [compactInput, setCompactInput] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (owner && !busy && d.historyLoaded === false && [...(root.current?.querySelectorAll('details') ?? [])].some(detail => detail.open && /처리 이력|추가 처리·정산 내역|다른 날짜 예약금/.test(detail.querySelector('summary')?.textContent ?? ""))) void loadDetails(true);
  }, [d.id, d.version, d.historyLoaded, owner, busy]);
  useEffect(() => {
    const keepFormVisible = () => {
      const input = document.activeElement;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setCompactInput(height < 500 && Boolean(input && root.current?.contains(input)));
      if (!(input instanceof HTMLInputElement) || !root.current?.contains(input)) return;
      const form = input.closest<HTMLElement>("[data-deposit-form]");
      let available = height;
      for (let parent = input.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) { available = Math.min(available, parent.clientHeight); break; }
      }
      requestAnimationFrame(() => (form && form.getBoundingClientRect().height < available - 32 ? form : input).scrollIntoView({ block: "center", behavior: "instant" }));
    };
    const section = root.current, viewport = window.visualViewport;
    section?.addEventListener("focusin", keepFormVisible);
    viewport?.addEventListener("resize", keepFormVisible);
    return () => { section?.removeEventListener("focusin", keepFormVisible); viewport?.removeEventListener("resize", keepFormVisible); };
  }, []);
  async function copyAccount() {
    try { await navigator.clipboard.writeText(d.bankAccount); setCopyMessage("계좌번호를 복사했습니다."); }
    catch { setCopyMessage("복사하지 못했습니다. 계좌번호를 길게 눌러 복사해 주세요."); }
  }
  const key = useRef<{ identity: string; key: string } | null>(null);
  const [date, setDate] = useState(schedule?.date ?? ""), [time, setTime] = useState(schedule?.time ?? ""), [transfer, setTransfer] = useState("");
  useEffect(() => { setDate(schedule?.date ?? ""); setTime(schedule?.time ?? ""); setTransfer(""); }, [schedule?.date, schedule?.time]);
  useEffect(() => { setName(d.payerName); setTotal(d.receivedTotal > 0 ? d.receiptTotal : d.requestedAmount); setRefund(d.refundDue); }, [d.id, d.version, d.payerName, d.receivedTotal, d.receiptTotal, d.refundDue, d.requestedAmount]);
  async function act(action: string, fields: Record<string, unknown>) {
    const identity = JSON.stringify({ action, fields, version: d.version });
    if (key.current?.identity !== identity) key.current = { identity, key: crypto.randomUUID() };
    await onAct(action, { ...fields, requestKey: key.current.key, ledgerVersion: d.version });
  }
  const deadline = d.retryDueAt ?? d.dueAt;
  const awaiting = d.state === "pending" || d.state === "reported";
  const cancelled = appointmentStatus === "cancelled" || appointmentStatus === "noshow";
  const needsConfirmation = !cancelled && (awaiting || d.unverified);
  const reviewRequired = d.confirmationReviewRequired === true;
  const manualSettlement = d.usedTotal > 0 || d.refundedTotal > 0 || d.forfeitedTotal > 0 || d.receivedTotal !== d.receiptTotal;
  const fullyRefunded = d.refundedTotal > 0 && d.availableTotal === 0 && d.refundDue === 0 && d.usedTotal === 0;
  const status = d.refundDue > 0 ? "환불 대기" : fullyRefunded ? "환불 완료" : d.unverified ? "입금 미확인" : ({ pending: "입금 대기", reported: "매장 확인 대기", confirmed: "입금 확인 완료", waived: "예약금 면제", cancelled: "요청 종료" })[d.state];
  const tone = d.refundDue > 0 || needsConfirmation ? "bg-[#fffaf0] text-[#8a5b11]" : "bg-[#f1f5f9] text-[#475569]";
  const compactConfirmation = compactInput && d.receivedTotal === 0;
  if (owner) return <OwnerDepositControls d={d} busy={busy} appointmentStatus={appointmentStatus} remainingAmount={remainingAmount} serviceAmount={serviceAmount} act={act} onRefresh={onRefresh} loadDetails={async () => { if (onLoadDetails) await onLoadDetails(); }} additionalDetails={additionalDetails} schedule={schedule} onReschedule={onReschedule} sectionRef={root} />;
  return <section ref={root} aria-label="공유 예약금" aria-busy={busy} className="pm-deposit-controls min-w-0 space-y-3 border-b border-[#e5e8ec] py-4 text-[16px] font-normal leading-6 text-[#15213b] [overflow-wrap:anywhere]">
    <header className="flex items-center justify-between gap-3"><h3 className="text-[16px] font-semibold leading-6">예약금</h3><span role="status" className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-medium leading-5 ${tone}`}>{status}</span></header>
    {d.bookingCount > 1 && <p className={helper}>같은 날 예약은 예약금을 한 번만 입금하시면 됩니다.</p>}
    {!d.requiresDeposit && !cancelled && <p className={helper}>이 예약에는 추가 입금이 필요하지 않습니다.</p>}
    {reviewRequired && <p role="status" className="rounded-[10px] border border-[#ead9b8] bg-[#fffaf0] px-3 py-2 text-[14px] leading-5 text-[#8a5b11]">{owner ? "입금 확인을 취소해 예약금 대기로 돌아갔습니다. 다시 확인하거나 입금 재요청을 하기 전까지 자동 확정·만료가 보류됩니다." : "매장에서 입금 내역을 다시 확인하고 있습니다. 추가 송금하지 말고 매장 확인을 기다려 주세요."}</p>}
    {d.unverified && <p role="status" className="rounded-[10px] border border-[#ead9b8] bg-[#fffaf0] px-3 py-2 text-[14px] leading-5 text-[#8a5b11]">예약은 확정됐지만 실제 입금은 아직 확인되지 않았어요. 입금 확인 전에는 미용 요금에서 차감되지 않습니다.</p>}
    <dl data-deposit-summary className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-[10px] bg-[#f8fafc] p-3 [&>dt]:text-[#64748b] [&>dd]:text-right [&>dd]:font-medium [&>dd]:tabular-nums">
      {awaiting && d.refundDue === 0 && <><dt>요청한 예약금</dt><dd>{money(d.requestedAmount)}</dd></>}
      {!awaiting && !cancelled && d.refundDue === 0 && d.allocatedAmount > 0 && appointmentStatus !== "completed" && <><dt>이번 예약에서 차감할 금액</dt><dd>{money(d.allocatedAmount)}</dd></>}
      {!cancelled && serviceAmount != null && <><dt>남은 결제 금액</dt><dd>{remainingAmount == null ? "확인 필요" : money(remainingAmount)}</dd></>}
      {!awaiting && !cancelled && serviceAmount == null && <><dt>남은 결제 금액</dt><dd>미용 요금 확정 후 안내</dd></>}
      {d.refundDue > 0 && <><dt>환불 예정 금액</dt><dd>{money(d.refundDue)}</dd></>}
      {d.refundedTotal > 0 && <><dt>환불 완료 금액</dt><dd>{money(d.refundedTotal)}</dd></>}
    </dl>
    {d.refundDue > 0 && <p className={helper}>{owner ? "고객에게 직접 송금한 뒤 아래에서 환불 완료를 기록해 주세요." : "매장에서 환불을 진행할 예정입니다. 자세한 일정은 매장에 문의해 주세요."}</p>}
    {fullyRefunded && <p className={helper}>매장에서 환불 완료를 기록했습니다.{owner ? "" : " 입금 내역을 확인해 주세요."}</p>}
    {awaiting && !cancelled && !reviewRequired && (owner || d.requiresDeposit) && <>
      {!owner && d.reportValid && <div role="status" className="space-y-1 rounded-[10px] bg-[#f8fafc] p-3"><p className="font-medium">입금 신고를 받았어요</p><p className={helper}>예약 시간을 유지하며 매장 확인을 기다리고 있어요. 다시 입금하지 않으셔도 됩니다.</p></div>}
      <details open={!owner && !d.reportValid || undefined} className="border-b border-[#e5e8ec] pb-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">입금 안내</summary><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 pt-2 [&>dt]:text-[#64748b] [&>dd]:min-w-0"><dt>은행</dt><dd>{d.bankName}</dd><dt>계좌번호</dt><dd className="tabular-nums [overflow-wrap:anywhere]">{d.bankAccount}</dd><dt>예금주</dt><dd>{d.bankHolder}</dd><dt>입금 마감</dt><dd>{stamp(deadline)}</dd></dl>{!owner && <button type="button" className={`${button} mt-3 w-full`} onClick={() => void copyAccount()}>계좌번호 복사</button>}{copyMessage && <p role="status" className={`mt-2 ${helper}`}>{copyMessage}</p>}{!d.reportValid && <p className={`mt-3 ${helper}`}>기한 안에 이체 후 입금 완료를 신고해 주세요. 신고 없이 기한이 지나면 예약이 취소됩니다.</p>}</details>
    </>}
    {!owner && !cancelled && !reviewRequired && d.requiresDeposit && awaiting && <div data-deposit-form className="space-y-3 scroll-mb-24">
      <label className="grid gap-1.5">입금자명<input aria-label="실제 입금자명" className={field} maxLength={50} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="button" className={primary} disabled={busy || !name.trim() || (d.reportValid && name.trim() === d.payerName) || (!d.reportValid && Date.parse(deadline) <= Date.now())} onClick={() => void act("report_deposit", { payerName: name })}>{d.reportValid ? "입금자명 수정" : "입금했어요"}</button>
      {!d.reportValid && Date.parse(deadline) <= Date.now() && <p role="status" className={helper}>입금 신고 기한을 확인하고 있습니다. 송금하지 말고 매장에 문의해 주세요.</p>}
    </div>}
    {cancelled && <p className={helper}>{owner ? "취소된 예약입니다. 확인된 예약금의 환불 금액과 취소·노쇼 수수료를 확인해 주세요." : "취소된 예약에는 송금하지 마세요. 취소 후 입금하셨다면 매장에 문의해 주세요."}</p>}
    <details>
      <summary className={`min-h-11 cursor-pointer py-2 ${helper}`}>취소·환불 규정</summary>
      <ul className={`space-y-1 ${helper}`}>
        {[...d.refundRules].sort((a, b) => b.hoursBefore - a.hoursBefore).map((rule, index, rules) => <li key={index}>예약 시작 {rule.hoursBefore}시간 이상{index > 0 ? ` ~ ${rules[index - 1].hoursBefore}시간 미만` : ""} 전 취소 시 {rule.percent}% 환불</li>)}
        <li>노쇼 시 {d.noShowRefundPercent}% 환불</li><li>매장 귀책 취소·취소 후 늦은 입금은 전액 환불</li>
      </ul>
    </details>
    <button type="button" className={`${button} w-full !text-[#64748b]`} disabled={busy} onClick={() => void onRefresh()}>예약금 상태 새로고침</button>
  </section>;
}
