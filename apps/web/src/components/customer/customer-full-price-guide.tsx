import { directPriceGuideWeightLabel, readDirectPriceGuideMatrix } from "@/lib/price-guide-direct-matrix";
import { priceGuideDisplayGroupLabel } from "@/lib/price-guide-structured-table";
import type { PriceGuideV2, PriceGuideV2Row, PriceGuideV2Surcharge } from "@/types/price-guide-photo-import";

// PRICE_GUIDE_UI_HARD_CONTRACT: 16/24 table text, 20/28 group labels,
// 18/26 breed lists, 400/500/600 weights, and one nowrap price/time row.

function formatPrice(row: PriceGuideV2Row) {
  if (row.priceMinKrw === null || row.priceKind === "unknown") return "미정";
  if (row.priceKind === "range") {
    return row.priceMaxKrw === null
      ? `${row.priceMinKrw.toLocaleString("ko-KR")}원부터`
      : `${row.priceMinKrw.toLocaleString("ko-KR")}~${row.priceMaxKrw.toLocaleString("ko-KR")}원`;
  }
  return `${row.priceMinKrw.toLocaleString("ko-KR")}원${row.priceKind === "starting" ? "부터" : ""}`;
}

function formatDuration(row: PriceGuideV2Row) {
  return row.durationMinutes === null ? "미정" : `${row.durationMinutes}분`;
}

function formatPriceTime(row: PriceGuideV2Row | undefined) {
  return `${row ? formatPrice(row) : "미정"} / ${row ? formatDuration(row) : "미정"}`;
}

function formatSurcharge(surcharge: PriceGuideV2Surcharge) {
  const values = [
    surcharge.amountKrw === null ? null : `${surcharge.amountKrw.toLocaleString("ko-KR")}원`,
    surcharge.percent === null ? null : `${surcharge.percent}%`,
  ].filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join(" · ") : "미정";
}

export default function CustomerFullPriceGuide({ document }: { document: PriceGuideV2 }) {
  const groups = readDirectPriceGuideMatrix(document);

  return (
    <div className="space-y-5" data-customer-full-price-guide="canonical-v2">
      {groups.map((group, groupIndex) => {
        const groupName = priceGuideDisplayGroupLabel(group.sourceLabel.trim()) || `요금 분류 ${groupIndex + 1}`;
        const tableWidth = Math.max(376, 136 + group.serviceNames.length * 160);

        return (
          <section key={`${group.sourceLabel}-${groupIndex}`} className="min-w-0" data-customer-price-guide-group={groupIndex}>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#e8edf3] pb-3">
              <h4 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b]">{groupName}</h4>
              {group.breedNames.length > 0 ? (
                <p className="min-w-0 text-[18px] font-normal leading-[26px] text-[#52657a]" data-customer-price-guide-breeds="true">
                  {group.breedNames.join(", ")}
                </p>
              ) : null}
            </div>

            {group.note ? <p className="mt-2 text-[16px] font-normal leading-6 text-[#64748b]">{group.note}</p> : null}

            <div
              className="mt-3 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[10px] border border-[#dbe2ea]"
              tabIndex={0}
              aria-label={`${groupName} 요금표, 좌우로 이동할 수 있습니다`}
              data-customer-price-guide-table-scroll="true"
            >
              <table className="border-collapse text-[16px] font-normal leading-6 text-[#334155]" style={{ minWidth: tableWidth }}>
                <thead>
                  <tr className="bg-[#f8fafc] text-left">
                    <th className="sticky left-0 z-20 w-[136px] border-b border-r border-[#dbe2ea] bg-[#f8fafc] px-3 py-3 text-[16px] font-medium leading-6 text-[#52657a]">
                      몸무게
                    </th>
                    {group.serviceNames.map((serviceName, serviceIndex) => (
                      <th
                        key={`${serviceName}-${serviceIndex}`}
                        className="min-w-[160px] max-w-[200px] whitespace-normal break-words border-b border-[#dbe2ea] px-3 py-3 text-[16px] font-medium leading-6 text-[#15213b]"
                      >
                        {serviceName || "미정"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.weightBands.map((weightBand, weightIndex) => {
                    const weightLabel = weightBand.label.trim()
                      || directPriceGuideWeightLabel(weightBand.minKg, weightBand.maxKg)
                      || "미정";
                    return (
                      <tr key={`${weightLabel}-${weightIndex}`} className="border-b border-[#edf2f7] last:border-b-0">
                        <th className="sticky left-0 z-10 border-r border-[#dbe2ea] bg-[#fbfcfd] px-3 py-3 text-left align-top text-[16px] font-normal leading-6 text-[#334155]">
                          <span className="whitespace-nowrap">{weightLabel}</span>
                          {weightBand.note ? <span className="mt-1 block font-normal text-[#64748b]">{weightBand.note}</span> : null}
                        </th>
                        {group.serviceNames.map((serviceName, serviceIndex) => {
                          const row = group.cells[weightIndex]?.[serviceIndex];
                          return (
                            <td key={`${serviceName}-${serviceIndex}`} className="min-w-[160px] max-w-[200px] px-3 py-3 align-top">
                              <span
                                className="whitespace-nowrap text-[16px] font-normal leading-6 tabular-nums text-[#15213b]"
                                data-customer-price-time-inline="true"
                              >
                                {formatPriceTime(row)}
                              </span>
                              {row?.note ? <p className="mt-1 whitespace-normal text-[16px] font-normal leading-6 text-[#64748b]">{row.note}</p> : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length === 0 ? (
        <p className="rounded-[10px] border border-[#e8edf3] px-4 py-4 text-[16px] font-normal leading-6 text-[#64748b]">
          표로 표시할 요금 항목이 없습니다.
        </p>
      ) : null}

      {document.surcharges.length > 0 ? (
        <section className="border-t border-[#e8edf3] pt-4" data-customer-price-guide-surcharges="true">
          <h4 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b]">추가금액</h4>
          <div className="mt-2 divide-y divide-[#edf2f7] rounded-[10px] border border-[#e8edf3]">
            {document.surcharges.map((surcharge, index) => (
              <div key={`${surcharge.condition ?? "미정"}-${index}`} className="px-3 py-3 text-[16px] font-normal leading-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="min-w-0 text-[#334155]">{surcharge.condition ?? "조건 미정"}</span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-[#15213b]">{formatSurcharge(surcharge)}</span>
                </div>
                {surcharge.note ? <p className="mt-1 text-[#64748b]">{surcharge.note}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {document.overallNote ? (
        <section className="border-t border-[#e8edf3] pt-4" data-customer-price-guide-overall-note="true">
          <h4 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b]">전체 안내</h4>
          <p className="mt-2 whitespace-pre-wrap text-[16px] font-normal leading-6 text-[#52657a]">{document.overallNote}</p>
        </section>
      ) : null}
    </div>
  );
}
