"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

import { CustomerReportSectionTitle } from "@/components/customer/customer-report-section-title";
import type { CustomerWeightMeasurement } from "@/lib/customer-weight-history";

export type { CustomerWeightMeasurement } from "@/lib/customer-weight-history";

const MAX_WEIGHT_POINTS = 6;

function formatWeight(value: number) {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatMeasurementDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function CustomerWeightTrendCard({ history }: { history: CustomerWeightMeasurement[] }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const sortedHistory = history
    .filter((item) => Number.isFinite(item.weightKg) && item.weightKg > 0 && Number.isFinite(new Date(item.measuredAt).getTime()))
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  const measurements = sortedHistory.slice(-MAX_WEIGHT_POINTS);

  if (!measurements.length) return null;

  const activePointIndex = selectedPointIndex === null ? measurements.length - 1 : Math.min(Math.max(0, selectedPointIndex), measurements.length - 1);
  const displayedMeasurement = measurements[activePointIndex];
  const previous = sortedHistory[sortedHistory.length - measurements.length + activePointIndex - 1];
  const change = previous ? Math.round((displayedMeasurement.weightKg - previous.weightKg) * 10) / 10 : null;
  const changeLabel = change === null ? "이전 비교 기록 없음" : change === 0 ? "지난 미용과 같아요" : "지난 미용보다";
  const chartWidth = 320;
  const chartHeight = 78;
  const columnWidth = chartWidth / measurements.length;
  const chartTop = 18;
  const chartBottom = 60;
  const rawMin = Math.min(...measurements.map((item) => item.weightKg));
  const rawMax = Math.max(...measurements.map((item) => item.weightKg));
  const tickStep = [0.1, 0.2, 0.5, 1, 2, 5, 10].find((step) => (rawMax - rawMin) / step <= 4.000001) ?? Math.ceil((rawMax - rawMin) / 4);
  const min = Math.max(0, Math.floor(rawMin / tickStep + 0.000001) * tickStep - tickStep);
  const max = Math.ceil(rawMax / tickStep - 0.000001) * tickStep + tickStep;
  const points = measurements.map((item, index) => ({
    ...item,
    x: (index + 0.5) * columnWidth,
    y: chartBottom - ((item.weightKg - min) / (max - min)) * (chartBottom - chartTop),
  }));

  return (
    <section aria-label="몸무게 변화">
      <CustomerReportSectionTitle icon={<Activity />}>몸무게 변화</CustomerReportSectionTitle>

      <div className="mt-2.5 rounded-[18px] border border-[#f5cdd4] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <p data-current-weight className="whitespace-nowrap text-[32px] font-normal leading-[38px] tracking-[-0.02em] text-[#302629]">
            {formatWeight(displayedMeasurement.weightKg)}
            <span className="ml-1 text-[14px] font-normal tracking-normal text-[#75666a]">kg</span>
          </p>
          <p data-weight-change className="whitespace-nowrap rounded-full bg-[#fff0f2] px-2.5 py-1 text-[12px] font-normal leading-5 text-[#c35d74]">
            {changeLabel}
            {change !== null && change !== 0 ? (
              <>{" "}<strong data-weight-delta className="text-[14px] font-semibold text-[#a54561]">{change > 0 ? "+" : ""}{formatWeight(change)}kg</strong></>
            ) : null}
          </p>
        </div>

        {measurements.length >= 2 ? (
          <div className="-mx-3.5 mt-3">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`최근 ${measurements.length}번의 몸무게 기록, ${formatWeight(rawMin)}에서 ${formatWeight(rawMax)}kg 사이`}
              className="block h-auto w-full overflow-visible"
            >
              <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#ec9aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => {
                const isSelected = activePointIndex === index;
                return (
                  <g
                    key={`${point.measuredAt}-${index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatMeasurementDate(point.measuredAt)} 몸무게 ${formatWeight(point.weightKg)}kg`}
                    aria-pressed={isSelected}
                    className="group cursor-pointer outline-none"
                    onClick={() => setSelectedPointIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedPointIndex(index);
                    }}
                  >
                    <rect x={index * columnWidth} y="0" width={columnWidth} height="78" fill="transparent" pointerEvents="all" aria-hidden="true" />
                    <circle cx={point.x} cy={point.y} r="9" fill="none" stroke="#a44f5b" strokeWidth="1.5" className="opacity-0 group-focus-visible:opacity-100" pointerEvents="none" aria-hidden="true" />
                    {isSelected && selectedPointIndex !== null ? <circle cx={point.x} cy={point.y} r="8" fill="#fbe1e7" pointerEvents="none" /> : null}
                    <circle data-weight-point cx={point.x} cy={point.y} r={isSelected ? 5 : 3.5} fill={isSelected ? "#e97287" : "#fff"} stroke={isSelected ? "#e97287" : "#ec9aaa"} strokeWidth={isSelected ? 1.5 : 1.8} pointerEvents="none" />
                  </g>
                );
              })}
            </svg>
            <div className="grid text-center tabular-nums" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((point, index) => (
                <div key={`${point.measuredAt}-${index}`} className="min-w-0">
                  <time
                    data-weight-point-date
                    data-selected={index === activePointIndex}
                    dateTime={point.measuredAt}
                    className={`inline-flex h-6 min-w-[38px] items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[12px] font-normal leading-[18px] ${index === activePointIndex ? "bg-[#fff0f2] text-[#c35d74]" : "text-[#9c8590]"}`}
                  >
                    {formatShortDate(point.measuredAt)}
                  </time>
                </div>
              ))}
            </div>
          </div>
        ) : null}

      </div>
    </section>
  );
}
