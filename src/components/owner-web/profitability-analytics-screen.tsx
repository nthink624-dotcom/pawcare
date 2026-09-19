"use client";

import { AlertTriangle, Clock3, RefreshCw, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchApiJson, fetchApiJsonWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProfitabilityPayload, ProfitabilityRange } from "@/types/profitability";

const rangeOptions: Array<{ value: ProfitabilityRange; label: string }> = [
  { value: "30d", label: "최근 30일" },
  { value: "90d", label: "최근 90일" },
  { value: "365d", label: "최근 1년" },
];

function won(value: number | null) {
  return value === null ? "-" : `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function minutes(value: number | null) {
  if (value === null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}분`;
}

function hours(value: number) {
  return `${(value / 60).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}시간`;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 bg-white px-4 py-4">
      <p className="text-[12px] font-medium leading-[18px] text-[#64748b]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#111827]">{value}</p>
      <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#64748b]">{sub}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <Clock3 className="h-8 w-8 text-[#9aa7b8]" strokeWidth={1.6} />
      <p className="mt-3 text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">분석할 완료 기록이 아직 없습니다.</p>
      <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]">미용 시작·완료 시간을 기록하면 시간당 매출과 가격 조정 구간이 자동으로 쌓입니다.</p>
    </div>
  );
}

