import { ChevronLeft, ChevronRight } from "lucide-react";

import { getWrapIndicatorClass } from "@/components/owner-web/status-indicators";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";
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
    <div className="max-w-full overflow-hidden bg-white">
      <div className="relative flex h-[96px] items-center justify-center bg-gradient-to-b from-[#2f7866] to-[#1f6b5b] px-16 text-white">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="absolute left-5 inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/25 bg-white/10 text-white transition hover:bg-white/15"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={onCurrentMonth} className="text-[44px] font-normal leading-none tracking-[0]">
          {compactMonthLabel}
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          className="absolute right-5 inline-flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/25 bg-white/10 text-white transition hover:bg-white/15"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="max-w-full overflow-hidden">
        <div className="w-full min-w-0">
          <div className="grid min-w-0 grid-cols-7 border-b border-t border-[#dbe2ea] bg-[#f8fafc] text-[16px] text-[#475569]">
            {weekdayColumns.map((day, index) => (
              <div key={day.key} className={cn("flex h-[40px] items-center justify-center border-[#e2e8f0]", index < weekdayColumns.length - 1 && "border-r")}>
                {day.label}
              </div>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-7 border-l border-[#dbe2ea]">
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
        "min-w-0 h-[150px] border-b border-r border-[#dbe2ea] bg-white px-[12px] py-[12px]",
        !day.isCurrentMonth && "bg-[#fafafa] text-[#94a3b8]",
      )}
    >
      <div className="mb-[9px] flex h-6 items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2 text-[17px] font-normal",
            day.isToday ? "bg-[#2f7866] text-white" : day.isCurrentMonth ? "text-[#111827]" : "text-[#94a3b8]",
          )}
        >
          {day.dayNumber}
        </span>
        {day.isToday ? <span className="text-[16px] text-[#2f7866]">{"\uC624\uB298"}</span> : null}
      </div>
      <div className="max-h-[104px] min-w-0 space-y-[4px] overflow-y-auto pr-0.5">
        {workingCells.map(({ staffMember, staffIndex, cell }) => {
          const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
          return (
            <button
              key={`${day.date}-${staffMember.id}`}
              type="button"
              onClick={() => onOpenScheduleEditor(staffMember, day)}
              className={cn(
                "pm-wrap-indicator flex h-[23px] w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-[7px] border bg-white px-[7px] text-left text-[12px] leading-none transition hover:bg-[#f8fafc]",
                getWrapIndicatorClass(getCellIndicatorTone(cell.status)),
              )}
              style={
                {
                  borderColor: staffTone.border,
                  "--pm-wrap-indicator-color": staffTone.border,
                } as any
              }
            >
              <span className="min-w-0 flex-1 truncate font-normal" style={{ color: staffTone.text }}>
                {staffMember.name}
              </span>
              <span className="shrink-0 font-normal tabular-nums text-[#64748b]">{cell.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
