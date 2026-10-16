"use client";
import { useEffect, useState } from "react";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";
import type { BookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { buildDepositTemplateValues } from "@petmanager/shared/lib/deposit-template-values";
import { fillNotificationTemplate } from "@/lib/notification-registry";
import { fetchApiJsonWithAuth } from "@/lib/api";

export function BookingDepositAlimtalkPreview({ shopId, policy, loaded }: { shopId: string; policy: BookingPolicy; loaded: boolean }) {
  const [state, setState] = useState<{ shopId: string; shopName: string; approved: boolean; failed: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    void fetchApiJsonWithAuth<{ shopName: string; templates: Array<{ type: string; source: string }> }>(`/api/owner/alimtalk-template-previews?shopId=${encodeURIComponent(shopId)}`, { cache: "no-store" })
      .then((result) => { if (active) setState({ shopId, shopName: result.shopName, approved: result.templates.some((template) => template.type === "booking_deposit_request" && template.source === "ssodaa_approved"), failed: false }); })
      .catch(() => { if (active) setState({ shopId, shopName: "내 매장", approved: false, failed: true }); });
    return () => { active = false; };
  }, [shopId]);
  const current = state?.shopId === shopId ? state : null;
  const body = fillNotificationTemplate(APPROVED_ALIMTALK_CONTRACTS.booking_deposit_request.body, {
    매장명: current?.shopName ?? "내 매장", 보호자명: "보호자 (예시)", 반려동물명: "반려동물 (예시)",
    예약일시: "방문 일시 (예시)", ...buildDepositTemplateValues(policy),
  });
  return <aside aria-label="예약금 알림톡 미리보기" className="min-h-0 min-w-0 rounded-[14px] border border-[#e8edf3] bg-white p-4 sm:p-5 xl:h-full xl:overflow-y-auto">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-[18px] font-medium text-[#15213b]">예약금 알림톡 미리보기</h3><span className="text-[13px] text-[#64748b]">{!current ? "승인 상태 확인 중" : current.failed ? "승인 상태 확인 불가" : current.approved ? "승인된 문안" : "승인 전 기본 문안"}</span></div>
    <div className="rounded-[14px] bg-[#bdd2e2] p-4"><div className="mb-2 text-[14px] font-medium text-[#334155]">{current?.shopName ?? "내 매장"}</div><div className="overflow-hidden rounded-[10px] bg-white"><div className="bg-[#ffe500] px-3 py-2 text-[14px] font-medium text-[#1f2937]">알림톡 도착</div><p className="whitespace-pre-wrap break-words px-3 py-3 text-[14px] leading-6 text-[#334155]">{loaded ? body : "예약금 설정을 불러오고 있습니다."}</p><div className="border-t border-[#e8edf3] px-3 py-3 text-center text-[14px] font-medium text-[#475569]">예약금 입금 신고</div></div></div>
  </aside>;
}
