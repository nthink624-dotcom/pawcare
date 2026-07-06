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
  hideGuidance?: boolean;
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
        displayName: option.sourceName,
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
  return next;
}

function getOptionSelectLabel(option: CustomerServiceSourceOption) {
  const name = option.sourceName.startsWith(`${option.category} /`) ? option.sourceName : `${option.category} / ${option.sourceName}`;
  return `${name} · ${option.durationMinutes}분 · ${formatServicePrice(option.price, option.priceType)}`;
}

function getOptionDisplayKey(option: CustomerServiceSourceOption) {
  return getOptionSelectLabel(option).replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function getDistinctSelectOptions(options: CustomerServiceSourceOption[], currentLinkedOptionId: string) {
  const optionByLabel = new Map<string, CustomerServiceSourceOption>();

  for (const option of options) {
    const key = getOptionDisplayKey(option);
    const isCurrentOption = getLinkedOptionId(option) === currentLinkedOptionId;
    if (!optionByLabel.has(key) || isCurrentOption) {
      optionByLabel.set(key, option);
    }
  }

  return Array.from(optionByLabel.values());
}

function buildGroupedSelectOptions(options: CustomerServiceSourceOption[], currentLinkedOptionId: string) {
  const groupedOptions = new Map<string, CustomerServiceSourceOption[]>();

  for (const option of getDistinctSelectOptions(options, currentLinkedOptionId)) {
    groupedOptions.set(option.category, [...(groupedOptions.get(option.category) ?? []), option]);
  }

  return Array.from(groupedOptions.entries()).map(([category, groupOptions]) => (
    <optgroup key={category} label={category}>
      {groupOptions.map((option) => (
        <option key={option.id} value={getLinkedOptionId(option)}>
          {getOptionSelectLabel(option)}
        </option>
      ))}
    </optgroup>
  ));
}

export default function CustomerServiceExposurePanel({
  options,
  overrides,
  title,
  embedded = false,
  hideHeader = false,
  hideGuidance = false,
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
  const usedDisplayKeys = new Set(rows.map((row) => getOptionDisplayKey(row.option)));
  const hasAvailableOption = priceGuideOptions.some((option) => !usedDisplayKeys.has(getOptionDisplayKey(option)));
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
              <span className="text-[15px]">요금표 추가</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {!hideGuidance ? (
        <div className="mb-3 rounded-[8px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]">
              <Info className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[#334155]">고객에게 안내할 요금표를 추가해 주세요.</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#64748b]">
                <span className="block">자주 예약되는 미용 항목의 예상 시간과 시작 가격을 등록하면, 고객 예약페이지 첫 화면에 보여집니다.</span>
                <span className="block">아이의 크기나 털 상태에 따라 최종 금액은 달라질 수 있어요.</span>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto px-1">
          <div className={cn("min-w-[680px] overflow-hidden rounded-[8px] border border-[#edf2f7] bg-white", !canDelete && "min-w-[640px]")}>
            <div className={cn("grid items-center gap-2 border-b border-[#edf2f7] bg-[#f8fafc] px-3 py-1.5 text-[15px] font-normal text-[#64748b]", rowGridClass)}>
              <span>순서</span>
              <span>고객에게 보여줄 요금표</span>
              {canDelete ? <span className="text-center">삭제</span> : null}
            </div>

            <div className="divide-y divide-[#edf2f7]">
              {rows.map((row, index) => {
                const rowBusy = busyOptionId === row.option.id;
                const currentLinkedOptionId = getLinkedOptionId(row.option);
                const selectableOptions = priceGuideOptions.filter((option) => {
                  const linkedOptionId = getLinkedOptionId(option);
                  return (
                    linkedOptionId === currentLinkedOptionId ||
                    (!usedLinkedOptionIds.has(linkedOptionId) && !usedDisplayKeys.has(getOptionDisplayKey(option)))
                  );
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
                      <span className="sr-only">고객에게 보여줄 요금표</span>
                      <select
                        value={currentLinkedOptionId}
                        onChange={(event) => void onRelinkOption?.(row.option, event.target.value)}
                        disabled={!onRelinkOption || rowBusy}
                        className="h-8 w-full appearance-none rounded-[7px] border border-[#dbe2ea] bg-white py-0 pl-3 pr-9 text-[15px] font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#2f7866]/10 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      >
                        {buildGroupedSelectOptions(selectableOptions, currentLinkedOptionId)}
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
          {onAddOption ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => void onAddOption?.()}
                disabled={busyOptionId === "__add__" || !hasAvailableOption}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#2f6bd4] bg-white px-3.5 text-[14px] font-medium text-[#2f6bd4] transition hover:bg-[#f6f9ff] disabled:cursor-not-allowed disabled:border-[#dbe2ea] disabled:text-[#94a3b8] disabled:opacity-70"
              >
                <Plus className="h-4 w-4" />
                서비스 추가하기
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[#cfd7e3] bg-[#fbfcfd] px-4 py-5 text-center">
          <p className="text-[16px] font-medium text-[#334155]">아직 추가된 요금표가 없습니다.</p>
          <p className="mx-auto mt-1.5 max-w-[520px] text-[14px] font-normal leading-5 text-[#64748b]">
            요금표를 추가하면 고객 예약페이지에 서비스명, 예상 시간, 시작 가격이 함께 보여집니다.
          </p>
          {onAddOption ? (
            <button
              type="button"
              onClick={() => void onAddOption?.()}
              disabled={busyOptionId === "__add__"}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#2f6bd4] bg-white px-3.5 text-[14px] font-medium text-[#2f6bd4] transition hover:bg-[#f6f9ff] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" />
              서비스 추가하기
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
