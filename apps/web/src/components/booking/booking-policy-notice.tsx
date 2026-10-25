"use client";
import { useEffect, useState } from "react";
import type { CustomerBookingDepositOptions, PublicBookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { NEXT_BOOKING_RULE_LABELS } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJson } from "@/lib/api";
type PolicyResult = { policy: PublicBookingPolicy | null; version: number };
type PolicyAcceptance = { version: number; accepted: boolean; depositChoice: boolean | null };
export default function BookingPolicyNotice({ shopId, depositOptions, onChange }: {
  shopId: string; depositOptions: CustomerBookingDepositOptions | null; onChange: (value: PolicyAcceptance) => void;
}) {
  const [result, setResult] = useState<PolicyResult | null>(null), [accepted, setAccepted] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true; setResult(null); setAccepted(false); onChange({ version: 0, accepted: false, depositChoice: null });
    void fetchApiJson<PolicyResult>(`/api/booking-policy?shopId=${encodeURIComponent(shopId)}`).then(r => { if (active) { setResult(r); setAccepted(!r.policy); } }).catch(() => { if (active) setMessage("예약 정책을 확인하지 못했습니다. 다시 불러와 주세요."); });
    return () => { active = false; };
  }, [shopId, onChange]);
  useEffect(() => { if (result) onChange({ version: result.version, accepted, depositChoice: depositOptions ? depositOptions.required : null }); }, [result, accepted, depositOptions, onChange]);
  if (!result) return <p role="status" className="text-[16px]">{message || "예약 정책을 확인하고 있습니다."}</p>;
  const policy = result.policy;
  if (!policy && !depositOptions?.required) return null;
  return <section className="space-y-3 rounded-[10px] border border-slate-200 p-4 text-[16px] font-normal leading-6 text-[#15213b]">
    <h3 className="font-medium">예약금·취소 안내</h3>
    {depositOptions?.required ? <>
      <p>이 예약은 예약금 {depositOptions.amount.toLocaleString()}원 입금 확인 후 확정됩니다.</p>
      <p>예약 신청 후 최대 {depositOptions.holdMinutes}분 안에 입금자명을 남겨 입금 완료를 신고해 주세요. 예약 시작이 더 빠르면 시작 전까지 신고해야 합니다. 신고 없이 기한이 지나면 예약이 취소됩니다.</p>
      <dl className="space-y-1"><div>은행: {depositOptions.bankName}</div><div className="break-words">계좌번호: {depositOptions.bankAccount}</div><div>예금주: {depositOptions.bankHolder}</div></dl>
      <div className="space-y-1 text-slate-600"><p>고객 취소 시 환불 기준</p>{[...(depositOptions.refundRules ?? [{ hoursBefore: 0, percent: 100 }])].sort((a,b) => b.hoursBefore-a.hoursBefore).map((r,i) => <p key={i}>예약 시작 {r.hoursBefore}시간 전부터 {r.percent}% 환불</p>)}<p>노쇼 시 {depositOptions.noShowRefundPercent ?? 0}% 환불 · 매장 귀책 취소는 전액 환불</p></div>
    </> : policy?.depositMode !== "off" ? <p>{depositOptions ? "이번 예약은 추가 예약금 없이 진행됩니다." : "보호자 정보를 입력하면 예약금 적용 여부를 확인합니다."}</p> : null}
    {policy && <>
      <p className="whitespace-pre-wrap break-words">{policy.cancellationNotice}</p>
      <p>직접 취소는 시작 {policy.cancellationCutoffHours}시간 전까지 가능합니다. 이후에는 매장에 취소를 요청해 주세요.</p>
      <p className="text-[13px] leading-5 text-slate-600">예약 제한: 노쇼 1회 {NEXT_BOOKING_RULE_LABELS[policy.firstNoshowRule]} · 2회 이상 {NEXT_BOOKING_RULE_LABELS[policy.repeatNoshowRule]}</p>
      <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>예약금·취소·노쇼 안내를 확인했습니다.</span></label>
    </>}
  </section>;
}
