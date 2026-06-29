"use client";

import { ArrowDown, ArrowUp, ChevronDown, Info, Plus, Trash2 } from "lucide-react";

import {
  normalizeCustomerServiceOverrides,
  type CustomerServiceDisplayOverrides,
  type CustomerServiceSourceOption,
} from "@/lib/customer-service-options";
import { cn, formatServicePrice } from "@/lib/utils";

type CustomerServiceExposurePanelProps = {
  options: CustomerServiceSourceOption[];
  overrides: CustomerServiceDisplayOverrides;
  title?: string;
  embedded?: boolean;
  hideHeader?: boolean;
  busyOptionId?: string | null;
  onChange: (overrides: CustomerServiceDisplayOverrides) => void;
  connectionOptions?: CustomerServiceSourceOption[];
  onAddOption?: () => void | Promise<void>;
  onDeleteOption?: (option: CustomerServiceSourceOption) => void | Promise<void>;
  onRenameOption?: (option: CustomerServiceSourceOption, nextName: string) => void | Promise<void>;
  onRelinkOption?: (option: CustomerServiceSourceOption, nextOptionId: string) => void | Promise<void>;
};

function getLinkedOptionId(option: CustomerServiceSourceOption) {
  return option.linkedOptionId ?? option.id;
}

function getOptionRows(options: CustomerServiceSourceOption[], overrides: CustomerServiceDisplayOverrides) {
  return options
    .map((option) => {
      const override = overrides[option.id];
      return {
        option,
        visible: true,
        order: override?.order ?? option.order,
        displayName: override?.displayName ?? option.sourceName,
      };
    })
    .sort((left, right) => left.order - right.order || left.option.sourceName.localeCompare(right.option.sourceName, "ko"));
}

function cleanOverride(
  option: CustomerServiceSourceOption,
  override: CustomerServiceDisplayOverrides[string],
  options: { preserveOrder?: boolean } = {},
) {
  const next = { ...override };
  if (next.visible === true) delete next.visible;
  if (!options.preserveOrder && next.order === option.order) delete next.order;
  if (next.displayName?.trim() === option.sourceName) delete next.displayName;
  if (!next.displayName?.trim()) delete next.displayName;
  if (!next.description?.trim()) delete next.description;
  return next;
}

function getOptionSelectLabel(option: CustomerServiceSourceOption) {
  const name = option.sourceName.startsWith(`${option.category} /`) ? option.sourceName : `${option.category} / ${option.sourceName}`;
  return `${name} · ${option.durationMinutes}분 · ${formatServicePrice(option.price, option.priceType)}`;
}

function buildGroupedSelectOptions(options: CustomerServiceSourceOption[]) {
  return options.flatMap((option, index) => {
    const previousOption = options[index - 1];
    const shouldShowDivider = !previousOption || previousOption.category !== option.category;
    const optionElement = (
      <option key={option.id} value={getLinkedOptionId(option)}>
        {getOptionSelectLabel(option)}
      </option>
    );

    if (!shouldShowDivider) return [optionElement];

    return [
      <option key={`divider-${option.category}-${index}`} disabled value={`__divider-${option.category}-${index}`}>
        ── {option.category} ──
      </option>,
      optionElement,
    ];
  });
}

