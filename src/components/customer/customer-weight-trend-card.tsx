"use client";

import { useState } from "react";

import type { CustomerWeightMeasurement } from "@/lib/customer-weight-history";

export type { CustomerWeightMeasurement } from "@/lib/customer-weight-history";

const MAX_WEIGHT_POINTS = 12;

function formatWeight(value: number) {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatMeasurementDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(parsed);
}

export function CustomerWeightTrendCard({ history }: { history: CustomerWeightMeasurement[] }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const measurements = history
    .filter((item) => Number.isFinite(item.weightKg) && item.weightKg > 0 && item.measuredAt)
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .slice(-MAX_WEIGHT_POINTS);

  if (!measurements.length) return null;

  const latest = measurements.at(-1)!;
  const chartWidth = 320;
  const chartHeight = 92;
  const xInset = 8;
  const chartTop = 14;
  const chartBottom = 73;
  const weights = measurements.map((item) => item.weightKg);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const visualRange = Math.max(rawMax - rawMin, 0.4);
  const min = rawMin - visualRange * 0.18;
  const max = rawMax + visualRange * 0.18;
  const plotWidth = chartWidth - xInset * 2;
  const points = measurements.map((item, index) => {
    const x = measurements.length === 1 ? chartWidth / 2 : xInset + (index / (measurements.length - 1)) * plotWidth;
    const y = chartBottom - ((item.weightKg - min) / (max - min)) * (chartBottom - chartTop);
    return { ...item, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M ${points[0].x} ${chartBottom} L ${linePoints.replaceAll(",", " ")} L ${points.at(-1)!.x} ${chartBottom} Z`;
  const selectedPoint = selectedPointIndex === null ? null : points[selectedPointIndex] ?? null;
  const displayedMeasurement = selectedPoint ?? latest;

  return (
    <section aria-label="몸무게 변화">
      <p className="text-[18px] font-medium tracking-[-0.02em] text-[#795f64]">몸무게 변화</p>

      <div className="mt-2.5 overflow-hidden rounded-[20px] border border-[#eadfe1] bg-white shadow-[0_8px_24px_rgba(112,72,80,0.045)]">
        <div className="flex min-h-[92px] items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[14px] font-normal text-[#927f83]">{selectedPoint ? "선택한 기록" : "현재 몸무게"}</p>
            <p className="mt-1 text-[30px] font-semibold tracking-[-0.05em] text-[#352a2d]">
              {formatWeight(displayedMeasurement.weightKg)}
              <span className="ml-1 text-[15px] font-medium tracking-[-0.02em] text-[#75666a]">kg</span>
            </p>
          </div>
          <div className="text-right">
            {selectedPoint ? (
              <>
                <p className="text-[14px] font-medium text-[#a2505a]">{formatMeasurementDate(selectedPoint.measuredAt)}</p>
                <button
                  type="button"
                  onClick={() => setSelectedPointIndex(null)}
                  className="mt-1 text-[14px] font-normal text-[#9a8589] underline decoration-[#d9c7ca] underline-offset-4"
                >
                  현재 기록 보기
                </button>
              </>
            ) : (
              <p className="max-w-[132px] text-[14px] font-normal leading-5 text-[#9a8589]">
                그래프의 점을 눌러<br />기록을 확인해 보세요
              </p>
            )}
          </div>
        </div>

        {measurements.length >= 2 ? (
          <div className="border-t border-[#f0e8e9] bg-[#fdfafa] px-3 pb-3 pt-3">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`최근 몸무게 ${formatWeight(latest.weightKg)}kg을 포함한 ${measurements.length}개의 측정 기록`}
              className="h-auto w-full overflow-visible"
              onPointerDown={() => setSelectedPointIndex(null)}
            >
              <defs>
                <linearGradient id="weightAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef9ba4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#ef9ba4" stopOpacity="0.03" />
                </linearGradient>
              </defs>
              <line x1={xInset} x2={chartWidth - xInset} y1={chartBottom} y2={chartBottom} stroke="#eadfe1" strokeWidth="1" />
              <path d={areaPath} fill="url(#weightAreaFill)" />
              <polyline
                points={linePoints}
                fill="none"
                stroke="#d96570"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {selectedPoint ? (
                <line
                  x1={selectedPoint.x}
                  x2={selectedPoint.x}
                  y1={8}
                  y2={chartBottom}
                  stroke="#e6c4c8"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  pointerEvents="none"
                />
              ) : null}
              {points.map((point, index) => {
                const isSelected = selectedPointIndex === index;
                const isLatest = index === points.length - 1;
                return (
                  <g
                    key={`${point.measuredAt}-${index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatMeasurementDate(point.measuredAt)} 몸무게 ${formatWeight(point.weightKg)}kg`}
                    aria-pressed={isSelected}
                    className="cursor-pointer outline-none"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setSelectedPointIndex((current) => current === index ? null : index)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedPointIndex((current) => current === index ? null : index);
                    }}
                  >
                    <circle cx={point.x} cy={point.y} r="15" fill="transparent" />
                    {isSelected ? <circle cx={point.x} cy={point.y} r="8.5" fill="#f5d6d9" /> : null}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isSelected ? 5 : isLatest ? 4.5 : 3.2}
                      fill={isSelected || isLatest ? "#d96570" : "#fff"}
                      stroke="#d96570"
                      strokeWidth={isSelected ? 2.4 : 2}
                    />
                  </g>
                );
              })}
            </svg>
            <p className="sr-only" aria-live="polite">
              {selectedPoint ? `${formatMeasurementDate(selectedPoint.measuredAt)} 몸무게 ${formatWeight(selectedPoint.weightKg)}kg` : ""}
            </p>
          </div>
        ) : (
          <p className="border-t border-[#f0e8e9] bg-[#fdfafa] px-5 py-3 text-[14px] leading-5 text-[#8c777b]">
            다음 측정부터 몸무게 흐름을 함께 보여드릴게요.
          </p>
        )}
      </div>
    </section>
  );
}
