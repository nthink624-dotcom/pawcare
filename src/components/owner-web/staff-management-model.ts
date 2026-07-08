import { currentDateInTimeZone } from "@/lib/utils";
import type { OwnerWebStaffMember, OwnerWebWeekdayKey } from "@/components/owner-web/owner-web-staff-data";
import type { StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import type { StaffScheduleOverride as BootstrapStaffScheduleOverride } from "@/types/domain";

export type StaffStatus = "work" | "off" | "annual" | "half" | "pending";
export type LeaveType = "휴무" | "연차" | "반차";
export type LeaveStatus = "승인대기" | "승인" | "거절";
export type StaffBoardTab = "schedule" | "monthly" | "list";
export type WeekdayKey = OwnerWebWeekdayKey;
export type StaffMember = OwnerWebStaffMember;

export type StaffScheduleCell = {
  status: StaffStatus;
  label: string;
  requestId?: string;
};

export type LeaveRequest = {
  id: string;
  staffId: string;
  date: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  period?: "오전" | "오후";
};

export type ScheduleOverrideStatus = "work" | "off" | "annual" | "half";

export type ScheduleOverride = {
  id: string;
  staffId: string;
  date: string;
  status: ScheduleOverrideStatus;
  startTime: string;
  endTime: string;
  period?: "오전" | "오후";
  reason?: string;
};

export type ScheduleEditDraft = {
  staffId: string;
  staffName: string;
  date: string;
  dayLabel: string;
  status: ScheduleOverrideStatus;
  startTime: string;
  endTime: string;
  period: "오전" | "오후";
  reason: string;
  defaultDaysText: string;
  defaultStartTime: string;
  defaultEndTime: string;
};

export type StaffDraft = {
  name: string;
  displayName: string;
  profileImageUrl: string;
  profileMessage: string;
  chipColorIndex: number | null;
  phone: string;
  role: string;
  titlePrefix: string;
  position: string;
  defaultDaysText: string;
  startTime: string;
  endTime: string;
  regularOff: string;
  annualRemain: string;
};

export const emptyStaffDraft: StaffDraft = {
  name: "",
  displayName: "",
  profileImageUrl: "",
  profileMessage: "",
  chipColorIndex: null,
  phone: "",
  role: "",
  titlePrefix: "",
  position: "",
  defaultDaysText: "",
  startTime: "10:00",
  endTime: "19:00",
  regularOff: "",
  annualRemain: "0",
};

export const weekdayColumns: Array<{ key: WeekdayKey; label: string }> = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

export const monthlyWeekdayColumns: Array<{ key: WeekdayKey; label: string }> = [
  { key: "sun", label: "일" },
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
];

export const timeSelectOptions = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  const value = `${hour}:${minute}`;
  return { value, label: value };
});

export const initialRequests: LeaveRequest[] = [
  { id: "leave-1", staffId: "staff-2", date: "2026-05-22", type: "연차", reason: "개인 일정", status: "승인대기" },
  { id: "leave-2", staffId: "staff-3", date: "2026-05-24", type: "반차", period: "오전", reason: "병원 방문", status: "승인대기" },
  { id: "leave-3", staffId: "staff-4", date: "2026-05-21", type: "휴무", reason: "가족 일정", status: "승인" },
];

const dayNameToKey: Record<string, WeekdayKey> = {
  월: "mon",
  화: "tue",
  수: "wed",
  목: "thu",
  금: "fri",
  토: "sat",
  일: "sun",
};

export function scheduleOverrideFromBootstrap(row: BootstrapStaffScheduleOverride): ScheduleOverride {
  return {
    id: row.id,
    staffId: row.staff_id,
    date: row.work_date,
    status: row.status,
    startTime: row.start_time ?? "10:00",
    endTime: row.end_time ?? "19:00",
    period: row.period ?? undefined,
    reason: row.reason ?? undefined,
  };
}

export function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number) {
  const nextDate = parseDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateKey(nextDate);
}

