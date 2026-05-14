"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { GhostButton, PrimaryButton, WebSurface } from "@/components/owner-web/owner-web-ui";
import { cn, currentDateInTimeZone } from "@/lib/utils";

type StaffStatus = "work" | "off" | "annual" | "half" | "pending";
type LeaveType = "휴무" | "연차" | "반차";
type LeaveStatus = "승인대기" | "승인" | "거절";
type StaffBoardTab = "list" | "schedule";
type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  role: string;
  defaultDays: WeekdayKey[];
  startTime: string;
  endTime: string;
  regularOff: string;
  annualRemain: number;
  todayBookings: number;
  weekBookings: number;
};

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

const defaultStaff: StaffMember[] = [
  { id: "staff-1", name: "정우진", phone: "010-8498-2077", role: "원장 / 전체 미용", defaultDays: ["mon", "tue", "thu", "fri", "sat"], startTime: "10:00", endTime: "19:00", regularOff: "수, 일", annualRemain: 8, todayBookings: 4, weekBookings: 18 },
  { id: "staff-2", name: "서하늘", phone: "010-1234-5678", role: "미용사 / 목욕", defaultDays: ["mon", "wed", "thu", "fri", "sat"], startTime: "11:00", endTime: "20:00", regularOff: "화, 일", annualRemain: 5, todayBookings: 3, weekBookings: 14 },
  { id: "staff-3", name: "민서윤", phone: "010-3333-4411", role: "디자이너 / 위생 미용", defaultDays: ["tue", "wed", "thu", "fri", "sat"], startTime: "10:00", endTime: "18:00", regularOff: "월, 일", annualRemain: 6, todayBookings: 2, weekBookings: 11 },
  { id: "staff-4", name: "강리오", phone: "010-5555-9081", role: "목욕 / 부분 미용", defaultDays: ["mon", "tue", "wed", "fri", "sat"], startTime: "10:00", endTime: "17:00", regularOff: "목, 일", annualRemain: 4, todayBookings: 3, weekBookings: 13 },
  { id: "staff-5", name: "오다은", phone: "010-7777-1102", role: "파트타임 / 목욕", defaultDays: ["wed", "thu", "fri", "sat"], startTime: "13:00", endTime: "19:00", regularOff: "월, 화, 일", annualRemain: 3, todayBookings: 1, weekBookings: 7 },
  { id: "staff-6", name: "한지우", phone: "010-9090-1024", role: "파트타임 / 보조", defaultDays: ["mon", "tue", "sat"], startTime: "12:00", endTime: "18:00", regularOff: "수, 목, 금, 일", annualRemain: 2, todayBookings: 0, weekBookings: 4 },
  { id: "staff-7", name: "윤하나", phone: "010-2323-1188", role: "미용 보조 / 목욕", defaultDays: ["mon", "wed", "thu", "sat"], startTime: "11:00", endTime: "18:00", regularOff: "화, 금, 일", annualRemain: 2, todayBookings: 1, weekBookings: 5 },
];

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

function getTodayKey() {
  const day = parseDate(currentDateInTimeZone()).getDay();
  return weekdayColumns[day === 0 ? 6 : day - 1].key;
}

function getStaffAvailability(staff: StaffMember, requests: LeaveRequest[]) {
  const today = currentDateInTimeZone();
  const todayKey = getTodayKey();
  const cell = applyRequestsToSchedule(staff, todayKey, today, requests);
  if (cell.status === "work") return "근무 가능";
  if (cell.status === "pending") return "휴무/연차 승인대기";
  return cell.label;
}

function getWeeklyWorkDays(staff: StaffMember, weekStart: string, requests: LeaveRequest[]) {
  return getWeekDates(weekStart).filter((day) => applyRequestsToSchedule(staff, day.key, day.date, requests).status === "work").length;
}

function getScheduledLeaveCount(staff: StaffMember, requests: LeaveRequest[]) {
  return requests.filter((request) => request.staffId === staff.id && request.status !== "거절").length;
}

