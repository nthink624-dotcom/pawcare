"use client";

import { Clock3, PencilLine } from "lucide-react";

import {
  buildPriceGuideStructuredProjection,
  priceGuideWeightBandLabel,
} from "@/lib/price-guide-structured-table";
import type { PriceGuideV2, PriceGuideV2Row } from "@/types/price-guide-photo-import";

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
  onSetAverageTime,
  onEditRow,
}: {
  document: PriceGuideV2;
  onEdit?: () => void;
  onSetAverageTime?: () => void;
  /** Compatibility for older callers; connected photo review uses one table-level edit action. */
  onEditRow?: (rowIndex: number) => void;
}) {
  const projection = buildPriceGuideStructuredProjection(document);
  const firstVisibleRowIndex = projection.groups.flatMap((group) => group.rowIndexes)[0];
  const editTable = onEdit ?? (() => {
    if (firstVisibleRowIndex !== undefined) onEditRow?.(firstVisibleRowIndex);
  });
  const needsAverageTime = document.rows.some((row) => row.priceMinKrw !== null && row.durationMinutes === null);

  return (
    <section className="mt-5 min-w-0" aria-labelledby="price-guide-structured-heading" data-price-guide-structured-review="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="price-guide-structured-heading" className="text-[18px] font-semibold leading-[26px] text-[#172033]">사진에서 읽은 요금표</h3>
          <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">읽힌 가격만 채웠어요. 빈칸은 사진에서 확인하지 못한 부분입니다.</p>
        </div>
        <button
          type="button"
          onClick={editTable}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[14px] font-medium leading-5 text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          data-price-guide-edit-action="true"
        >
          <PencilLine className="h-4 w-4" aria-hidden="true" />
          요금표 수정
        </button>
      </div>

      {needsAverageTime ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#dbe7f7] bg-[#f7faff] px-4 py-3" data-price-guide-average-time-notice="true">
          <div className="flex min-w-0 items-start gap-2.5">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-5 text-[#23395b]">평균 시간 설정이 필요해요</p>
              <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-[#607080]">처음에는 매장 기준 평균 시간을 정해 주세요. 미용 완료 기록이 쌓이면 실제 평균 시간을 계산해 추천해 드려요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSetAverageTime ?? editTable}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] border border-[#b8cae5] bg-white px-3 text-[13px] font-medium leading-5 text-[#1d4f9e] hover:bg-[#eef5ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            시간 입력하기
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white" data-price-guide-photo-table-sheet="true">
        {projection.groups.length > 0 ? projection.groups.map((group, groupIndex) => (
          <section key={group.key} className={groupIndex > 0 ? "border-t border-[#dbe2ea]" : undefined} data-price-guide-review-group={group.label}>
            <div className="bg-[#fbfcfd] px-4 py-3">
              <h4 className="text-[16px] font-semibold leading-6 text-[#172033]">{group.label}</h4>
              {group.breeds.length > 0 ? <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-[#64748b]">{group.breeds.join(" · ")}</p> : null}
            </div>
            <div className="max-w-full overflow-x-auto border-t border-[#e5eaf0]" tabIndex={0} aria-label={`${group.label} 요금표, 좌우로 이동할 수 있습니다`}>
              <table className="w-full border-collapse text-[13px] leading-5 text-[#334155]" style={{ minWidth: Math.max(560, 132 + group.services.length * 150) }}>
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-[12px] font-medium leading-[18px] text-[#64748b]">
                    <th className="w-32 border-b border-r border-[#dbe2ea] px-3 py-3">체급</th>
                    {group.services.map((service) => <th key={service} className="min-w-36 border-b border-[#dbe2ea] px-3 py-3">{service}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {group.weights.map((weight) => (
                    <tr key={weight} className="border-b border-[#edf2f7] last:border-b-0">
                      <th className="whitespace-nowrap border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 text-left font-medium text-[#334155]">
                        {weight}
                        {group.weightNotes[weight] ? <span className="mt-1 block max-w-36 whitespace-normal text-[11px] font-normal leading-[17px] text-[#718096]">{group.weightNotes[weight]}</span> : null}
                      </th>
                      {group.services.map((service) => {
                        const relativeIndex = group.rows.findIndex((row) => priceGuideWeightBandLabel(row) === weight && row.serviceName?.trim() === service);
                        const rowIndex = relativeIndex < 0 ? -1 : group.rowIndexes[relativeIndex];
                        const row = rowIndex < 0 ? null : document.rows[rowIndex];
                        const price = row ? rowPriceLabel(row) : null;
                        return (
                          <td key={service} className="min-w-36 px-3 py-2.5 align-middle">
                            <div className="flex min-h-11 flex-col justify-center" aria-label={`${group.label} ${weight} ${service}${price ? ` ${price}` : " 빈칸"}`}>
                              {price ? <span className="font-medium tabular-nums text-[#172033]">{price}</span> : <span aria-hidden="true">&nbsp;</span>}
                              {row?.durationMinutes !== null && row?.durationMinutes !== undefined ? <span className="text-[11px] font-normal leading-[17px] text-[#718096]">{row.durationMinutes}분</span> : null}
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
          <p className="px-4 py-8 text-center text-[14px] font-normal leading-6 text-[#64748b]">사진에서 표로 옮길 수 있는 요금을 찾지 못했어요.</p>
        )}

        {document.surcharges.length > 0 ? (
          <section className="border-t border-[#dbe2ea]" aria-labelledby="price-guide-photo-surcharge-title">
            <h4 id="price-guide-photo-surcharge-title" className="bg-[#fbfcfd] px-4 py-3 text-[15px] font-semibold leading-6 text-[#172033]">추가요금</h4>
            <div className="divide-y divide-[#edf2f7] border-t border-[#e5eaf0]">
              {document.surcharges.map((surcharge, index) => (
                <div key={`photo-surcharge-${index}`} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[13px] leading-5">
                  <span className="min-w-0 text-[#334155]">{surcharge.condition ?? ""}</span>
                  <span className="whitespace-nowrap font-medium tabular-nums text-[#172033]">{surchargeValue(surcharge)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
