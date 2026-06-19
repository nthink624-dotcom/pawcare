"use client";

import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

import { SoftSelect } from "@/components/owner-web/owner-web-ui";
import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { isShopClosedOnDate } from "@/lib/availability";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type StaffFilter = "전체 직원" | string;

function formatSchedulePickerDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(year).slice(-2)}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`;
}

function formatSchedulePickerRelativeLabel(date: string, shop?: BootstrapPayload["shop"]) {
  if (shop && isShopClosedOnDate(shop, date)) return "휴무일";
  const today = currentDateInTimeZone();
  if (date === today) return "오늘";
  if (date === addDate(today, 1)) return "내일";
  if (date === addDate(today, 2)) return "모레";
  return formatSchedulePickerDateLabel(date);
}

export function CalendarToolbar({
  shop,
  selectedDate,
  staff,
  visibleStaff,
  onDateChange,
  onStaffChange,
  onAddSchedule,
}: {
  shop: BootstrapPayload["shop"];
  selectedDate: string;
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  onDateChange: (date: string) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onAddSchedule: () => void;
}) {
  const singleStaff = visibleStaff.length <= 1;
  const staffLabel = singleStaff
    ? visibleStaff[0]?.name ?? "담당 없음"
    : staff === "전체 직원"
      ? "전체 직원"
      : visibleStaff.find((item) => item.key === staff)?.name ?? "전체 직원";

  return (
    <div className="border-b border-[#e2e8f0] px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="inline-flex h-9 min-w-[178px] items-center justify-center rounded-[8px] px-2 text-[17px] font-medium text-[#111827] hover:bg-[#f8fafc]"
          >
            {formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {singleStaff ? (
            <div className="inline-flex h-9 w-[152px] items-center justify-between rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#0f172a]">
              <span className="text-[16px] text-[#64748b]">담당</span>
              <span className="truncate font-normal">{staffLabel}</span>
            </div>
          ) : (
            <SoftSelect<StaffFilter>
              label="담당"
              value={staff}
              onChange={onStaffChange}
              options={[
                { value: "전체 직원", label: "전체 직원" },
                ...visibleStaff.map((option) => ({ value: option.key, label: option.name })),
              ]}
              className="w-[152px]"
              buttonClassName="h-9"
              labelClassName="text-[16px]"
              valueClassName="text-[16px] font-normal"
              menuClassName="w-[152px] min-w-0"
            />
          )}
          <button
            type="button"
            onClick={onAddSchedule}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] bg-[#5570F1] px-4 text-[14px] font-medium text-white transition hover:bg-[#4962d6]"
          >
            <CalendarPlus className="h-4 w-4" />
            예약 추가
          </button>
        </div>
      </div>
    </div>
  );
}