function getCellTone(status: StaffStatus) {
  if (status === "work") return "border-[#d8e7e1] bg-[#f8fcfb] text-[#1f6b5b]";
  if (status === "annual") return "border-[#ead9cf] bg-[#fff8f1] text-[#9a5a24]";
  if (status === "half") return "border-[#f1e3bf] bg-[#fffdf6] text-[#8a5a00]";
  if (status === "pending") return "border-dashed border-[#e3c476] bg-[#fffdf6] text-[#8a5a00]";
  return "border-[#e5e7eb] bg-[#f8fafc] text-[#64748b]";
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-[#334155]">{label}</span>
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
            "inline-flex h-[38px] items-center gap-2 rounded-[8px] px-3.5 text-left text-[15px] font-normal transition",
            activeTab === tab.key ? "bg-[#e9f6f1] text-[#0f6b5a]" : "text-[#17233f] hover:bg-[#f8fafc]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function StaffManagementScreen() {
  const [staff, setStaff] = useState<StaffMember[]>(defaultStaff);
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [selectedStaffId, setSelectedStaffId] = useState(defaultStaff[0].id);
  const [boardTab, setBoardTab] = useState<StaffBoardTab>("schedule");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(() => buildDraft(defaultStaff[0]));
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
  const [leaveDraft, setLeaveDraft] = useState({ staffId: defaultStaff[0].id, date: currentDateInTimeZone(), type: "휴무" as LeaveType, reason: "" });
  const [notice, setNotice] = useState("");

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const selectedStaff = staff.find((item) => item.id === selectedStaffId) ?? staff[0];
  const pendingCount = requests.filter((request) => request.status === "승인대기").length;

  function selectStaff(staffMember: StaffMember) {
    setSelectedStaffId(staffMember.id);
    setDraft(buildDraft(staffMember));
  }

  function parseDefaultDays(text: string) {
    return text
      .split(/[,/ ]+/)
      .map((item) => dayNameToKey[item.trim()])
      .filter(Boolean);
  }

  function saveStaff() {
    if (!selectedStaff) return;
    const nextDays = parseDefaultDays(draft.defaultDaysText);
    setStaff((current) =>
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
    setStaff((current) => [...current, nextStaff]);
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
                    <h3 className="text-[18px] font-semibold text-[#111827]">스태프 목록</h3>
                    <p className="mt-1 text-[13px] text-[#64748b]">예약 배정 전 오늘 근무 가능 여부를 확인합니다.</p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]" aria-label="이전 주">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#111827]">
                      <CalendarDays className="h-4 w-4 text-[#64748b]" />
                      {formatWeekLabel(weekStart)}
                    </div>
                    <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]" aria-label="다음 주">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {boardTab === "list" ? (
                <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:h-10 [&>button]:w-[132px] [&>button]:shrink-0">
                  <span className="rounded-full bg-[#eef7f4] px-3 py-1 text-[12px] font-semibold text-[#1f6b5b]">{staff.length}명</span>
                  <PrimaryButton label="스태프 추가" onClick={() => setStaffDialogOpen(true)} />
                  <GhostButton label="휴무/연차 등록" onClick={() => setLeaveDialogOpen(true)} />
                </div>
              ) : null}
            </div>
            {boardTab === "list" ? (
              <div className="max-h-[532px] overflow-y-auto">
                {staff.map((staffMember) => {
                  const availability = getStaffAvailability(staffMember, requests);
                  const weeklyDays = getWeeklyWorkDays(staffMember, weekStart, requests);
                  const active = selectedStaff?.id === staffMember.id;
                  const available = availability === "근무 가능";

                  return (
                    <button
                      key={staffMember.id}
                      type="button"
                      onClick={() => selectStaff(staffMember)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(150px,1.1fr)_minmax(150px,1fr)_120px_120px_120px_130px] items-center gap-3 border-b border-[#edf2f7] px-5 py-3 text-left transition last:border-b-0",
                        active ? "bg-[#f6fbf9]" : "bg-white hover:bg-[#f8fafc]",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-[#111827]">{staffMember.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-[#64748b]">{staffMember.phone}</p>
                      </div>
                      <p className="truncate text-[14px] text-[#475569]">{staffMember.role}</p>
                      <span className={cn("w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold", available ? "bg-[#e6f3ef] text-[#1f6b5b]" : "bg-[#f3f4f6] text-[#64748b]")}>{availability}</span>
                      <p className="text-[13px] text-[#334155]">이번 주 {weeklyDays}일</p>
                      <p className="text-[13px] text-[#334155]">오늘 예약 {staffMember.todayBookings}건</p>
                      <p className="text-[13px] text-[#64748b]">휴무/연차 {getScheduledLeaveCount(staffMember, requests)}건</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[150px_repeat(7,minmax(100px,1fr))] border-b border-[#edf2f7] bg-[#f8fafc] px-4 py-3 text-[12px] font-semibold text-[#64748b]">
                    <span>스태프명</span>
                    {weekDates.map((day) => (
                      <span key={day.date} className="text-center">{day.label}</span>
                    ))}
                  </div>
                  <div className="max-h-[532px] overflow-y-auto">
                    {staff.map((staffMember) => (
                      <div key={staffMember.id} className="grid grid-cols-[150px_repeat(7,minmax(100px,1fr))] gap-2 border-b border-[#edf2f7] px-4 py-3 last:border-b-0">
                        <button type="button" onClick={() => selectStaff(staffMember)} className="min-w-0 text-left">
                          <p className="truncate text-[14px] font-semibold text-[#111827]">{staffMember.name}</p>
                          <p className="mt-1 truncate text-[12px] text-[#64748b]">{staffMember.role}</p>
                        </button>
                        {weekDates.map((day) => {
                          const cell = applyRequestsToSchedule(staffMember, day.key, day.date, requests);
                          return (
                            <div key={`${staffMember.id}-${day.date}`} className={cn("rounded-[8px] border px-2 py-2 text-center text-[12px] font-semibold", getCellTone(cell.status))}>
                              {cell.label}
                            </div>
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
            <WebSurface className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.12em] text-[#94a3b8]">스태프 상세</p>
                  <h3 className="mt-2 text-[22px] font-semibold text-[#111827]">{selectedStaff.name}</h3>
                  <p className="mt-1 text-[13px] text-[#64748b]">오늘 예약 {selectedStaff.todayBookings}건 · 이번 주 {selectedStaff.weekBookings}건</p>
                </div>
                <span className="rounded-full bg-[#e6f3ef] px-2.5 py-1 text-[12px] font-semibold text-[#1f6b5b]">{getStaffAvailability(selectedStaff, requests)}</span>
              </div>
              <div className="mt-5 space-y-3">
                <Field label="스태프명"><TextInput value={draft.name} onChange={(name) => setDraft((current) => ({ ...current, name }))} /></Field>
                <Field label="연락처"><TextInput value={draft.phone} onChange={(phone) => setDraft((current) => ({ ...current, phone }))} /></Field>
                <Field label="역할"><TextInput value={draft.role} onChange={(role) => setDraft((current) => ({ ...current, role }))} /></Field>
                <Field label="기본 근무 요일"><TextInput value={draft.defaultDaysText} onChange={(defaultDaysText) => setDraft((current) => ({ ...current, defaultDaysText }))} placeholder="월, 화, 수, 목, 금" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="기본 출근 시간"><TextInput type="time" value={draft.startTime} onChange={(startTime) => setDraft((current) => ({ ...current, startTime }))} /></Field>
                  <Field label="기본 퇴근 시간"><TextInput type="time" value={draft.endTime} onChange={(endTime) => setDraft((current) => ({ ...current, endTime }))} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="정기 휴무"><TextInput value={draft.regularOff} onChange={(regularOff) => setDraft((current) => ({ ...current, regularOff }))} /></Field>
                  <Field label="연차 잔여일"><TextInput type="number" value={draft.annualRemain} onChange={(annualRemain) => setDraft((current) => ({ ...current, annualRemain }))} /></Field>
                </div>
                <div className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
                  <p className="text-[13px] font-semibold text-[#334155]">예정 휴무/연차</p>
                  <p className="mt-1 text-[13px] text-[#64748b]">{getScheduledLeaveCount(selectedStaff, requests)}건 예정</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
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
              <select value={leaveDraft.staffId} onChange={(event) => setLeaveDraft((current) => ({ ...current, staffId: event.target.value }))} className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none">
                {staff.map((staffMember) => <option key={staffMember.id} value={staffMember.id}>{staffMember.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="요청 날짜"><TextInput type="date" value={leaveDraft.date} onChange={(date) => setLeaveDraft((current) => ({ ...current, date }))} /></Field>
              <Field label="유형">
                <select value={leaveDraft.type} onChange={(event) => setLeaveDraft((current) => ({ ...current, type: event.target.value as LeaveType }))} className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[14px] text-[#111827] outline-none">
                  <option value="휴무">휴무</option>
                  <option value="연차">연차</option>
                  <option value="반차">반차</option>
                </select>
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
    </div>
  );
}

function StaffDraftForm({ draft, onChange }: { draft: StaffDraft; onChange: (draft: StaffDraft) => void }) {
  return (
    <div className="space-y-3">
      <Field label="스태프명"><TextInput value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="예: 박수현" /></Field>
      <Field label="연락처"><TextInput value={draft.phone} onChange={(phone) => onChange({ ...draft, phone })} placeholder="010-0000-0000" /></Field>
      <Field label="역할"><TextInput value={draft.role} onChange={(role) => onChange({ ...draft, role })} placeholder="예: 미용사 / 목욕" /></Field>
      <Field label="기본 근무 요일"><TextInput value={draft.defaultDaysText} onChange={(defaultDaysText) => onChange({ ...draft, defaultDaysText })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="기본 출근 시간"><TextInput type="time" value={draft.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} /></Field>
        <Field label="기본 퇴근 시간"><TextInput type="time" value={draft.endTime} onChange={(endTime) => onChange({ ...draft, endTime })} /></Field>
      </div>
    </div>
  );
}

function StaffModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={onClose}>
      <div className="w-full max-w-[500px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-semibold text-[#111827]">{title}</h3>
            <p className="mt-1 text-[13px] leading-5 text-[#64748b]">예약 배정 전 근무 가능 여부를 확인하기 위한 정보만 관리합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