export default function ProfitabilityAnalyticsScreen({ shopId }: { shopId: string }) {
  const [range, setRange] = useState<ProfitabilityRange>("90d");
  const [payload, setPayload] = useState<ProfitabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const requestProfitability = shopId === "demo-shop" || shopId === "owner-demo" ? fetchApiJson : fetchApiJsonWithAuth;
    void requestProfitability<ProfitabilityPayload>(
      `/api/owner/profitability?shopId=${encodeURIComponent(shopId)}&range=${range}${reloadKey > 0 ? "&refresh=1" : ""}`,
      { cache: "no-store" },
    )
      .then((result) => {
        if (active) setPayload(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "수익 분석을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, reloadKey, shopId]);

  return (
    <div className="h-full min-h-0 min-w-0 overflow-auto">
      <div data-profitability-main-surface className="min-w-0 overflow-hidden rounded-[14px] border border-[#e8edf3] bg-white">
        <header className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-b border-[#e8edf3] px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#1f6f5f]" strokeWidth={1.9} />
              <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#111827]">시간당 수익 분석</h1>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="flex min-w-0 flex-1 flex-wrap rounded-[8px] border border-[#dfe5ec] bg-[#f8fafc] p-0.5 sm:flex-none">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    setRange(option.value);
                  }}
                  className={cn(
                    "min-h-11 min-w-[88px] flex-1 rounded-[7px] px-3 text-[14px] font-medium leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] sm:flex-none",
                    range === option.value ? "bg-white text-[#111827] shadow-sm" : "text-[#718096] hover:text-[#334155]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError("");
                setReloadKey((value) => value + 1);
              }}
              disabled={loading}
              aria-label="분석 새로고침"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-[#dfe5ec] bg-white text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {error ? (
          <div data-profitability-state="error" className="border-b border-[#e8edf3] bg-[#fffafa] px-4 py-3 text-[13px] font-medium leading-5 text-[#9f3a48]">{error}</div>
        ) : null}

        {loading && !payload ? (
          <div data-profitability-state="loading" className="flex min-h-[240px] items-center justify-center px-4 py-12 text-[14px] font-normal leading-5 text-[#64748b]">분석 데이터를 계산하고 있습니다.</div>
        ) : payload && payload.summary.completedCount === 0 ? (
          <EmptyState />
        ) : payload ? (
          <>
            <section data-profitability-kpi-strip className="grid grid-cols-1 gap-px border-b border-[#e8edf3] bg-[#e8edf3] sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="실수령 매출" value={won(payload.summary.netRevenue)} sub={`할인 전 ${won(payload.summary.grossRevenue)}`} />
              <MetricCard label="시간당 매출" value={won(payload.summary.hourlyRevenue)} sub={`실제 작업 ${hours(payload.summary.actualWorkMinutes)}`} />
              <MetricCard label="평균 예상 차이" value={minutes(payload.summary.averageDelayMinutes)} sub="실제시간 - 예상시간" />
              <MetricCard label="분석 완료 건" value={`${payload.summary.timedCount}건`} sub={`전체 완료 ${payload.summary.completedCount}건`} />
              <MetricCard label="할인 영향" value={`-${won(payload.summary.discountAmount)}`} sub="할인 전후 수익에 반영" />
            </section>

            <section data-profitability-section="insights" className="border-b border-[#e8edf3] px-4 py-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">지금 확인할 내용</h2>
                <span className="text-[12px] font-medium leading-[18px] text-[#64748b]">최소 {payload.dataQuality.minimumRecommendationSampleSize}건 기준</span>
              </div>
              <div className="divide-y divide-[#e8edf3]">
                {payload.insights.map((insight) => (
                  <div key={insight.id} className="flex items-start gap-2.5 py-3 first:pt-1 last:pb-0">
                    {insight.tone === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" /> : <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d6d]" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium leading-5 text-[#1f2937]">{insight.title}</p>
                      <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#64748b]">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section data-profitability-section="staff" className="border-b border-[#e8edf3] px-4 py-5">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#607080]" />
                <h2 className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">직원별 실제시간과 매출</h2>
              </div>
              <div className="min-w-0 max-w-full overflow-x-auto border-t border-[#e8edf3]" style={{ contain: "inline-size" }}>
                <table className="min-w-[520px] w-full table-fixed text-left">
                  <thead className="bg-[#fafbfc] text-[14px] font-medium leading-5 text-[#526174]">
                    <tr><th className="px-3 py-2 font-medium">담당</th><th className="px-3 py-2 text-right font-medium">작업시간</th><th className="px-3 py-2 text-right font-medium">매출</th><th className="px-3 py-2 text-right font-medium">시간당</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f4] text-[14px] font-normal leading-5 tabular-nums">
                    {payload.staff.map((staff) => (
                      <tr key={staff.staffId ?? "unassigned"}>
                        <td className="px-3 py-2.5 font-medium text-[#253044]">{staff.staffName}<span className="ml-1 text-[13px] font-normal text-[#64748b]">{staff.completedCount}건</span></td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{hours(staff.actualWorkMinutes)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#253044]">{won(staff.netRevenue)}</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{won(staff.hourlyRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section data-profitability-section="services" className="border-b border-[#e8edf3] px-4 py-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">서비스별 수익성과 지연</h2>
                <span className="text-[12px] font-medium leading-[18px] text-[#64748b]">분석 기간 {payload.from} ~ {payload.to}</span>
              </div>
              <div className="min-w-0 max-w-full overflow-x-auto border-t border-[#e8edf3]" style={{ contain: "inline-size" }}>
                <table className="min-w-[900px] w-full text-left">
                  <thead className="bg-[#fafbfc] text-[14px] font-medium leading-5 text-[#526174]">
                    <tr><th className="px-3 py-2 font-medium">서비스</th><th className="px-3 py-2 text-right font-medium">완료</th><th className="px-3 py-2 text-right font-medium">예상</th><th className="px-3 py-2 text-right font-medium">실제</th><th className="px-3 py-2 text-right font-medium">차이</th><th className="px-3 py-2 text-right font-medium">지연 비율</th><th className="px-3 py-2 text-right font-medium">실수령 매출</th><th className="px-3 py-2 text-right font-medium">시간당</th><th className="px-3 py-2 text-right font-medium">기준 대비</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f4] text-[14px] font-normal leading-5 tabular-nums">
                    {payload.services.map((service) => (
                      <tr key={service.serviceId}>
                        <td className="px-3 py-2.5 font-medium text-[#253044]">{service.serviceName}</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.completedCount}건</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.averageExpectedMinutes ?? "-"}분</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.averageActualMinutes ?? "-"}분</td>
                        <td className={cn("px-3 py-2.5 text-right font-medium", (service.averageDelayMinutes ?? 0) >= 10 ? "text-[#a15c1b]" : "text-[#526174]")}>{minutes(service.averageDelayMinutes)}</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.delayedRate === null ? "-" : `${service.delayedRate}%`}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#253044]">{won(service.netRevenue)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#253044]">{won(service.hourlyRevenue)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-medium", (service.benchmarkGapPercent ?? 0) < -10 ? "text-[#a04455]" : "text-[#2f7d6d]")}>{service.benchmarkGapPercent === null ? "-" : `${service.benchmarkGapPercent > 0 ? "+" : ""}${service.benchmarkGapPercent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section data-profitability-section="recommendations" className="px-4 py-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#172033]">가격을 검토할 구간</h2>
                <span className="text-[12px] font-medium leading-[18px] text-[#64748b]">선정 기준 · 평균 10분 이상 지연 · 시간당 매출 매장 기준 대비 -10% 이하</span>
              </div>
              {payload.priceRecommendations.length === 0 ? (
                <div className="border-t border-[#e8edf3] px-2 py-6 text-center text-[14px] font-normal leading-5 text-[#64748b]">아직 가격 조정을 권할 만큼 표본이 쌓이지 않았습니다.</div>
              ) : (
                <div className="divide-y divide-[#e8edf3] border-t border-[#e8edf3]">
                  {payload.priceRecommendations.map((item) => (
                    <div key={item.key} className="flex flex-col items-stretch justify-between gap-3 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0"><p className="whitespace-normal break-words text-[14px] font-medium leading-5 text-[#253044] [overflow-wrap:anywhere]">{item.segmentLabel}</p><p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">표본 {item.sampleCount}건 · 평균 {item.averageDelayMinutes}분 지연 · 시간당 기준 대비 {item.benchmarkGapPercent}%</p></div>
                      <div className="shrink-0 text-left sm:text-right"><p className="text-[12px] font-medium leading-[18px] text-[#64748b]">현재 평균 → 권장</p><p className="mt-0.5 text-[14px] font-semibold leading-5 text-[#1f6f5f]">{won(item.currentAveragePrice)} → {won(item.recommendedPrice)}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
