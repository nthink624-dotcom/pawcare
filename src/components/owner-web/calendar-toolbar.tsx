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
    <div className="border-b border-[#e2e8f0] px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, -dateStep))}
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
            {viewMode === "week" ? formatScheduleWeekLabel(selectedDate) : formatSchedulePickerRelativeLabel(selectedDate, shop)}
          </button>
          <button
            type="button"
            onClick={() => onDateChange(addDate(selectedDate, dateStep))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex h-9 rounded-[8px] border border-[#dbe2ea] bg-white p-0.5" role="group" aria-label="일정 보기 방식">
            <button
              type="button"
              onClick={() => handleViewModeChange("day")}
              className={cn(
                "rounded-[6px] px-3 text-[13px] transition",
                viewMode === "day" ? "bg-[#eff6ff] font-medium text-[#1677ff]" : "text-[#64748b] hover:bg-[#f8fafc]",
              )}
            >
              일간
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("week")}
              className={cn(
                "rounded-[6px] px-3 text-[13px] transition",
                viewMode === "week" ? "bg-[#eff6ff] font-medium text-[#1677ff]" : "text-[#64748b] hover:bg-[#f8fafc]",
              )}
            >
              주간
            </button>
          </div>
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
                ...(allowAllStaff ? [{ value: "전체 직원", label: "전체 직원" }] : []),
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
            className={OWNER_WEB_PRIMARY_ACTION_BUTTON_CLASS}
          >
            <CalendarPlus className="h-4 w-4" />
            예약 추가
          </button>
        </div>
      </div>
    </div>
  );
}
