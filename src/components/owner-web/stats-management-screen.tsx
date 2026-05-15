"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import {
  GhostButton,
  MiniSection,
  SelectLike,
  SimpleLineChart,
  WebSectionTitle,
  WebSurface,
} from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";

const trendPoints = [
  { label: "5/1", value: 92 },
  { label: "5/3", value: 118 },
  { label: "5/5", value: 104 },
  { label: "5/7", value: 136 },
  { label: "5/9", value: 152 },
  { label: "5/11", value: 145 },
  { label: "5/13", value: 168 },
];

const revenueMetrics = [
  { label: "완료 건수", value: "274건", helper: "완료율 86.1%" },
  { label: "객단가", value: "54,300원", helper: "지난달 대비 +4.8%" },
  { label: "미수", value: "2건", helper: "확인 필요 88,000원", tone: "warning" },
  { label: "환불", value: "1건", helper: "이번 달 35,000원", tone: "muted" },
];

const serviceRevenue = [
  { service: "전체 미용", amount: "3,536,000원", share: "42%", count: "64건" },
  { service: "목욕 + 부분정리", amount: "2,358,000원", share: "28%", count: "58건" },
  { service: "목욕", amount: "1,516,000원", share: "18%", count: "47건" },
  { service: "위생 미용", amount: "1,010,000원", share: "12%", count: "41건" },
];

const operationIssues = [
  { label: "취소", value: "21건", helper: "취소율 6.6%" },
  { label: "미수", value: "88,000원", helper: "2건 확인 필요" },
  { label: "재방문율", value: "67%", helper: "재방문 고객 103명" },
];

export default function StatsManagementScreen() {
  const [period, setPeriod] = useState("이번 달");
  const [comparison, setComparison] = useState("지난달 대비");
  const [trendMode, setTrendMode] = useState("일별");
  const [downloadMessage, setDownloadMessage] = useState("");

  function togglePeriod() {
    setPeriod((current) => (current === "이번 달" ? "지난 30일" : current === "지난 30일" ? "이번 주" : "이번 달"));
  }

  function toggleComparison() {
    setComparison((current) => (current === "지난달 대비" ? "전년 동월 대비" : current === "전년 동월 대비" ? "비교 없음" : "지난달 대비"));
  }

  function handleDownload() {
    setDownloadMessage("매출 리포트 다운로드를 준비했습니다.");
  }

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="매출"
        description="이번 달 매출과 정산 상태를 확인합니다."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SelectLike label={period} onClick={togglePeriod} />
            <SelectLike label={comparison} onClick={toggleComparison} />
            <button
              type="button"
              onClick={handleDownload}
              aria-label="매출 리포트 다운로드"
              className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] transition hover:bg-[#f8fafc]"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,1.15fr)_minmax(0,1fr)]">
        <WebSurface className="flex min-h-[190px] flex-col justify-between p-6">
          <div>
            <p className="text-[14px] font-medium text-[#64748b]">이번 달 매출</p>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-[44px] font-semibold tracking-[-0.04em] text-[#111827]">8,420,000원</p>
              <span className="mb-2 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 py-1 text-[13px] font-medium text-[#1f6b5b]">
                +12%
              </span>
            </div>
            <p className="mt-3 text-[14px] text-[#64748b]">완료된 예약 기준 매출입니다. 정산 전 미수와 환불은 오른쪽에서 따로 확인합니다.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[13px] text-[#475569]">
            <span className="rounded-[8px] bg-[#f8fafc] px-3 py-1.5">총 예약 318건</span>
            <span className="rounded-[8px] bg-[#f8fafc] px-3 py-1.5">완료 274건</span>
          </div>
        </WebSurface>

        <div className="grid gap-4 sm:grid-cols-2">
          {revenueMetrics.map((metric) => (
            <WebSurface
              key={metric.label}
              className={cn(
                "p-5",
                metric.tone === "warning" && "border-[#eadfc9] bg-[#fffdf8]",
                metric.tone === "muted" && "bg-[#fbfcfd]",
              )}
            >
              <p className="text-[13px] font-medium text-[#64748b]">{metric.label}</p>
              <p className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[#111827]">{metric.value}</p>
              <p className="mt-2 text-[13px] text-[#64748b]">{metric.helper}</p>
            </WebSurface>
          ))}
        </div>
      </div>

      <MiniSection
        title="일별 매출 추이"
        action={
          <div className="flex items-center gap-2">
            {["일별", "주별", "월별"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTrendMode(mode)}
                className={cn(
                  "h-9 rounded-[8px] border px-3 text-[13px] font-medium transition",
                  trendMode === mode
                    ? "border-[#dbe2ea] bg-white text-[#111827] shadow-[0_1px_4px_rgba(15,23,42,0.08)]"
                    : "border-transparent bg-transparent text-[#64748b] hover:bg-[#f8fafc]",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#64748b]">
          <span>{period} · {comparison}</span>
          <span>최고 매출일 5월 13일 · 168만원</span>
        </div>
        <SimpleLineChart points={trendPoints} />
      </MiniSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <MiniSection title="서비스별 매출">
          <div className="overflow-hidden rounded-[8px] border border-[#e2e8f0]">
            <div className="grid grid-cols-[1.1fr_1fr_0.55fr_0.55fr] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-[#64748b]">
              <span>서비스</span>
              <span className="text-right">매출</span>
              <span className="text-right">비율</span>
              <span className="text-right">건수</span>
            </div>
            {serviceRevenue.map((item) => (
              <div key={item.service} className="grid grid-cols-[1.1fr_1fr_0.55fr_0.55fr] border-t border-[#edf2f7] px-4 py-4 text-[14px]">
                <span className="font-medium text-[#111827]">{item.service}</span>
                <span className="text-right font-semibold text-[#111827]">{item.amount}</span>
                <span className="text-right text-[#64748b]">{item.share}</span>
                <span className="text-right text-[#64748b]">{item.count}</span>
              </div>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="운영 이슈">
          <div className="space-y-3">
            {operationIssues.map((issue) => (
              <div key={issue.label} className="flex items-center justify-between gap-4 rounded-[8px] border border-[#e2e8f0] bg-white px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium text-[#111827]">{issue.label}</p>
                  <p className="mt-1 text-[13px] text-[#64748b]">{issue.helper}</p>
                </div>
                <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">{issue.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <GhostButton label="미수 확인" />
            <GhostButton label="취소 내역" />
          </div>
        </MiniSection>
      </div>

      {downloadMessage ? <p className="text-[13px] text-[#64748b]">{downloadMessage}</p> : null}
    </div>
  );
}
