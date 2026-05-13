"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { revenueTrend, serviceShare, weekdayReservations } from "@/components/owner-web/owner-web-data";
import {
  GhostButton,
  MetricCard,
  MiniSection,
  PrimaryButton,
  SelectLike,
  SimpleBarChart,
  SimpleLineChart,
  DonutChart,
  ToolbarRow,
  WebSectionTitle,
} from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";

const metricItems = [
  { key: "total", label: "총 예약", value: "318건", meta: "지난 기간 대비 +12%" },
  { key: "completed", label: "완료", value: "274건", tone: "mint" as const, meta: "완료율 86.1%" },
  { key: "cancelled", label: "취소", value: "21건", tone: "rose" as const, meta: "취소율 6.6%" },
  { key: "revenue", label: "매출", value: "₩8,420,000", tone: "sand" as const, meta: "객단가 ₩54,300" },
  { key: "revisit", label: "재방문율", value: "67%", tone: "slate" as const, meta: "재방문 고객 103명" },
];

export default function StatsManagementScreen() {
  const [period, setPeriod] = useState("이번 달");
  const [comparison, setComparison] = useState("지난달 대비");
  const [activeMetric, setActiveMetric] = useState("revenue");
  const [trendMode, setTrendMode] = useState("월간 비교");
  const [serviceMode, setServiceMode] = useState("비율 보기");
  const [weekdayMode, setWeekdayMode] = useState("예약 수 기준");
  const [reportMessage, setReportMessage] = useState("매출 권한 확인 후 데이터를 표시합니다.");

  function togglePeriod() {
    setPeriod((current) => (current === "이번 달" ? "지난 30일" : current === "지난 30일" ? "이번 주" : "이번 달"));
    setReportMessage("조회 기간을 변경했습니다.");
  }

  function toggleComparison() {
    setComparison((current) => (current === "지난달 대비" ? "전년 동월 대비" : current === "전년 동월 대비" ? "비교 없음" : "지난달 대비"));
    setReportMessage("비교 기준을 변경했습니다.");
  }

  function downloadReport(label = "보고서") {
    setReportMessage(`${label} 다운로드를 준비했습니다.`);
  }

  return (
    <div className="space-y-6">
      <WebSectionTitle
        title="통계"
        description="총 예약, 완료, 취소, 매출, 재방문율 카드와 차트를 한 번에 보는 대시보드형 화면입니다."
        action={
          <div className="flex items-center gap-2">
            <SelectLike label={period} onClick={togglePeriod} />
            <SelectLike label={comparison} onClick={toggleComparison} />
            <PrimaryButton label="다운로드" onClick={() => downloadReport("통계")} />
          </div>
        }
      />

      <div className="rounded-[8px] border border-[#dbe2ea] bg-white px-4 py-3 text-[13px] font-medium text-[#475569]">
        현재 보기: <span className="font-semibold text-[#1f6b5b]">{period}</span>
        <span className="mx-2 text-[#cbd5e1]">/</span>
        {comparison}
        <span className="mx-2 text-[#cbd5e1]">/</span>
        {reportMessage}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricItems.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onClick={() => {
              setActiveMetric(metric.key);
              setReportMessage(`${metric.label} 지표를 선택했습니다.`);
            }}
            className={cn("rounded-[8px] text-left transition hover:-translate-y-0.5", activeMetric === metric.key && "ring-2 ring-[#1f6b5b]/25")}
          >
            <MetricCard label={metric.label} value={metric.value} tone={metric.tone} meta={metric.meta} />
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <MiniSection title="매출 추이" action={<GhostButton label="비교 기간 바꾸기" onClick={toggleComparison} />}>
          <p className="mb-3 text-[13px] font-medium text-[#64748b]">{trendMode} · {comparison}</p>
          <SimpleLineChart points={revenueTrend} />
          <div className="mt-3 flex gap-2">
            {["월간 비교", "주간 비교", "일별 보기"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTrendMode(mode);
                  setReportMessage(`${mode}로 매출 추이를 전환했습니다.`);
                }}
                className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium", trendMode === mode ? "border-[#cfded8] bg-[#eef7f4] text-[#1f6b5b]" : "border-[#dbe2ea] bg-white text-[#64748b]")}
              >
                {mode}
              </button>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="서비스별 비율" action={<GhostButton label="서비스 목록" onClick={() => {
          setServiceMode((current) => (current === "비율 보기" ? "서비스 목록" : "비율 보기"));
          setReportMessage("서비스별 화면을 전환했습니다.");
        }} />}>
          <p className="mb-3 text-[13px] font-medium text-[#64748b]">{serviceMode}</p>
          <DonutChart items={serviceShare} />
        </MiniSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <MiniSection title="요일별 예약 분포" action={<GhostButton label="요일 기준 보기" onClick={() => {
          setWeekdayMode((current) => (current === "예약 수 기준" ? "매출 기준" : "예약 수 기준"));
          setReportMessage("요일별 기준을 변경했습니다.");
        }} />}>
          <p className="mb-3 text-[13px] font-medium text-[#64748b]">{weekdayMode}</p>
          <SimpleBarChart items={weekdayReservations} />
        </MiniSection>

        <MiniSection title="운영 메모">
          <div className="space-y-3 text-[14px] leading-7 text-[#5f5851]">
            <p>금요일과 토요일 오후 슬롯이 가장 빠르게 차기 때문에, 웹 화면에서는 이 두 요일에만 별도 강조 배지를 넣는 방향이 자연스럽습니다.</p>
            <p>완료율과 취소율을 바로 비교할 수 있게 KPI 카드 하단에 짧은 메타 수치를 넣었고, 다운로드 버튼은 우측 상단에 두어 보고서 흐름과 분리했습니다.</p>
            <ToolbarRow>
              <button
                type="button"
                onClick={() => downloadReport("CSV")}
                className="inline-flex items-center gap-2 rounded-[14px] border border-[#e5ddd6] bg-white px-4 py-2.5 text-[13px] font-medium text-[#3c4d48]"
              >
                <Download className="h-4 w-4" />
                CSV 저장
              </button>
              <GhostButton label="주간 비교" onClick={() => {
                setTrendMode("주간 비교");
                setReportMessage("주간 비교를 열었습니다.");
              }} />
            </ToolbarRow>
          </div>
        </MiniSection>
      </div>
    </div>
  );
}
