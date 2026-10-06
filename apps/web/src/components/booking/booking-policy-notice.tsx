"use client";
import { useEffect, useState } from "react";
import type { PublicBookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { NEXT_BOOKING_RULE_LABELS } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJson } from "@/lib/api";
export default function BookingPolicyNotice({ shopId, onChange }: { shopId: string; onChange: (value: { version: number; accepted: boolean }) => void }) {
  const [result, setResult] = useState<{ policy: PublicBookingPolicy | null; version: number } | null>(null), [accepted, setAccepted] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { let active = true; onChange({ version: 0, accepted: false });
    fetchApiJson<{ policy: PublicBookingPolicy | null; version: number }>(`/api/booking-policy?shopId=${encodeURIComponent(shopId)}`).then(r => { if (active) { setResult(r); onChange({ version: r.version, accepted: !r.policy }); } }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [shopId, onChange]);
  if (!result) return <p role="status" className="text-[16px]">{message || "예약 정책을 확인하고 있습니다."}</p>;
  if (!result.policy) return null;
  const p = result.policy;
  return <section className="space-y-3 rounded-[10px] border border-slate-200 p-4 text-[16px] leading-6 text-slate-700">
    <h3 className="font-medium">예약금·취소 안내</h3>
    {p.depositMode !== "off" && <p>{p.depositAudience === "all" ? "전체 고객" : p.depositAudience === "new" ? "첫 방문 고객" : "노쇼 이력 고객"}의 예약금은 {p.depositAmount.toLocaleString()}원입니다. {p.depositMode === "required" ? "대상 예약은 입금 확인 후 매장에서 확정합니다." : "매장에서 예약별로 요청할 수 있습니다."}</p>}
    <p className="whitespace-pre-wrap break-words">{p.cancellationNotice}</p><p>직접 취소는 예약 시작 {p.cancellationCutoffHours}시간 전까지 가능합니다. 이후에는 매장에 취소를 요청해 주세요.</p>
    <p>노쇼 1회: {NEXT_BOOKING_RULE_LABELS[p.firstNoshowRule]} · 2회 이상: {NEXT_BOOKING_RULE_LABELS[p.repeatNoshowRule]}</p>
    <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={accepted} onChange={e => { setAccepted(e.target.checked); onChange({ version: result.version, accepted: e.target.checked }); }} />예약금·취소·노쇼 안내를 확인했습니다.</label>
  </section>;
}
