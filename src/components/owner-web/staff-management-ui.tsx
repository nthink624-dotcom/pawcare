import type { ReactNode } from "react";
import { ChevronDown, ImagePlus, UserRound, X } from "lucide-react";

import { GhostButton, PrimaryButton, SoftSelect, WebSurface } from "@/components/owner-web/owner-web-ui";
import { getWrapIndicatorClass } from "@/components/owner-web/status-indicators";
import { getStaffChipTone, staffChipPalette } from "@/lib/staff-chip-colors";
import { getStaffCustomerName, getStaffPositionName } from "@/lib/staff-display";
import { cn } from "@/lib/utils";
import {
  applyScheduleToCell,
  buildDraft,
  formatShortDate,
  formatWeekdayKeys,
  getAnnualLeaveUsage,
  getCellIndicatorTone,
  getCellTone,
  getScheduledLeaveCount,
  getStaffRank,
  getStaffAvailability,
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

function formatStaffPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function StaffAvatar({ name, imageUrl, size = "md" }: { name: string; imageUrl?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const iconSizeClass = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dbe2ea] bg-[#f8fafc] text-[#475569]", sizeClass)}>
      {imageUrl ? <img src={imageUrl} alt={`${name || "스태프"} 프로필`} className="h-full w-full object-cover" /> : <UserRound className={iconSizeClass} strokeWidth={1.8} />}
    </span>
  );
}

function StaffPhotoField({
  name,
  value,
  title = "프로필",
  subtitle = "",
  onChange,
}: {
  name: string;
  value: string;
  title?: string;
  subtitle?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <label className="group relative flex h-[84px] w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-[12px] border border-[#dbe2ea] bg-white px-2 text-center text-[16px] font-normal tracking-[-0.02em] text-[#111111] transition hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#94a3b8]/20">
        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] text-[#475569]">
          {value ? (
            <img src={value} alt={`${name || "스태프"} 프로필`} className="h-full w-full rounded-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
          )}
          {value ? (
            <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_4px_rgba(15,23,42,0.12)]">
              <ImagePlus className="h-3 w-3" strokeWidth={1.9} />
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 max-w-full truncate text-[15px] font-normal leading-[17px]">{title}</span>
        {subtitle ? <span className="mt-0.5 max-w-full truncate text-[13px] leading-[15px] text-[#64748b]">{subtitle}</span> : null}
        <span className="pointer-events-none absolute inset-0 rounded-[12px] bg-black/0 transition group-hover:bg-black/[0.025]" />
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="프로필 사진 변경"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {value ? (
        <button type="button" onClick={() => onChange("")} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]" aria-label="프로필 사진 삭제">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

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
      <div className="min-w-[1240px]">
        <div className="grid grid-cols-[180px_repeat(7,minmax(150px,1fr))] border-b border-[#edf2f7] bg-[#f8fafc] text-[14px] text-[#64748b]">
          <div className="px-5 py-3">이름</div>
          {weekDates.map((day) => (
            <div key={day.date} className="whitespace-nowrap px-3 py-3 text-center [word-break:keep-all]">
              {day.label}
            </div>
          ))}
        </div>
        {staff.map((staffMember, staffIndex) => (
          <div key={staffMember.id} className="grid grid-cols-[180px_repeat(7,minmax(150px,1fr))] items-center border-b border-[#edf2f7] last:border-b-0">
            <button type="button" className="px-5 py-4 text-left">
              <p className="text-[16px] font-normal text-[#111827]">{staffMember.name}</p>
            </button>
            {weekDates.map((day) => {
              const cell = applyScheduleToCell(staffMember, day.key, day.date, requests, overrides);
              const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
              return (
                <button
                  key={`${staffMember.id}-${day.date}`}
                  type="button"
                  onClick={() => onOpenScheduleEditor(staffMember, day)}
                  className={cn(
                    "relative mx-2 my-3 flex h-9 min-w-[130px] items-center justify-between gap-2 overflow-hidden rounded-[8px] border bg-white px-2.5 text-left text-[14px] font-medium leading-none whitespace-nowrap [word-break:keep-all] transition hover:bg-[#f8fafc]",
                    getCellTone(cell.status),
                    getWrapIndicatorClass(getCellIndicatorTone(cell.status)),
                  )}
                  style={
                    {
                      borderColor: staffTone.border,
                      "--pm-wrap-indicator-color": staffTone.border,
                    } as any
                  }
                >
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap font-normal [word-break:keep-all]" style={{ color: staffTone.text }}>
                    {staffMember.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-normal tabular-nums text-[#64748b] [word-break:keep-all]">{cell.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffChipColorPicker({ value, fallbackIndex = 0, onChange }: { value: number | null; fallbackIndex?: number; onChange: (value: number) => void }) {
  const selectedIndex = value ?? fallbackIndex % staffChipPalette.length;

  return (
    <div className="grid grid-cols-8 gap-1.5">
      {staffChipPalette.map((tone, index) => {
        const selected = selectedIndex === index;
        return (
          <button
            key={tone.selectedBackground}
            type="button"
            onClick={() => onChange(index)}
            className={cn(
              "h-9 rounded-[8px] border bg-white p-1 transition hover:bg-[#f8fafc]",
              selected ? "border-[#64748b] ring-1 ring-[#64748b]/30" : "border-[#dbe2ea]",
            )}
            aria-label={`직원 칩 색 ${index + 1}`}
          >
            <span className="block h-full rounded-[6px]" style={{ backgroundColor: tone.selectedBackground }} />
          </button>
        );
      })}
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
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <div className="min-w-[1160px]">
        <div className="grid grid-cols-[minmax(160px,1fr)_minmax(140px,0.85fr)_minmax(100px,0.62fr)_minmax(120px,0.72fr)_minmax(150px,0.9fr)_112px_112px_104px_104px] items-center gap-3 border-b border-[#edf2f7] bg-white px-5 py-2.5 text-center text-[16px] font-normal text-[#64748b]">
          <span className="whitespace-nowrap">이름</span>
          <span className="whitespace-nowrap">노출 이름</span>
          <span className="whitespace-nowrap">직책</span>
          <span className="whitespace-nowrap">역할</span>
          <span className="whitespace-nowrap">연락처</span>
          <span className="whitespace-nowrap text-center">상태</span>
          <span className="whitespace-nowrap text-center">주간 근무</span>
          <span className="whitespace-nowrap text-center">오늘 예약</span>
          <span className="whitespace-nowrap text-center">휴무/연차</span>
        </div>
        <div className="max-h-[560px] divide-y divide-[#edf2f7] overflow-x-hidden overflow-y-auto">
          {staff.map((staffMember) => {
            const active = selectedStaffId === staffMember.id;
            const availability = getStaffAvailability(staffMember, requests, overrides);
            const weeklyDays = getWeeklyWorkDays(staffMember, weekStart, requests, overrides);

            return (
              <button
                key={staffMember.id}
                type="button"
                onClick={() => onSelect(staffMember)}
                className={cn(
                  "grid w-full grid-cols-[minmax(160px,1fr)_minmax(140px,0.85fr)_minmax(100px,0.62fr)_minmax(120px,0.72fr)_minmax(150px,0.9fr)_112px_112px_104px_104px] items-center gap-3 px-5 py-3 text-center transition",
                  active ? "bg-white" : "bg-white hover:bg-white",
                )}
              >
                <div className="flex min-w-0 items-center justify-center gap-3">
                  <StaffAvatar name={staffMember.name} imageUrl={staffMember.profileImageUrl} size="sm" />
                  <p className="truncate text-center text-[16px] font-normal text-[#111827]">{staffMember.name}</p>
                </div>
                <p className="truncate text-center text-[16px] text-[#334155]">{getStaffCustomerName(staffMember) || "-"}</p>
                <p className="truncate text-center text-[16px] text-[#334155]">{staffMember.titlePrefix?.trim() || "-"}</p>
                <p className="truncate text-center text-[16px] text-[#334155]">{getStaffPositionName(staffMember) || "-"}</p>
                <p className="truncate text-center text-[16px] tabular-nums text-[#475569]">{staffMember.phone || "-"}</p>
                <span
                  className={cn(
                    "justify-self-center rounded-full px-2.5 py-1 text-[16px] font-normal",
                    availability === "근무 가능" ? "bg-[#f1f5f9] text-[#334155]" : "bg-[#f1f5f9] text-[#64748b]",
                  )}
                >
                  {availability}
                </span>
                <p className="text-center text-[16px] text-[#334155]">{weeklyDays}일</p>
                <p className="text-center text-[16px] text-[#334155]">{staffMember.todayBookings}건</p>
                <p className="text-center text-[16px] text-[#334155]">{getScheduledLeaveCount(staffMember, requests)}건</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StaffDetailPanel({
  selectedStaff,
  draft,
  requests,
  overrides,
  fallbackColorIndex,
  onDraftChange,
  onSave,
  onOpenLeaveDialog,
  onOpenAnnualGrantDialog,
}: {
  selectedStaff: StaffMember;
  draft: StaffDraft;
  requests: LeaveRequest[];
  overrides: ScheduleOverride[];
  fallbackColorIndex: number;
  onDraftChange: (updater: (current: StaffDraft) => StaffDraft) => void;
  onSave: () => void;
  onOpenLeaveDialog: () => void;
  onOpenAnnualGrantDialog: () => void;
}) {
  const annualUsage = getAnnualLeaveUsage(selectedStaff, requests);
  const internalName = draft.name.trim() || selectedStaff.name;
  const customerVisibleName = draft.displayName.trim() || internalName;
  const positionName = draft.position.trim() || getStaffRank(selectedStaff.role);
  const profileSubtitle = [draft.titlePrefix.trim(), positionName].filter(Boolean).join(" ");

  return (
    <WebSurface className="p-3">
      <div className="space-y-2">
        <StaffPhotoField
          name={customerVisibleName}
          value={draft.profileImageUrl}
          title={customerVisibleName}
          subtitle={profileSubtitle}
          onChange={(profileImageUrl) => onDraftChange((current) => ({ ...current, profileImageUrl }))}
        />
        <Field label="고객에게 노출할 이름">
          <TextInput value={draft.displayName} onChange={(displayName) => onDraftChange((current) => ({ ...current, displayName }))} placeholder="예: 진" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="직책">
            <TextInput value={draft.titlePrefix} onChange={(titlePrefix) => onDraftChange((current) => ({ ...current, titlePrefix }))} placeholder="예: 대표, 수석, 원장" />
          </Field>
          <Field label="역할">
            <TextInput value={draft.position} onChange={(position) => onDraftChange((current) => ({ ...current, position }))} placeholder="예: 디자이너" />
          </Field>
        </div>
        <Field label="개인 칩 색">
          <StaffChipColorPicker value={draft.chipColorIndex} fallbackIndex={fallbackColorIndex} onChange={(chipColorIndex) => onDraftChange((current) => ({ ...current, chipColorIndex }))} />
        </Field>
        <Field label="이름">
          <TextInput value={draft.name} onChange={(name) => onDraftChange((current) => ({ ...current, name }))} />
        </Field>
        <Field label="연락처">
          <TextInput value={draft.phone} onChange={(phone) => onDraftChange((current) => ({ ...current, phone: formatStaffPhone(phone) }))} placeholder="010-0000-0000" />
        </Field>
        <Field label="기본 근무 요일">
          <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onDraftChange((current) => ({ ...current, defaultDaysText }))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="기본 출근 시간">
            <TimeSelect value={draft.startTime} onChange={(startTime) => onDraftChange((current) => ({ ...current, startTime }))} align="left" buttonClassName="h-10" />
          </Field>
          <Field label="기본 퇴근 시간">
            <TimeSelect value={draft.endTime} onChange={(endTime) => onDraftChange((current) => ({ ...current, endTime }))} align="left" buttonClassName="h-10" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="정기 휴무">
            <TextInput value={draft.regularOff} onChange={(regularOff) => onDraftChange((current) => ({ ...current, regularOff }))} placeholder="예: 일" />
          </Field>
          <Field label="연차 잔여일">
            <TextInput value={draft.annualRemain} onChange={(annualRemain) => onDraftChange((current) => ({ ...current, annualRemain }))} type="number" />
          </Field>
        </div>
        <div className="rounded-[8px] border border-[#edf2f7] bg-white px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-[16px]">
            <span className="text-[#64748b]">예정 휴무/연차</span>
            <span className="font-normal text-[#111827]">{getScheduledLeaveCount(selectedStaff, requests)}건</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[16px]">
            <span className="text-[#64748b]">남은 연차</span>
            <span className="font-normal text-[#111827]">{annualUsage.remaining}일</span>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <GhostButton label="취소" onClick={() => onDraftChange(() => buildDraft(selectedStaff))} />
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-[40px] items-center justify-center rounded-[8px] bg-[#111827] px-4 text-[14px] font-medium text-white hover:bg-[#1f2937]"
        >
          저장
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <GhostButton label="휴무/연차 등록" onClick={onOpenLeaveDialog} />
        <GhostButton label="연차 일괄 부여" onClick={onOpenAnnualGrantDialog} />
      </div>
    </WebSurface>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[16px] font-normal text-[#334155]">{label}</span>
      <div className="mt-1.5">{children}</div>
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
      className="h-9 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] text-[#111827] outline-none focus:border-[#94a3b8] focus:bg-white"
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
      <div className="flex flex-wrap gap-1.5">
        {weekdayColumns.map((day) => {
          const selected = selectedKeys.has(day.key);
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => toggleDay(day.key)}
              className={cn(
                "h-8 min-w-8 rounded-full border px-2 text-[16px] font-normal transition",
                selected ? "border-[#111827] bg-white text-[#111827]" : "border-[#d5dde6] bg-white text-[#64748b]",
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
      buttonClassName={cn("h-9 bg-white px-2", buttonClassName)}
      valueClassName="text-[16px] font-normal"
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
      className="h-8 min-w-0 flex-1 rounded-[6px] border border-transparent bg-transparent px-2 text-right text-[16px] text-[#111827] outline-none transition hover:border-[#dbe2ea] hover:bg-[#f8fafc] focus:border-[#94a3b8] focus:bg-white"
    />
  );
}

export function StaffInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-[#edf2f7] py-2 last:border-b-0">
      <span className="shrink-0 text-[16px] text-[#64748b]">{label}</span>
      <div className="ml-auto flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

export function StaffMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#edf2f7] bg-white px-3 py-2">
      <p className="text-[16px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 text-[16px] font-normal text-[#111827]">{value}</p>
    </div>
  );
}

export function StaffBoardTabs({ activeTab, onChange }: { activeTab: StaffBoardTab; onChange: (tab: StaffBoardTab) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-2">
      {[
        { key: "monthly" as StaffBoardTab, label: "월간 근무표" },
        { key: "list" as StaffBoardTab, label: "직원 목록" },
      ].map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "h-10 rounded-[8px] px-4 text-[16px] transition",
            activeTab === tab.key ? "border border-[#dbe2ea] bg-white text-[#111827] shadow-sm" : "text-[#475569] hover:bg-[#f8fafc]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StaffDraftForm({ draft, onChange, fallbackColorIndex = 0 }: { draft: StaffDraft; onChange: (draft: StaffDraft) => void; fallbackColorIndex?: number }) {
  const displayName = draft.displayName.trim() || draft.name.trim() || "프로필";
  const title = [draft.titlePrefix.trim(), draft.position.trim()].filter(Boolean).join(" ");

  return (
    <div className="space-y-3">
      <StaffPhotoField name={displayName} value={draft.profileImageUrl} title={displayName} subtitle={title} onChange={(profileImageUrl) => onChange({ ...draft, profileImageUrl })} />
      <Field label="이름">
        <TextInput value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="예: 박수현" />
      </Field>
      <Field label="고객에게 노출할 이름">
        <TextInput value={draft.displayName} onChange={(displayName) => onChange({ ...draft, displayName })} placeholder="예: 진" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="직책">
          <TextInput value={draft.titlePrefix} onChange={(titlePrefix) => onChange({ ...draft, titlePrefix })} placeholder="예: 대표, 수석, 원장" />
        </Field>
        <Field label="역할">
          <TextInput value={draft.position} onChange={(position) => onChange({ ...draft, position })} placeholder="예: 디자이너" />
        </Field>
      </div>
      <Field label="개인 칩 색">
        <StaffChipColorPicker value={draft.chipColorIndex} fallbackIndex={fallbackColorIndex} onChange={(chipColorIndex) => onChange({ ...draft, chipColorIndex })} />
      </Field>
      <Field label="연락처">
        <TextInput value={draft.phone} onChange={(phone) => onChange({ ...draft, phone: formatStaffPhone(phone) })} placeholder="010-0000-0000" />
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
      <div className="space-y-3">
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
              <TimeSelect value={draft.startTime} onChange={(startTime) => onDraftChange((current) => (current ? { ...current, startTime } : current))} align="left" buttonClassName="h-10" />
            </Field>
            <Field label="퇴근 시간">
              <TimeSelect value={draft.endTime} onChange={(endTime) => onDraftChange((current) => (current ? { ...current, endTime } : current))} align="left" buttonClassName="h-10" />
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

      <div className="mt-5 overflow-hidden rounded-[8px] border border-[#e5eaf0] bg-[#fbfcfd]">
        <button type="button" onClick={onToggleDefaultSchedule} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="min-w-0">
            <span className="block text-[14px] font-normal text-[#334155]">반복 근무 기준</span>
            <span className="mt-0.5 block text-[13px] text-[#64748b]">매주 반복되는 요일과 시간은 필요할 때만 수정합니다.</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-[#64748b] transition", defaultScheduleOpen && "rotate-180")} />
        </button>
        {defaultScheduleOpen ? (
          <div className="border-t border-[#edf2f7] px-4 py-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_auto] md:items-start">
              <Field label="반복 근무 요일">
                <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onDraftChange((current) => (current ? { ...current, defaultDaysText } : current))} />
              </Field>
              <div className="flex justify-end">
                <GhostButton label="기준 저장" onClick={onSaveDefaultSchedule} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="출근 기준">
                <TimeSelect value={draft.defaultStartTime} onChange={(defaultStartTime) => onDraftChange((current) => (current ? { ...current, defaultStartTime } : current))} align="left" buttonClassName="h-10" />
              </Field>
              <Field label="퇴근 기준">
                <TimeSelect value={draft.defaultEndTime} onChange={(defaultEndTime) => onDraftChange((current) => (current ? { ...current, defaultEndTime } : current))} align="left" buttonClassName="h-10" />
              </Field>
            </div>
          </div>
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
