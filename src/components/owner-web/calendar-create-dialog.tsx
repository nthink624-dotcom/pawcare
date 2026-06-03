"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { ScheduleDropdown, type ScheduleDropdownOption } from "@/components/owner-web/calendar-schedule-dropdown";
import type { OwnerWebStaffColumn, OwnerWebStaffMember } from "@/components/owner-web/owner-web-staff-data";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type StaffKey = string;
type StaffFilter = "전체 직원" | StaffKey;
type StaffAssignments = Record<string, StaffKey>;
type ScheduleCreateFormState = {
  customerMode: "new" | "existing";
  petId: string;
  customerName: string;
  petName: string;
  customerPhone: string;
  serviceId: string;
  staffKey: StaffKey;
  date: string;
  time: string;
  memo: string;
};
type DailyBooking = { id: string };

function addScheduleDays(date: string, days: number) {
  return addDate(date, days);
}

function formatSchedulePickerDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(year).slice(-2)}년 ${String(month).padStart(2, "0")}월 ${String(day).padStart(2, "0")}일`;
}

function formatSchedulePickerRelativeLabel(date: string, shop?: BootstrapPayload["shop"]) {
  const today = currentDateInTimeZone();
  if (date === today) return "오늘";
  if (date === addScheduleDays(today, 1)) return "내일";
  if (date === addScheduleDays(today, 2)) return "모레";
  return formatSchedulePickerDateLabel(date);
}

function normalizeSchedulePhone(value: string) {
  return value.replace(/\D/g, "");
}

function formatSchedulePhone(value: string) {
  const digits = normalizeSchedulePhone(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
export function ScheduleCreateDialog({
  data,
  bookings,
  form,
  selectedDate,
  visibleStaff,
  staffMembers,
  staffAssignments,
  getAvailableSlots,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  data: BootstrapPayload;
  bookings: DailyBooking[];
  form: ScheduleCreateFormState;
  selectedDate: string;
  visibleStaff: OwnerWebStaffColumn[];
  staffMembers: OwnerWebStaffMember[];
  staffAssignments: StaffAssignments;
  getAvailableSlots: (params: { date: string; duration: number; staffKey: StaffKey }) => string[];
  saving: boolean;
  error: string;
  onChange: (form: ScheduleCreateFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const petRows = data.pets.map((pet) => ({
    pet,
    guardian: data.guardians.find((guardian) => guardian.id === pet.guardian_id),
  }));
  const customerRows = [
    ...data.guardians.map((guardian) => ({
      value: guardian.id,
      guardianName: guardian.name,
      phone: guardian.phone,
      pets: data.pets
        .filter((pet) => pet.guardian_id === guardian.id)
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    })),
    ...data.pets
      .filter((pet) => !data.guardians.some((guardian) => guardian.id === pet.guardian_id))
      .map((pet) => ({
        value: `pet:${pet.id}`,
        guardianName: "보호자 미등록",
        phone: null,
        pets: [pet],
      })),
  ]
    .filter((row) => row.pets.length > 0)
    .sort((a, b) => a.guardianName.localeCompare(b.guardianName, "ko"));
  const activeServices = data.services.filter((service) => service.is_active);
  const customerModeOptions: ScheduleDropdownOption[] = [
    { value: "new", label: "신규 고객 입력", meta: "고객명, 연락처, 반려동물명을 직접 입력" },
    { value: "existing", label: "기존 고객 선택", meta: "등록된 고객과 반려동물에서 선택" },
  ];
  const customerOptions = customerRows.map(({ value, guardianName, phone, pets }) => ({
    value,
    label: `${guardianName} · ${pets.map((pet) => pet.name).join(", ")}`,
    meta: phone ? formatSchedulePhone(phone) : undefined,
    searchText: `${guardianName} ${phone ?? ""} ${phone ? formatSchedulePhone(phone) : ""} ${pets
      .map((pet) => pet.name)
      .join(" ")}`,
  }));
  const selectedPet = data.pets.find((pet) => pet.id === form.petId);
  const selectedCustomerRow = selectedPet
    ? customerRows.find((row) => row.pets.some((pet) => pet.id === selectedPet.id))
    : null;
  const serviceOptions = activeServices.map((service) => ({
    value: service.id,
    label: service.name,
    meta: `${service.duration_minutes}분 · ${service.price.toLocaleString()}원`,
  }));
  const staffOptions = visibleStaff.map((staffMember) => ({
    value: staffMember.key,
    label: staffMember.name,
  }));
  const selectedService = data.services.find((service) => service.id === form.serviceId);
  const duration = selectedService ? selectedService.duration_minutes / 60 : 1;
  const availableSlots = selectedService ? getAvailableSlots({ date: form.date, duration, staffKey: form.staffKey }) : [];
  const normalizedCustomerPhone = normalizeSchedulePhone(form.customerPhone);
  const isCustomerPhoneIncomplete = form.customerMode === "new" && Boolean(form.customerPhone.trim()) && normalizedCustomerPhone.length < 10;
  const hasCustomerInfo =
    form.customerMode === "existing"
      ? Boolean(form.petId)
      : Boolean(form.customerName.trim() && form.petName.trim() && normalizedCustomerPhone.length >= 10);
  const canSubmit = Boolean(hasCustomerInfo && form.serviceId && form.staffKey && form.date && form.time && !saving);
  const dateInputRef = useRef<HTMLInputElement>(null);

  function updateDate(nextDate: string) {
    onChange({ ...form, date: nextDate, time: "" });
  }

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-center">
          <div className="relative flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, -1))}
              className="inline-flex h-9 w-7 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
              aria-label="이전 날짜"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openDatePicker}
              className={cn(
                "h-9 min-w-[154px] rounded-[8px] px-1 text-center text-[15px] text-[#111827] transition hover:bg-[#f8fafc]",
                form.date === currentDateInTimeZone() ? "font-bold" : "font-medium",
              )}
            >
              {formatSchedulePickerRelativeLabel(form.date, data.shop)}
            </button>
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, 1))}
              className="inline-flex h-9 w-7 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
              aria-label="다음 날짜"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={form.date}
              onChange={(event) => updateDate(event.target.value)}
              className="pointer-events-none absolute h-px w-px opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <ScheduleDropdown
            label="고객 등록 방식"
            value={form.customerMode}
            options={customerModeOptions}
            showMeta={false}
            onChange={(value) => onChange({ ...form, customerMode: value as "new" | "existing", time: "" })}
          />

          {form.customerMode === "existing" ? (
            <div className="space-y-2">
              <ScheduleDropdown
                label="고객 / 반려동물"
                value={selectedCustomerRow?.value ?? ""}
                options={customerOptions}
                placeholder="기존 고객을 선택해 주세요"
                showMeta={false}
                showOptionMeta
                searchable
                searchPlaceholder="고객명, 반려동물명, 연락처 검색"
                onChange={(value) => {
                  const customerRow = customerRows.find((row) => row.value === value);
                  onChange({ ...form, petId: customerRow?.pets[0]?.id ?? "" });
                }}
              />
              {selectedCustomerRow && selectedCustomerRow.pets.length > 1 ? (
                <div className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCustomerRow.pets.map((pet) => (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => onChange({ ...form, petId: pet.id })}
                        className={cn(
                          "h-8 rounded-[8px] border px-3 text-[14px] transition",
                          pet.id === form.petId
                            ? "border-[#1f6b5b] bg-white text-[#1f6b5b]"
                            : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#b8c8d8]",
                        )}
                      >
                        {pet.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[14px] text-[#64748b]">고객명</span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(event) => onChange({ ...form, customerName: event.target.value })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 김민지"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[14px] text-[#64748b]">반려동물 이름</span>
                <input
                  type="text"
                  value={form.petName}
                  onChange={(event) => onChange({ ...form, petName: event.target.value })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="예: 몽이"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[14px] text-[#64748b]">고객 연락처</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(event) => onChange({ ...form, customerPhone: formatSchedulePhone(event.target.value) })}
                  className="h-10 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none transition focus:border-[#1f6b5b] focus:ring-[3px] focus:ring-[#1f6b5b]/10"
                  placeholder="010-1234-5678"
                />
                {isCustomerPhoneIncomplete ? (
                  <span className="block text-[14px] text-[#64748b]">연락처를 10자리 이상 입력해 주세요.</span>
                ) : null}
              </label>
            </div>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
            <ScheduleDropdown
              label="서비스"
              value={form.serviceId}
              options={serviceOptions}
              showMeta={false}
              onChange={(value) => onChange({ ...form, serviceId: value, time: "" })}
            />
            <ScheduleDropdown
              label="담당"
              value={form.staffKey}
              options={staffOptions}
              showMeta={false}
              onChange={(value) => onChange({ ...form, staffKey: value as StaffKey, time: "" })}
            />
          </div>
        </div>

        <div className="hidden">
          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">고객 / 반려동물</span>
            <select
              value={form.petId}
              onChange={(event) => onChange({ ...form, petId: event.target.value })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {petRows.map(({ pet, guardian }) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name} · {guardian?.name ?? "보호자 미등록"}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">서비스</span>
            <select
              value={form.serviceId}
              onChange={(event) => onChange({ ...form, serviceId: event.target.value, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {activeServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes}분
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">담당자</span>
            <select
              value={form.staffKey}
              onChange={(event) => onChange({ ...form, staffKey: event.target.value as StaffKey, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            >
              {visibleStaff.map((staffMember) => (
                <option key={staffMember.key} value={staffMember.key}>
                  {staffMember.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[12px] text-[#64748b]">날짜</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => onChange({ ...form, date: event.target.value, time: "" })}
              className="h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] outline-none focus:border-[#1f6b5b]"
            />
          </label>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] text-[#64748b]">가능 시간</p>
          </div>
          <div className="mt-1.5 max-h-[128px] overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-2">
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onChange({ ...form, time: slot })}
                    className={cn(
                      "h-8 rounded-[8px] border text-[13px] tabular-nums transition",
                      form.time === slot
                        ? "border-[#1f6b5b] bg-[#1f6b5b] text-white"
                        : "border-[#dbe2ea] bg-white text-[#334155] hover:border-[#9fc9bd]",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-[#64748b]">선택한 담당자와 서비스로 등록 가능한 시간이 없습니다.</p>
            )}
          </div>
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="text-[14px] text-[#64748b]">메모</span>
          <textarea
            value={form.memo}
            onChange={(event) => onChange({ ...form, memo: event.target.value })}
            className="min-h-[68px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] outline-none focus:border-[#1f6b5b]"
            placeholder="고객 요청사항이나 직원 참고 메모를 적어주세요."
          />
        </label>

        {error ? <p className="mt-3 rounded-[8px] bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a3412]">{error}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] text-[#334155]">
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="h-11 rounded-[8px] bg-[#1f6b5b] text-[14px] font-medium text-white disabled:bg-[#cbd5e1]"
          >
            {saving ? "등록 중" : "예약 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}


