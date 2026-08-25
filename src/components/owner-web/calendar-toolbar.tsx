"use client";

import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

import { OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS } from "@/components/owner-web/owner-web-action-button-styles";
import { getRollingScheduleDates, WEEKLY_SCHEDULE_VISIBLE_DAYS } from "@/components/owner-web/calendar-week-range";
import { SoftSelect } from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";
import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { isShopClosedOnDate } from "@/lib/availability";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type StaffFilter = "전체 직원" | string;
export type CalendarViewMode = "day" | "week";

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

function formatScheduleWeekLabel(date: string) {
  const weekDates = getRollingScheduleDates(date);
  const weekStart = weekDates[0];
  const weekEnd = weekDates.at(-1);
  if (!weekStart || !weekEnd) return "";
  const [startYear, startMonth, startDay] = weekStart.split("-").map(Number);
  const [endYear, endMonth, endDay] = weekEnd.split("-").map(Number);
  const endLabel = startYear === endYear && startMonth === endMonth
    ? `${endDay}일`
    : `${endMonth}월 ${endDay}일`;

  return `${startMonth}월 ${startDay}일 - ${endLabel}`;
}

export function CalendarToolbar({
  shop,
  selectedDate,
  viewMode,
  staff,
  visibleStaff,
  onDateChange,
  onViewModeChange,
  onStaffChange,
  onAddSchedule,
}: {
  shop: BootstrapPayload["shop"];
  selectedDate: string;
  viewMode: CalendarViewMode;
  staff: StaffFilter;
  visibleStaff: OwnerWebStaffColumn[];
  onDateChange: (date: string) => void;
  onViewModeChange: (viewMode: CalendarViewMode) => void;
  onStaffChange: (staff: StaffFilter) => void;
  onAddSchedule: () => void;
}) {
  const singleStaff = visibleStaff.length <= 1;
  const allowAllStaff = viewMode === "day";
  const dateStep = viewMode === "week" ? WEEKLY_SCHEDULE_VISIBLE_DAYS : 1;
  const staffLabel = singleStaff
    ? visibleStaff[0]?.name ?? "담당 없음"
    : staff === "전체 직원"
      ? "전체 직원"
      : visibleStaff.find((item) => item.key === staff)?.name ?? "전체 직원";

  function handleViewModeChange(nextViewMode: CalendarViewMode) {
    if (nextViewMode === "week" && staff === "전체 직원" && visibleStaff[0]) {
      onStaffChange(visibleStaff[0].key);
    }
    onViewModeChange(nextViewMode);
  }

  return (
    <div className="border-b border-[#e4eaf1] bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 rounded-[10px] border border-[#e1e7ef] bg-[#f8fafc] p-1">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -dateStep))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-white hover:text-[#0f172a] hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDateChange(currentDateInTimeZone())}
            className="inline-flex h-8 min-w-[158px] items-center justify-center rounded-[7px] px-3 text-[16px] font-semibold tracking-[-0.015em] text-[#172033] transition hover:bg-white"
          >
            {viewMode === "week" ? formatScheduleWeekLabel(selectedDate) : formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, dateStep))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] text-[#64748b] transition hover:bg-white hover:text-[#0f172a] hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <div className="inline-flex h-9 rounded-[9px] border border-[#dfe6ee] bg-[#f8fafc] p-0.5" role="group" aria-label="일정 보기 방식">
            <button
              type="button"
              onClick={() => handleViewModeChange("day")}
              className={cn(
                "rounded-[7px] px-3.5 text-[13px] transition",
                viewMode === "day" ? "bg-white font-semibold text-[#2563eb] shadow-[0_1px_3px_rgba(15,23,42,0.08)]" : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              일간
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("week")}
              className={cn(
                "rounded-[7px] px-3.5 text-[13px] transition",
                viewMode === "week" ? "bg-white font-semibold text-[#2563eb] shadow-[0_1px_3px_rgba(15,23,42,0.08)]" : "text-[#64748b] hover:text-[#334155]",
              )}
            >
              주간
            </button>
          </div>
          {singleStaff ? (
            <div className="inline-flex h-9 w-[164px] items-center justify-between rounded-[9px] border border-[#dfe6ee] bg-white px-3 text-[#0f172a]">
              <span className="text-[12px] font-medium text-[#94a3b8]">담당</span>
              <span className="truncate text-[14px] font-medium">{staffLabel}</span>
            </div>
          ) : (
            <SoftSelect<StaffFilter>
              label="담당"
              value={staff}
              onChange={onStaffChange}
              options={[
                ...(allowAllStaff ? [{ value: "전체 직원", label: "전체 직원" }] : []),
                ...visibleStaff.map((option) => ({ value: option.key, label: option.name })),
              ]}
              className="w-[164px]"
              buttonClassName="h-9"
              labelClassName="text-[12px] font-medium text-[#94a3b8]"
              valueClassName="text-[14px] font-medium"
              menuClassName="w-[164px] min-w-0"
            />
          )}
          <button
            type="button"
            onClick={onAddSchedule}
            className={cn(OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS, "!bg-[#111b32] hover:!bg-[#1b2b45]")}
          >
            <CalendarPlus className="h-4 w-4" />
            예약 추가
          </button>
        </div>
      </div>
    </div>
  );
}
