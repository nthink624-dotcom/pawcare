"use client";

import { BarChart3, CalendarDays, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProfitabilityPayload, ProfitabilityRange } from "@/types/profitability";

const rangeOptions: Array<{ value: ProfitabilityRange; label: string }> = [
  { value: "30d", label: "이번 달" },
  { value: "90d", label: "최근 3개월" },
  { value: "365d", label: "올해" },
];

const won = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="min-w-0 rounded-xl border border-[#e5eaf0] bg-white p-4">
    <p className="text-[14px] leading-5 text-[#66758a]">{label}</p>
    <p className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-[#172033] tabular-nums [overflow-wrap:anywhere]">{value}</p>
    <p className="mt-1 text-[13px] leading-5 text-[#718096]">{note}</p>
  </div>;
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="border-t border-[#e8edf3] px-4 py-5 sm:px-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[18px] font-semibold leading-6 text-[#172033]">{title}</h2>{aside}</div>{children}
  </section>;
}

export default function ProfitabilityAnalyticsScreen({ shopId }: { shopId: string }) {
  const [range, setRange] = useState<ProfitabilityRange>("30d");
  const [payload, setPayload] = useState<ProfitabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const request = shopId === "demo-shop" || shopId === "owner-demo" ? fetchApiJson : fetchApiJsonWithAuth;
    void request<ProfitabilityPayload>(`/api/owner/profitability?shopId=${encodeURIComponent(shopId)}&range=${range}${reloadKey ? "&refresh=1" : ""}`, { cache: "no-store" })
      .then((result) => { if (active) setPayload(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "매출 정보를 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, reloadKey, shopId]);

  const chartRows = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const item of payload?.sales.daily ?? []) {
      let key = item.date;
      if (range === "365d") key = `${item.date.slice(0, 7)}-01`;
      if (range === "90d") {
        const date = new Date(`${item.date}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        key = date.toISOString().slice(0, 10);
      }
      buckets.set(key, (buckets.get(key) ?? 0) + item.paidAmount);
    }
    if (!payload) return [];

    const start = new Date(`${payload.from}T00:00:00Z`);
    const end = new Date(`${payload.to}T00:00:00Z`);
    const keys: string[] = [];
    if (range === "365d") {
      const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      while (cursor <= end) {
        keys.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } else if (range === "90d") {
      const cursor = new Date(start);
      cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay() + 6) % 7);
      while (cursor <= end) {
        keys.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
    } else {
      const cursor = new Date(start);
      while (cursor <= end) {
        keys.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    return keys.map((date, index) => ({
      date,
      paidAmount: buckets.get(date) ?? 0,
      label: range === "365d"
        ? date.slice(5, 7) + "월"
        : range === "90d"
          ? date.slice(5, 10).replace("-", "/")
          : index % 5 === 0 || index === keys.length - 1 ? date.slice(8) : "",
    }));
  }, [payload, range]);
  const maxBucket = useMemo(() => Math.max(1, ...chartRows.map((item) => item.paidAmount)), [chartRows]);
  const bestBucket = useMemo(() => chartRows.reduce<(typeof chartRows)[number] | null>((best, item) => item.paidAmount > (best?.paidAmount ?? 0) ? item : best, null), [chartRows]);
  const bestBucketLabel = bestBucket
    ? range === "365d"
      ? `${bestBucket.date.slice(0, 4)}년 ${Number(bestBucket.date.slice(5, 7))}월`
      : bestBucket.date.slice(5).replace("-", "/")
    : "";
  const averagePerDay = payload
    ? Math.round(payload.sales.paidAmount / Math.max(1, Math.floor((new Date(`${payload.to}T00:00:00Z`).getTime() - new Date(`${payload.from}T00:00:00Z`).getTime()) / 86400000) + 1))
    : 0;
  const categoryTotal = payload?.sales.categories.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const change = payload?.sales.previousPaidAmount ? Math.round((payload.sales.paidAmount - payload.sales.previousPaidAmount) / Math.abs(payload.sales.previousPaidAmount) * 100) : null;
  const hasPaidSales = Boolean(payload && (payload.sales.paidCount > 0 || payload.sales.paidAmount !== 0));

  return <div data-profitability-main-surface className="h-full min-h-0 min-w-0 overflow-auto">
      <header className="flex flex-col justify-between gap-3 border-b border-[#e8edf3] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#2563eb]" strokeWidth={2} /><h1 className="text-[20px] font-semibold leading-7 text-[#172033]">매출 분석</h1></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#f2f5f9] p-1" aria-label="분석 기간">
            {rangeOptions.map((option) => <button key={option.value} type="button" aria-pressed={range === option.value} onClick={() => { setLoading(true); setError(""); setRange(option.value); }} className={cn("min-h-10 rounded-md px-3 text-[14px] transition", range === option.value ? "bg-white font-medium text-[#172033] shadow-sm" : "text-[#68778c] hover:text-[#243247]")}>{option.label}</button>)}
          </div>
          <button type="button" onClick={() => { setLoading(true); setError(""); setReloadKey((value) => value + 1); }} disabled={loading} aria-label="매출 새로고침" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfe5ec] text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
        </div>
      </header>
      {error && <div className="border-b border-[#f0d8dc] bg-[#fff8f8] px-5 py-3 text-[14px] text-[#9f3a48]">{error}</div>}
      {loading && !payload ? <div className="px-5 py-16 text-center text-[14px] text-[#64748b]">매출 정보를 불러오고 있습니다.</div> : payload && <>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 pt-4 text-[13px] text-[#64748b] sm:px-5"><CalendarDays className="h-4 w-4 shrink-0" />{payload.from} ~ {payload.to}<span className="ml-auto">결제 완료분 · 미수/예정 제외</span></div>
        <section className="grid grid-cols-2 gap-2 px-4 pb-5 lg:grid-cols-4 sm:px-5">
          <Metric label="결제 매출" value={won(payload.sales.paidAmount)} note={change === null ? "비교 기간 자료 없음" : `이전 기간보다 ${change > 0 ? "+" : ""}${change}%`} />
          <Metric label="결제 건수" value={`${payload.sales.paidCount.toLocaleString("ko-KR")}건`} note={`건당 평균 ${won(payload.sales.averagePaidAmount)}`} />
          <Metric label="할인" value={won(payload.sales.discountAmount)} note="결제된 항목에 기록된 할인" />
          <Metric label="환불" value={won(payload.sales.refundAmount)} note="결제 원장에 기록된 환불" />
        </section>
        {!hasPaidSales ? <div className="flex min-h-[280px] flex-col items-center justify-center border-t border-[#e8edf3] px-5 py-10 text-center">
          <BarChart3 className="h-6 w-6 text-[#8a98aa]" strokeWidth={1.8} aria-hidden="true" />
          <h2 className="mt-2 text-[18px] font-medium leading-6 text-[#253044]">선택한 기간에 결제된 매출이 없습니다</h2>
          <p className="mt-1 max-w-[34rem] text-[14px] leading-5 text-[#64748b]">결제가 완료되면 매출 추이와 구성, 적용된 혜택을 확인할 수 있습니다.</p>
        </div> : <>
        <Section title={range === "365d" ? "월별 매출" : range === "90d" ? "주별 매출" : "일별 매출"} aside={<span className="text-[13px] text-[#718096]">결제 완료분</span>}>
          {chartRows.length ? <>
            <div role="list" aria-label={range === "365d" ? "월별 결제 매출" : range === "90d" ? "주별 결제 매출" : "일별 결제 매출"} className="flex h-36 items-end gap-1 border-b border-[#e8edf3] pb-2 sm:gap-2">
              {chartRows.map((item) => <div key={item.date} role="listitem" aria-label={`${item.date}: ${won(item.paidAmount)}`} title={`${item.date}: ${won(item.paidAmount)}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div className={cn("w-full max-w-8 rounded-t", item.paidAmount ? "bg-[#4b83f5]" : "bg-[#e8edf3]")} style={{ height: `${Math.max(item.paidAmount ? 4 : 2, item.paidAmount / maxBucket * 100)}%` }} />
                <span className="min-h-4 text-[12px] leading-4 text-[#718096]">{item.label}</span>
              </div>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px] leading-5 text-[#64748b]">
              {bestBucket && bestBucket.paidAmount > 0 && <span>가장 높은 구간 <span className="font-medium text-[#172033]">{bestBucketLabel} · {won(bestBucket.paidAmount)}</span></span>}
              <span>하루 평균 <span className="font-medium text-[#172033]">{won(averagePerDay)}</span></span>
            </div>
          </> : <p className="py-5 text-center text-[14px] text-[#718096]">선택한 기간의 결제 매출이 없습니다.</p>}
        </Section>
        {(payload.sales.categories.length > 0 || payload.sales.paidCount > 0) && <Section title="매출 구성" aside={<span className="text-[13px] text-[#718096]">항목이 기록된 매출 기준</span>}>
          {payload.sales.categories.length ? <div className="divide-y divide-[#edf0f4]">
            {payload.sales.categories.map((item) => {
              const share = categoryTotal > 0 ? Math.max(0, Math.round(item.amount / categoryTotal * 100)) : 0;
              return <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 text-[14px]">
                <div className="min-w-0"><p className="truncate font-medium text-[#29364a]">{item.name}</p><p className="mt-0.5 text-[13px] text-[#718096]">{item.count}건 · {share}%</p></div>
                <p className="shrink-0 font-medium tabular-nums text-[#172033]">{won(item.amount)}</p>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[#edf1f5]" aria-hidden="true"><div className="h-full rounded-full bg-[#8aa8dc]" style={{ width: `${share}%` }} /></div>
              </div>;
            })}
          </div> : <p className="py-2 text-[14px] text-[#718096]">상품·서비스 매출 구분이 기록된 항목이 없습니다.</p>}
          {categoryTotal > 0 && categoryTotal < payload.sales.paidAmount && <p className="mt-2 text-[13px] leading-5 text-[#718096]">일부 결제 항목은 유형이 기록되지 않아 위 구성에서 제외될 수 있습니다.</p>}
        </Section>}
        {(payload.sales.benefits.length > 0 || payload.sales.paidCount > 0) && <Section title="혜택 사용" aside={<span className="text-[13px] text-[#718096]">기록된 혜택만 표시</span>}>
          {payload.sales.benefits.length ? <div className="divide-y divide-[#edf0f4]">
            {payload.sales.benefits.map((item) => <div key={item.name} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[14px]"><p className="font-medium text-[#29364a]">{item.name}</p><p className="text-[#58677c]">{item.usageCount}회 사용{item.freeServiceCount ? ` · 무료 서비스 ${item.freeServiceCount}회` : ""}{item.discountAmount ? ` · 할인 ${won(item.discountAmount)}` : ""}</p></div>)}
          </div> : <p className="py-2 text-[14px] text-[#718096]">선택한 기간에 기록된 쿠폰·서비스 혜택이 없습니다.</p>}
        </Section>}
        </>}
        {(payload.sales.unpaidAmount || payload.sales.expectedAmount) ? <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[#e8edf3] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#68778c] sm:px-5"><span>미수 {won(payload.sales.unpaidAmount)}</span><span>예정 {won(payload.sales.expectedAmount)}</span><span className="text-[#8591a0]">결제 매출 합계에는 포함하지 않았습니다.</span></div> : null}
      </>}
  </div>;
}
