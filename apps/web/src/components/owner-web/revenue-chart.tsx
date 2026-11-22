"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RevenueAnalyticsPayload } from "@petmanager/shared/contracts/revenue-analytics";
import { buildRevenueChart, formatRevenueWon, type RevenueChartBucket } from "@/lib/revenue-analytics";

export default function RevenueChart({ payload, onDrillDown }: { payload: RevenueAnalyticsPayload; onDrillDown: (bucket: RevenueChartBucket) => void }) {
  const buckets = useMemo(() => buildRevenueChart(payload), [payload]);
  const [selection, setSelection] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const selected = buckets.find(row => row.from === selection);
  const maximum = Math.max(1, ...buckets.map(row => Math.abs(row.amount)));
  useEffect(() => {
    const element = viewport.current;
    const lastMovement = buckets.findLastIndex(row => row.amount !== 0);
    const target = element?.querySelectorAll<HTMLButtonElement>("[data-revenue-bucket]")[lastMovement];
    if (!element || !target) return;
    const revealLatest = () => { element.scrollLeft = Math.max(0, target.offsetLeft + target.offsetWidth - element.clientWidth); };
    revealLatest();
    const observer = new ResizeObserver(revealLatest);
    observer.observe(element);
    return () => observer.disconnect();
  }, [buckets]);
  return <section aria-labelledby="revenue-chart-title" className="border-t border-[#e8edf3] px-4 py-5 sm:px-5">
    <h2 id="revenue-chart-title" className="text-[18px] font-semibold leading-6 text-[#172033]">수금 매출 추이</h2>
    {payload.summary.eventCount === 0 ? <p className="py-6 text-[14px] text-[#64748b]">선택한 기간에 확인된 수금·환불 기록이 없습니다. 미수·확인 필요 내역을 확인해 주세요.</p> : <>
      <div ref={viewport} className="mt-3 overflow-x-auto pb-2" tabIndex={0} aria-label="날짜별 그래프. 가로로 이동하고 막대를 누르면 금액을 확인할 수 있습니다.">
        <div className="relative grid h-48" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(44px, 1fr))`, minWidth: buckets.length * 44 }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[84px] border-t border-[#94a3b8]" />
          {buckets.map(bucket => <button data-revenue-bucket data-owner-control-size="content" key={bucket.from} type="button" aria-pressed={selected?.from === bucket.from} aria-label={`${bucket.from}${bucket.to !== bucket.from ? ` ~ ${bucket.to}` : ""}, ${formatRevenueWon(bucket.amount)}`} onClick={() => setSelection(bucket.from)} className="relative min-h-11 min-w-11 rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb]">
            {bucket.amount !== 0 && <span aria-hidden="true" className={`absolute left-1/2 w-5 -translate-x-1/2 ${bucket.amount < 0 ? "rounded-b bg-[#9a5e4e]" : "rounded-t bg-[#7e9bc5]"}`} style={{ height: Math.max(2, Math.abs(bucket.amount) / maximum * 72), ...(bucket.amount > 0 ? { bottom: "108px" } : { top: "84px" }) }} />}
            <span className={`absolute inset-x-0 bottom-1 text-[12px] leading-4 ${selected?.from === bucket.from ? "font-medium text-[#172033]" : "text-[#64748b]"}`}>{bucket.label}</span>
          </button>)}
        </div>
      </div>
      <div className="mt-2 flex min-h-11 flex-wrap items-center justify-between gap-2 text-[14px] leading-5">
        <p role="status" className="text-[#475569]">{selected ? `${selected.from}${selected.to !== selected.from ? ` ~ ${selected.to}` : ""} · ${formatRevenueWon(selected.amount)}` : "막대를 누르면 날짜와 금액을 확인할 수 있습니다."}</p>
        {selected && <button data-owner-control-size="content" type="button" onClick={() => onDrillDown(selected)} className="min-h-11 rounded-lg border border-[#dfe5ec] px-3 font-medium text-[#172033]">이 구간 거래 보기</button>}
      </div>
      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">가운데 선은 0원입니다. 위쪽은 수금이 더 많은 구간, 아래쪽은 환불이 더 많은 구간입니다.</p>
    </>}
  </section>;
}
