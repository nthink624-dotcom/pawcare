"use client";

import { Clock3, PencilLine } from "lucide-react";

import {
  buildPriceGuideStructuredProjection,
  priceGuideWeightBandLabel,
} from "@/lib/price-guide-structured-table";
import type { PriceGuideV2, PriceGuideV2Row } from "@/types/price-guide-photo-import";

// PRICE_GUIDE_UI_HARD_CONTRACT: 16/24 only; price left + duration right on one nowrap row.

function rowPriceLabel(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null) return null;
  if (row.priceKind === "range" && row.priceMaxKrw !== null) {
    return `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}${row.priceKind === "starting" ? "원부터" : "원"}`;
}

function surchargeValue(surcharge: PriceGuideV2["surcharges"][number]) {
  if (surcharge.amountKrw !== null) return `${surcharge.amountKrw.toLocaleString("ko-KR")}원`;
  if (surcharge.percent !== null) return `${surcharge.percent}%`;
  return "";
}

export default function PriceGuideStructuredReviewTable({
  document,
  onEdit,
  onEditGroup,
  onEditExtras,
  onSetAverageTime,
  onEditRow,
}: {
  document: PriceGuideV2;
  onEdit?: () => void;
  onEditGroup?: (groupIndex: number) => void;
  onEditExtras?: () => void;
  onSetAverageTime?: (groupIndex: number) => void;
  /** Compatibility for older callers that still enter the full editor by row. */
  onEditRow?: (rowIndex: number) => void;
}) {
  const projection = buildPriceGuideStructuredProjection(document);
  const firstVisibleRowIndex = projection.groups.flatMap((group) => group.rowIndexes)[0];
  const editTable = onEdit ?? (() => {
    if (firstVisibleRowIndex !== undefined) onEditRow?.(firstVisibleRowIndex);
  });
  const needsAverageTime = document.rows.some((row) => row.priceMinKrw !== null && row.durationMinutes === null);
  const firstMissingDurationGroupIndex = projection.groups.findIndex((group) => (
    group.rows.some((row) => row.priceMinKrw !== null && row.durationMinutes === null)
  ));

  return (
    <section className="min-w-0" aria-label="요금표" data-price-guide-structured-review="true">
      {needsAverageTime ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#dbe7f7] bg-[#f7faff] px-4 py-2" data-price-guide-average-time-notice="true">
          <div className="flex min-w-0 items-center gap-2.5">
            <Clock3 className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />
            <p className="text-[16px] font-normal leading-6 text-[#23395b]">평균 시간 설정이 필요해요</p>
          </div>
          <button
            type="button"
            onClick={() => firstMissingDurationGroupIndex >= 0 && onSetAverageTime
              ? onSetAverageTime(firstMissingDurationGroupIndex)
              : editTable()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] border border-[#b8cae5] bg-white px-3 text-[16px] font-normal leading-6 text-[#1d4f9e] hover:bg-[#eef5ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            시간 입력하기
          </button>
        </div>
      ) : null}

      <div className="space-y-4" data-price-guide-photo-table-sheet="true">
        {projection.groups.length > 0 ? projection.groups.map((group, groupIndex) => (
          <section key={group.key} className="overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white" data-price-guide-review-group={group.label}>
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 bg-[#fbfcfd] px-4 py-2" data-price-guide-group-heading="true">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="shrink-0 text-[20px] font-semibold leading-7 text-[#172033]">{group.label}</h4>
                {group.breeds.length > 0 ? (
                  <p
                    className="min-w-0 border-l border-[#cbd5e1] pl-3 text-[18px] font-normal leading-[26px] text-[#64748b]"
                    data-price-guide-breeds="true"
                  >
                    {group.breeds.join(" · ")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onEditGroup) onEditGroup(groupIndex);
                  else if (onEdit) onEdit();
                  else if (group.rowIndexes[0] !== undefined) onEditRow?.(group.rowIndexes[0]);
                }}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-medium leading-6 text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                aria-label={`${group.label} 요금표 수정`}
                data-price-guide-group-edit-action={groupIndex}
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                수정
              </button>
            </div>
            <div className="max-w-full overflow-x-auto border-t border-[#e5eaf0]" tabIndex={0} aria-label={`${group.label} 요금표, 좌우로 이동할 수 있습니다`}>
              <table className="w-full border-collapse text-[16px] leading-6 text-[#334155]" style={{ minWidth: Math.max(560, 132 + group.services.length * 210) }} data-price-guide-ui-hard-contract="true">
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-[16px] font-normal leading-6 text-[#64748b]">
                    <th className="w-32 border-b border-r border-[#dbe2ea] px-3 py-3 font-medium">몸무게</th>
                    {group.services.map((service) => (
                      <th key={service} className="min-w-[210px] whitespace-nowrap border-b border-[#dbe2ea] px-3 py-3 font-medium text-[#172033]">{service}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.weights.map((weight) => (
                    <tr key={weight} className="border-b border-[#edf2f7] last:border-b-0">
                      <th className="whitespace-nowrap border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 text-left font-normal text-[#334155]">
                        {weight}
                        {group.weightNotes[weight] ? <span className="mt-1 block max-w-36 whitespace-normal text-[16px] font-normal leading-6 text-[#718096]">{group.weightNotes[weight]}</span> : null}
                      </th>
                      {group.services.map((service) => {
                        const relativeIndex = group.rows.findIndex((row) => priceGuideWeightBandLabel(row) === weight && row.serviceName?.trim() === service);
                        const rowIndex = relativeIndex < 0 ? -1 : group.rowIndexes[relativeIndex];
                        const row = rowIndex < 0 ? null : document.rows[rowIndex];
                        const price = row ? rowPriceLabel(row) : null;
                        const duration = row?.durationMinutes === null || row?.durationMinutes === undefined ? "미정" : `${row.durationMinutes}분`;
                        return (
                          <td key={service} className="min-w-[210px] px-3 py-2 align-middle">
                            <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_88px] items-center gap-2 whitespace-nowrap" aria-label={`${group.label} ${weight} ${service}${price ? ` ${price} ${duration}` : " 빈칸"}`} data-price-left-time-right="true">
                              {price ? <span className="whitespace-nowrap text-[16px] font-normal leading-6 tabular-nums text-[#172033]" data-price-side="left">{price}</span> : <span aria-hidden="true">&nbsp;</span>}
                              {row ? <span className="whitespace-nowrap border-l border-[#e2e8f0] pl-2 text-[16px] font-normal leading-6 tabular-nums text-[#64748b]" data-duration-side="right">{duration}</span> : <span aria-hidden="true">&nbsp;</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )) : (
          <p className="px-4 py-8 text-center text-[16px] font-normal leading-6 text-[#64748b]">사진에서 표로 옮길 수 있는 요금을 찾지 못했어요.</p>
        )}

        {document.surcharges.length > 0 ? (
          <section className="overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white" aria-labelledby="price-guide-photo-surcharge-title">
            <div className="flex min-h-14 items-center justify-between gap-2 bg-[#fbfcfd] px-4 py-2">
              <h4 id="price-guide-photo-surcharge-title" className="text-[18px] font-normal leading-[26px] text-[#172033]">추가요금</h4>
              <button
                type="button"
                onClick={onEditExtras ?? editTable}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-medium leading-6 text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                aria-label="추가요금 수정"
                data-price-guide-extras-edit-action="true"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                수정
              </button>
            </div>
            <div className="divide-y divide-[#edf2f7] border-t border-[#e5eaf0]">
              {document.surcharges.map((surcharge, index) => (
                <div key={`photo-surcharge-${index}`} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[16px] leading-6">
                  <span className="min-w-0 text-[#334155]">{surcharge.condition ?? ""}</span>
                  <span className="whitespace-nowrap font-normal tabular-nums text-[#172033]">{surchargeValue(surcharge)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
