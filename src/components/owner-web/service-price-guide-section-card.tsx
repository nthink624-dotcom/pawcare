"use client";

import { Check, PencilLine, Plus } from "lucide-react";

import { BasilIcon } from "@/components/owner-web/basil-icon";
import type {
  ServicePriceGuideCell,
  ServicePriceGuideSection,
} from "@/components/owner-web/service-price-guide";
import { cn } from "@/lib/utils";

function formatGroupDisplayName(title: string) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return "이름 없는 그룹";
  return trimmedTitle.endsWith("그룹") ? trimmedTitle : `${trimmedTitle} 그룹`;
}

function formatPriceInput(value: string) {
  const numericValue = Number(value.replace(/[^0-9]/g, ""));
  if (!numericValue) return "";
  return numericValue.toLocaleString("ko-KR");
}

type ServicePriceGuideSectionCardProps = {
  section: ServicePriceGuideSection;
  breedLabels: string[];
  isEditing: boolean;
  canDeleteSection: boolean;
  onToggleEdit: () => void;
  onChangeTitle: (title: string) => void;
  onOpenBreedManagement: () => void;
  onAddWeightBand: () => void;
  onAddItem: () => void;
  onRemoveSection: () => void;
  onUpdateItemLabel: (itemId: string, label: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateWeightBand: (index: number, label: string) => void;
  onRemoveWeightBand: (index: number) => void;
  onUpdateCell: (
    itemId: string,
    band: string,
    patch: Partial<ServicePriceGuideCell>,
  ) => void;
};

export function ServicePriceGuideSectionCard({
  section,
  breedLabels,
  isEditing,
  canDeleteSection,
  onToggleEdit,
  onChangeTitle,
  onOpenBreedManagement,
  onAddWeightBand,
  onAddItem,
  onRemoveSection,
  onUpdateItemLabel,
  onRemoveItem,
  onUpdateWeightBand,
  onRemoveWeightBand,
  onUpdateCell,
}: ServicePriceGuideSectionCardProps) {
  const smallButtonStyle = {
    fontSize: "12.5px",
    fontWeight: 600,
    lineHeight: "normal",
  } as const;
  const editOnlyClassName = isEditing
    ? "opacity-100"
    : "pointer-events-none invisible opacity-0";

  return (
    <section className="relative left-1/2 w-[calc(100%+32px)] max-w-[900px] min-w-0 -translate-x-1/2 rounded-[16px] border border-[#e2e7ed] bg-white px-[26px] pb-[26px] pt-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-[18px] flex min-w-0 items-center justify-between">
        <div className="flex min-w-0 items-center gap-[10px]">
          {isEditing ? (
            <label className="flex h-9 min-w-0 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[#e2e7ed] bg-[#f6f7f9] px-[14px] text-[15px] font-extrabold tracking-[-0.84px] text-[#0f172a] transition focus-within:border-[#cbd5e1]">
              <span className="sr-only">그룹명</span>
              <input
                type="text"
                value={section.title}
                onChange={(event) => onChangeTitle(event.target.value)}
                placeholder="그룹명"
                aria-label={`${formatGroupDisplayName(section.title)} 그룹명 수정`}
                style={{ fontSize: "15px", fontWeight: 800, lineHeight: "normal" }}
                className="min-w-[1ch] max-w-[120px] border-0 bg-transparent p-0 text-[15px] font-extrabold leading-none tracking-[-0.02em] text-[#0f172a] outline-none placeholder:text-[#94a3b8] [field-sizing:content]"
              />
              {section.title.trim() && !section.title.trim().endsWith("그룹") ? (
                <span className="shrink-0 leading-none tracking-[-0.02em]" aria-hidden="true">
                  그룹
                </span>
              ) : null}
              <PencilLine
                className="h-[13px] w-[13px] shrink-0 text-[#94a3b8]"
                strokeWidth={2}
              />
            </label>
          ) : (
            <h3 className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-[#0f172a]">
              {formatGroupDisplayName(section.title)}
            </h3>
          )}
          <span className="shrink-0 whitespace-nowrap text-[12.5px] font-medium tracking-[-0.7px] text-[#94a3b8]">
            {breedLabels.length}종 등록됨
          </span>
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onAddWeightBand}
                style={smallButtonStyle}
                className="inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e7ed] bg-white px-[13px] text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#f6f7f9]"
              >
                <Plus className="h-[13px] w-[13px]" strokeWidth={2.2} />
                무게
              </button>
              <button
                type="button"
                onClick={onAddItem}
                style={smallButtonStyle}
                className="inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e7ed] bg-white px-[13px] text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#f6f7f9]"
              >
                <Plus className="h-[13px] w-[13px]" strokeWidth={2.2} />
                항목
              </button>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-[#e2e7ed]" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggleEdit}
                style={smallButtonStyle}
                className="inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#0f172a] bg-[#0f172a] px-[13px] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1c2a3e]"
              >
                <Check className="h-[13px] w-[13px]" strokeWidth={2} />
                완료
              </button>
              <button
                type="button"
                onClick={onRemoveSection}
                disabled={!canDeleteSection}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#f2d3d3] bg-white text-[#d64545] transition-colors hover:bg-[#fbebeb] disabled:cursor-not-allowed disabled:opacity-40"
                title={canDeleteSection ? "그룹 삭제" : "그룹은 최소 1개가 필요합니다."}
                aria-label={canDeleteSection ? "그룹 삭제" : "그룹 삭제 불가"}
              >
                <BasilIcon name="trash" className="h-[13px] w-[13px]" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleEdit}
              style={smallButtonStyle}
              className="inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#0f172a] bg-[#0f172a] px-[13px] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1c2a3e]"
            >
              <PencilLine className="h-[13px] w-[13px]" strokeWidth={2} />
              편집
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[11px] bg-[#f6f7f9] p-4">
        {breedLabels.length > 0 ? (
          breedLabels.map((breed, index) => (
            <span
              key={`${breed}-${index}`}
              style={{ letterSpacing: "-0.7px" }}
              className="whitespace-nowrap rounded-full border border-[#e2e7ed] bg-white px-[11px] py-[5px] text-[12px] font-semibold leading-[14px] text-[#334155]"
            >
              {breed}
            </span>
          ))
        ) : (
          <span className="text-[12px] font-medium text-[#94a3b8]">
            등록된 품종이 없습니다.
          </span>
        )}
        {isEditing ? (
          <button
            type="button"
            onClick={onOpenBreedManagement}
            style={smallButtonStyle}
            className="ml-auto inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#e2e7ed] bg-white px-[13px] text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#f6f7f9]"
          >
            <PencilLine className="h-[13px] w-[13px]" strokeWidth={2} />
            품종 관리
          </button>
        ) : null}
      </div>

      <div className="w-full max-w-full overflow-x-auto rounded-[11px] border border-[#e2e7ed]">
        <table className="w-full border-collapse text-[13.5px] leading-[17px] text-[#1e293b]">
          <colgroup>
            <col className="w-24" />
            <col className="w-24" />
            {section.items.map((item) => (
              <col key={item.id} />
            ))}
            {isEditing ? <col className="w-[34px]" /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className="w-24 min-w-24 whitespace-nowrap border-b border-r border-[#e2e7ed] bg-[#f6f7f9] px-[14px] py-[11px] text-left text-[12px] font-bold leading-4 text-[#334155]">
                그룹
              </th>
              <th className="w-24 min-w-24 whitespace-nowrap border-b border-r border-[#e2e7ed] bg-[#f6f7f9] px-[14px] py-[11px] text-left text-[12px] font-bold leading-4 text-[#334155]">
                무게
              </th>
              {section.items.map((item, itemIndex) => (
                <th
                  key={item.id}
                  className={cn(
                    "whitespace-nowrap border-b border-[#e2e7ed] bg-[#f6f7f9] px-[14px] py-[11px] text-left text-[12px] font-bold leading-4 text-[#334155]",
                    (isEditing || itemIndex < section.items.length - 1) && "border-r",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-[7px]">
                    <span className="relative min-w-0 flex-1">
                      <span className={cn("block truncate", isEditing && "invisible")}>
                        {item.label}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={item.label}
                          onChange={(event) => onUpdateItemLabel(item.id, event.target.value)}
                          aria-label={`${item.label} 항목명 수정`}
                          style={{ fontSize: "12px", fontWeight: 700, lineHeight: "16px" }}
                          className="absolute inset-0 w-full border-0 bg-transparent p-0 text-left text-[12px] font-bold leading-normal text-[#334155] outline-none"
                        />
                      ) : null}
                    </span>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={section.items.length <= 1}
                        className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center text-[#94a3b8] transition-colors hover:text-[#d64545] disabled:opacity-35"
                        aria-label={`${item.label} 항목 삭제`}
                      >
                        <BasilIcon name="trash" className="h-[13px] w-[13px]" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              {isEditing ? (
                <th
                  className="w-[34px] border-b border-[#e2e7ed] bg-[#f6f7f9] px-[14px] py-[11px]"
                  aria-label="행 관리"
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {section.weightBands.map((band, bandIndex) => {
              const isLastBand = bandIndex === section.weightBands.length - 1;

              return (
                <tr key={`${section.id}-weight-${bandIndex}`}>
                  {bandIndex === 0 ? (
                    <td
                      rowSpan={section.weightBands.length}
                      className="min-w-24 whitespace-nowrap border-b border-r border-[#edf1f5] bg-[#f6f7f9] px-[14px] py-3 align-middle text-left font-extrabold tracking-[-0.84px] text-[#0f172a]"
                    >
                      {formatGroupDisplayName(section.title)}
                    </td>
                  ) : null}
                  <td
                    className={cn(
                      "min-w-24 border-r border-[#edf1f5] bg-[#fbfcfd] px-[14px] py-3",
                      !isLastBand && "border-b border-[#edf1f5]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 font-bold text-[#0f172a]">
                      <span className="relative min-w-0 flex-1 whitespace-nowrap">
                        <span
                          className={cn(
                            "block whitespace-nowrap tracking-[-0.7px]",
                            isEditing && "invisible",
                          )}
                        >
                          {band}
                        </span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={band}
                            onChange={(event) => onUpdateWeightBand(bandIndex, event.target.value)}
                            aria-label={`${band} 무게 구간 수정`}
                            style={{
                              fontSize: "13.5px",
                              fontWeight: 700,
                              letterSpacing: "-0.7px",
                              lineHeight: "17px",
                            }}
                            className="absolute inset-0 w-full border-0 bg-transparent p-0 text-left text-[13.5px] font-bold leading-normal text-[#0f172a] outline-none"
                          />
                        ) : null}
                      </span>
                      {isEditing ? (
                        <PencilLine
                          className="h-3 w-3 shrink-0 text-[#94a3b8]"
                          strokeWidth={2}
                        />
                      ) : null}
                    </div>
                  </td>
                  {section.items.map((item, itemIndex) => {
                    const cell = item.cells[band] ?? {
                      price: "",
                      durationMinutes: "",
                    };
                    const formattedPrice = formatPriceInput(cell.price);
                    const priceInputWidth = `calc(${Math.max(formattedPrice.length, 1)}ch + 2px)`;
                    const durationInputWidth = `calc(${Math.max(cell.durationMinutes.length, 1)}ch + 1px)`;

                    return (
                      <td
                        key={item.id}
                        className={cn(
                          "px-[14px] py-3",
                          !isLastBand && "border-b border-[#edf1f5]",
                          (isEditing || itemIndex < section.items.length - 1) &&
                            "border-r border-[#edf1f5]",
                        )}
                      >
                        <div className="flex items-baseline gap-[6px] whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formattedPrice}
                                onChange={(event) =>
                                  onUpdateCell(item.id, band, { price: event.target.value })
                                }
                                placeholder="-"
                                aria-label={`${item.label} ${band} 가격 수정`}
                                style={{
                                  fontSize: "13.5px",
                                  fontWeight: 800,
                                  lineHeight: "17px",
                                  width: priceInputWidth,
                                }}
                                className="min-w-[1ch] shrink-0 border-0 bg-transparent p-0 text-left text-[13.5px] font-extrabold leading-normal tabular-nums text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                              />
                              <span className="inline-flex items-baseline whitespace-nowrap text-[12px] leading-[normal] text-[#64748b]">
                                <span className="mr-1">/</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={cell.durationMinutes}
                                  onChange={(event) =>
                                    onUpdateCell(item.id, band, {
                                      durationMinutes: event.target.value,
                                    })
                                  }
                                  placeholder="-"
                                  aria-label={`${item.label} ${band} 예상 시간 수정`}
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 400,
                                    lineHeight: "15px",
                                    width: durationInputWidth,
                                  }}
                                  className="min-w-[1ch] shrink-0 border-0 bg-transparent p-0 text-right text-[12px] leading-normal tabular-nums text-[#64748b] outline-none placeholder:text-[#94a3b8]"
                                />
                                <span>분 예상</span>
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-extrabold tabular-nums text-[#0f172a]">
                                {formattedPrice || "-"}
                              </span>
                              <span className="text-[12px] leading-[normal] text-[#64748b]">
                                / {cell.durationMinutes || "-"}분 예상
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {isEditing ? (
                    <td
                      className={cn(
                        "w-[34px] px-[14px] py-3 text-center",
                        !isLastBand && "border-b border-[#edf1f5]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onRemoveWeightBand(bandIndex)}
                        disabled={section.weightBands.length <= 1}
                        className="inline-flex h-[14px] w-[14px] items-center justify-center text-[#94a3b8] transition-colors hover:text-[#d64545] disabled:opacity-35"
                        aria-label={`${band} 무게 구간 삭제`}
                      >
                        <BasilIcon name="trash" className="h-[14px] w-[14px]" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditing ? (
        <button
          type="button"
          onClick={onAddWeightBand}
          style={smallButtonStyle}
          className="mt-3 inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#e2e7ed] bg-[#f6f7f9] text-[12.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef1f5]"
        >
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.2} />
          무게 구간 추가
        </button>
      ) : null}
    </section>
  );
}
