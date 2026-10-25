import { useState, type CSSProperties, type KeyboardEvent } from "react";

import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
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
      <div className="flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:hidden">
          <div className="space-y-2">
            {monthDates.filter((day) => day.isCurrentMonth).map((day) => {
              const workingCells = buildDailyCells(staff, day, requests, overrides).filter(({ cell }) => cell.status === "work");
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-[12px] border border-[#e8edf3] bg-white px-3 py-2 text-left transition hover:bg-[#f8fafc]"
                >
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[16px] font-semibold", day.isToday ? "bg-[#15213b] text-white" : "bg-[#f1f4f8] text-[#334155]")}>{day.dayNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium leading-5 text-[#15213b]">{day.label}요일 · {workingCells.length}명 근무</span>
                    <span className="mt-0.5 block truncate text-[14px] leading-5 text-[#64748b]">
                      {workingCells.slice(0, 2).map(({ staffMember, cell }) => `${staffMember.name} ${cell.label}`).join(" · ") || "근무 일정 없음"}
                      {workingCells.length > 2 ? ` 외 ${workingCells.length - 2}명` : ""}
                    </span>
                  </span>
                  {day.isToday && <span className="shrink-0 rounded-full bg-[#eef3fb] px-2.5 py-1 text-[12px] font-medium text-[#334155]">오늘</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="hidden min-h-0 max-w-full flex-1 overflow-x-auto overflow-y-hidden p-2 sm:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex h-full w-full min-w-[1120px] flex-col gap-1.5">
            <div className="grid min-w-0 shrink-0 grid-cols-7 gap-1.5 text-[15px] font-medium leading-5 tracking-[-0.005em] text-[#64748b]">
              {monthlyWeekdayColumns.map((day, index) => (
                <div key={day.key} className={cn("flex h-8 items-center justify-center rounded-[9px] bg-[#f5f7fa]", index === 0 && "text-[#8a5a52]", index === 6 && "text-[#41668b]")}>
                  {day.label}
                </div>
              ))}
            </div>
            <div
              className="grid min-h-0 min-w-0 flex-1 grid-cols-7 gap-2"
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
                    maxVisibleStaff={weekCount >= 6 ? 3 : 4}
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
  maxVisibleStaff,
  onOpenDateDetail,
  onOpenScheduleEditor,
}: {
  day: MonthDay;
  staff: StaffMember[];
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  maxVisibleStaff: number;
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
        "flex min-h-0 min-w-0 flex-col rounded-[11px] border border-[#e8edf3] bg-white px-2 py-1.5 outline-none transition",
        day.isCurrentMonth && "cursor-pointer hover:border-[#cbd5e1] hover:bg-[#fbfcfd] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#94a3b8]/35",
        !day.isCurrentMonth && "border-transparent bg-transparent text-[#9a9a94]",
      )}
    >
      <div className="mb-0.5 flex h-5 shrink-0 items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[18px] font-semibold leading-5",
            day.isToday ? "bg-[#15213b] text-white" : day.isCurrentMonth ? "text-[#15213b]" : "text-[#9a9a94]",
          )}
        >
          {day.dayNumber}
        </span>
        <span className="flex items-center gap-1.5">
          {workingCells.length > 0 ? (
            <span className="rounded-full bg-[#f1f4f8] px-1.5 py-0.5 text-[12px] font-medium leading-4 text-[#64748b]">
              {workingCells.length}명
            </span>
          ) : null}
          {day.isToday ? <span className="text-[12px] font-medium leading-[18px] text-[#64748b]">오늘</span> : null}
        </span>
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-px overflow-hidden">
        {workingCells.slice(0, maxVisibleStaff).map(({ staffMember, cell }) => {
          const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex);
          return (
            <button
              key={`${day.date}-${staffMember.id}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenScheduleEditor(staffMember, day);
              }}
              className={cn(
                "flex h-[18px] w-full min-w-0 items-center gap-1 overflow-hidden rounded-[5px] border-l-[2px] px-1.5 text-left text-[13px] font-medium leading-[18px] transition hover:bg-[#f1f4f8]",
              )}
              style={{ borderLeftColor: staffTone.selectedBackground, backgroundColor: `${staffTone.selectedBackground}12` } as CSSProperties}
            >
              <span className="inline-flex min-w-0 flex-1 items-center truncate text-[14px] font-medium leading-[18px]" style={{ color: staffTone.text }}>
                {staffMember.name}
              </span>
              <span className="inline-flex shrink-0 items-center text-[14px] font-medium leading-[18px] tabular-nums tracking-[-0.025em] text-[#586579]">{cell.label}</span>
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
          <p className="text-[13px] font-normal leading-5 text-[#64748b]">근무</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">{workingCount}명</p>
        </div>
        <div className="rounded-[10px] border border-[#dbe2ea] bg-[#f8fafc] px-3 py-2">
          <p className="text-[13px] font-normal leading-5 text-[#64748b]">휴무/연차</p>
          <p className="mt-0.5 text-[18px] font-semibold leading-[26px] tracking-[-0.01em] text-[#111827]">{leaveCount}명</p>
        </div>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {dailyCells.map(({ staffMember, cell }) => (
          <MonthlyDayDetailRow
            key={staffMember.id}
            staffMember={staffMember}
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
  cell,
  onClick,
}: {
  staffMember: StaffMember;
  cell: StaffScheduleCell;
  onClick: () => void;
}) {
  const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex);
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
          <span className="block truncate text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#111827]" style={{ color: staffTone.text }}>
            {staffMember.name}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-normal leading-5 text-[#64748b]">{staffMember.position || staffMember.role || "직원"}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[12px] font-medium leading-[18px] text-[#334155]">{formatDailyCellStatus(cell)}</span>
    </button>
  );
}

function formatDailyCellStatus(cell: StaffScheduleCell) {
  if (cell.status === "work") return cell.label;
  if (cell.status === "half") return cell.label.includes("반차") ? cell.label : `반차 · ${cell.label}`;
  return cell.label;
}
