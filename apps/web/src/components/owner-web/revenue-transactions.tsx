"use client";

import { useState } from "react";
import type { RevenueAnalyticsPayload, RevenueTransaction, RevenueView } from "@petmanager/shared/contracts/revenue-analytics";
import { formatRevenueWon, paymentMethodLabels } from "@/lib/revenue-analytics";

const action = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#dfe5ec] px-3 text-[14px] font-medium text-[#172033] disabled:opacity-50";
export default function RevenueTransactions({ shopId, payload, demo, onView, onKind, onPage, onRecord }: { shopId: string; payload: RevenueAnalyticsPayload; demo: boolean; onView: (view: RevenueView) => void; onKind: (kind: "all" | "payment" | "refund") => void; onPage: (page: number) => void; onRecord: (row: RevenueTransaction) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { pagination, transactions } = payload;
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  return <section id="revenue-transactions" aria-labelledby="revenue-transactions-title" className="border-t border-[#e8edf3] px-4 py-5 sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="revenue-transactions-title" className="text-[18px] font-semibold leading-6 text-[#172033]">거래 내역</h2><div className="flex flex-wrap gap-2">{([['payments', '수금·환불'], ['outstanding', '미수·확인 필요']] as const).map(([view, label]) => <button data-owner-control-size="content" key={view} type="button" aria-pressed={pagination.view === view} onClick={() => onView(view)} className={`${action} ${pagination.view === view ? "bg-[#f1f3f7]" : "bg-white"}`}>{label}</button>)}</div></div>
    {pagination.view === "outstanding" && <p className="mt-2 text-[13px] leading-5 text-[#64748b]">이용일 {payload.outstanding.through}까지의 미수 내역입니다. 수금 전이므로 결제수단 필터를 적용하지 않습니다. 기존 자동 매출은 수금 여부를 확인해 주세요.</p>}
    {pagination.view === "payments" && <select aria-label="거래 구분" value={payload.filters.eventType ?? "all"} onChange={event => onKind(event.target.value as "all" | "payment" | "refund")} className={`${action} mt-3 bg-white`}><option value="all">수금·환불 전체</option><option value="payment">수금만</option><option value="refund">환불만</option></select>}
    <p className="mt-3 text-[13px] text-[#64748b]">{pagination.total.toLocaleString("ko-KR")}건 · 항목을 누르면 상세 내역을 확인할 수 있습니다.</p>
    <ul className="mt-2 divide-y divide-[#e8edf3]">
      {transactions.map(row => <li key={row.id} className="py-3">
        <button data-owner-control-size="content" type="button" aria-expanded={expanded === row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="flex min-h-11 w-full items-start justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#2563eb]">
          <span className="min-w-0 text-[14px] leading-5"><span className="block font-medium text-[#172033]">{row.title}</span><span className="mt-1 block break-words text-[13px] text-[#64748b]">{row.eventType === "refund" ? "환불" : row.eventType === "payment" ? "수금" : row.confirmationRequired ? "수금 확인 필요" : "미수"} · {row.occurredAt ? new Date(row.occurredAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : row.appointmentDate} · {row.staffName}</span></span>
          <span className={`shrink-0 text-[16px] font-medium tabular-nums ${row.amount < 0 ? "text-[#9a5e4e]" : "text-[#172033]"}`}>{formatRevenueWon(row.amount)}</span>
        </button>
        {expanded === row.id && <div className="mt-2 rounded-lg bg-[#f8fafc] p-3 text-[14px] leading-5 text-[#475569]">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2"><dt>보호자·반려동물</dt><dd className="break-words">{[row.guardianName, row.petName].filter(Boolean).join(" · ") || "미입력"}</dd><dt>이용일</dt><dd>{row.appointmentDate}</dd><dt>결제수단</dt><dd>{row.eventType === "outstanding" ? "수금 전" : paymentMethodLabels[row.paymentMethod]}</dd>{row.eventType === "payment" && <><dt>환불 가능</dt><dd>{formatRevenueWon(row.refundableAmount)}</dd></>}</dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.appointmentId && <a data-owner-control-size="content" href={`/owner?${new URLSearchParams({ shopId, screen: "schedule", depositAppointment: row.appointmentId, depositDate: row.appointmentDate })}`} className={action}>해당 예약 열기</a>}
            {(row.eventType === "outstanding" || (row.eventType === "payment" && row.refundableAmount > 0)) && <button data-owner-control-size="content" type="button" disabled={demo} onClick={() => onRecord(row)} className={action}>{row.eventType === "outstanding" ? "수금 확인" : "환불 기록"}</button>}
          </div>
          {demo && <p className="mt-2 text-[13px] text-[#64748b]">데모 화면에서는 수금·환불을 저장하지 않습니다.</p>}
        </div>}
      </li>)}
    </ul>
    {!transactions.length && <p className="py-6 text-center text-[14px] text-[#64748b]">조건에 맞는 내역이 없습니다.</p>}
    <nav aria-label="매출 거래 페이지" className="mt-3 flex flex-wrap items-center justify-between gap-2"><button data-owner-control-size="content" type="button" className={action} disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>이전</button><span className="text-[14px] tabular-nums text-[#64748b]">{pagination.page} / {pages}</span><button data-owner-control-size="content" type="button" className={action} disabled={pagination.page >= pages} onClick={() => onPage(pagination.page + 1)}>다음</button></nav>
  </section>;
}
