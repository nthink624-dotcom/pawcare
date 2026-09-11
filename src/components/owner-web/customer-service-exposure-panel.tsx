"use client";

import { ArrowDown, ArrowUp, Info } from "lucide-react";

import {
  formatCustomerServiceDuration,
  sanitizeCustomerServiceOverridesForSourceOptions,
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
};

type ExposureRow = {
  option: CustomerServiceSourceOption;
  visible: boolean;
  order: number;
};

function getExposureRows(
  options: CustomerServiceSourceOption[],
  overrides: CustomerServiceDisplayOverrides,
): ExposureRow[] {
  const sourceBoundOverrides = sanitizeCustomerServiceOverridesForSourceOptions(overrides, options);
  const overrideBySourceId = new Map(
    Object.values(sourceBoundOverrides).flatMap((override) =>
      override.linkedOptionId ? [[override.linkedOptionId, override] as const] : [],
    ),
  );

  return options
    .map((option) => {
      const override = overrideBySourceId.get(option.id);
      return {
        option,
        visible: override?.visible ?? true,
        order: override?.order ?? option.order,
      };
    })
    .sort((left, right) => left.order - right.order || left.option.sourceName.localeCompare(right.option.sourceName, "ko"));
}

function rowsToSourceBoundOverrides(rows: ExposureRow[]): CustomerServiceDisplayOverrides {
  return Object.fromEntries(
    rows.map((row, index) => [
      row.option.id,
      {
        visible: row.visible,
        order: index + 1,
        linkedOptionId: row.option.id,
      },
    ]),
  );
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
}: CustomerServiceExposurePanelProps) {
  const rows = getExposureRows(options, overrides);

  function moveOption(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const reordered = [...rows];
    const [target] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, target);
    onChange(rowsToSourceBoundOverrides(reordered));
  }

  function toggleOption(index: number) {
    onChange(rowsToSourceBoundOverrides(rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, visible: !row.visible } : row,
    )));
  }

  return (
    <section className={cn("rounded-[8px] border border-[#dbe2ea] bg-white p-3", embedded && "border-0 bg-transparent p-0")}>
      {!hideHeader && title ? <p className="mb-3 text-[18px] font-semibold tracking-[-0.02em] text-[#181b21]">{title}</p> : null}

      {!hideGuidance ? (
        <div className="mb-3 rounded-[8px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[#2f7866]">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[#334155]">저장된 상세 요금표 항목만 고객에게 보여줄 수 있어요.</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[#64748b]">가격과 시간은 원본 요금표를 수정하면 고객 화면에도 같은 값으로 반영됩니다.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto px-1">
        <div className="min-w-[760px] overflow-hidden rounded-[8px] border border-[#edf2f7] bg-white">
          <div className="grid grid-cols-[132px_minmax(300px,1fr)_100px_130px_92px] items-center gap-2 border-b border-[#edf2f7] bg-[#f8fafc] px-3 py-2 text-[13px] font-medium text-[#64748b]">
            <span>순서</span>
            <span>저장된 요금표 항목</span>
            <span className="text-right">시간</span>
            <span className="text-right">가격</span>
            <span className="text-center">고객 노출</span>
          </div>
          <div className="divide-y divide-[#edf2f7]">
            {rows.map((row, index) => {
              const rowBusy = busyOptionId === row.option.id;
              return (
                <div key={row.option.id} className={cn("grid grid-cols-[132px_minmax(300px,1fr)_100px_130px_92px] items-center gap-2 px-3 py-2", row.visible ? "bg-white" : "bg-[#fbfcfd]")}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-7 text-center text-[14px] font-medium tabular-nums text-[#64748b]">{String(index + 1).padStart(2, "0")}</span>
                    <button type="button" onClick={() => moveOption(index, -1)} disabled={index === 0 || rowBusy} className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`${row.option.sourceName} 위로 이동`}>
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => moveOption(index, 1)} disabled={index === rows.length - 1 || rowBusy} className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-35" aria-label={`${row.option.sourceName} 아래로 이동`}>
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-[#172033]">{row.option.sourceName}</p>
                    <p className="truncate text-[13px] leading-5 text-[#64748b]">{[row.option.weightBand, row.option.description].filter(Boolean).join(" · ") || "상세 요금표 원본"}</p>
                  </div>
                  <span className="text-right text-[14px] tabular-nums text-[#334155]">{formatCustomerServiceDuration(row.option)}</span>
                  <span className="text-right text-[14px] tabular-nums text-[#334155]">{formatServicePrice(row.option.price, row.option.priceType)}</span>
                  <button type="button" onClick={() => toggleOption(index)} disabled={rowBusy} aria-pressed={row.visible} className={cn("min-h-11 rounded-[8px] border px-3 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-45", row.visible ? "border-[#c8ded8] bg-[#edf7f3] text-[#2f7866]" : "border-[#dbe2ea] bg-white text-[#64748b]")}>
                    {row.visible ? "노출" : "숨김"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
