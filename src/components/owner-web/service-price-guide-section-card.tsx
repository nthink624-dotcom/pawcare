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
  const actionColumnWidth = isEditing ? 40 : 0;

  return (
    <section
      className={cn(
        "w-full min-w-0 rounded-[16px] border border-[#e2e7ed] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        isEditing ? "px-[30px] py-7" : "px-[22px] py-5",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {isEditing ? (
            <label className="relative flex h-10 w-[135px] max-w-full min-w-0 items-center gap-1 rounded-[9px] border border-[#d8dee7] bg-[#f8f9fb] px-3 pr-8 transition hover:border-[#b8c2cf] focus-within:border-[var(--accent)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#e8f0f7]">
              <span className="sr-only">그룹명</span>
              <input
                type="text"
                value={section.title}
                onChange={(event) => onChangeTitle(event.target.value)}
                placeholder="그룹명"
                aria-label={`${formatGroupDisplayName(section.title)} 그룹명 수정`}
                style={{ fontWeight: 800 }}
                className="h-full min-w-[1ch] max-w-[72px] border-0 bg-transparent p-0 text-[15px] tracking-[-0.02em] text-[#0f172a] outline-none placeholder:text-[#94a3b8] [field-sizing:content]"
              />
              {section.title.trim() && !section.title.trim().endsWith("그룹") ? (
                <span
                  className="shrink-0 text-[15px] tracking-[-0.02em] text-[#0f172a]"
                  style={{ fontWeight: 800 }}
                  aria-hidden="true"
                >
                  그룹
                </span>
              ) : null}
              <PencilLine
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8291a6]"
                strokeWidth={1.9}
              />
            </label>
          ) : (
            <h3 className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-[#0f172a]">
              {formatGroupDisplayName(section.title)}
            </h3>
          )}
          <span className="shrink-0 text-[12.5px] font-medium text-[#94a3b8]">
            {breedLabels.length}종 등록됨
          </span>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={onAddWeightBand}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#e2e7ed] bg-white px-3.5 text-[13px] font-semibold text-[#334155] transition hover:bg-[#f6f7f9]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                무게
              </button>
              <button
                type="button"
                onClick={onAddItem}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#e2e7ed] bg-white px-3.5 text-[13px] font-semibold text-[#334155] transition hover:bg-[#f6f7f9]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                항목
              </button>
              <span className="mx-1 h-5 w-px bg-[#e2e7ed]" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggleEdit}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#0f172a] bg-[#0f172a] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#1e293b]"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                완료
              </button>
              <button
                type="button"
                onClick={onRemoveSection}
                disabled={!canDeleteSection}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#f0d5d5] bg-white text-[#c24141] transition hover:border-[#e6bcbc] hover:bg-[#fff7f7] disabled:cursor-not-allowed disabled:opacity-40"
                title={canDeleteSection ? "그룹 삭제" : "그룹은 최소 1개가 필요합니다."}
                aria-label={canDeleteSection ? "그룹 삭제" : "그룹 삭제 불가"}
              >
                <BasilIcon name="trash" className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleEdit}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-[#e2e7ed] bg-white px-3 text-[13px] font-semibold text-[#334155] transition hover:bg-[#f6f7f9]"
            >
              <PencilLine className="h-3.5 w-3.5" strokeWidth={1.9} />
              편집
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-5 rounded-[11px] bg-[#f6f7f9]",
          isEditing ? "flex min-h-[76px] items-center gap-3 px-[18px] py-4" : "p-4",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto">
          {breedLabels.length > 0 ? (
            breedLabels.map((breed, index) => (
              <span
                key={`${breed}-${index}`}
                className="inline-flex h-7 items-center rounded-full border border-[#e2e7ed] bg-white px-2.5 text-[12px] font-semibold text-[#334155]"
              >
                {breed}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-[#9a6b1f]">등록된 품종이 없습니다.</span>
          )}
        </div>
        {isEditing ? (
          <button
            type="button"
            onClick={onOpenBreedManagement}
            className="inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[12px] font-semibold text-[#334155] transition hover:border-[#b8c2cf] hover:bg-[#fbfcfd]"
          >
            <PencilLine className="h-3 w-3 text-[#64748b]" strokeWidth={1.9} />
            품종 관리
          </button>
        ) : null}
      </div>

      <div className="mt-[18px] w-full max-w-full overflow-x-auto overscroll-x-contain rounded-[11px] border border-[#e2e7ed] [scrollbar-gutter:stable] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#b8c1cc] [&::-webkit-scrollbar-track]:bg-[#edf1f5]">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-[13.5px]"
          style={{
            minWidth: 108 + 108 + section.items.length * 164 + actionColumnWidth,
          }}
        >
          <colgroup>
            <col className="w-[108px]" />
            <col className="w-[108px]" />
            {section.items.map((item) => (
              <col key={item.id} className="w-[164px]" />
            ))}
            {isEditing ? <col className="w-[40px]" /> : null}
          </colgroup>
          <thead>
            <tr className="bg-[#f6f7f9] text-[#334155]">
              <th className="border-b border-r border-[#e2e7ed] px-4 py-3 text-left text-[12px] font-bold">
                그룹
              </th>
              <th className="border-b border-r border-[#e2e7ed] px-4 py-3 text-left text-[12px] font-bold">
                무게
              </th>
              {section.items.map((item) => (
                <th
                  key={item.id}
                  className={cn(
                    "border-b border-r border-[#e2e7ed] px-4 py-2.5 text-left",
                    !isEditing && "last:border-r-0",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.label}
                        onChange={(event) => onUpdateItemLabel(item.id, event.target.value)}
                        aria-label={`${item.label} 항목명 수정`}
                        style={{ fontWeight: 800 }}
                        className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[12.5px] text-[#243047] outline-none transition focus:bg-white"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold text-[#243047]">
                        {item.label}
                      </span>
                    )}
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={section.items.length <= 1}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#8fa0b7] transition hover:bg-white hover:text-[#c24141] disabled:opacity-35"
                        aria-label={`${item.label} 항목 삭제`}
                      >
                        <BasilIcon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              {isEditing ? (
                <th
                  className="border-b border-[#e2e7ed] bg-[#f6f7f9]"
                  aria-label="행 관리"
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {section.weightBands.map((band, bandIndex) => (
              <tr key={`${section.id}-weight-${bandIndex}`}>
                {bandIndex === 0 ? (
                  <td
                    rowSpan={section.weightBands.length}
                    className="border-b border-r border-[#e2e7ed] bg-[#f6f7f9] px-4 py-3 align-middle text-left text-[13px] font-extrabold text-[#0f172a]"
                  >
                    {formatGroupDisplayName(section.title)}
                  </td>
                ) : null}
                <td className="border-b border-r border-[#edf1f5] bg-[#fbfcfd] px-4 py-2.5">
                  {isEditing ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <input
                        type="text"
                        value={band}
                        onChange={(event) => onUpdateWeightBand(bandIndex, event.target.value)}
                        aria-label={`${band} 무게 구간 수정`}
                        style={{ fontWeight: 800 }}
                        className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[13px] text-[#0f172a] outline-none transition focus:bg-white"
                      />
                      <PencilLine
                        className="h-3.5 w-3.5 shrink-0 text-[#8fa0b7]"
                        strokeWidth={1.8}
                      />
                    </div>
                  ) : (
                    <span className="block text-[13px] font-extrabold text-[#0f172a]">{band}</span>
                  )}
                </td>
                {section.items.map((item) => {
                  const cell = item.cells[band] ?? {
                    price: "",
                    durationMinutes: "",
                  };

                  return (
                    <td
                      key={item.id}
                      className={cn(
                        "border-b border-r border-[#edf1f5] bg-white px-4 py-2.5",
                        !isEditing && "last:border-r-0",
                      )}
                    >
                      {isEditing ? (
                        <div className="flex h-7 min-w-0 items-baseline gap-1.5 whitespace-nowrap">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatPriceInput(cell.price)}
                            onChange={(event) =>
                              onUpdateCell(item.id, band, { price: event.target.value })
                            }
                            placeholder="-"
                            aria-label={`${item.label} ${band} 가격 수정`}
                            style={{ fontWeight: 800 }}
                            className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[13.5px] tabular-nums text-[#0f172a] outline-none transition placeholder:text-[#a3afbd] focus:bg-[#f8fafc]"
                          />
                          <span className="shrink-0 text-[12px] font-normal text-[#64748b]">/</span>
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
                            style={{ fontWeight: 400 }}
                            className="h-7 w-[24px] shrink-0 border-0 bg-transparent p-0 text-right text-[12px] tabular-nums text-[#64748b] outline-none transition placeholder:text-[#a3afbd] focus:bg-[#f8fafc]"
                          />
                          <span className="shrink-0 text-[12px] font-normal text-[#64748b]">
                            분 예상
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                          <span className="font-extrabold tabular-nums text-[#0f172a]">
                            {formatPriceInput(cell.price) || "-"}
                          </span>
                          <span className="text-[12px] text-[#64748b]">
                            / {cell.durationMinutes || "-"}분 예상
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
                {isEditing ? (
                  <td className="border-b border-[#edf1f5] bg-white px-0 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveWeightBand(bandIndex)}
                      disabled={section.weightBands.length <= 1}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#8fa0b7] transition hover:bg-[#fff1f1] hover:text-[#c24141] disabled:opacity-35"
                      aria-label={`${band} 무게 구간 삭제`}
                    >
                      <BasilIcon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isEditing ? (
        <button
          type="button"
          onClick={onAddWeightBand}
          className="mt-3 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[#d8dee7] bg-[#f8f9fb] text-[13px] font-semibold text-[#334155] transition hover:border-[#b8c2cf] hover:bg-[#f3f5f7]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          무게 구간 추가
        </button>
      ) : null}
    </section>
  );
}
