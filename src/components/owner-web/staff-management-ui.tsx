import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

import { GhostButton, PrimaryButton, SoftSelect, WebSurface } from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";
import {
  applyScheduleToCell,
  formatShortDate,
  formatWeekdayKeys,
  getAnnualLeaveUsage,
  getCellIndicatorTone,
  getCellTone,
  getScheduledLeaveCount,
  getStaffAvailability,
  getStaffRank,
  getWeeklyWorkDays,
  parseWeekdayText,
  timeSelectOptions,
  weekdayColumns,
  type LeaveRequest,
  type ScheduleEditDraft,
  type ScheduleOverride,
  type ScheduleOverrideStatus,
  type StaffBoardTab,
  type StaffDraft,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";

export function ScheduleTable({
  staff,
  weekDates,
  requests,
  overrides,
  onOpenScheduleEditor,
}: {
  staff: StaffMember[];
  weekDates: Array<{ key: WeekdayKey; label: string; date: string }>;
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  onOpenScheduleEditor: (staffMember: StaffMember, day: { key: WeekdayKey; label: string; date: string }) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[180px_repeat(7,minmax(94px,1fr))] border-b border-[#edf2f7] bg-[#f8fafc] text-[13px] text-[#64748b]">
          <div className="px-5 py-3">스태프명</div>
          {weekDates.map((day) => (
            <div key={day.date} className="px-3 py-3 text-center">
              {day.label}
            </div>
          ))}
        </div>
        {staff.map((staffMember) => (
          <div key={staffMember.id} className="grid grid-cols-[180px_repeat(7,minmax(94px,1fr))] items-center border-b border-[#edf2f7] last:border-b-0">
            <button type="button" className="px-5 py-4 text-left">
              <p className="text-[16px] font-semibold text-[#111827]">{staffMember.name}</p>
              <p className="mt-1 truncate text-[12px] text-[#64748b]">{staffMember.role}</p>
            </button>
            {weekDates.map((day) => {
              const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, overrides);
              return (
                <button
                  key={`${staffMember.id}-${day.date}`}
                  type="button"
                  onClick={() => onOpenScheduleEditor(staffMember, day)}
                  className={cn("mx-2 my-3 h-9 rounded-[8px] border px-2 text-[13px] transition hover:bg-[#f8fafc]", getCellTone(cell.status))}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", getCellIndicatorTone(cell.status))} />
                    {cell.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StaffList({
  staff,
  selectedStaffId,
  requests,
  overrides,
  weekStart,
  onSelect,
}: {
  staff: StaffMember[];
  selectedStaffId: string;
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  weekStart: string;
  onSelect: (staff: StaffMember) => void;
}) {
  return (
    <div className="divide-y divide-[#edf2f7]">
      {staff.map((staffMember) => (
        <button
          key={staffMember.id}
          type="button"
          onClick={() => onSelect(staffMember)}
          className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-4 text-left transition hover:bg-[#f8fafc]", selectedStaffId === staffMember.id && "bg-[#f8fafc]")}
        >
          <div>
            <p className="text-[18px] font-semibold text-[#111827]">{staffMember.name}</p>
            <p className="mt-1 text-[13px] text-[#64748b]">{staffMember.role}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <StaffMetric label="상태" value={getStaffAvailability(staffMember, requests, overrides)} />
            <StaffMetric label="주간 근무" value={`${getWeeklyWorkDays(staffMember, weekStart, requests, overrides)}일`} />
            <StaffMetric label="예정 휴무" value={`${getScheduledLeaveCount(staffMember, requests)}건`} />
          </div>
        </button>
      ))}
    </div>
  );
}

export function StaffDetailPanel({
  selectedStaff,
  draft,
  requests,
  onDraftChange,
  onSave,
  onOpenLeaveDialog,
  onDeactivate,
}: {
  selectedStaff: StaffMember;
  draft: StaffDraft;
  requests: LeaveRequest[];
  onDraftChange: (updater: (current: StaffDraft) => StaffDraft) => void;
  onSave: () => void;
  onOpenLeaveDialog: () => void;
  onDeactivate: () => void;
}) {
  return (
    <WebSurface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#64748b]">선택 스태프</p>
          <h3 className="mt-1 text-[26px] font-medium text-[#111827]">{selectedStaff.name}</h3>
          <p className="mt-1 text-[14px] text-[#64748b]">{getStaffRank(selectedStaff.role)}</p>
        </div>
        <PrimaryButton label="저장" onClick={onSave} />
      </div>
      <div className="mt-5 space-y-2">
        <StaffInfoRow label="이름">
          <CompactInput value={draft.name} onChange={(name) => onDraftChange((current) => ({ ...current, name }))} ariaLabel="이름" />
        </StaffInfoRow>
        <StaffInfoRow label="연락처">
          <CompactInput value={draft.phone} onChange={(phone) => onDraftChange((current) => ({ ...current, phone }))} ariaLabel="연락처" />
        </StaffInfoRow>
        <StaffInfoRow label="역할">
          <CompactInput value={draft.role} onChange={(role) => onDraftChange((current) => ({ ...current, role }))} ariaLabel="역할" />
        </StaffInfoRow>
        <StaffInfoRow label="근무 요일">
          <CompactInput value={draft.defaultDaysText} onChange={(defaultDaysText) => onDraftChange((current) => ({ ...current, defaultDaysText }))} ariaLabel="근무 요일" />
        </StaffInfoRow>
        <StaffInfoRow label="기본 시간">
          <div className="flex items-center gap-2">
            <TimeSelect value={draft.startTime} onChange={(startTime) => onDraftChange((current) => ({ ...current, startTime }))} />
            <span className="text-[#94a3b8]">-</span>
            <TimeSelect value={draft.endTime} onChange={(endTime) => onDraftChange((current) => ({ ...current, endTime }))} />
          </div>
        </StaffInfoRow>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <StaffMetric label="오늘 예약" value={`${selectedStaff.todayBookings}건`} />
        <StaffMetric label="주간 예약" value={`${selectedStaff.weekBookings}건`} />
        <StaffMetric label="연차 잔여" value={`${getAnnualLeaveUsage(selectedStaff, requests).remaining}일`} />
      </div>
      <div className="mt-5 flex gap-2">
        <GhostButton label="휴무/연차 등록" onClick={onOpenLeaveDialog} />
        <GhostButton label="스태프 비활성화" onClick={onDeactivate} />
      </div>
    </WebSurface>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-normal text-[#334155]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function TextInput({ value, onChange, type = "text", placeholder }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
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

export function WeekdayColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedKeys = new Set(parseWeekdayText(value));

  function toggleDay(key: WeekdayKey) {
    const nextKeys = new Set(selectedKeys);
    if (nextKeys.has(key)) nextKeys.delete(key);
    else nextKeys.add(key);
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
                "h-10 rounded-[8px] border text-[13px] font-semibold transition",
                selected ? "border-[#9ccabe] bg-[#f3faf7] text-[#1f6b5b]" : "border-[#d5dde6] bg-[#f8fafc] text-[#64748b]",
              )}
              aria-pressed={selected}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeSelect({
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
  const options = timeSelectOptions.some((option) => option.value === value) ? timeSelectOptions : [{ value, label: value }, ...timeSelectOptions];
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

export function CompactInput({
  value,
  onChange,
  type = "text",
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-right text-[14px] text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#2f7866] focus:bg-white"
    />
  );
}

export function StaffInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-[#edf2f7] py-2 last:border-b-0">
      <span className="shrink-0 text-[13px] text-[#64748b]">{label}</span>
      <div className="ml-auto flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

export function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2">
      <p className="text-[12px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 text-[15px] font-medium text-[#111827]">{value}</p>
    </div>
  );
}

export function StaffBoardTabs({ activeTab, onChange }: { activeTab: StaffBoardTab; onChange: (tab: StaffBoardTab) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[#dbe2ea] pb-2">
      {[
        { key: "schedule" as StaffBoardTab, label: "주간 근무표" },
        { key: "list" as StaffBoardTab, label: "스태프 목록" },
      ].map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "h-10 rounded-[8px] px-4 text-[15px] transition",
            activeTab === tab.key ? "border border-[#dbe2ea] bg-white text-[#111827] shadow-sm" : "text-[#475569] hover:bg-[#f8fafc]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StaffDraftForm({ draft, onChange }: { draft: StaffDraft; onChange: (draft: StaffDraft) => void }) {
  return (
    <div className="space-y-3">
      <Field label="스태프명">
        <TextInput value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="예: 박수현" />
      </Field>
      <Field label="연락처">
        <TextInput value={draft.phone} onChange={(phone) => onChange({ ...draft, phone })} placeholder="010-0000-0000" />
      </Field>
      <Field label="역할">
        <TextInput value={draft.role} onChange={(role) => onChange({ ...draft, role })} placeholder="예: 미용사 / 목욕" />
      </Field>
      <Field label="기본 근무 요일">
        <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onChange({ ...draft, defaultDaysText })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="기본 출근">
          <TimeSelect value={draft.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} align="left" />
        </Field>
        <Field label="기본 퇴근">
          <TimeSelect value={draft.endTime} onChange={(endTime) => onChange({ ...draft, endTime })} align="left" />
        </Field>
      </div>
    </div>
  );
}

export function StaffScheduleEditModal({
  draft,
  defaultScheduleOpen,
  onClose,
  onToggleDefaultSchedule,
  onDraftChange,
  onSaveDefaultSchedule,
  onReset,
  onSave,
}: {
  draft: ScheduleEditDraft;
  defaultScheduleOpen: boolean;
  onClose: () => void;
  onToggleDefaultSchedule: () => void;
  onDraftChange: (updater: (current: ScheduleEditDraft | null) => ScheduleEditDraft | null) => void;
  onSaveDefaultSchedule: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <StaffModal title={`${formatShortDate(draft.date)} ${draft.dayLabel}`} onClose={onClose}>
      <div className="rounded-[8px] border border-[#dbe2ea]">
        <button type="button" onClick={onToggleDefaultSchedule} className="flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-[#111827]">
          <span>기본 근무 설정</span>
          <ChevronDown className={cn("h-4 w-4 transition", defaultScheduleOpen && "rotate-180")} />
        </button>
        {defaultScheduleOpen ? (
          <div className="space-y-3 border-t border-[#edf2f7] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Field label="기본 근무 요일">
                <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onDraftChange((current) => (current ? { ...current, defaultDaysText } : current))} />
              </Field>
              <GhostButton label="저장" onClick={onSaveDefaultSchedule} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="기본 출근">
                <TimeSelect value={draft.defaultStartTime} onChange={(defaultStartTime) => onDraftChange((current) => (current ? { ...current, defaultStartTime } : current))} align="left" />
              </Field>
              <Field label="기본 퇴근">
                <TimeSelect value={draft.defaultEndTime} onChange={(defaultEndTime) => onDraftChange((current) => (current ? { ...current, defaultEndTime } : current))} align="left" />
              </Field>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <Field label="이날 일정">
          <SoftSelect<ScheduleOverrideStatus>
            value={draft.status}
            onChange={(status) => onDraftChange((current) => (current ? { ...current, status } : current))}
            options={[
              { value: "work", label: "근무" },
              { value: "off", label: "휴무" },
              { value: "annual", label: "연차" },
              { value: "half", label: "반차" },
            ]}
            align="left"
            buttonClassName="h-10"
          />
        </Field>
        {draft.status === "work" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="출근 시간">
              <TimeSelect value={draft.startTime} onChange={(startTime) => onDraftChange((current) => (current ? { ...current, startTime } : current))} align="left" />
            </Field>
            <Field label="퇴근 시간">
              <TimeSelect value={draft.endTime} onChange={(endTime) => onDraftChange((current) => (current ? { ...current, endTime } : current))} align="left" />
            </Field>
          </div>
        ) : null}
        {draft.status === "half" ? (
          <Field label="반차 구분">
            <SoftSelect<"오전" | "오후">
              value={draft.period}
              onChange={(period) => onDraftChange((current) => (current ? { ...current, period } : current))}
              options={[
                { value: "오전", label: "오전 반차" },
                { value: "오후", label: "오후 반차" },
              ]}
              align="left"
              buttonClassName="h-10"
            />
          </Field>
        ) : null}
        {draft.status !== "work" ? (
          <Field label="메모">
            <TextInput value={draft.reason} onChange={(reason) => onDraftChange((current) => (current ? { ...current, reason } : current))} placeholder="예: 개인 일정, 병원 방문" />
          </Field>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <GhostButton label="기본값" onClick={onReset} />
        <GhostButton label="취소" onClick={onClose} />
        <PrimaryButton label="저장" onClick={onSave} />
      </div>
    </StaffModal>
  );
}

export function StaffModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={onClose}>
      <div
        className="max-h-[calc(100vh-48px)] w-full max-w-[500px] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[20px] font-semibold text-[#111827]">{title}</h3>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
