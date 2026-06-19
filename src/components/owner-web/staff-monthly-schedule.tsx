import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";

import { getWrapIndicatorClass } from "@/components/owner-web/status-indicators";
import {
  applyScheduleToCell,
  getCellIndicatorTone,
  getMonthCalendarDates,
  weekdayColumns,
  type LeaveRequest,
  type ScheduleOverride,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";

type MonthDay = ReturnType<typeof getMonthCalendarDates>[number];

export function StaffMonthlySchedule({
  staff,
  monthStart,
  monthLabel,
  requests,
  overrides,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
  onOpenScheduleEditor,
}: {
  staff: StaffMember[];
  monthStart: string;
  monthLabel: string;
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  const monthDates = getMonthCalendarDates(monthStart);
  const weeks = Array.from({ length: 6 }, (_, index) => monthDates.slice(index * 7, index * 7 + 7));
  const compactMonthLabel = monthLabel.replace(/^\d{4}년\s*/, "");

  return (
    <div className="flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-white">
      <div className="relative flex h-[64px] items-center justify-center border-b border-[#e1e1dd] bg-white px-16 text-[#202124]">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="absolute left-5 inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#e1e1dd] bg-white text-[#6f747a] transition hover:bg-[#f4f4f1] hover:text-[#202124]"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={onCurrentMonth} className="text-[24px] font-medium leading-none tracking-[0] text-[#202124]">
          {compactMonthLabel}
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          className="absolute right-5 inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[#e1e1dd] bg-white text-[#6f747a] transition hover:bg-[#f4f4f1] hover:text-[#202124]"
          aria-label="다음 달"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 max-w-full flex-1 overflow-auto overscroll-contain [scrollbar-width:thin]">
        <div className="w-full min-w-[980px]">
          <div className="grid min-w-0 grid-cols-7 border-b border-[#e1e1dd] bg-[#f7f7f4] text-[16px] text-[#6f747a]">
            {weekdayColumns.map((day, index) => (
              <div key={day.key} className={cn("flex h-[36px] items-center justify-center border-[#e1e1dd]", index < weekdayColumns.length - 1 && "border-r")}>
                {day.label}
              </div>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-7 border-l border-[#e1e1dd]">
            {weeks.flatMap((week) =>
              week.map((day) => (
                <MonthlyDayCell
                  key={day.date}
                  day={day}
                  staff={staff}
                  requests={requests}
                  overrides={overrides}
                  onOpenScheduleEditor={onOpenScheduleEditor}
                />
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyDayCell({
  day,
  staff,
  requests,
  overrides,
  onOpenScheduleEditor,
}: {
  day: MonthDay;
  staff: StaffMember[];
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  const workingCells = staff
    .map((staffMember, staffIndex) => ({
      staffMember,
      staffIndex,
      cell: applyScheduleToCell(staffMember, day.key, day.date, requests, overrides),
    }))
    .filter(({ cell }) => day.isCurrentMonth && cell.status === "work");
  return (
    <div
      className={cn(
        "flex h-[154px] min-w-0 flex-col border-b border-r border-[#e1e1dd] bg-white px-[12px] py-[11px]",
        !day.isCurrentMonth && "bg-[#fafafa] text-[#9a9a94]",
      )}
    >
      <div className="mb-[8px] flex h-6 shrink-0 items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 text-[17px] font-normal",
            day.isToday ? "bg-[#30312f] text-white" : day.isCurrentMonth ? "text-[#202124]" : "text-[#9a9a94]",
          )}
        >
          {day.dayNumber}
        </span>
        {day.isToday ? <span className="text-[16px] text-[#6f747a]">오늘</span> : null}
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-[3px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {workingCells.map(({ staffMember, staffIndex, cell }) => {
          const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
          return (
            <button
              key={`${day.date}-${staffMember.id}`}
              type="button"
              onClick={() => onOpenScheduleEditor(staffMember, day)}
              className={cn(
                "pm-wrap-indicator flex h-[22px] w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-[7px] border bg-white px-[7px] text-left text-[12px] leading-none transition hover:bg-[#f7f7f4]",
                getWrapIndicatorClass(getCellIndicatorTone(cell.status)),
              )}
              style={
                {
                  borderColor: staffTone.border,
                  "--pm-wrap-indicator-color": staffTone.border,
                } as CSSProperties
              }
            >
              <span className="inline-flex min-w-0 items-center truncate font-normal leading-none" style={{ color: staffTone.text }}>
                {staffMember.name}
              </span>
              <span className="inline-flex shrink-0 items-center font-normal leading-none tabular-nums text-[#6f747a]">{cell.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