export default function CustomerServiceExposurePanel({
  options,
  overrides,
  title,
  embedded = false,
  hideHeader = false,
  busyOptionId = null,
  onChange,
  connectionOptions,
  onAddOption,
  onDeleteOption,
  onRelinkOption,
}: CustomerServiceExposurePanelProps) {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);
  const rows = getOptionRows(options, normalizedOverrides);
  const priceGuideOptions = connectionOptions ?? options;
  const usedLinkedOptionIds = new Set(rows.map((row) => getLinkedOptionId(row.option)));
  const canDelete = Boolean(onDeleteOption);
  const rowGridClass = canDelete
    ? "grid-cols-[86px_minmax(420px,1fr)_60px]"
    : "grid-cols-[86px_minmax(420px,1fr)]";

  function moveOption(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;

    const reordered = [...rows];
    const [target] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, target);

    const nextOverrides = { ...normalizedOverrides };
    reordered.forEach((row, rowIndex) => {
      const nextOverride = cleanOverride(
        row.option,
        {
          ...(nextOverrides[row.option.id] ?? {}),
          order: rowIndex + 1,
        },
        { preserveOrder: true },
      );
      if (Object.keys(nextOverride).length > 0) {
        nextOverrides[row.option.id] = nextOverride;
      } else {
        delete nextOverrides[row.option.id];
      }
    });
    onChange(nextOverrides);
  }

  return (
    <section className={cn("rounded-[8px] border border-[#dbe2ea] bg-white p-3", embedded && "border-0 bg-transparent p-0")}>
      {!hideHeader && (title || onAddOption) ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <p className="text-[18px] font-semibold tracking-[-0.02em] text-[#181b21]">{title}</p> : <span />}
          {onAddOption ? (
            <button
              type="button"
              onClick={() => void onAddOption?.()}
              disabled={busyOptionId === "__add__"}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#2f6bd4] bg-[#2f6bd4] px-3 text-[0px] font-semibold text-white transition hover:bg-[#285bb3] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              <span className="text-[15px]">서비스 추가</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mb-3 rounded-[8px] border border-[#dbe2ea] bg-gradient-to-r from-[#fbfcfd] to-white px-3.5 py-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#334155]">처음 보이는 가격은 고객의 기대 기준이 됩니다.</p>
            <p className="mt-1 text-[15px] leading-6 text-[#64748b]">
              최저가만 앞에 두면 실제 상담 때 가격 차이가 크게 느껴질 수 있어요. 많이 선택되는 무게나 옵션 기준을 먼저 보여주고,
              세부 가격은 상담이나 상세 안내에서 자연스럽게 설명하는 편이 좋습니다.
            </p>
          </div>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto px-1">
          <div className={cn("min-w-[680px] overflow-hidden rounded-[8px] border border-[#edf2f7] bg-white", !canDelete && "min-w-[640px]")}>
            <div className={cn("grid items-center gap-2 border-b border-[#edf2f7] bg-[#f8fafc] px-3 py-1.5 text-[15px] font-normal text-[#64748b]", rowGridClass)}>
              <span>순서</span>
              <span>노출할 서비스</span>
              {canDelete ? <span className="text-center">삭제</span> : null}
            </div>

            <div className="divide-y divide-[#edf2f7]">
              {rows.map((row, index) => {
                const rowBusy = busyOptionId === row.option.id;
                const currentLinkedOptionId = getLinkedOptionId(row.option);
                const selectableOptions = priceGuideOptions.filter((option) => {
                  const linkedOptionId = getLinkedOptionId(option);
                  return linkedOptionId === currentLinkedOptionId || !usedLinkedOptionIds.has(linkedOptionId);
                });
                return (
                  <div
                    key={row.option.id}
                    className={cn("grid items-center gap-2 px-3 py-1", rowGridClass, row.visible ? "bg-white" : "bg-[#fbfcfd]")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 text-center text-[15px] font-normal tabular-nums text-[#64748b]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="inline-flex overflow-hidden rounded-[7px] border border-[#dbe2ea] bg-white">
                        <button
                          type="button"
                          onClick={() => moveOption(index, -1)}
                          disabled={index === 0}
                          className="inline-flex h-7 w-7 items-center justify-center text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#334155] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
                          aria-label="위로 이동"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-px bg-[#edf2f7]" />
                        <button
                          type="button"
                          onClick={() => moveOption(index, 1)}
                          disabled={index === rows.length - 1}
                          className="inline-flex h-7 w-7 items-center justify-center text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#334155] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
                          aria-label="아래로 이동"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <label className="relative block min-w-0">
                      <span className="sr-only">노출할 서비스</span>
                      <select
                        value={currentLinkedOptionId}
                        onChange={(event) => void onRelinkOption?.(row.option, event.target.value)}
                        disabled={!onRelinkOption || rowBusy}
                        className="h-8 w-full appearance-none rounded-[7px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-9 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      >
                        {buildGroupedSelectOptions(selectableOptions)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#0f172a]" strokeWidth={2} />
                    </label>

                    {onDeleteOption ? (
                      <button
                        type="button"
                        onClick={() => void onDeleteOption(row.option)}
                        disabled={rowBusy}
                        className="inline-flex h-9 w-full items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:border-[#efcaca] hover:bg-[#fffafa] hover:text-[#a04455] disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`${row.displayName} 삭제`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {false ? (
                <div className={cn("grid items-center gap-2 bg-[#fbfcfd] px-3 py-2", rowGridClass)}>
                  <button
                    type="button"
                    onClick={() => void onAddOption?.()}
                    disabled={busyOptionId === "__add__"}
                    className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-[7px] border border-[#dbe2ea] bg-white text-[15px] font-normal text-[#334155] transition hover:border-[#2f6bd4] hover:text-[#2f6bd4] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    추가
                  </button>
                  <span className="text-[15px] font-normal text-[#64748b]">서비스 추가</span>
                  {canDelete ? <span /> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[#dbe2ea] bg-[#fbfcfd] px-4 py-5 text-center text-[16px] font-normal text-[#64748b]">
          등록된 항목이 없습니다.
        </div>
      )}
    </section>
  );
}
