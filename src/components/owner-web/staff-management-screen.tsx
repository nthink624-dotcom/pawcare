"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  defaultOwnerWebStaff,
  type OwnerWebStaffMember,
  type OwnerWebWeekdayKey,
} from "@/components/owner-web/owner-web-staff-data";
import { GhostButton, PrimaryButton, SoftSelect, WebSurface } from "@/components/owner-web/owner-web-ui";
import { cn, currentDateInTimeZone } from "@/lib/utils";

type StaffStatus = "work" | "off" | "annual" | "half" | "pending";
type LeaveType = "휴무" | "연차" | "반차";
type LeaveStatus = "승인대기" | "승인" | "거절";
type StaffBoardTab = "list" | "schedule";
type WeekdayKey = OwnerWebWeekdayKey;
type StaffMember = OwnerWebStaffMember;

type StaffScheduleCell = {
  status: StaffStatus;
  label: string;
  requestId?: string;
};

type LeaveRequest = {
  id: string;
  staffId: string;
  date: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  period?: "오전" | "오후";
};

type ScheduleOverrideStatus = "work" | "off" | "annual" | "half";

type ScheduleOverride = {
  id: string;
  staffId: string;
  date: string;
  status: ScheduleOverrideStatus;
  startTime: string;
  endTime: string;
  period?: "오전" | "오후";
  reason?: string;
};

type ScheduleEditDraft = {
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

type StaffDraft = {
  name: string;
  phone: string;
  role: string;
  defaultDaysText: string;
  startTime: string;
  endTime: string;
  regularOff: string;
  annualRemain: string;
};

const weekdayColumns: Array<{ key: WeekdayKey; label: string }> = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
];

const timeSelectOptions = Array.from({ length: 29 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  const value = `${hour}:${minute}`;
  return { value, label: value };
});

const initialRequests: LeaveRequest[] = [
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

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const nextDate = parseDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateKey(nextDate);
}

function getWeekStart(date = currentDateInTimeZone()) {
  const parsed = parseDate(date);
  const offset = parsed.getDay() === 0 ? -6 : 1 - parsed.getDay();
  parsed.setDate(parsed.getDate() + offset);
  return formatDateKey(parsed);
}

function getWeekDates(weekStart: string) {
  return weekdayColumns.map((day, index) => ({ ...day, date: addDays(weekStart, index) }));
}

