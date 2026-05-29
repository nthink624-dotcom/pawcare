"use client";

import {
  normalizeCustomerServiceOverrides,
  type CustomerServiceDisplayOverrides,
  type CustomerServiceSourceOption,
} from "@/lib/customer-service-options";
import { cn, formatServicePrice } from "@/lib/utils";

type SaveStatus = "idle" | "pending" | "saved" | "error";

type CustomerServiceExposurePanelProps = {
  options: CustomerServiceSourceOption[];
  overrides: CustomerServiceDisplayOverrides;
  saveStatus: SaveStatus;
  embedded?: boolean;
  onChange: (overrides: CustomerServiceDisplayOverrides) => void;
};

function getStatusLabel(status: SaveStatus) {
  if (status === "pending") return "저장 중";
  if (status === "saved") return "저장됨";
  if (status === "error") return "저장 실패";
  return "자동 저장";
}

function getOptionRows(options: CustomerServiceSourceOption[], overrides: CustomerServiceDisplayOverrides) {
  return options
    .map((option) => {
      const override = overrides[option.id];
      return {
        option,
        visible: override?.visible ?? true,
        order: override?.order ?? option.order,
        displayName: override?.displayName ?? option.sourceName,
        description: override?.description ?? option.description,
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

export default function CustomerServiceExposurePanel({
  options,
  overrides,
  saveStatus,
  embedded = false,
  onChange,
}: CustomerServiceExposurePanelProps) {
  const normalizedOverrides = normalizeCustomerServiceOverrides(overrides);
  const rows = getOptionRows(options, normalizedOverrides);

  function updateOverride(option: CustomerServiceSourceOption, patch: CustomerServiceDisplayOverrides[string]) {
    const nextOverride = cleanOverride(option, {
      ...(normalizedOverrides[option.id] ?? {}),
      ...patch,
    });
    const nextOverrides = { ...normalizedOverrides };
    if (Object.keys(nextOverride).length > 0) {
      nextOverrides[option.id] = nextOverride;
    } else {
      delete nextOverrides[option.id];
    }
    onChange(nextOverrides);
  }

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

  if (options.length === 0) {
    return null;
  }

  return (
    <section className={cn("rounded-[8px] border border-[#dbe2ea] bg-white p-4", embedded && "border-0 bg-transparent p-0")}>
      <div className={cn("mb-3 flex items-center justify-between gap-3", embedded && "mb-2")}>
        <div>
          <p className={cn("text-[16px] font-normal text-[#111827]", embedded && "sr-only")}>고객 예약 페이지 노출</p>
          <p className="text-[13px] font-normal text-[#64748b]">미용요금 항목을 기준으로 고객에게 보일 이름, 설명, 순서, 노출 여부를 정리합니다.</p>
        </div>
        <span className="shrink-0 rounded-[8px] border border-[#dbe2ea] px-3 py-1.5 text-[13px] font-normal text-[#64748b]">
          {getStatusLabel(saveStatus)}
        </span>
      </div>

      <div className="divide-y divide-[#edf2f7]">
        {rows.map((row, index) => (
          <div key={row.option.id} className="grid gap-3 py-3 lg:grid-cols-[88px_minmax(0,1fr)_92px] lg:items-center">
            <button
              type="button"
              onClick={() => updateOverride(row.option, { visible: !row.visible })}
              className={`h-9 rounded-[8px] border px-3 text-[15px] font-normal transition ${
                row.visible
                  ? "border-[#c8ded8] bg-[#edf7f3] text-[#2f7866]"
                  : "border-[#dbe2ea] bg-white text-[#64748b]"
              }`}
            >
              {row.visible ? "노출" : "숨김"}
            </button>

            <div className="grid gap-2 sm:grid-cols-[minmax(160px,0.8fr)_minmax(180px,1fr)]">
              <label className="block">
                <span className="sr-only">고객 표시명</span>
                <input
                  value={row.displayName}
                  onChange={(event) => updateOverride(row.option, { displayName: event.target.value })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal text-[#111827] outline-none focus:border-[#2f7866]"
                />
                <span className="mt-1 block truncate text-[13px] font-normal text-[#64748b]">
                  원본 {row.option.sourceName} · {row.option.durationMinutes}분 · {formatServicePrice(row.option.price, row.option.priceType)}
                </span>
              </label>
              <label className="block">
                <span className="sr-only">짧은 설명</span>
                <input
                  value={row.description}
                  onChange={(event) => updateOverride(row.option, { description: event.target.value })}
                  placeholder="예: 목욕과 기본 정리"
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#2f7866]"
                />
                <span className="mt-1 block text-[13px] font-normal text-[#64748b]">{row.option.category}</span>
              </label>
            </div>

            <div className="flex gap-1.5 lg:justify-end">
              <button
                type="button"
                onClick={() => moveOption(index, -1)}
                disabled={index === 0}
                className="h-9 w-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-normal text-[#334155] disabled:opacity-35"
                aria-label="위로 이동"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveOption(index, 1)}
                disabled={index === rows.length - 1}
                className="h-9 w-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-normal text-[#334155] disabled:opacity-35"
                aria-label="아래로 이동"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
