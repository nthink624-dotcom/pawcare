"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

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

function cleanOverride(option: CustomerServiceSourceOption, override: CustomerServiceDisplayOverrides[string]) {
  const next = { ...override };
  if (next.visible === true) delete next.visible;
  if (next.order === option.order) delete next.order;
  if (next.displayName?.trim() === option.sourceName) delete next.displayName;
  if (!next.displayName?.trim()) delete next.displayName;
  if (!next.description?.trim()) delete next.description;
  return next;
}

function getOptionSelectLabel(option: CustomerServiceSourceOption) {
  return `${option.category} / ${option.sourceName} · ${option.durationMinutes}분 · ${formatServicePrice(option.price, option.priceType)}`;
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
    ? "grid-cols-[82px_minmax(520px,1fr)_104px_140px_56px]"
    : "grid-cols-[82px_minmax(520px,1fr)_104px_140px]";

  function moveOption(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;

    const reordered = [...rows];
    const [target] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, target);

    const nextOverrides = { ...normalizedOverrides };
    reordered.forEach((row, rowIndex) => {
      const nextOverride = cleanOverride(row.option, {
        ...(nextOverrides[row.option.id] ?? {}),
        order: rowIndex + 1,
      });
      if (Object.keys(nextOverride).length > 0) {
        nextOverrides[row.option.id] = nextOverride;
      } else {
        delete nextOverrides[row.option.id];
      }
    });
    onChange(nextOverrides);
  }

  return (
    <section className={cn("rounded-[8px] border border-[#dbe2ea] bg-white p-4", embedded && "border-0 bg-transparent p-0")}>
      {title || onAddOption ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          {title ? <p className="text-[16px] font-medium text-[#334155]">{title}</p> : <span />}
          {onAddOption ? (
            <button
              type="button"
              onClick={() => void onAddOption()}
              disabled={busyOptionId === "__add__"}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#2f7866] bg-[#2f7866] px-3 text-[16px] font-normal text-white transition hover:bg-[#286a5a] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              항목 추가
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <div className={cn("min-w-[1120px] overflow-hidden rounded-[10px] border border-[#edf2f7] bg-white", !canDelete && "min-w-[1060px]")}>
            <div className={cn("grid items-center gap-2 border-b border-[#edf2f7] bg-[#f8fafc] px-2 py-2 text-[16px] font-normal text-[#64748b]", rowGridClass)}>
              <span>순서</span>
              <span>노출할 서비스</span>
              <span className="text-right">예상 시간</span>
              <span className="text-right">시작 가격</span>
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
                    className={cn("grid items-center gap-2 px-2 py-2", rowGridClass, row.visible ? "bg-white" : "bg-[#fbfcfd]")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-6 text-center text-[16px] font-normal tabular-nums text-[#64748b]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="inline-flex overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white">
                        <button
                          type="button"
                          onClick={() => moveOption(index, -1)}
                          disabled={index === 0}
                          className="inline-flex h-8 w-8 items-center justify-center text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#334155] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
                          aria-label="위로 이동"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <span className="w-px bg-[#edf2f7]" />
                        <button
                          type="button"
                          onClick={() => moveOption(index, 1)}
                          disabled={index === rows.length - 1}
                          className="inline-flex h-8 w-8 items-center justify-center text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#334155] disabled:cursor-not-allowed disabled:text-[#cbd5e1]"
                          aria-label="아래로 이동"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <label className="block min-w-0">
                      <span className="sr-only">노출할 서비스</span>
                      <select
                        value={currentLinkedOptionId}
                        onChange={(event) => void onRelinkOption?.(row.option, event.target.value)}
                        disabled={!onRelinkOption || rowBusy}
                        className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      >
                        {buildGroupedSelectOptions(selectableOptions)}
                      </select>
                    </label>

                    <div className="flex h-9 items-center justify-end rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-normal tabular-nums text-[#334155]">
                      {row.option.durationMinutes}분
                    </div>
                    <div className="flex h-9 items-center justify-end rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] font-normal tabular-nums text-[#334155]">
                      {formatServicePrice(row.option.price, row.option.priceType)}
                    </div>
                    {onDeleteOption ? (
                      <button
                        type="button"
                        onClick={() => void onDeleteOption(row.option)}
                        disabled={rowBusy}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] transition hover:border-[#efcaca] hover:bg-[#fffafa] hover:text-[#a04455] disabled:cursor-not-allowed disabled:opacity-35"
                        aria-label={`${row.displayName} 삭제`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
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
