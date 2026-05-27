"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ScheduleTable,
  StaffBoardTabs,
  StaffDetailPanel,
  StaffList,
  StaffScheduleEditModal,
} from "@/components/owner-web/staff-management-ui";
import { StaffAddModal, StaffLeaveModal } from "@/components/owner-web/staff-management-modals";
import { AssetIcon, PrimaryButton, WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { StaffScheduleOverride as BootstrapStaffScheduleOverride } from "@/types/domain";
import {
  applyScheduleToCell,
  buildDraft,
  emptyStaffDraft,
  formatWeekLabel,
  formatWeekdayKeys,
  getWeekDates,
  getWeekStart,
  initialRequests,
  parseWeekdayText,
  scheduleOverrideFromBootstrap,
  type LeaveRequest,
  type LeaveType,
  type ScheduleEditDraft,
  type ScheduleOverride,
  type ScheduleOverrideStatus,
  type StaffBoardTab,
  type StaffDraft,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";

type Props = {
  shopId?: string;
  staffMembers?: StaffMember[];
  staffScheduleOverrides?: BootstrapStaffScheduleOverride[];
  onStaffMembersChange?: (staff: StaffMember[]) => void | Promise<void>;
  onStaffMemberDeactivate?: (staffId: string) => void | Promise<void>;
  onStaffScheduleOverridesChange?: (overrides: BootstrapStaffScheduleOverride[]) => void;
};

type OverrideResponse = {
  override: BootstrapStaffScheduleOverride;
};

export default function StaffManagementScreen({
  shopId,
  staffMembers,
  staffScheduleOverrides = [],
  onStaffMembersChange,
  onStaffMemberDeactivate,
  onStaffScheduleOverridesChange,
}: Props) {
  const isDemoShop = shopId === "demo-shop" || shopId === "owner-demo";
  const initialStaff = staffMembers?.[0] ?? null;
  const [localStaff, setLocalStaff] = useState<StaffMember[]>(staffMembers ?? []);
  const staff = staffMembers ?? localStaff;
  const [requests, setRequests] = useState<LeaveRequest[]>(() => (isDemoShop ? initialRequests : []));
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>(() => staffScheduleOverrides.map(scheduleOverrideFromBootstrap));
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaff?.id ?? "");
  const [boardTab, setBoardTab] = useState<StaffBoardTab>("schedule");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [draft, setDraft] = useState<StaffDraft>(() => (initialStaff ? buildDraft(initialStaff) : emptyStaffDraft));
  const [newStaffDraft, setNewStaffDraft] = useState<StaffDraft>({ ...emptyStaffDraft, defaultDaysText: "월, 화, 수, 목, 금", regularOff: "토, 일" });
  const [leaveDraft, setLeaveDraft] = useState({ staffId: initialStaff?.id ?? "", date: currentDateInTimeZone(), type: "휴무" as LeaveType, period: "오전" as "오전" | "오후", reason: "" });
  const [scheduleEditDraft, setScheduleEditDraft] = useState<ScheduleEditDraft | null>(null);
  const [defaultScheduleOpen, setDefaultScheduleOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setScheduleOverrides(staffScheduleOverrides.map(scheduleOverrideFromBootstrap));
  }, [staffScheduleOverrides]);

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

  async function updateStaffMembers(updater: (current: StaffMember[]) => StaffMember[]) {
    const nextStaff = updater(staff);
    if (onStaffMembersChange) {
      try {
        await onStaffMembersChange(nextStaff);
        return true;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "직원 정보를 저장하지 못했습니다.");
        return false;
      }
    }

    setLocalStaff(nextStaff);
    return true;
  }

  function createStaffId() {
    const prefix = shopId ?? "local";
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-staff-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isValidTimeRange(startTime: string, endTime: string) {
    return startTime < endTime;
  }

  async function saveStaff() {
    if (!selectedStaff) return;
    if (!isValidTimeRange(draft.startTime, draft.endTime)) {
      setNotice("기본 출근 시간은 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    const nextDays = parseDefaultDays(draft.defaultDaysText);
    const saved = await updateStaffMembers((current) =>
      current.map((item) =>
        item.id === selectedStaff.id
          ? {
              ...item,
              name: draft.name.trim() || item.name,
              phone: draft.phone.trim(),
              role: "직원",
              defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
              startTime: draft.startTime,
              endTime: draft.endTime,
              regularOff: draft.regularOff.trim() || item.regularOff,
              annualRemain: Number(draft.annualRemain) || 0,
            }
          : item,
      ),
    );
    if (saved) {
      setNotice("직원 정보를 저장했습니다.");
    }
  }

  async function addStaff() {
    if (!isValidTimeRange(newStaffDraft.startTime, newStaffDraft.endTime)) {
      setNotice("기본 출근 시간은 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    const nextDays = parseDefaultDays(newStaffDraft.defaultDaysText);
    const nextStaff: StaffMember = {
      id: createStaffId(),
      name: newStaffDraft.name.trim() || "신규 직원",
      phone: newStaffDraft.phone.trim(),
      role: "직원",
      defaultDays: nextDays.length > 0 ? nextDays : ["mon", "tue", "wed", "thu", "fri"],
      startTime: newStaffDraft.startTime,
      endTime: newStaffDraft.endTime,
      regularOff: newStaffDraft.regularOff || "토, 일",
      annualRemain: Number(newStaffDraft.annualRemain) || 0,
      todayBookings: 0,
      weekBookings: 0,
    };
    const saved = await updateStaffMembers((current) => [...current, nextStaff]);
    if (!saved) {
      return;
    }
    selectStaff(nextStaff);
    setNewStaffDraft({ ...emptyStaffDraft, defaultDaysText: "월, 화, 수, 목, 금", regularOff: "토, 일" });
    setStaffDialogOpen(false);
    setNotice("직원를 추가했습니다.");
  }

  async function deactivateSelectedStaff() {
    if (!selectedStaff) return;
    if (staff.length <= 1) {
      setNotice("최소 1명의 활성 직원는 남아 있어야 합니다.");
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(`${selectedStaff.name} 직원를 비활성화할까요?`)) {
      return;
    }

    const nextStaff = staff.filter((item) => item.id !== selectedStaff.id);
    try {
      if (onStaffMemberDeactivate) {
        await onStaffMemberDeactivate(selectedStaff.id);
      } else {
        setLocalStaff(nextStaff);
      }
      const nextSelectedStaff = nextStaff[0];
      if (nextSelectedStaff) {
        selectStaff(nextSelectedStaff);
      }
      setNotice("직원를 비활성화했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "직원를 비활성화하지 못했습니다.");
    }
  }

  function selectStaff(staffMember: StaffMember) {
    setSelectedStaffId(staffMember.id);
    setDraft(buildDraft(staffMember));
  }

  function parseDefaultDays(text: string) {
    return parseWeekdayText(text);
  }

  function emitScheduleOverrides(overrides: ScheduleOverride[]) {
    if (!onStaffScheduleOverridesChange) return;
    onStaffScheduleOverridesChange(overrides.map((override) => toBootstrapOverride(override, shopId)));
  }

  function replaceLocalOverride(current: ScheduleOverride[], override: ScheduleOverride) {
    const next = current.filter((item) => !(item.staffId === override.staffId && item.date === override.date));
    return [...next, override];
  }

  async function addLeaveRequest() {
    if (!leaveDraft.staffId || !leaveDraft.date) return;
    const nextRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      staffId: leaveDraft.staffId,
      date: leaveDraft.date,
      type: leaveDraft.type,
      reason: leaveDraft.reason.trim() || "사유 없음",
      status: "승인대기",
      period: leaveDraft.type === "반차" ? leaveDraft.period : undefined,
    };
    const nextOverride: ScheduleOverride = {
      id: `${shopId ?? "local"}-${nextRequest.staffId}-${nextRequest.date}`,
      staffId: nextRequest.staffId,
      date: nextRequest.date,
      status: nextRequest.type === "연차" ? "annual" : nextRequest.type === "반차" ? "half" : "off",
      startTime: "10:00",
      endTime: "19:00",
      period: nextRequest.type === "반차" ? nextRequest.period ?? "오전" : undefined,
      reason: nextRequest.reason,
    };
    const previousOverrides = scheduleOverrides;
    const optimisticOverrides = replaceLocalOverride(previousOverrides, nextOverride);
    setScheduleOverrides(optimisticOverrides);
    emitScheduleOverrides(optimisticOverrides);

    try {
      if (shopId && !isDemoShop) {
        const response = await fetchApiJsonWithAuth<OverrideResponse>("/api/staff-schedule-overrides", {
          method: "PATCH",
          body: JSON.stringify({
            shopId,
            staffId: nextOverride.staffId,
            date: nextOverride.date,
            status: nextOverride.status,
            startTime: null,
            endTime: null,
            period: nextOverride.status === "half" ? nextOverride.period : null,
            reason: nextOverride.reason,
          }),
        });
        const persistedOverride = scheduleOverrideFromBootstrap(response.override);
        const persistedOverrides = replaceLocalOverride(previousOverrides, persistedOverride);
        setScheduleOverrides(persistedOverrides);
        onStaffScheduleOverridesChange?.(replaceBootstrapOverride(staffScheduleOverrides, response.override));
      } else {
        setRequests((current) => [nextRequest, ...current]);
      }
      setLeaveDialogOpen(false);
      setNotice("휴무/연차 일정을 저장했습니다.");
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "휴무/연차 일정을 저장하지 못했습니다.");
    }
  }

  function openScheduleEditor(staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) {
    const override = scheduleOverrides.find((item) => item.staffId === staffMember.id && item.date === day.date);
    const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, scheduleOverrides);
    const status: ScheduleOverrideStatus =
      override?.status ?? (["work", "off", "annual", "half"].includes(cell.status) ? (cell.status as ScheduleOverrideStatus) : "off");

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
      defaultDaysText: formatWeekdayKeys(staffMember.defaultDays),
      defaultStartTime: staffMember.startTime,
      defaultEndTime: staffMember.endTime,
    });
    setDefaultScheduleOpen(false);
  }

  async function saveStaffDefaultScheduleFromDraft() {
    if (!scheduleEditDraft) return;
    if (!isValidTimeRange(scheduleEditDraft.defaultStartTime, scheduleEditDraft.defaultEndTime)) {
      setNotice("기본 출근 시간은 퇴근 시간보다 빨라야 합니다.");
      return;
    }
    const nextDays = parseDefaultDays(scheduleEditDraft.defaultDaysText);
    const saved = await updateStaffMembers((current) =>
      current.map((item) =>
        item.id === scheduleEditDraft.staffId
          ? {
              ...item,
              defaultDays: nextDays.length > 0 ? nextDays : item.defaultDays,
              startTime: scheduleEditDraft.defaultStartTime,
              endTime: scheduleEditDraft.defaultEndTime,
              regularOff: formatWeekdayKeys(weekDates.filter((day) => !nextDays.includes(day.key)).map((day) => day.key)),
            }
          : item,
      ),
    );
    if (saved) {
      setNotice("기본 근무 설정을 저장했습니다.");
    }
  }

  async function persistScheduleOverride() {
    if (!scheduleEditDraft) return;
    if (scheduleEditDraft.status === "work" && !isValidTimeRange(scheduleEditDraft.startTime, scheduleEditDraft.endTime)) {
      setNotice("근무 시작 시간은 종료 시간보다 빨라야 합니다.");
      return;
    }
    const previousOverrides = scheduleOverrides;
    const nextOverride: ScheduleOverride = {
      id: `${shopId ?? "local"}-${scheduleEditDraft.staffId}-${scheduleEditDraft.date}`,
      staffId: scheduleEditDraft.staffId,
      date: scheduleEditDraft.date,
      status: scheduleEditDraft.status,
      startTime: scheduleEditDraft.status === "work" ? scheduleEditDraft.startTime : "10:00",
      endTime: scheduleEditDraft.status === "work" ? scheduleEditDraft.endTime : "19:00",
      period: scheduleEditDraft.status === "half" ? scheduleEditDraft.period : undefined,
      reason: scheduleEditDraft.reason.trim(),
    };
    const optimisticOverrides = replaceLocalOverride(previousOverrides, nextOverride);
    setScheduleOverrides(optimisticOverrides);
    emitScheduleOverrides(optimisticOverrides);

    try {
      if (shopId && !isDemoShop) {
        const response = await fetchApiJsonWithAuth<OverrideResponse>("/api/staff-schedule-overrides", {
          method: "PATCH",
          body: JSON.stringify({
            shopId,
            staffId: nextOverride.staffId,
            date: nextOverride.date,
            status: nextOverride.status,
            startTime: nextOverride.status === "work" ? nextOverride.startTime : null,
            endTime: nextOverride.status === "work" ? nextOverride.endTime : null,
            period: nextOverride.status === "half" ? nextOverride.period : null,
            reason: nextOverride.reason,
          }),
        });
        const persistedOverride = scheduleOverrideFromBootstrap(response.override);
        const persistedOverrides = replaceLocalOverride(previousOverrides, persistedOverride);
        setScheduleOverrides(persistedOverrides);
        onStaffScheduleOverridesChange?.(replaceBootstrapOverride(staffScheduleOverrides, response.override));
      }
      setNotice("선택한 날짜의 근무 일정을 저장했습니다.");
      setScheduleEditDraft(null);
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "선택한 날짜의 근무 일정을 저장하지 못했습니다.");
    }
  }

  async function persistResetScheduleOverride() {
    if (!scheduleEditDraft) return;
    const previousOverrides = scheduleOverrides;
    const nextOverrides = previousOverrides.filter((item) => !(item.staffId === scheduleEditDraft.staffId && item.date === scheduleEditDraft.date));
    setScheduleOverrides(nextOverrides);
    emitScheduleOverrides(nextOverrides);

    try {
      if (shopId && !isDemoShop) {
        await fetchApiJsonWithAuth<{ ok: boolean }>("/api/staff-schedule-overrides", {
          method: "DELETE",
          body: JSON.stringify({ shopId, staffId: scheduleEditDraft.staffId, date: scheduleEditDraft.date }),
        });
        onStaffScheduleOverridesChange?.(
          staffScheduleOverrides.filter((item) => !(item.staff_id === scheduleEditDraft.staffId && item.work_date === scheduleEditDraft.date)),
        );
      }
      setNotice("선택한 날짜를 기본 근무 설정으로 되돌렸습니다.");
      setScheduleEditDraft(null);
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      emitScheduleOverrides(previousOverrides);
      setNotice(error instanceof Error ? error.message : "선택한 날짜의 근무 일정을 초기화하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-3">
      <StaffBoardTabs activeTab={boardTab} onChange={setBoardTab} />

      <div className={cn("grid gap-5", boardTab === "list" ? "xl:grid-cols-[minmax(0,1fr)_390px]" : "xl:grid-cols-1")}>
        <div className="min-w-0">
          <WebSurface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf2f7] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-[#111827]">{boardTab === "list" ? "직원 목록" : "주간 근무표"}</h2>
                  {boardTab === "list" ? (
                    <span className="inline-flex h-7 items-center rounded-full bg-[#eef8f4] px-3 text-[16px] font-semibold text-[#2f7866]">
                      {staff.length}명
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {boardTab === "schedule" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setWeekStart((current) => formatDateShift(current, -7))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="이전 주"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setWeekStart(getWeekStart())} className="h-8 px-3 text-[16px] font-medium text-[#111827]">
                      {formatWeekLabel(weekStart)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStart((current) => formatDateShift(current, 7))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#475569] hover:bg-[#f8fafc]"
                      aria-label="다음 주"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <PrimaryButton
                    label="직원 추가"
                    icon={<AssetIcon src="/icons/phosphor/UserPlus.svg" className="h-6 w-6" />}
                    onClick={() => setStaffDialogOpen(true)}
                  />
                )}
              </div>
            </div>

            {notice ? <div className="border-b border-[#edf2f7] bg-[#f8fafc] px-5 py-2 text-[16px] text-[#1f6b5b]">{notice}</div> : null}

            {boardTab === "schedule" ? (
              <ScheduleTable staff={staff} weekDates={weekDates} requests={requests} overrides={scheduleOverrides} onOpenScheduleEditor={openScheduleEditor} />
            ) : (
              <StaffList
                staff={staff}
                selectedStaffId={selectedStaff?.id ?? ""}
                requests={requests}
                overrides={scheduleOverrides}
                weekStart={weekStart}
                onSelect={selectStaff}
              />
            )}
          </WebSurface>
        </div>

        {boardTab === "list" && selectedStaff ? (
          <StaffDetailPanel
            selectedStaff={selectedStaff}
            draft={draft}
            requests={requests}
            overrides={scheduleOverrides}
            onDraftChange={setDraft}
            onSave={saveStaff}
            onOpenLeaveDialog={() => setLeaveDialogOpen(true)}
            onDeactivate={deactivateSelectedStaff}
          />
        ) : null}
      </div>

      {staffDialogOpen ? <StaffAddModal draft={newStaffDraft} onDraftChange={setNewStaffDraft} onClose={() => setStaffDialogOpen(false)} onAdd={addStaff} /> : null}

      {leaveDialogOpen ? (
        <StaffLeaveModal staff={staff} draft={leaveDraft} onDraftChange={setLeaveDraft} onClose={() => setLeaveDialogOpen(false)} onSave={addLeaveRequest} />
      ) : null}

      {scheduleEditDraft ? (
        <StaffScheduleEditModal
          draft={scheduleEditDraft}
          defaultScheduleOpen={defaultScheduleOpen}
          onClose={() => setScheduleEditDraft(null)}
          onToggleDefaultSchedule={() => setDefaultScheduleOpen((current) => !current)}
          onDraftChange={setScheduleEditDraft}
          onSaveDefaultSchedule={saveStaffDefaultScheduleFromDraft}
          onReset={persistResetScheduleOverride}
          onSave={persistScheduleOverride}
        />
      ) : null}
    </div>
  );
}

function formatDateShift(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toBootstrapOverride(override: ScheduleOverride, shopId?: string): BootstrapStaffScheduleOverride {
  return {
    id: override.id,
    shop_id: shopId ?? "local",
    staff_id: override.staffId,
    work_date: override.date,
    status: override.status,
    start_time: override.status === "work" ? override.startTime : null,
    end_time: override.status === "work" ? override.endTime : null,
    period: override.status === "half" ? override.period ?? "오전" : null,
    reason: override.reason || null,
    created_at: "",
    updated_at: "",
  };
}

function replaceBootstrapOverride(current: BootstrapStaffScheduleOverride[], nextOverride: BootstrapStaffScheduleOverride) {
  return [...current.filter((item) => !(item.staff_id === nextOverride.staff_id && item.work_date === nextOverride.work_date)), nextOverride];
}
