import { useState, type CSSProperties, type KeyboardEvent } from "react";

import { getDotIndicatorClass, getWrapIndicatorClass } from "@/components/owner-web/status-indicators";
import {
  applyScheduleToCell,
  formatShortDate,
  getCellIndicatorTone,
  getMonthCalendarDates,
  monthlyWeekdayColumns,
  type StaffScheduleCell,
  type LeaveRequest,
  type ScheduleOverride,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";
import { StaffModal } from "@/components/owner-web/staff-management-ui";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";

type MonthDay = ReturnType<typeof getMonthCalendarDates>[number];

export function StaffMonthlySchedule({
  staff,
  monthStart,
  requests,
  overrides,
  onOpenScheduleEditor,
}: {
  staff: StaffMember[];
  monthStart: string;
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<MonthDay | null>(null);
  const monthDates = getMonthCalendarDates(monthStart);
  const weekCount = Math.ceil(monthDates.length / 7);
  const weeks = Array.from({ length: weekCount }, (_, index) => monthDates.slice(index * 7, index * 7 + 7));

  return (
    <>
      <div className="flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-white pt-1">
        <div className="min-h-0 max-w-full flex-1 overflow-hidden">
          <div className="flex h-full w-full min-w-[980px] flex-col">
            <div className="grid min-w-0 shrink-0 grid-cols-7 border-y border-[#e1e1dd] bg-[#f7f7f4] text-[14px] leading-none text-[#6f747a]">
              {monthlyWeekdayColumns.map((day, index) => (
                <div key={day.key} className={cn("flex h-[34px] items-center justify-center border-[#e1e1dd] pt-px", index < monthlyWeekdayColumns.length - 1 && "border-r")}>
                  {day.label}
                </div>
              ))}
            </div>
            <div
              className="grid min-h-0 flex-1 min-w-0 grid-cols-7 border-l border-[#e1e1dd]"
              style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
            >
              {weeks.flatMap((week) =>
                week.map((day) => (
                  <MonthlyDayCell
                    key={day.date}
                    day={day}
                    staff={staff}
                    requests={requests}
                    overrides={overrides}
                    onOpenDateDetail={setSelectedDay}
                    onOpenScheduleEditor={onOpenScheduleEditor}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedDay ? (
        <MonthlyDayDetailModal
          day={selectedDay}
          staff={staff}
          requests={requests}
          overrides={overrides}
          onClose={() => setSelectedDay(null)}
          onOpenScheduleEditor={(staffMember, day) => {
            setSelectedDay(null);
            onOpenScheduleEditor(staffMember, day);
          }}
        />
      ) : null}
    </>
  );
}

function buildDailyCells(staff: StaffMember[], day: MonthDay, requests: LeaveRequest[], overrides: ScheduleOverride[]) {
  return staff.map((staffMember, staffIndex) => ({
    staffMember,
    staffIndex,
    cell: applyScheduleToCell(staffMember, day.key, day.date, requests, overrides),
  }));
}

function MonthlyDayCell({
  day,
  staff,
  requests,
  overrides,
  onOpenDateDetail,
  onOpenScheduleEditor,
}: {
  day: MonthDay;
  staff: StaffMember[];
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onOpenDateDetail: (day: MonthDay) => void;
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  const workingCells = buildDailyCells(staff, day, requests, overrides).filter(({ cell }) => day.isCurrentMonth && cell.status === "work");
  const openDateDetail = () => {
    if (day.isCurrentMonth) onOpenDateDetail(day);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!day.isCurrentMonth) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDateDetail(day);
    }
  };

  return (
    <div
      role={day.isCurrentMonth ? "button" : undefined}
      tabIndex={day.isCurrentMonth ? 0 : undefined}
      onClick={openDateDetail}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex min-h-0 min-w-0 flex-col border-b border-r border-[#e1e1dd] bg-white px-[8px] py-[6px] outline-none transition",
        day.isCurrentMonth && "cursor-pointer hover:bg-[#fbfcfd] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#94a3b8]/25",
        !day.isCurrentMonth && "bg-[#fafafa] text-[#9a9a94]",
      )}
    >
      <div className="mb-[3px] flex h-5 shrink-0 items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-[7px] px-1.5 text-[15px] font-normal",
            day.isToday ? "bg-[#30312f] text-white" : day.isCurrentMonth ? "text-[#202124]" : "text-[#9a9a94]",
          )}
        >
          {day.dayNumber}
        </span>
        {day.isToday ? <span className="text-[12px] text-[#6f747a]">오늘</span> : null}
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-[2px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {workingCells.map(({ staffMember, staffIndex, cell }) => {
          const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
          return (
            <button
              key={`${day.date}-${staffMember.id}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenScheduleEditor(staffMember, day);
              }}
              className={cn(
                "pm-wrap-indicator flex h-[18px] w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-[6px] border bg-white px-[6px] text-left text-[11px] leading-none transition hover:bg-[#f7f7f4]",
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

function MonthlyDayDetailModal({
  day,
  staff,
  requests,
  overrides,
  onClose,
  onOpenScheduleEditor,
}: {
  day: MonthDay;
  staff: StaffMember[];
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onClose: () => void;
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  const dailyCells = buildDailyCells(staff, day, requests, overrides);
  const workingCount = dailyCells.filter(({ cell }) => cell.status === "work").length;
  const leaveCount = dailyCells.filter(({ cell }) => cell.status !== "work").length;

  return (
    <StaffModal title={`${formatShortDate(day.date)} ${day.label}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2">
          <p className="text-[13px] text-[#64748b]">근무</p>
          <p className="mt-0.5 text-[18px] font-semibold text-[#111827]">{workingCount}명</p>
        </div>
        <div className="rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2">
          <p className="text-[13px] text-[#64748b]">휴무/연차</p>
          <p className="mt-0.5 text-[18px] font-semibold text-[#111827]">{leaveCount}명</p>
        </div>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {dailyCells.map(({ staffMember, staffIndex, cell }) => (
          <MonthlyDayDetailRow
            key={staffMember.id}
            staffMember={staffMember}
            staffIndex={staffIndex}
            cell={cell}
            onClick={() => onOpenScheduleEditor(staffMember, day)}
          />
        ))}
      </div>
    </StaffModal>
  );
}

function MonthlyDayDetailRow({
  staffMember,
  staffIndex,
  cell,
  onClick,
}: {
  staffMember: StaffMember;
  staffIndex: number;
  cell: StaffScheduleCell;
  onClick: () => void;
}) {
  const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
  const tone = getCellIndicatorTone(cell.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-[#dbe2ea] bg-white px-3 py-2.5 text-left transition hover:bg-[#f8fafc]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={getDotIndicatorClass(tone)} />
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-medium text-[#111827]" style={{ color: staffTone.text }}>
            {staffMember.name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-[#64748b]">{staffMember.position || staffMember.role || "직원"}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[14px] text-[#334155]">{formatDailyCellStatus(cell)}</span>
    </button>
  );
}

function formatDailyCellStatus(cell: StaffScheduleCell) {
  if (cell.status === "work") return cell.label;
  if (cell.status === "half") return cell.label.includes("반차") ? cell.label : `반차 · ${cell.label}`;
  return cell.label;
}