export function getWeekStart(date = currentDateInTimeZone()) {
  const parsed = parseDate(date);
  const offset = parsed.getDay() === 0 ? -6 : 1 - parsed.getDay();
  parsed.setDate(parsed.getDate() + offset);
  return formatDateKey(parsed);
}

export function getWeekDates(weekStart: string) {
  return weekdayColumns.map((day, index) => ({ ...day, date: addDays(weekStart, index) }));
}

export function getMonthStart(date = currentDateInTimeZone()) {
  const parsed = parseDate(date);
  parsed.setDate(1);
  return formatDateKey(parsed);
}

export function formatMonthShift(date: string, months: number) {
  const parsed = parseDate(date);
  parsed.setMonth(parsed.getMonth() + months, 1);
  return formatDateKey(parsed);
}

export function formatMonthLabel(monthStart: string) {
  const parsed = parseDate(monthStart);
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

export function getMonthCalendarDates(monthStart: string) {
  const firstDate = parseDate(monthStart);
  const firstDayOffset = firstDate.getDay();
  const gridStart = addDays(monthStart, -firstDayOffset);
  const currentMonth = firstDate.getMonth();
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
  const cellCount = Math.max(35, Math.ceil((firstDayOffset + daysInMonth) / 7) * 7);

  return Array.from({ length: cellCount }, (_, index) => {
    const date = addDays(gridStart, index);
    const parsed = parseDate(date);
    const weekday = monthlyWeekdayColumns[parsed.getDay()];

    return {
      key: weekday.key,
      label: weekday.label,
      date,
      dayNumber: parsed.getDate(),
      isCurrentMonth: parsed.getMonth() === currentMonth,
      isToday: date === currentDateInTimeZone(),
    };
  });
}

export function formatShortDate(date: string) {
  const parsed = parseDate(date);
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

export function formatWeekLabel(weekStart: string) {
  return `${formatShortDate(weekStart)} - ${formatShortDate(addDays(weekStart, 6))}`;
}

export function defaultScheduleFor(staff: StaffMember, dayKey: WeekdayKey): StaffScheduleCell {
  if (!staff.defaultDays.includes(dayKey)) return { status: "off", label: "휴무" };
  return { status: "work", label: `${staff.startTime}-${staff.endTime}` };
}

export function applyRequestsToSchedule(staff: StaffMember, dayKey: WeekdayKey, date: string, requests: LeaveRequest[]): StaffScheduleCell {
  const request = requests.find((item) => item.staffId === staff.id && item.date === date && item.status !== "거절");
  if (!request) return defaultScheduleFor(staff, dayKey);
  if (request.status === "승인대기") return { status: "pending", label: `${request.type} 대기`, requestId: request.id };
  if (request.type === "반차") return { status: "half", label: `${request.period ?? "오전"} 반차`, requestId: request.id };
  return { status: request.type === "연차" ? "annual" : "off", label: request.type, requestId: request.id };
}

export function applyScheduleToCell(
  staff: StaffMember,
  dayKey: WeekdayKey,
  date: string,
  requests: LeaveRequest[],
  overrides: ScheduleOverride[],
): StaffScheduleCell {
  const override = overrides.find((item) => item.staffId === staff.id && item.date === date);
  if (override) {
    if (override.status === "work") return { status: "work", label: `${override.startTime}-${override.endTime}` };
    if (override.status === "half") return { status: "half", label: `${override.period ?? "오전"} 반차` };
    if (override.status === "annual") return { status: "annual", label: "연차" };
    return { status: "off", label: "휴무" };
  }
  return applyRequestsToSchedule(staff, dayKey, date, requests);
}

export function getTodayKey() {
  const day = parseDate(currentDateInTimeZone()).getDay();
  return weekdayColumns[day === 0 ? 6 : day - 1].key;
}

export function getStaffAvailability(staff: StaffMember, requests: LeaveRequest[], overrides: ScheduleOverride[]) {
  const today = currentDateInTimeZone();
  const cell = applyScheduleToCell(staff, getTodayKey(), today, requests, overrides);
  if (cell.status === "work") return "근무 가능";
  if (cell.status === "pending") return "휴무/연차 승인대기";
  return cell.label;
}

export function getWeeklyWorkDays(staff: StaffMember, weekStart: string, requests: LeaveRequest[], overrides: ScheduleOverride[]) {
  return getWeekDates(weekStart).filter((day) => applyScheduleToCell(staff, day.key, day.date, requests, overrides).status === "work").length;
}

export function getScheduledLeaveCount(staff: StaffMember, requests: LeaveRequest[]) {
  return requests.filter((request) => request.staffId === staff.id && request.status !== "거절").length;
}

export function getAnnualLeaveUsage(staff: StaffMember, requests: LeaveRequest[]) {
  const used = requests
    .filter((request) => request.staffId === staff.id && request.status === "승인")
    .reduce((sum, request) => {
      if (request.type === "연차") return sum + 1;
      if (request.type === "반차") return sum + 0.5;
      return sum;
    }, 0);
  const granted = Number(staff.annualRemain) || 0;
  return { granted, used, remaining: Math.max(granted - used, 0) };
}

export function getCellTone(status: StaffStatus) {
  if (status === "pending") return "border-dashed border-[#d8dee6] bg-white text-[#111827] hover:bg-[#f8fafc]";
  return "border-[#d8dee6] bg-white text-[#111827] hover:bg-[#f8fafc]";
}

export function getCellIndicatorTone(status: StaffStatus): StatusIndicatorTone {
  if (status === "work") return "teal";
  if (status === "annual") return "amber";
  if (status === "half") return "amber";
  if (status === "pending") return "amber";
  return "burgundy";
}

export function getRequestTone(status: LeaveStatus) {
  if (status === "승인") return "bg-[#e6f3ef] text-[#1f6b5b]";
  if (status === "거절") return "bg-[#f3f4f6] text-[#64748b]";
  return "bg-[#fff1b8] text-[#8a5a00]";
}

export function buildDraft(staff: StaffMember): StaffDraft {
  return {
    name: staff.name,
    displayName: staff.displayName ?? "",
    profileImageUrl: staff.profileImageUrl ?? "",
    profileMessage: staff.profileMessage ?? "",
    chipColorIndex: staff.chipColorIndex ?? null,
    phone: staff.phone,
    role: staff.role,
    titlePrefix: staff.titlePrefix ?? "",
    position: staff.position ?? getStaffRank(staff.role),
    defaultDaysText: formatFixedOffDays(staff.defaultDays),
    startTime: staff.startTime,
    endTime: staff.endTime,
    regularOff: staff.regularOff,
    annualRemain: String(staff.annualRemain),
  };
}

export function getStaffRank(role: string) {
  return role.split(/[/.|]/)[0]?.trim() || role.trim();
}

export function parseWeekdayText(text: string) {
  return text
    .split(/[,/ ]+/)
    .map((item) => dayNameToKey[item.trim()])
    .filter((key): key is WeekdayKey => Boolean(key));
}

export function formatWeekdayKeys(keys: WeekdayKey[]) {
  return weekdayColumns
    .filter((day) => keys.includes(day.key))
    .map((day) => day.label)
    .join(", ");
}

export function getFixedOffDayKeys(defaultDays: WeekdayKey[]) {
  const workDays = new Set(defaultDays);
  return weekdayColumns.map((day) => day.key).filter((key) => !workDays.has(key));
}

export function formatFixedOffDays(defaultDays: WeekdayKey[]) {
  return formatWeekdayKeys(getFixedOffDayKeys(defaultDays));
}

export function parseDefaultDaysFromFixedOffText(text: string) {
  const offDays = new Set(parseWeekdayText(text));
  return weekdayColumns.map((day) => day.key).filter((key) => !offDays.has(key));
}
