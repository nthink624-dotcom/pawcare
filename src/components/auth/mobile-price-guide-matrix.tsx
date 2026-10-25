"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import {
  addMobilePriceGuideGroup,
  addMobilePriceGuideService,
  addMobilePriceGuideWeightBand,
  readMobilePriceGuideMatrix,
  removeMobilePriceGuideGroup,
  removeMobilePriceGuideService,
  removeMobilePriceGuideWeightBand,
  updateMobilePriceGuideCell,
  updateMobilePriceGuideGroup,
  updateMobilePriceGuideService,
  updateMobilePriceGuideWeightBand,
} from "@/lib/price-photo/mobile-price-guide-matrix";
import {
  MAX_SERVICE_PRICE_KRW,
  type MobilePriceGuideRow,
  type MobilePriceGuideV2,
} from "@/lib/price-photo/mobile-price-photo-adapter";

const inputClass = "h-11 w-full min-w-0 rounded-[8px] border border-slate-300 bg-white px-2.5 text-[16px] font-normal leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 text-[14px] font-medium leading-5 text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const iconClass = "inline-grid size-11 shrink-0 place-items-center rounded-[8px] text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

function nullableInteger(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function PriceDurationCell({
  row,
  onChange,
}: {
  row: MobilePriceGuideRow;
  onChange: (patch: Partial<MobilePriceGuideRow>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5" data-mobile-price-duration-cell>
      <label className="min-w-0">
        <span className="sr-only">가격</span>
        <input
          data-mobile-price-cell
          value={row.priceMinKrw ?? ""}
          inputMode="numeric"
          min={0}
          max={MAX_SERVICE_PRICE_KRW}
          placeholder="가격"
          className={`${inputClass} tabular-nums`}
          onChange={(event) => {
            const priceMinKrw = nullableInteger(event.target.value);
            onChange({
              priceMinKrw,
              ...(priceMinKrw !== null && row.priceKind === "unknown" ? { priceKind: "fixed" as const } : {}),
            });
          }}
        />
      </label>
      <label className="min-w-0">
        <span className="sr-only">평균 시간(분)</span>
        <input
          data-mobile-duration-cell
          value={row.durationMinutes ?? ""}
          inputMode="numeric"
          min={1}
          max={1440}
          placeholder="분"
          className={`${inputClass} tabular-nums`}
          onChange={(event) => onChange({ durationMinutes: nullableInteger(event.target.value) })}
        />
      </label>
      {row.priceKind === "range" ? (
        <label className="col-span-2 min-w-0">
          <span className="sr-only">최대 가격</span>
          <input
            value={row.priceMaxKrw ?? ""}
            inputMode="numeric"
            min={0}
            max={MAX_SERVICE_PRICE_KRW}
            placeholder="최대 가격"
            className={`${inputClass} tabular-nums`}
            onChange={(event) => onChange({ priceMaxKrw: nullableInteger(event.target.value) })}
          />
        </label>
      ) : null}
    </div>
  );
}

export default function MobilePriceGuideMatrix({
  document,
  onChange,
}: {
  document: MobilePriceGuideV2;
  onChange: (document: MobilePriceGuideV2) => void;
}) {
  const groups = useMemo(() => readMobilePriceGuideMatrix(document), [document]);

  return (
    <div className="min-w-0 max-w-full space-y-5" data-mobile-price-guide-matrix>
      {groups.map((group, groupIndex) => (
        <section key={`${group.sourceLabel}-${groupIndex}`} className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">그룹 이름</span>
                <input
                  value={group.sourceLabel}
                  placeholder="그룹 이름"
                  className={inputClass}
                  onChange={(event) => onChange(updateMobilePriceGuideGroup(document, groupIndex, { sourceLabel: event.target.value }))}
                />
              </label>
              <button
                type="button"
                className={iconClass}
                aria-label={`${group.sourceLabel || "그룹"} 삭제`}
                onClick={() => onChange(removeMobilePriceGuideGroup(document, groupIndex))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <label className="block">
              <span className="sr-only">품종</span>
              <input
                value={group.breedNames.join(", ")}
                placeholder="품종을 쉼표로 구분해 입력"
                className={inputClass}
                onChange={(event) => onChange(updateMobilePriceGuideGroup(document, groupIndex, {
                  breedNames: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
              />
            </label>
          </div>

          <div className="relative w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain" data-mobile-price-guide-matrix-scroll>
            <table
              className="w-max min-w-full table-fixed border-collapse text-left"
              style={{ minWidth: `${176 + group.serviceNames.length * 180}px` }}
            >
              <thead>
                <tr className="bg-slate-50">
                  <th className="w-44 border-b border-r border-slate-200 p-2 text-[13px] font-medium text-slate-600">체급</th>
                  {group.serviceNames.map((serviceName, serviceIndex) => (
                    <th key={`${serviceIndex}-${serviceName}`} className="w-[180px] border-b border-r border-slate-200 p-2 align-top last:border-r-0">
                      <div className="flex items-center gap-1">
                        <label className="min-w-0 flex-1">
                          <span className="sr-only">서비스 이름</span>
                          <input
                            value={serviceName}
                            placeholder="서비스"
                            className={inputClass}
                            onChange={(event) => onChange(updateMobilePriceGuideService(document, groupIndex, serviceIndex, event.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          className={iconClass}
                          aria-label={`${serviceName || "서비스"} 열 삭제`}
                          onClick={() => onChange(removeMobilePriceGuideService(document, groupIndex, serviceIndex))}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-24 border-b border-slate-200 p-2 align-middle">
                    <button type="button" className={actionClass} onClick={() => onChange(addMobilePriceGuideService(document, groupIndex))}>
                      <Plus size={16} aria-hidden="true" /> 항목
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.weightBands.map((band, weightIndex) => (
                  <tr key={`${weightIndex}-${band.label}`}>
                    <th className="border-b border-r border-slate-200 p-2 align-top">
                      <div className="flex items-center gap-1">
                        <label className="min-w-0 flex-1">
                          <span className="sr-only">체급</span>
                          <input
                            value={band.label}
                            placeholder="체급"
                            className={inputClass}
                            onChange={(event) => onChange(updateMobilePriceGuideWeightBand(document, groupIndex, weightIndex, event.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          className={iconClass}
                          aria-label={`${band.label || "체급"} 행 삭제`}
                          onClick={() => onChange(removeMobilePriceGuideWeightBand(document, groupIndex, weightIndex))}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                    {group.serviceNames.map((serviceName, serviceIndex) => (
                      <td key={`${serviceIndex}-${serviceName}`} className="border-b border-r border-slate-200 p-2 align-top last:border-r-0">
                        <PriceDurationCell
                          row={group.cells[weightIndex][serviceIndex]}
                          onChange={(patch) => onChange(updateMobilePriceGuideCell(document, groupIndex, weightIndex, serviceIndex, patch))}
                        />
                      </td>
                    ))}
                    <td className="border-b border-slate-200" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            <button type="button" className={actionClass} onClick={() => onChange(addMobilePriceGuideWeightBand(document, groupIndex))}>
              <Plus size={16} aria-hidden="true" /> 체급
            </button>
          </div>
        </section>
      ))}
      <button type="button" className={actionClass} onClick={() => onChange(addMobilePriceGuideGroup(document))}>
        <Plus size={16} aria-hidden="true" /> 그룹 추가
      </button>
    </div>
  );
}
