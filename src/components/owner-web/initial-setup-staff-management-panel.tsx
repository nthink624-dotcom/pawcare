"use client";

import { OwnerInitialSetupSaveNextActions } from "@/components/owner-web/owner-initial-setup-guide";
import StaffProfilePhotoField, {
  type InitialSetupStaffPhotoDraft,
} from "@/components/owner-web/staff-profile-photo-field";
import {
  weekdayColumns,
  type StaffDraft,
  type StaffMember,
  type WeekdayKey,
} from "@/components/owner-web/staff-management-model";

export type InitialSetupStaffSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type InitialSetupStaffSessionDraft = {
  staffId: string | null;
  draft: StaffDraft;
  photo: InitialSetupStaffPhotoDraft;
  saveState: InitialSetupStaffSaveState;
};

export function formatInitialSetupStaffPhone(value: string) {
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

function staffRole(staffMember: StaffMember, ownerStaffId: string) {
  if (staffMember.id === ownerStaffId || staffMember.id.endsWith("-staff-owner")) return "대표";
  return staffMember.position?.trim() || staffMember.role.split(/[/.|]/)[0]?.trim() || "직원";
}

const INPUT_CLASS = "mt-1.5 min-h-11 w-full min-w-0 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 text-[#15213b] outline-none placeholder:text-[#94a3b8] focus:border-[#94a3b8] focus-visible:ring-2 focus-visible:ring-[#2563eb] read-only:bg-[#f8fafc]";

export default function InitialSetupStaffManagementPanel({
  staff,
  ownerStaffId,
  ownerStaffName,
  selectedStaffId,
  draft,
  photo,
  workDayKeys,
  ownerLocked,
  saveState,
  feedback,
  onSelectStaff,
  onDraftChange,
  onToggleWorkday,
  onPhotoFileChange,
  onPhotoRemove,
  onPhotoReset,
  onPhotoError,
  onSave,
  onNext,
}: {
  staff: StaffMember[];
  ownerStaffId: string;
  ownerStaffName: string;
  selectedStaffId: string | null;
  draft: StaffDraft;
  photo: InitialSetupStaffPhotoDraft;
  workDayKeys: WeekdayKey[];
  ownerLocked: boolean;
  saveState: InitialSetupStaffSaveState;
  feedback: string;
  onSelectStaff: (staffMember: StaffMember) => void;
  onDraftChange: (patch: Partial<StaffDraft>) => void;
  onToggleWorkday: (dayKey: WeekdayKey) => void;
  onPhotoFileChange: (file: File) => void;
  onPhotoRemove: () => void;
  onPhotoReset: () => void;
  onPhotoError: (message: string) => void;
  onSave: () => void;
  onNext: () => void;
}) {
  const persistedUrl = draft.profileImageUrl.trim();
  const isSaving = saveState === "saving";

  return (
    <div className="min-w-0" data-testid="owner-initial-setup-staff">
      <OwnerInitialSetupSaveNextActions onSave={onSave} onNext={onNext} saving={isSaving} />

      <div className="mb-4 min-h-5" aria-live="polite">
        {feedback ? (
          <p
            role={saveState === "error" ? "alert" : "status"}
            className={saveState === "error"
              ? "rounded-[10px] border border-[#f0c7ce] bg-[#fff7f8] px-4 py-3 text-[13px] font-normal leading-5 text-[#a04455]"
              : "rounded-[10px] border border-[#cce7db] bg-[#f3fbf7] px-4 py-3 text-[13px] font-normal leading-5 text-[#177856]"}
          >
            {feedback}
          </p>
        ) : saveState === "dirty" ? (
          <p className="text-[13px] font-normal leading-5 text-[#64748b]">저장하지 않은 변경사항이 있습니다.</p>
        ) : saveState === "saved" ? (
          <p className="text-[13px] font-normal leading-5 text-[#177856]">저장된 직원 정보입니다.</p>
        ) : null}
      </div>

      <div className="grid min-w-0 overflow-hidden rounded-[14px] border border-[#dbe2ea] bg-white md:grid-cols-[220px_minmax(0,1fr)]">
        <section className="min-w-0 border-b border-[#dbe2ea] md:border-b-0 md:border-r" aria-label="직원 목록">
          <div className="flex min-h-11 items-center justify-between border-b border-[#edf2f7] px-4 py-2.5">
            <h3 className="text-[14px] font-medium leading-5 text-[#15213b]">직원 목록</h3>
            <span className="text-[13px] font-normal leading-5 text-[#64748b]">{staff.length}명</span>
          </div>
          {staff.length > 0 ? (
            <div className="space-y-1 p-2">
              {staff.map((staffMember) => {
                const selected = selectedStaffId === staffMember.id;
                const name = staffMember.id === ownerStaffId || staffMember.id.endsWith("-staff-owner") ? ownerStaffName : staffMember.name;
                return (
                  <button
                    key={staffMember.id}
                    type="button"
                    onClick={() => onSelectStaff(staffMember)}
                    aria-pressed={selected}
                    className={selected
                      ? "flex min-h-11 w-full min-w-0 flex-col items-start rounded-[10px] bg-[#f1f4f8] px-3 py-2.5 text-left outline-none ring-1 ring-inset ring-[#dbe2ea] focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                      : "flex min-h-11 w-full min-w-0 flex-col items-start rounded-[10px] px-3 py-2.5 text-left outline-none hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb]"}
                  >
                    <span className="block w-full truncate text-[14px] font-medium leading-5 text-[#15213b]">{name} / {staffRole(staffMember, ownerStaffId)}</span>
                    <span className="mt-1 block text-[13px] font-normal leading-5 tabular-nums text-[#64748b]">근무 {staffMember.startTime}–{staffMember.endTime}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-5 text-[13px] font-normal leading-5 text-[#64748b]">저장된 직원이 없습니다.</p>
          )}
        </section>

        <section className="min-w-0 space-y-5 p-4 sm:p-5" aria-label="직원 정보 편집">
          <StaffProfilePhotoField
            name={draft.name}
            persistedUrl={persistedUrl}
            photo={photo}
            disabled={isSaving}
            onFileChange={onPhotoFileChange}
            onRemove={onPhotoRemove}
            onReset={onPhotoReset}
            onError={onPhotoError}
          />

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-[14px] font-medium leading-5 text-[#475569]">이름</span>
              <input value={draft.name} onChange={(event) => onDraftChange({ name: event.target.value, displayName: event.target.value })} readOnly={ownerLocked} className={INPUT_CLASS} />
            </label>
            <label className="block min-w-0">
              <span className="text-[14px] font-medium leading-5 text-[#475569]">역할</span>
              <input value={ownerLocked ? "대표" : draft.role} onChange={(event) => onDraftChange({ role: event.target.value, position: event.target.value })} readOnly={ownerLocked} placeholder="예: 디자이너" className={INPUT_CLASS} />
            </label>
          </div>

          <label className="block min-w-0">
            <span className="text-[14px] font-medium leading-5 text-[#475569]">연락처 (선택)</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(event) => onDraftChange({ phone: formatInitialSetupStaffPhone(event.target.value) })}
              placeholder="010-0000-0000"
              className={INPUT_CLASS}
            />
          </label>

          <fieldset className="min-w-0">
            <legend className="text-[14px] font-medium leading-5 text-[#475569]">기본 근무 요일</legend>
            <div className="mt-2 grid min-w-0 grid-cols-7 gap-1.5">
              {weekdayColumns.map((day) => {
                const active = workDayKeys.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onToggleWorkday(day.key)}
                    aria-pressed={active}
                    className={active
                      ? "inline-flex min-h-11 min-w-0 items-center justify-center rounded-[8px] border border-[#15213b] bg-[#15213b] text-[14px] font-medium leading-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                      : "inline-flex min-h-11 min-w-0 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium leading-5 text-[#64748b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-end gap-2">
            <label className="block min-w-0">
              <span className="text-[14px] font-medium leading-5 text-[#475569]">출근 시간</span>
              <input type="time" value={draft.startTime} onChange={(event) => onDraftChange({ startTime: event.target.value })} className={`${INPUT_CLASS} tabular-nums`} />
            </label>
            <span className="mb-3 text-center text-[14px] font-normal leading-5 text-[#94a3b8]">–</span>
            <label className="block min-w-0">
              <span className="text-[14px] font-medium leading-5 text-[#475569]">퇴근 시간</span>
              <input type="time" value={draft.endTime} onChange={(event) => onDraftChange({ endTime: event.target.value })} className={`${INPUT_CLASS} tabular-nums`} />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
