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
    <div className="rounded-[10px] border border-[#e5e9ef] bg-white px-4 py-3">
      <p className="text-[12px] font-medium text-[#7b8798]">{label}</p>
      <p className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-[#111827]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[#94a3b8]">{sub}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#d8dee8] bg-white text-center">
      <Clock3 className="h-8 w-8 text-[#9aa7b8]" strokeWidth={1.6} />
      <p className="mt-3 text-[16px] font-semibold text-[#172033]">분석할 완료 기록이 아직 없습니다.</p>
      <p className="mt-1 text-[13px] leading-5 text-[#64748b]">미용 시작·완료 시간을 기록하면 시간당 매출과 가격 조정 구간이 자동으로 쌓입니다.</p>
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
      `/api/owner/profitability?shopId=${encodeURIComponent(shopId)}&range=${range}`,
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
    <div className="h-full min-h-0 overflow-auto bg-[#f7f8fa] p-4">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e2e7ee] bg-white px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#1f6f5f]" strokeWidth={1.9} />
              <h1 className="text-[18px] font-bold tracking-[-0.02em] text-[#111827]">시간당 수익 분석</h1>
            </div>
            <p className="mt-1 text-[12px] text-[#718096]">실제 미용시간과 받은 금액을 연결해 지연 구간과 가격 조정 후보를 찾습니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-[8px] border border-[#dfe5ec] bg-[#f8fafc] p-0.5">
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
                    "h-8 rounded-[7px] px-3 text-[12px] font-semibold transition",
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dfe5ec] bg-white text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-[10px] border border-[#efd9d9] bg-white px-4 py-3 text-[13px] font-medium text-[#9f3a48]">{error}</div>
        ) : null}

        {loading && !payload ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-[10px] border border-[#e5e9ef] bg-white text-[13px] text-[#64748b]">분석 데이터를 계산하고 있습니다.</div>
        ) : payload && payload.summary.completedCount === 0 ? (
          <EmptyState />
        ) : payload ? (
          <>
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <MetricCard label="실수령 매출" value={won(payload.summary.netRevenue)} sub={`할인 전 ${won(payload.summary.grossRevenue)}`} />
              <MetricCard label="시간당 매출" value={won(payload.summary.hourlyRevenue)} sub={`실제 작업 ${hours(payload.summary.actualWorkMinutes)}`} />
              <MetricCard label="평균 예상 차이" value={minutes(payload.summary.averageDelayMinutes)} sub="실제시간 - 예상시간" />
              <MetricCard label="분석 완료 건" value={`${payload.summary.timedCount}건`} sub={`전체 완료 ${payload.summary.completedCount}건`} />
              <MetricCard label="할인 영향" value={`-${won(payload.summary.discountAmount)}`} sub="할인 전후 수익에 반영" />
            </section>

            <section className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
              <div className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-[#172033]">지금 확인할 내용</h2>
                  <span className="text-[11px] font-medium text-[#94a3b8]">최소 {payload.dataQuality.minimumRecommendationSampleSize}건 기준</span>
                </div>
                <div className="space-y-2">
                  {payload.insights.map((insight) => (
                    <div key={insight.id} className="rounded-[9px] border border-[#e7ebf0] px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        {insight.tone === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b7791f]" /> : <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d6d]" />}
                        <div>
                          <p className="text-[13px] font-bold leading-5 text-[#1f2937]">{insight.title}</p>
                          <p className="mt-0.5 text-[12px] leading-5 text-[#64748b]">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#607080]" />
                  <h2 className="text-[15px] font-bold text-[#172033]">직원별 실제시간과 매출</h2>
                </div>
                <div className="overflow-hidden rounded-[8px] border border-[#e7ebf0]">
                  <table className="w-full table-fixed text-left">
                    <thead className="bg-[#fafbfc] text-[11px] font-semibold text-[#718096]">
                      <tr><th className="px-3 py-2">담당</th><th className="px-3 py-2 text-right">작업시간</th><th className="px-3 py-2 text-right">매출</th><th className="px-3 py-2 text-right">시간당</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef1f4] text-[12px]">
                      {payload.staff.map((staff) => (
                        <tr key={staff.staffId ?? "unassigned"}>
                          <td className="px-3 py-2.5 font-semibold text-[#253044]">{staff.staffName}<span className="ml-1 font-normal text-[#94a3b8]">{staff.completedCount}건</span></td>
                          <td className="px-3 py-2.5 text-right text-[#526174]">{hours(staff.actualWorkMinutes)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[#253044]">{won(staff.netRevenue)}</td>
                          <td className="px-3 py-2.5 text-right text-[#526174]">{won(staff.hourlyRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="text-[15px] font-bold text-[#172033]">서비스별 수익성과 지연</h2><p className="mt-0.5 text-[11px] text-[#94a3b8]">시간당 매출이 낮은 순서입니다.</p></div>
                <span className="text-[11px] text-[#94a3b8]">분석 기간 {payload.from} ~ {payload.to}</span>
              </div>
              <div className="overflow-x-auto rounded-[8px] border border-[#e7ebf0]">
                <table className="min-w-[900px] w-full text-left">
                  <thead className="bg-[#fafbfc] text-[11px] font-semibold text-[#718096]">
                    <tr><th className="px-3 py-2">서비스</th><th className="px-3 py-2 text-right">완료</th><th className="px-3 py-2 text-right">예상</th><th className="px-3 py-2 text-right">실제</th><th className="px-3 py-2 text-right">차이</th><th className="px-3 py-2 text-right">지연 비율</th><th className="px-3 py-2 text-right">실수령 매출</th><th className="px-3 py-2 text-right">시간당</th><th className="px-3 py-2 text-right">기준 대비</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f4] text-[12px]">
                    {payload.services.map((service) => (
                      <tr key={service.serviceId}>
                        <td className="px-3 py-2.5 font-semibold text-[#253044]">{service.serviceName}</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.completedCount}건</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.averageExpectedMinutes ?? "-"}분</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.averageActualMinutes ?? "-"}분</td>
                        <td className={cn("px-3 py-2.5 text-right font-semibold", (service.averageDelayMinutes ?? 0) >= 10 ? "text-[#a15c1b]" : "text-[#526174]")}>{minutes(service.averageDelayMinutes)}</td>
                        <td className="px-3 py-2.5 text-right text-[#526174]">{service.delayedRate === null ? "-" : `${service.delayedRate}%`}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#253044]">{won(service.netRevenue)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#253044]">{won(service.hourlyRevenue)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-semibold", (service.benchmarkGapPercent ?? 0) < -10 ? "text-[#a04455]" : "text-[#2f7d6d]")}>{service.benchmarkGapPercent === null ? "-" : `${service.benchmarkGapPercent > 0 ? "+" : ""}${service.benchmarkGapPercent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[10px] border border-[#e2e7ee] bg-white p-4">
              <div className="mb-3"><h2 className="text-[15px] font-bold text-[#172033]">가격을 검토할 구간</h2><p className="mt-0.5 text-[11px] text-[#94a3b8]">평균 10분 이상 지연되고 시간당 매출이 매장 기준보다 10% 이상 낮은 품종·체중·서비스 조합입니다.</p></div>
              {payload.priceRecommendations.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[#dfe5ec] px-4 py-6 text-center text-[12px] text-[#718096]">아직 가격 조정을 권할 만큼 표본이 쌓이지 않았습니다.</div>
              ) : (
                <div className="grid gap-2 xl:grid-cols-2">
                  {payload.priceRecommendations.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 rounded-[8px] border border-[#e7ebf0] px-3.5 py-3">
                      <div className="min-w-0"><p className="truncate text-[13px] font-bold text-[#253044]">{item.segmentLabel}</p><p className="mt-1 text-[11px] text-[#718096]">표본 {item.sampleCount}건 · 평균 {item.averageDelayMinutes}분 지연 · 시간당 기준 대비 {item.benchmarkGapPercent}%</p></div>
                      <div className="shrink-0 text-right"><p className="text-[11px] text-[#94a3b8]">현재 평균 → 권장</p><p className="mt-0.5 text-[13px] font-bold text-[#1f6f5f]">{won(item.currentAveragePrice)} → {won(item.recommendedPrice)}</p></div>
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
