import type { ReactNode } from "react";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ImagePlus, UserRound, X } from "lucide-react";

import { GhostButton, PrimaryButton, SoftSelect } from "@/components/owner-web/owner-web-ui";
import { getWrapIndicatorClass } from "@/components/owner-web/status-indicators";
import { getStaffChipTone, staffChipPalette } from "@/lib/staff-chip-colors";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import {
  applyScheduleToCell,
  buildDraft,
  formatFixedOffDays,
  formatShortDate,
  formatWeekdayKeys,
  getAnnualLeaveUsage,
  getCellIndicatorTone,
  getCellTone,
  getScheduledLeaveCount,
  getStaffRank,
  getStaffAvailability,
  getTodayKey,
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
  compact = false,
  onChange,
}: {
  name: string;
  value: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <label className={cn(
        "group relative flex shrink-0 cursor-pointer flex-col items-center justify-center border border-[#dbe2ea] bg-white text-center font-normal tracking-[-0.02em] text-[#111111] transition hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#94a3b8]/20",
        compact ? "h-[104px] w-[96px] rounded-[12px] px-2 py-3 text-[14px]" : "h-[136px] w-[118px] rounded-[14px] px-3 py-4 text-[16px]",
      )}>
        <span className={cn("relative flex items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] text-[#475569]", compact ? "h-11 w-11" : "h-[54px] w-[54px]")}>
          {value ? (
            <img src={value} alt={`${name || "스태프"} 프로필`} className="h-full w-full rounded-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" strokeWidth={1.8} />
          )}
          {value ? (
            <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_4px_rgba(15,23,42,0.12)]">
              <ImagePlus className="h-3 w-3" strokeWidth={1.9} />
            </span>
          ) : null}
        </span>
        <span className={cn("max-w-full truncate font-medium", compact ? "mt-2 text-[14px] leading-[18px]" : "mt-3 text-[16px] leading-[19px]")}>{title}</span>
        {subtitle ? <span className="mt-1 max-w-full truncate text-[13px] leading-[15px] text-[#64748b]">{subtitle}</span> : null}
        <span className={cn("pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/[0.025]", compact ? "rounded-[12px]" : "rounded-[14px]")} />
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
                  style={{ "--pm-wrap-indicator-color": staffTone.selectedBackground } as CSSProperties}
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
  const [expanded, setExpanded] = useState(selectedIndex >= 8);
  const visiblePalette = expanded ? staffChipPalette : staffChipPalette.slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-8 gap-1.5">
        {visiblePalette.map((tone, index) => {
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
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="h-8 rounded-[8px] px-2 text-[15px] text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
      >
        {expanded ? "간단히 보기" : "더보기"}
      </button>
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
  const todayKey = getTodayKey();
  const todayDate = currentDateInTimeZone();

  return (
    <div className="max-h-[560px] overflow-y-auto py-4 pl-4 pr-1">
      <div className="grid gap-3 2xl:grid-cols-2">
          {staff.map((staffMember, staffIndex) => {
            const active = selectedStaffId === staffMember.id;
            const staffTone = getStaffChipTone(staffMember.id, staffMember.chipColorIndex ?? staffIndex);
            const weeklyDays = getWeeklyWorkDays(staffMember, weekStart, requests, overrides);
            const todayCell = applyScheduleToCell(staffMember, todayKey, todayDate, requests, overrides);
            const annualUsage = getAnnualLeaveUsage(staffMember, requests);
            const upcomingLeave = getUpcomingStaffLeave(staffMember, requests, todayDate);
            const fixedOffDaysLabel = formatFixedOffDays(staffMember.defaultDays);
            const todayStatusLabel = todayCell.status === "work" ? todayCell.label : todayCell.label || getStaffAvailability(staffMember, requests, overrides);

            return (
              <button
                key={staffMember.id}
                type="button"
                onClick={() => onSelect(staffMember)}
                className={cn(
                  "grid w-full gap-3 rounded-[10px] border bg-white p-4 text-left transition hover:border-[#cbd5e1] hover:bg-[#fbfcfd]",
                  getWrapIndicatorClass(getCellIndicatorTone(todayCell.status)),
                  active ? "border-[#cbd5e1] shadow-[0_10px_26px_rgba(15,23,42,0.06)]" : "border-[#dbe2ea]",
                )}
                style={{ "--pm-wrap-indicator-color": staffTone.selectedBackground } as CSSProperties}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <StaffAvatar name={staffMember.name} imageUrl={staffMember.profileImageUrl} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-[17px] font-medium text-[#111827]">{staffMember.name}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-[#64748b]">
                        {staffMember.position || staffMember.role || "직원"}
                        {staffMember.phone ? ` · ${staffMember.phone}` : ""}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[13px] font-medium",
                      todayCell.status === "work"
                        ? "border-[#c8d2dc] bg-[#f8fafc] text-[#607080]"
                        : "border-[#e5c7cf] bg-[#fff8fa] text-[#a04455]",
                    )}
                  >
                    {todayCell.status === "work" ? "오늘 근무" : "오늘 휴무"}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <StaffListMetric label="오늘 예약" value={`${staffMember.todayBookings ?? 0}건`} />
                  <StaffListMetric label="주간 예약" value={`${staffMember.weekBookings ?? 0}건`} />
                  <StaffListMetric label="주간 근무" value={`${weeklyDays}일`} />
                  <StaffListMetric label="남은 연차" value={`${annualUsage.remaining}일`} />
                </div>

                <div className="grid gap-1.5 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[13px] leading-5 text-[#475569]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">오늘 일정</span>
                    <span className="truncate text-right font-medium text-[#111827]">{todayStatusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">고정 휴무일</span>
                    <span className="truncate text-right font-medium text-[#111827]">
                      {fixedOffDaysLabel || "없음"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#64748b]">다음 휴무/연차</span>
                    <span className="truncate text-right font-medium text-[#111827]">
                      {upcomingLeave ? `${formatShortDate(upcomingLeave.date)} ${upcomingLeave.type}` : "예정 없음"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function StaffListMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 rounded-[8px] border border-[#e2e8f0] bg-white px-2.5 py-2 text-center">
      <span className="block truncate text-[12px] text-[#64748b]">{label}</span>
      <span className="mt-0.5 block truncate text-[16px] font-medium text-[#111827]">{value}</span>
    </span>
  );
}

function getUpcomingStaffLeave(staffMember: StaffMember, requests: LeaveRequest[], today: string) {
  return requests
    .filter((request) => request.staffId === staffMember.id && request.status !== "거절" && request.date >= today)
    .sort((first, second) => first.date.localeCompare(second.date))[0];
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
    <div className="space-y-3">
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
        <Field label="직원 프로필 메시지">
          <TextAreaInput
            value={draft.profileMessage}
            onChange={(profileMessage) => onDraftChange((current) => ({ ...current, profileMessage }))}
            placeholder="예: 아이 성향에 맞춰 차분하게 미용해드려요."
          />
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
        <Field label="고정 휴무일">
          <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onDraftChange((current) => ({ ...current, defaultDaysText }))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="고정 출근 시간">
            <TimeSelect value={draft.startTime} onChange={(startTime) => onDraftChange((current) => ({ ...current, startTime }))} align="left" buttonClassName="h-10" />
          </Field>
          <Field label="고정 퇴근 시간">
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
    </div>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[16px] font-normal text-[#334155]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function StaffDraftFieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <>
      {label}
      <span className={required ? "ml-1 text-[#a04455]" : "ml-1 text-[14px] text-[#94a3b8]"}>{required ? "*" : "(선택)"}</span>
    </>
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

export function TextAreaInput({ value, onChange, placeholder, compact = false }: { value: string; onChange: (value: string) => void; placeholder?: string; compact?: boolean }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value.slice(0, 80))}
      placeholder={placeholder}
      rows={2}
        className={cn("w-full resize-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] leading-6 text-[#111827] outline-none transition placeholder:text-[#9aa8bb] focus:border-[#94a3b8]", compact ? "min-h-[64px]" : "min-h-[72px]")}
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

export function StaffBoardTabs({
  activeTab,
  onChange,
  trailing,
}: {
  activeTab: StaffBoardTab;
  onChange: (tab: StaffBoardTab) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-10 flex-wrap items-center gap-3 pb-2">
      <div className="flex flex-wrap items-center gap-3">
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
      {trailing ? <div className="absolute left-1/2 top-0 shrink-0 -translate-x-1/2">{trailing}</div> : null}
    </div>
  );
}

export function StaffDraftForm({ draft, onChange, fallbackColorIndex = 0 }: { draft: StaffDraft; onChange: (draft: StaffDraft) => void; fallbackColorIndex?: number }) {
  const displayName = draft.displayName.trim() || draft.name.trim() || "프로필";
  const title = [draft.titlePrefix.trim(), draft.position.trim()].filter(Boolean).join(" ");

  return (
    <div className="space-y-2.5">
      <StaffPhotoField compact name={displayName} value={draft.profileImageUrl} title={displayName} subtitle={title} onChange={(profileImageUrl) => onChange({ ...draft, profileImageUrl })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={<StaffDraftFieldLabel label="이름" required />}>
          <TextInput value={draft.name} onChange={(name) => onChange({ ...draft, name })} placeholder="예: 박수현" />
        </Field>
        <Field label={<StaffDraftFieldLabel label="고객에게 노출할 이름" />}>
          <TextInput value={draft.displayName} onChange={(displayName) => onChange({ ...draft, displayName })} placeholder="예: 진" />
        </Field>
      </div>
      <Field label={<StaffDraftFieldLabel label="직원 프로필 메시지" />}>
        <TextAreaInput
          value={draft.profileMessage}
          onChange={(profileMessage) => onChange({ ...draft, profileMessage })}
          placeholder="예: 아이 성향에 맞춰 차분하게 미용해드려요."
          compact
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={<StaffDraftFieldLabel label="직책" />}>
          <TextInput value={draft.titlePrefix} onChange={(titlePrefix) => onChange({ ...draft, titlePrefix })} placeholder="예: 대표, 수석, 원장" />
        </Field>
        <Field label={<StaffDraftFieldLabel label="역할" />}>
          <TextInput value={draft.position} onChange={(position) => onChange({ ...draft, position })} placeholder="예: 디자이너" />
        </Field>
      </div>
      <Field label={<StaffDraftFieldLabel label="개인 칩 색" />}>
        <StaffChipColorPicker value={draft.chipColorIndex} fallbackIndex={fallbackColorIndex} onChange={(chipColorIndex) => onChange({ ...draft, chipColorIndex })} />
      </Field>
      <Field label={<StaffDraftFieldLabel label="연락처" />}>
        <TextInput value={draft.phone} onChange={(phone) => onChange({ ...draft, phone: formatStaffPhone(phone) })} placeholder="010-0000-0000" />
      </Field>
      <Field label={<StaffDraftFieldLabel label="고정 휴무일" />}>
        <WeekdayColorPicker value={draft.defaultDaysText} onChange={(defaultDaysText) => onChange({ ...draft, defaultDaysText })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={<StaffDraftFieldLabel label="고정 출근 시간" />}>
          <TimeSelect value={draft.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} align="left" />
        </Field>
        <Field label={<StaffDraftFieldLabel label="고정 퇴근 시간" />}>
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
            <span className="block text-[14px] font-normal text-[#334155]">고정 휴무 기준</span>
            <span className="mt-0.5 block text-[13px] text-[#64748b]">매주 쉬는 요일은 필요할 때만 수정합니다.</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-[#64748b] transition", defaultScheduleOpen && "rotate-180")} />
        </button>
        {defaultScheduleOpen ? (
          <div className="border-t border-[#edf2f7] px-4 py-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_auto] md:items-start">
              <Field label="반복 휴무 요일">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/28 px-4 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="max-h-[calc(100dvh-48px)] w-full max-w-[500px] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
    </div>,
    document.body,
  );
}