function formatShortDate(date: string) {
  const parsed = parseDate(date);
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

function formatWeekLabel(weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
}

function defaultScheduleFor(staff: StaffMember, dayKey: WeekdayKey): StaffScheduleCell {
  if (!staff.defaultDays.includes(dayKey)) return { status: "off", label: "휴무" };
  return { status: "work", label: `${staff.startTime}-${staff.endTime}` };
}

function applyRequestsToSchedule(staff: StaffMember, dayKey: WeekdayKey, date: string, requests: LeaveRequest[]): StaffScheduleCell {
  const request = requests.find((item) => item.staffId === staff.id && item.date === date && item.status !== "거절");
  if (!request) return defaultScheduleFor(staff, dayKey);

  if (request.status === "승인대기") {
    return { status: "pending", label: `${request.type} 대기`, requestId: request.id };
  }

  if (request.type === "반차") {
    return { status: "half", label: `${request.period ?? "오전"} 반차`, requestId: request.id };
  }

  return { status: request.type === "연차" ? "annual" : "off", label: request.type, requestId: request.id };
}

function applyScheduleToCell(staff: StaffMember, dayKey: WeekdayKey, date: string, requests: LeaveRequest[], overrides: ScheduleOverride[]): StaffScheduleCell {
  const override = overrides.find((item) => item.staffId === staff.id && item.date === date);
  if (override) {
    if (override.status === "work") return { status: "work", label: `${override.startTime}-${override.endTime}` };
    if (override.status === "half") return { status: "half", label: `${override.period ?? "오전"} 반차` };
    if (override.status === "annual") return { status: "annual", label: "연차" };
    return { status: "off", label: "휴무" };
  }

  return applyRequestsToSchedule(staff, dayKey, date, requests);
}

function getTodayKey() {
  const day = parseDate(currentDateInTimeZone()).getDay();
  return weekdayColumns[day === 0 ? 6 : day - 1].key;
}

function getStaffAvailability(staff: StaffMember, requests: LeaveRequest[], overrides: ScheduleOverride[]) {
  const today = currentDateInTimeZone();
  const todayKey = getTodayKey();
  const cell = applyScheduleToCell(staff, todayKey, today, requests, overrides);
  if (cell.status === "work") return "근무 가능";
  if (cell.status === "pending") return "휴무/연차 승인대기";
  return cell.label;
}

function getWeeklyWorkDays(staff: StaffMember, weekStart: string, requests: LeaveRequest[], overrides: ScheduleOverride[]) {
  return getWeekDates(weekStart).filter((day) => applyScheduleToCell(staff, day.key, day.date, requests, overrides).status === "work").length;
}

function getScheduledLeaveCount(staff: StaffMember, requests: LeaveRequest[]) {
  return requests.filter((request) => request.staffId === staff.id && request.status !== "거절").length;
}

function getAnnualLeaveUsage(staff: StaffMember, requests: LeaveRequest[]) {
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

function getCellTone(status: StaffStatus) {
  if (status === "pending") return "border-dashed border-[#d8dee6] bg-white text-[#1f2937]";
  return "border-[#d8dee6] bg-white text-[#1f2937]";
}

function getCellIndicatorTone(status: StaffStatus) {
  if (status === "work") return "bg-[#4f9b88]";
  if (status === "annual") return "bg-[#b47a4f]";
  if (status === "half") return "bg-[#c2993f]";
  if (status === "pending") return "bg-[#c2993f]";
  return "bg-[#8f2438]";
}

function getRequestTone(status: LeaveStatus) {
  if (status === "승인") return "bg-[#e6f3ef] text-[#1f6b5b]";
  if (status === "거절") return "bg-[#f3f4f6] text-[#64748b]";
  return "bg-[#fff1b8] text-[#8a5a00]";
}

function buildDraft(staff: StaffMember): StaffDraft {
  return {
    name: staff.name,
    phone: staff.phone,
    role: staff.role,
    defaultDaysText: staff.defaultDays.map((key) => weekdayColumns.find((day) => day.key === key)?.label).filter(Boolean).join(", "),
    startTime: staff.startTime,
    endTime: staff.endTime,
    regularOff: staff.regularOff,
    annualRemain: String(staff.annualRemain),
  };
}

function getStaffRank(role: string) {
  return role.split(/[\/·|]/)[0]?.trim() || role.trim();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-normal text-[#334155]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({ value, onChange, type = "text", placeholder }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none focus:border-[#2f7866] focus:bg-white"
    />
  );
}

function parseWeekdayText(text: string) {
  return text
    .split(/[,/ ]+/)
    .map((item) => dayNameToKey[item.trim()])
    .filter((key): key is WeekdayKey => Boolean(key));
}

function formatWeekdayKeys(keys: WeekdayKey[]) {
  return weekdayColumns
    .filter((day) => keys.includes(day.key))
    .map((day) => day.label)
    .join(", ");
}

function WeekdayColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedKeys = new Set(parseWeekdayText(value));

  function toggleDay(key: WeekdayKey) {
    const nextKeys = new Set(selectedKeys);
    if (nextKeys.has(key)) {
      nextKeys.delete(key);
    } else {
      nextKeys.add(key);
    }
    onChange(formatWeekdayKeys(Array.from(nextKeys)));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {weekdayColumns.map((day) => {
          const selected = selectedKeys.has(day.key);
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => toggleDay(day.key)}
              className={cn(
                "h-10 rounded-[8px] border text-[13px] font-semibold transition focus:outline-none focus:ring-[3px] focus:ring-[#1f6b5b]/12",
                selected
                  ? "border-[#9ccabe] bg-[#f3faf7] text-[#1f6b5b]"
                  : "border-[#d5dde6] bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9]",
              )}
              aria-pressed={selected}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-[12px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-[#145b4b]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#9ccabe]" />
          근무
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#64748b]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d5dde6]" />
          휴무
        </span>
      </div>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
  className,
  buttonClassName,
  align = "right",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}) {
  const options = timeSelectOptions.some((option) => option.value === value)
    ? timeSelectOptions
    : [{ value, label: value }, ...timeSelectOptions];

  return (
    <SoftSelect
      value={value}
      onChange={onChange}
      options={options}
      align={align}
      className={className}
      buttonClassName={cn("h-9 bg-[#f8fafc] px-2", buttonClassName)}
      menuClassName="max-h-[180px] overflow-y-auto overscroll-contain"
    />
  );
}

function CompactInput({
  value,
  onChange,
  type = "text",
  placeholder,
  ariaLabel,
  align = "right",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  ariaLabel: string;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(
        "h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-[14px] text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#2f7866] focus:bg-white",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    />
  );
}

function StaffInfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-[#edf2f7] py-2 last:border-b-0">
      <span className="shrink-0 text-[13px] text-[#64748b]">{label}</span>
      <div className="ml-auto flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#edf2f7] bg-[#f8fafc] px-3 py-2">
      <p className="text-[12px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 text-[16px] font-medium text-[#111827]">{value}</p>
    </div>
  );
}

function StaffBoardTabs({ activeTab, onChange }: { activeTab: StaffBoardTab; onChange: (tab: StaffBoardTab) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#dbe2ea] pb-2">
      {[
        { key: "schedule" as StaffBoardTab, label: "주간 근무표" },
        { key: "list" as StaffBoardTab, label: "스태프 목록" },
      ].map((tab, index) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex h-[36px] items-center gap-2 rounded-[8px] border px-3 text-left text-[15px] font-normal transition",
            activeTab === tab.key
              ? "border-[#dbe2ea] bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              : "border-transparent text-[#475569] hover:border-[#e2e8f0] hover:bg-white",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function StaffManagementScreen({
  staffMembers,
  onStaffMembersChange,
}: {
  staffMembers?: StaffMember[];
  onStaffMembersChange?: (staff: StaffMember[]) => void;
}) {
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(defaultOwnerWebStaff);
  const staff = staffMembers ?? localStaff;
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [selectedStaffId, setSelectedStaffId] = useState(defaultOwnerWebStaff[0].id);
  const [boardTab, setBoardTab] = useState<StaffBoardTab>("schedule");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(() => buildDraft(defaultOwnerWebStaff[0]));
  const [newStaffDraft, setNewStaffDraft] = useState<StaffDraft>({
    name: "",
    phone: "",
    role: "",
    defaultDaysText: "월, 화, 수, 목, 금",
    startTime: "10:00",
    endTime: "19:00",
    regularOff: "일",
    annualRemain: "0",
  });
  const [leaveDraft, setLeaveDraft] = useState({ staffId: defaultOwnerWebStaff[0].id, date: currentDateInTimeZone(), type: "휴무" as LeaveType, reason: "" });
  const [scheduleEditDraft, setScheduleEditDraft] = useState<ScheduleEditDraft | null>(null);
  const [defaultScheduleOpen, setDefaultScheduleOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const selectedStaff = staff.find((item) => item.id === selectedStaffId) ?? staff[0];
  const pendingCount = requests.filter((request) => request.status === "승인대기").length;

  useEffect(() => {
    if (!selectedStaff) return;
    if (selectedStaff.id !== selectedStaffId) {
      setSelectedStaffId(selectedStaff.id);
      setDraft(buildDraft(selectedStaff));
    }
  }, [selectedStaff, selectedStaffId]);

  function updateStaffMembers(updater: (current: StaffMember[]) => StaffMember[]) {
    if (onStaffMembersChange) {
      onStaffMembersChange(updater(staff));
      return;
    }
    setLocalStaff(updater);
  }

  function selectStaff(staffMember: StaffMember) {
    setSelectedStaffId(staffMember.id);
    setDraft(buildDraft(staffMember));
  }

  function parseDefaultDays(text: string) {
    return parseWeekdayText(text);
  }

  function saveStaff() {
    if (!selectedStaff) return;
    const nextDays = parseDefaultDays(draft.defaultDaysText);
    updateStaffMembers((current) =>
      current.map((item) =>
        item.id === selectedStaff.id
          ? {
              ...item,
              name: draft.name.trim() || item.name,
              phone: draft.phone.trim(),
              role: draft.role.trim() || item.role,
              defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
              startTime: draft.startTime,
              endTime: draft.endTime,
              regularOff: draft.regularOff.trim() || item.regularOff,
              annualRemain: Number(draft.annualRemain) || 0,
            }
          : item,
      ),
    );
    setNotice("스태프 정보를 저장했습니다.");
  }

  function addStaff() {
    const name = newStaffDraft.name.trim();
    if (!name) {
      setNotice("스태프명을 입력해 주세요.");
      return;
    }

    const nextStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      name,
      phone: newStaffDraft.phone.trim() || "010-0000-0000",
      role: newStaffDraft.role.trim() || "미용사",
      defaultDays: parseDefaultDays(newStaffDraft.defaultDaysText),
      startTime: newStaffDraft.startTime,
      endTime: newStaffDraft.endTime,
      regularOff: newStaffDraft.regularOff || "일",
      annualRemain: Number(newStaffDraft.annualRemain) || 0,
      todayBookings: 0,
      weekBookings: 0,
    };
    updateStaffMembers((current) => [...current, nextStaff]);
    selectStaff(nextStaff);
    setStaffDialogOpen(false);
    setNotice("스태프를 추가했습니다.");
  }

  function addLeaveRequest() {
    const request: LeaveRequest = {
      id: `leave-${Date.now()}`,
      staffId: leaveDraft.staffId,
      date: leaveDraft.date,
      type: leaveDraft.type,
      reason: leaveDraft.reason.trim() || "사유 미입력",
      status: "승인대기",
    };
    setRequests((current) => [request, ...current]);
    setLeaveDialogOpen(false);
    setNotice("휴무/연차 요청을 등록했습니다.");
  }

  function updateRequestStatus(requestId: string, status: LeaveStatus) {
    setRequests((current) => current.map((request) => (request.id === requestId ? { ...request, status } : request)));
    setNotice(`요청을 ${status} 처리했습니다.`);
  }

  function openScheduleEditor(staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) {
    selectStaff(staffMember);
    const override = scheduleOverrides.find((item) => item.staffId === staffMember.id && item.date === day.date);
    const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, scheduleOverrides);
    const status: ScheduleOverrideStatus = override?.status ?? (cell.status === "work" || cell.status === "off" || cell.status === "annual" || cell.status === "half" ? cell.status : "off");

    setScheduleEditDraft({
      staffId: staffMember.id,
      staffName: staffMember.name,
      date: day.date,
      dayLabel: day.label,
      status,
      startTime: override?.startTime ?? staffMember.startTime,
      endTime: override?.endTime ?? staffMember.endTime,
      period: override?.period ?? "오전",
      reason: override?.reason ?? "",
      defaultDaysText: buildDraft(staffMember).defaultDaysText,
      defaultStartTime: staffMember.startTime,
      defaultEndTime: staffMember.endTime,
    });
    setDefaultScheduleOpen(false);
  }

  function saveStaffDefaultScheduleFromDraft() {
    if (!scheduleEditDraft) return;
    const nextDays = parseDefaultDays(scheduleEditDraft.defaultDaysText);

    updateStaffMembers((current) =>
      current.map((item) =>
        item.id === scheduleEditDraft.staffId
          ? {
              ...item,
              defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
              startTime: scheduleEditDraft.defaultStartTime,
              endTime: scheduleEditDraft.defaultEndTime,
            }
          : item,
      ),
    );

    if (selectedStaff?.id === scheduleEditDraft.staffId) {
      setDraft((current) => ({
        ...current,
        defaultDaysText: scheduleEditDraft.defaultDaysText,
        startTime: scheduleEditDraft.defaultStartTime,
        endTime: scheduleEditDraft.defaultEndTime,
      }));
    }

    setNotice(`${scheduleEditDraft.staffName} 기본 근무시간을 저장했습니다.`);
  }

  function saveScheduleOverride() {
    if (!scheduleEditDraft) return;

    const nextOverride: ScheduleOverride = {
      id: `${scheduleEditDraft.staffId}-${scheduleEditDraft.date}`,
      staffId: scheduleEditDraft.staffId,
      date: scheduleEditDraft.date,
      status: scheduleEditDraft.status,
      startTime: scheduleEditDraft.startTime,
      endTime: scheduleEditDraft.endTime,
      period: scheduleEditDraft.status === "half" ? scheduleEditDraft.period : undefined,
      reason: scheduleEditDraft.reason.trim() || undefined,
    };

    setScheduleOverrides((current) => [
      ...current.filter((item) => !(item.staffId === nextOverride.staffId && item.date === nextOverride.date)),
      nextOverride,
    ]);
    setScheduleEditDraft(null);
    setNotice("선택한 날짜의 근무 일정을 저장했습니다.");
  }

  function resetScheduleOverride() {
    if (!scheduleEditDraft) return;
    setScheduleOverrides((current) => current.filter((item) => !(item.staffId === scheduleEditDraft.staffId && item.date === scheduleEditDraft.date)));
    setScheduleEditDraft(null);
    setNotice("선택한 날짜를 기본 근무 설정으로 되돌렸습니다.");
  }

  return (
    <div className="space-y-3">
      <StaffBoardTabs activeTab={boardTab} onChange={setBoardTab} />

      <div className={cn("grid gap-5", boardTab === "list" ? "xl:grid-cols-[minmax(0,1fr)_390px]" : "xl:grid-cols-1")}>
        <div className="min-w-0">
          <WebSurface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf2f7] px-5 py-4">
              <div>
                {boardTab === "list" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-semibold text-[#111827]">스태프 목록</h3>
                      <span className="rounded-full bg-[#eef7f4] px-3 py-1 text-[12px] font-semibold text-[#1f6b5b]">{staff.length}명</span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#64748b]">예약 배정 전 오늘 근무 가능 여부를 확인합니다.</p>
                  </>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]" aria-label="이전 주">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStart(getWeekStart())}
                      className="inline-flex h-8 min-w-[178px] items-center justify-center whitespace-nowrap rounded-[8px] px-2 text-[17px] font-medium text-[#111827] hover:bg-[#f8fafc]"
                    >
                      {formatWeekLabel(weekStart)}
                    </button>
                    <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]" aria-label="다음 주">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {boardTab === "list" ? (
                <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:h-10 [&>button]:min-w-[148px] [&>button]:shrink-0">
                  <PrimaryButton label="스태프 추가/삭제" onClick={() => setStaffDialogOpen(true)} />
                </div>
              ) : null}
            </div>
            {boardTab === "list" ? (
              <div className="max-h-[532px] overflow-y-auto">
                <div className="sticky top-0 z-10 grid grid-cols-[minmax(128px,1.1fr)_minmax(120px,0.9fr)_minmax(150px,1fr)_130px] items-center gap-4 border-b border-[#edf2f7] bg-[#f8fafc] px-5 py-2.5 text-[15px] font-semibold text-[#64748b]">
                  <span>이름</span>
                  <span>직급</span>
                  <span>연락처</span>
                  <span className="text-right">남은 휴가 일수</span>
                </div>
                {staff.map((staffMember) => {
                  const active = selectedStaff?.id === staffMember.id;
                  const annualUsage = getAnnualLeaveUsage(staffMember, requests);

                  return (
                    <button
                      key={staffMember.id}
                      type="button"
                      onClick={() => selectStaff(staffMember)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(128px,1.1fr)_minmax(120px,0.9fr)_minmax(150px,1fr)_130px] items-center gap-4 border-b border-[#edf2f7] px-5 py-3 text-left transition last:border-b-0",
                        active ? "bg-[#f6fbf9]" : "bg-white hover:bg-[#f8fafc]",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[18px] font-normal text-[#111827]">{staffMember.name}</p>
                      </div>
                      <p className="truncate text-[14px] text-[#334155]">{getStaffRank(staffMember.role)}</p>
                      <p className="truncate text-[14px] tabular-nums text-[#475569]">{staffMember.phone}</p>
                      <p className="text-right text-[14px] font-normal text-[#1f6b5b]">{annualUsage.remaining}일</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[150px_repeat(7,minmax(100px,1fr))] border-b border-[#edf2f7] bg-[#f8fafc] px-4 py-3 text-[15px] font-semibold text-[#64748b]">
                    <span>스태프명</span>
                    {weekDates.map((day) => (
                      <span key={day.date} className="text-center">{day.label}</span>
                    ))}
                  </div>
                  <div className="max-h-[532px] overflow-y-auto">
                    {staff.map((staffMember) => (
                      <div key={staffMember.id} className="grid grid-cols-[150px_repeat(7,minmax(100px,1fr))] gap-2 border-b border-[#edf2f7] px-4 py-3 last:border-b-0">
                        <button type="button" onClick={() => selectStaff(staffMember)} className="flex min-w-0 flex-col justify-center text-left">
                          <p className="truncate text-[18px] font-normal text-[#0f172a]">{staffMember.name}</p>
                          <p className="mt-0.5 truncate text-[12px] text-[#64748b]">{staffMember.role}</p>
                        </button>
                        {weekDates.map((day) => {
                          const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, scheduleOverrides);
                          return (
                            <button
                              key={`${staffMember.id}-${day.date}`}
                              type="button"
                              onClick={() => openScheduleEditor(staffMember, day)}
                              className={cn(
                                "relative flex min-h-[48px] items-center justify-center overflow-hidden rounded-[8px] border px-2 pl-3 text-center text-[12px] font-medium transition hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-[3px] focus:ring-[#1f6b5b]/12",
                                getCellTone(cell.status),
                              )}
                            >
                              <span className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-[8px]", getCellIndicatorTone(cell.status))} aria-hidden="true" />
                              <span className="leading-none">{cell.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </WebSurface>
        </div>

        {boardTab === "list" ? (
          <div className="space-y-5 min-w-0">
          {false ? (
            <WebSurface className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#111827]">휴무/연차 요청함</h3>
                  <p className="mt-1 text-[13px] text-[#64748b]">예약 배정 가능 여부에 반영됩니다.</p>
                </div>
                <span className="rounded-full bg-[#fff1b8] px-2.5 py-1 text-[12px] font-semibold text-[#8a5a00]">{pendingCount}건 대기</span>
              </div>
              <div className="mt-4 max-h-[344px] space-y-2 overflow-y-auto pr-1">
                {requests.map((request) => {
                  const staffMember = staff.find((item) => item.id === request.staffId);
                  return (
                    <div key={request.id} className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-[#111827]">{staffMember?.name ?? "스태프 미등록"}</p>
                          <p className="mt-1 text-[13px] text-[#64748b]">
                            {formatShortDate(request.date)} {request.period ?? ""} · {request.type}
                          </p>
                          <p className="mt-1 text-[13px] text-[#475569]">{request.reason}</p>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", getRequestTone(request.status))}>{request.status}</span>
                      </div>
                      {request.status === "승인대기" ? (
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => updateRequestStatus(request.id, "승인")} className="h-8 rounded-[8px] bg-[#2f7866] px-3 text-[12px] font-semibold text-white">승인</button>
                          <button type="button" onClick={() => updateRequestStatus(request.id, "거절")} className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[12px] font-medium text-[#334155]">거절</button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </WebSurface>
          ) : null}

          {selectedStaff ? (
            <WebSurface className="p-4">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  aria-label="스태프명"
                  className="min-h-11 w-auto min-w-0 max-w-[180px] rounded-[6px] border border-transparent bg-transparent px-0 py-0 text-[22px] font-bold leading-[1.2] text-[#0f172a] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#2f7866] focus:bg-white"
                  style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
                />
                <input
                  value={getStaffRank(draft.role)}
                  onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
                  aria-label="직급"
                  className="h-8 w-[84px] min-w-0 rounded-[6px] border border-transparent bg-transparent px-0 text-[18px] font-normal text-[#475569] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#2f7866] focus:bg-white"
                />
              </div>

              <div className="mt-1 border-b border-[#edf2f7] pb-3">
                <input
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  aria-label="연락처"
                  className="h-8 w-full rounded-[6px] border border-transparent bg-transparent px-0 text-[18px] font-normal tabular-nums text-[#0f172a] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#2f7866] focus:bg-white"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[8px] bg-[#f8fafc] px-3 py-2">
                  <p className="text-[11px] font-medium text-[#94a3b8]">남은 휴가 일수</p>
                  <p className="mt-1 text-[18px] font-semibold text-[#1f6b5b]">{getAnnualLeaveUsage(selectedStaff, requests).remaining}일</p>
                </div>
                <label className="rounded-[8px] bg-[#f8fafc] px-3 py-2">
                  <span className="text-[11px] font-medium text-[#94a3b8]">부여 휴가</span>
                  <input
                    type="number"
                    value={draft.annualRemain}
                    onChange={(event) => setDraft((current) => ({ ...current, annualRemain: event.target.value }))}
                    className="mt-1 h-7 w-full rounded-[6px] border border-transparent bg-transparent text-[18px] font-semibold text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-white focus:border-[#2f7866] focus:bg-white"
                  />
                </label>
              </div>

              <div className="mt-3">
                <p className="text-[13px] font-normal text-[#64748b]">기본 출퇴근 시간</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <TimeSelect value={draft.startTime} onChange={(startTime) => setDraft((current) => ({ ...current, startTime }))} align="left" buttonClassName="h-11 bg-white text-[16px]" />
                  <span className="text-[14px] text-[#94a3b8]">-</span>
                  <TimeSelect value={draft.endTime} onChange={(endTime) => setDraft((current) => ({ ...current, endTime }))} align="left" buttonClassName="h-11 bg-white text-[16px]" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <GhostButton label="취소" onClick={() => setDraft(buildDraft(selectedStaff))} />
                <PrimaryButton label="저장" onClick={saveStaff} />
              </div>
            </WebSurface>
          ) : null}
          </div>
        ) : null}
      </div>

      {notice ? <div className="rounded-[8px] border border-[#cfded8] bg-[#f6fbf9] px-4 py-3 text-[13px] font-medium text-[#1f6b5b]">{notice}</div> : null}

      {staffDialogOpen ? (
        <StaffModal title="스태프 추가" onClose={() => setStaffDialogOpen(false)}>
          <StaffDraftForm draft={newStaffDraft} onChange={setNewStaffDraft} />
          <div className="mt-6 grid grid-cols-2 gap-2">
            <GhostButton label="취소" onClick={() => setStaffDialogOpen(false)} />
            <PrimaryButton label="스태프 저장" onClick={addStaff} />
          </div>
        </StaffModal>
      ) : null}

      {leaveDialogOpen ? (
        <StaffModal title="휴무/연차 등록" onClose={() => setLeaveDialogOpen(false)}>
          <div className="space-y-3">
            <Field label="스태프명">
              <SoftSelect
                value={leaveDraft.staffId}
                onChange={(staffId) => setLeaveDraft((current) => ({ ...current, staffId }))}
                options={staff.map((staffMember) => ({ value: staffMember.id, label: staffMember.name }))}
                align="left"
                buttonClassName="h-10 bg-[#f8fafc]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="요청 날짜"><TextInput type="date" value={leaveDraft.date} onChange={(date) => setLeaveDraft((current) => ({ ...current, date }))} /></Field>
              <Field label="유형">
                <SoftSelect<LeaveType>
                  value={leaveDraft.type}
                  onChange={(type) => setLeaveDraft((current) => ({ ...current, type }))}
                  options={[
                    { value: "휴무", label: "휴무" },
                    { value: "연차", label: "연차" },
                    { value: "반차", label: "반차" },
                  ]}
                  align="left"
                  buttonClassName="h-10 bg-[#f8fafc]"
                />
              </Field>
            </div>
            <Field label="사유"><TextInput value={leaveDraft.reason} onChange={(reason) => setLeaveDraft((current) => ({ ...current, reason }))} placeholder="예: 개인 일정" /></Field>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <GhostButton label="취소" onClick={() => setLeaveDialogOpen(false)} />
            <PrimaryButton label="요청 등록" onClick={addLeaveRequest} />
          </div>
        </StaffModal>
      ) : null}

      {scheduleEditDraft ? (
        <StaffModal title={`${formatShortDate(scheduleEditDraft.date)} ${scheduleEditDraft.dayLabel}`} onClose={() => setScheduleEditDraft(null)}>
          <div className="rounded-[8px] border border-[#dbe2ea] bg-white">
            <div className="border-b border-[#edf2f7] bg-[#f8fafc] px-3 py-3">
              <button
                type="button"
                onClick={() => setDefaultScheduleOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 rounded-[8px] text-left transition hover:bg-white/70"
                aria-expanded={defaultScheduleOpen}
              >
                <div className="min-w-0">
                  <p className="truncate text-[28px] font-normal leading-[1.18] tracking-[-0.03em] text-[#111827]">{scheduleEditDraft.staffName}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span className="text-[14px] font-normal text-[#111827]">기본 근무 설정</span>
                  <ChevronDown className={cn("h-4 w-4 text-[#64748b] transition", defaultScheduleOpen && "rotate-180 text-[#1f6b5b]")} />
                </div>
              </button>

              {defaultScheduleOpen ? (
                <div className="space-y-3 border-t border-[#edf2f7] bg-white px-3 pb-3 pt-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[13px] font-normal text-[#334155]">기본 근무 요일</p>
                      <button
                        type="button"
                        onClick={saveStaffDefaultScheduleFromDraft}
                        className="h-8 shrink-0 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[12px] font-normal text-[#334155] hover:bg-[#f8fafc]"
                      >
                        저장
                      </button>
                    </div>
                    <WeekdayColorPicker
                      value={scheduleEditDraft.defaultDaysText}
                      onChange={(defaultDaysText) => setScheduleEditDraft((current) => (current ? { ...current, defaultDaysText } : current))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="기본 출근">
                      <TimeSelect value={scheduleEditDraft.defaultStartTime} onChange={(defaultStartTime) => setScheduleEditDraft((current) => (current ? { ...current, defaultStartTime } : current))} align="left" buttonClassName="h-10" />
                    </Field>
                    <Field label="기본 퇴근">
                      <TimeSelect value={scheduleEditDraft.defaultEndTime} onChange={(defaultEndTime) => setScheduleEditDraft((current) => (current ? { ...current, defaultEndTime } : current))} align="left" buttonClassName="h-10" />
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-3">
              <p className="text-[14px] font-normal text-[#111827]">이날 일정</p>
              <div className="mt-3 space-y-3">
                <Field label="상태">
                  <SoftSelect<ScheduleOverrideStatus>
                    value={scheduleEditDraft.status}
                    onChange={(status) => setScheduleEditDraft((current) => (current ? { ...current, status } : current))}
                    options={[
                      { value: "work", label: "근무" },
                      { value: "off", label: "휴무" },
                      { value: "annual", label: "연차" },
                      { value: "half", label: "반차" },
                    ]}
                    align="left"
                    buttonClassName="h-10 bg-[#f8fafc]"
                  />
                </Field>

                {scheduleEditDraft.status === "work" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="출근 시간">
                      <TimeSelect value={scheduleEditDraft.startTime} onChange={(startTime) => setScheduleEditDraft((current) => (current ? { ...current, startTime } : current))} align="left" buttonClassName="h-10" />
                    </Field>
                    <Field label="퇴근 시간">
                      <TimeSelect value={scheduleEditDraft.endTime} onChange={(endTime) => setScheduleEditDraft((current) => (current ? { ...current, endTime } : current))} align="left" buttonClassName="h-10" />
                    </Field>
                  </div>
                ) : null}

                {scheduleEditDraft.status === "half" ? (
                  <Field label="반차 구분">
                    <SoftSelect<"오전" | "오후">
                      value={scheduleEditDraft.period}
                      onChange={(period) => setScheduleEditDraft((current) => (current ? { ...current, period } : current))}
                      options={[
                        { value: "오전", label: "오전 반차" },
                        { value: "오후", label: "오후 반차" },
                      ]}
                      align="left"
                      buttonClassName="h-10 bg-[#f8fafc]"
                    />
                  </Field>
                ) : null}

                {scheduleEditDraft.status !== "work" ? (
                  <Field label="메모">
                    <TextInput value={scheduleEditDraft.reason} onChange={(reason) => setScheduleEditDraft((current) => (current ? { ...current, reason } : current))} placeholder="예: 개인 일정, 병원 방문" />
                  </Field>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-[1fr_1fr_1fr] gap-2">
            <GhostButton label="기본값" onClick={resetScheduleOverride} />
            <GhostButton label="취소" onClick={() => setScheduleEditDraft(null)} />
            <PrimaryButton label="저장" onClick={saveScheduleOverride} />
          </div>
        </StaffModal>
      ) : null}
    </div>
  );
}

function StaffDraftForm({ draft, onChange }: { draft: StaffDraft; onChange: (draft: StaffDraft) => void }) {
  return (
    <div className="space-y-3">
      <Field label="스태프명"><TextInput value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="예: 박수현" /></Field>
      <Field label="연락처"><TextInput value={draft.phone} onChange={(phone) => onChange({ ...draft, phone })} placeholder="010-0000-0000" /></Field>
      <Field label="역할"><TextInput value={draft.role} onChange={(role) => onChange({ ...draft, role })} placeholder="예: 미용사 / 목욕" /></Field>
      <Field label="기본 근무 요일">
        <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onChange({ ...draft, defaultDaysText })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="기본 출근 시간"><TimeSelect value={draft.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} align="left" buttonClassName="h-10" /></Field>
        <Field label="기본 퇴근 시간"><TimeSelect value={draft.endTime} onChange={(endTime) => onChange({ ...draft, endTime })} align="left" buttonClassName="h-10" /></Field>
      </div>
    </div>
  );
}

function StaffModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={onClose}>
      <div className="max-h-[calc(100vh-48px)] w-full max-w-[500px] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-semibold text-[#111827]">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
