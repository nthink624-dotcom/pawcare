"use client";

import { ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ScheduleDropdown, type ScheduleDropdownOption } from "@/components/owner-web/calendar-schedule-dropdown";
import type { OwnerWebStaffColumn } from "@/components/owner-web/owner-web-staff-data";
import { addDate, cn, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";
import type { ConsentRecord } from "@petmanager/shared/contracts/booking-preparation";

export type ScheduleConsentPrompt = { policyVersion: number; documents: ConsentRecord[] };
export type ScheduleConsentChoice = { decision: "send" | "recognize"; policyVersion: number; documents: Array<{ id: string; version: number }> };

function ScheduleConsentHelp({ title, children }: { title: string; children: ReactNode }) {
  return <details name="schedule-consent-help" data-schedule-consent-help>
    <summary aria-label={`${title} 도움말`} className="absolute right-3 top-3 flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#15213b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] [&::-webkit-details-marker]:hidden">
      <CircleHelp className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
    </summary>
    <div className="mt-2 space-y-3 border-t border-[#e2e8f0] pt-3 text-[14px] font-normal leading-[21px] text-[#526175]">{children}</div>
  </details>;
}

export function ScheduleConsentChoiceDialog({ prompt, saving, error, onCancel, onConfirm }: { prompt: ScheduleConsentPrompt; saving: boolean; error: string; onCancel: () => void; onConfirm: (choice: ScheduleConsentChoice) => void }) {
  const [decision, setDecision] = useState<"send" | "recognize">("send");
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault(); event.stopPropagation();
        const help = dialog?.querySelector<HTMLDetailsElement>("[data-schedule-consent-help][open]");
        if (help) { help.open = false; help.querySelector("summary")?.focus(); }
        else onCancel();
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("input:not(:disabled),button:not(:disabled),summary")).filter(control => !(control instanceof HTMLInputElement) || control.type !== "radio" || control.checked);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener("keydown", keydown);
    return () => { dialog?.removeEventListener("keydown", keydown); if (previous?.isConnected) previous.focus(); };
  }, [saving, onCancel]);
  const eligible = prompt.documents.filter(doc => doc.scope === "pet");
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/25 p-4" onClick={() => { if (!saving) onCancel(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="schedule-consent-title" className="max-h-[90dvh] w-full max-w-[480px] space-y-4 overflow-y-auto rounded-[14px] border border-[#e2e8f0] bg-white p-5 shadow-lg" onClick={event => event.stopPropagation()}>
      <h2 id="schedule-consent-title" className="text-[20px] font-semibold leading-7 text-[#15213b]">동의서는 어떻게 할까요?</h2>
      {error && <p role="alert" className="text-[14px] leading-5 text-[#9a5e4e]">{error}</p>}
      <div className="space-y-2 text-[16px] leading-6 text-[#15213b]">
        <div className="relative rounded-[10px] border border-[#e2e8f0] p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 pr-12"><input type="radio" name="schedule-consent" checked={decision === "send"} disabled={saving} onChange={() => setDecision("send")} /><span>고객에게 동의서 보내기</span></label>
          <ScheduleConsentHelp title="고객에게 동의서 보내기">
            <p>예약을 등록한 뒤, 아직 작성하지 않은 동의서의 작성 링크를 알림톡으로 요청합니다. 보호자가 링크에서 문서를 확인하고 직접 동의해야 동의 완료로 기록됩니다.</p>
            <p>발송 요청만으로 동의한 것으로 처리하지 않습니다. 매장·고객의 알림 설정과 사용 가능한 템플릿에 따라 발송이 제한될 수 있으며, 발송에 실패해도 등록한 예약은 유지됩니다. 고객 상세에서 동의 상태와 발송 결과를 확인해 주세요.</p>
            <div className="space-y-1"><p className="font-medium text-[#15213b]">이번 예약에서 확인할 문서</p>{prompt.documents.map(doc => <p key={doc.id}>{doc.title} · 버전 {doc.version}</p>)}</div>
          </ScheduleConsentHelp>
        </div>
        <div className="relative rounded-[10px] border border-[#e2e8f0] p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 pr-12"><input type="radio" name="schedule-consent" checked={decision === "recognize"} disabled={saving || !eligible.length} onChange={() => setDecision("recognize")} /><span>기존에 받은 동의서 인정하기</span></label>
          <ScheduleConsentHelp title="기존에 받은 동의서 인정하기">
            <p>이 반려동물에 대해 아래 문서와 같은 내용의 동의를 이미 받은 경우에 선택합니다. 저장하면 오너가 기존 동의를 확인한 기록을 남기며, 고객이 직접 작성한 전자서명과 구분해 보관합니다.</p>
            <p>인정 기록이 유효하고 추가로 작성할 문서가 없으면, 같은 반려동물의 다음 예약에서는 이 선택 창을 다시 띄우지 않습니다.</p>
            <p>다른 반려동물이나 새로 추가된 문서, 다시 동의를 받도록 변경된 문서는 별도로 확인합니다. 예약마다 작성하는 문서는 기존 동의 인정 대상이 아니므로 보호자에게 작성을 요청합니다.</p>
            <div className="space-y-1"><p className="font-medium text-[#15213b]">기존 동의를 인정할 문서</p>{eligible.length ? eligible.map(doc => <p key={doc.id}>{doc.title} · 버전 {doc.version}</p>) : <p>현재 기존 동의로 인정할 수 있는 문서가 없습니다.</p>}</div>
          </ScheduleConsentHelp>
        </div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="min-h-11 rounded-[8px] border border-[#e2e8f0] px-4 text-[16px] text-[#475569]" onClick={onCancel}>돌아가기</button><button type="button" disabled={saving} className="min-h-11 rounded-[8px] bg-[#111a30] px-4 text-[16px] font-medium text-white disabled:opacity-50" onClick={() => onConfirm({ decision, policyVersion: prompt.policyVersion, documents: eligible.map(({ id, version }) => ({ id, version })) })}>{saving ? "등록 중" : "선택하고 예약 등록"}</button></div>
    </section>
  </div>;
}

type StaffKey = string;
type StaffFilter = "전체 직원" | StaffKey;
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
  form,
  visibleStaff,
  getAvailableSlots,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  data: BootstrapPayload;
  form: ScheduleCreateFormState;
  visibleStaff: OwnerWebStaffColumn[];
  getAvailableSlots: (params: { date: string; serviceId: string; duration: number; staffKey: StaffKey }) => string[];
  saving: boolean;
  error: string;
  onChange: (form: ScheduleCreateFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const bookingFieldFocusClassName = "focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 focus-visible:ring-2 focus-visible:ring-[#2563eb]/20";
  const existingCustomerMode = form.customerMode === "existing";
  const customerRows = useMemo(() => {
    if (!existingCustomerMode) return [];

    const petsByGuardianId = new Map<string, typeof data.pets>();
    for (const pet of data.pets) {
      const guardianPets = petsByGuardianId.get(pet.guardian_id);
      if (guardianPets) guardianPets.push(pet);
      else petsByGuardianId.set(pet.guardian_id, [pet]);
    }

    const guardianIds = new Set<string>();
    const registeredCustomers = data.guardians.map((guardian) => {
      guardianIds.add(guardian.id);
      return {
        value: guardian.id,
        guardianName: guardian.name,
        phone: guardian.phone,
        pets: [...(petsByGuardianId.get(guardian.id) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko")),
      };
    });

    return [
      ...registeredCustomers,
      ...data.pets
        .filter((pet) => !guardianIds.has(pet.guardian_id))
        .map((pet) => ({
          value: `pet:${pet.id}`,
          guardianName: "보호자 미등록",
          phone: null,
          pets: [pet],
        })),
    ]
      .filter((row) => row.pets.length > 0)
      .sort((a, b) => a.guardianName.localeCompare(b.guardianName, "ko"));
  }, [data.guardians, data.pets, existingCustomerMode]);
  const activeServices = useMemo(() => data.services.filter((service) => service.is_active), [data.services]);
  const customerModeOptions: ScheduleDropdownOption[] = [
    { value: "new", label: "신규 고객 입력", meta: "고객명, 연락처, 반려동물명을 직접 입력" },
    { value: "existing", label: "기존 고객 선택", meta: "등록된 고객과 반려동물에서 선택" },
  ];
  const customerOptions = useMemo(
    () =>
      customerRows.map(({ value, guardianName, phone, pets }) => {
        const phoneLabel = phone ? formatSchedulePhone(phone) : "연락처 없음";
        const petSummary =
          pets
            .map((pet) => {
              const breed = pet.breed?.trim() || "품종 미입력";
              return `${pet.name} | ${breed}`;
            })
            .join(" · ") || "반려동물 없음";

        return {
          value,
          label: `${guardianName} · ${phoneLabel}`,
          meta: petSummary,
          searchText: `${guardianName} ${phone ?? ""} ${phone ? formatSchedulePhone(phone) : ""} ${pets
            .map((pet) => `${pet.name} ${pet.breed ?? ""}`)
            .join(" ")}`,
        };
      }),
    [customerRows],
  );
  const selectedPet = useMemo(
    () => (existingCustomerMode ? data.pets.find((pet) => pet.id === form.petId) : null),
    [data.pets, existingCustomerMode, form.petId],
  );
  const selectedCustomerRow = useMemo(
    () => (selectedPet ? customerRows.find((row) => row.pets.some((pet) => pet.id === selectedPet.id)) : null),
    [customerRows, selectedPet],
  );
  const serviceOptions = useMemo(
    () =>
      activeServices.map((service) => ({
        value: service.id,
        label: service.name,
        meta: `${service.duration_minutes}분 · ${service.price.toLocaleString()}원`,
      })),
    [activeServices],
  );
  const staffOptions = useMemo(
    () =>
      visibleStaff.map((staffMember) => ({
        value: staffMember.key,
        label: staffMember.name,
      })),
    [visibleStaff],
  );
  const selectedService = useMemo(() => data.services.find((service) => service.id === form.serviceId), [data.services, form.serviceId]);
  const duration = selectedService ? selectedService.duration_minutes / 60 : 1;
  const availabilityKey = `${form.date}|${form.serviceId}|${form.staffKey}`;
  const [computedAvailabilityKey, setComputedAvailabilityKey] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const availabilityReady = computedAvailabilityKey === availabilityKey;

  function dropdownProps(id: string) {
    return {
      open: activeDropdown === id,
      onOpenChange: (open: boolean) => setActiveDropdown(open ? id : (current) => current === id ? null : current),
    };
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setComputedAvailabilityKey(availabilityKey), 0);
    return () => window.clearTimeout(timer);
  }, [availabilityKey]);

  const availableSlots = useMemo(
    () =>
      availabilityReady && selectedService
        ? getAvailableSlots({ date: form.date, serviceId: selectedService.id, duration, staffKey: form.staffKey })
        : [],
    [availabilityReady, duration, form.date, form.staffKey, getAvailableSlots, selectedService],
  );
  const isSelectedTimeAvailable = !form.time || availableSlots.includes(form.time);
  const normalizedCustomerPhone = normalizeSchedulePhone(form.customerPhone);
  const isCustomerPhoneIncomplete = form.customerMode === "new" && Boolean(form.customerPhone.trim()) && normalizedCustomerPhone.length < 10;
  const hasCustomerInfo =
    form.customerMode === "existing"
      ? Boolean(form.petId)
      : Boolean(form.customerName.trim() && form.petName.trim() && normalizedCustomerPhone.length >= 10);
  const canSubmit = Boolean(
    availabilityReady && hasCustomerInfo && form.serviceId && form.staffKey && form.date && form.time && isSelectedTimeAvailable && !saving,
  );
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!availabilityReady || !form.time || !selectedService || availableSlots.includes(form.time)) return;
    onChange({ ...form, time: "" });
  }, [availabilityReady, availableSlots, form, onChange, selectedService]);

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
    <div data-schedule-create-dialog="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/25 px-4 py-4" onClick={onClose}>
      <div
        className="my-auto w-full max-w-[560px] min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-center">
          <div className="relative flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, -1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
              aria-label="이전 날짜"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openDatePicker}
              className={cn(
                "h-11 min-w-[154px] rounded-[8px] px-1 text-center text-[16px] font-medium leading-6 text-[#111827] transition hover:bg-[#f8fafc]",
                form.date === currentDateInTimeZone() && "bg-[#f8fafc]",
              )}
            >
              {formatSchedulePickerRelativeLabel(form.date, data.shop)}
            </button>
            <button
              type="button"
              onClick={() => updateDate(addScheduleDays(form.date, 1))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-[#475569] transition hover:bg-[#f8fafc]"
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
            {...dropdownProps("customer-mode")}
            label="고객 등록 방식"
            value={form.customerMode}
            options={customerModeOptions}
            showMeta={false}
            focusClassName={bookingFieldFocusClassName}
            onChange={(value) => onChange({ ...form, customerMode: value as "new" | "existing", time: "" })}
          />

          {form.customerMode === "existing" ? (
            <div className="space-y-2">
              <ScheduleDropdown
                {...dropdownProps("customer")}
                label="보호자 / 반려동물 찾기"
                value={selectedCustomerRow?.value ?? ""}
                options={customerOptions}
                placeholder="기존 고객을 선택해 주세요"
                showMeta
                showSelectedMeta={false}
                showOptionMeta
                inlineOptionMeta
                searchable
                searchPlaceholder="고객명, 반려동물명, 연락처 검색"
                focusClassName={bookingFieldFocusClassName}
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
                          "inline-flex min-h-11 items-center rounded-[8px] border px-3 py-1.5 text-[14px] font-medium leading-5 transition",
                          pet.id === form.petId
                            ? "border-[#1f6b5b] bg-white text-[#1f6b5b]"
                            : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#b8c8d8]",
                        )}
                      >
                        <span className="font-medium">{pet.name}</span>
                        <span className="mx-1.5 text-[#cbd5e1]">|</span>
                        <span className="text-[#64748b]">{pet.breed?.trim() || "품종 미입력"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[14px] font-medium leading-5 text-[#64748b]">고객명</span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(event) => onChange({ ...form, customerName: event.target.value })}
                  className={cn("h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal leading-6 outline-none transition", bookingFieldFocusClassName)}
                  placeholder="예: 김민지"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[14px] font-medium leading-5 text-[#64748b]">반려동물 이름</span>
                <input
                  type="text"
                  value={form.petName}
                  onChange={(event) => onChange({ ...form, petName: event.target.value })}
                  className={cn("h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal leading-6 outline-none transition", bookingFieldFocusClassName)}
                  placeholder="예: 몽이"
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-[14px] font-medium leading-5 text-[#64748b]">고객 연락처</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.customerPhone}
                  onChange={(event) => onChange({ ...form, customerPhone: formatSchedulePhone(event.target.value) })}
                  className={cn("h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-normal leading-6 outline-none transition", bookingFieldFocusClassName)}
                  placeholder="010-1234-5678"
                />
                {isCustomerPhoneIncomplete ? (
                  <span className="block text-[13px] font-normal leading-5 text-[#64748b]">연락처를 10자리 이상 입력해 주세요.</span>
                ) : null}
              </label>
            </div>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
            <ScheduleDropdown
              {...dropdownProps("service")}
              label="서비스"
              value={form.serviceId}
              options={serviceOptions}
              showMeta={false}
              focusClassName={bookingFieldFocusClassName}
              onChange={(value) => onChange({ ...form, serviceId: value, time: "" })}
            />
            <ScheduleDropdown
              {...dropdownProps("staff")}
              label="담당"
              value={form.staffKey}
              options={staffOptions}
              showMeta={false}
              focusClassName={bookingFieldFocusClassName}
              onChange={(value) => onChange({ ...form, staffKey: value as StaffKey, time: "" })}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium leading-5 text-[#64748b]">가능 시간</p>
          </div>
          <div className="mt-1.5 max-h-[128px] overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-2">
            {!availabilityReady ? (
              <p className="py-8 text-center text-[13px] font-normal leading-5 text-[#64748b]">가능한 시간을 준비 중입니다.</p>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-1.5">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onChange({ ...form, time: slot })}
                    className={cn(
                      "h-11 min-w-0 rounded-[8px] border text-[14px] font-medium leading-5 tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2",
                      form.time === slot
                        ? "border-[#1d4ed8] bg-[#1d4ed8] text-white hover:border-[#1e40af] hover:bg-[#1e40af]"
                        : "border-[#dbe2ea] bg-white text-[#334155] hover:border-[#2563eb]",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] font-normal leading-5 text-[#64748b]">선택한 담당자와 서비스로 등록 가능한 시간이 없습니다.</p>
            )}
          </div>
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="text-[14px] font-medium leading-5 text-[#64748b]">메모</span>
          <textarea
            value={form.memo}
            onChange={(event) => onChange({ ...form, memo: event.target.value })}
            className={cn("min-h-[68px] w-full rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[16px] font-normal leading-6 outline-none transition", bookingFieldFocusClassName)}
            placeholder="고객 요청사항이나 직원 참고 메모를 적어주세요."
          />
        </label>

        {error ? <p className="mt-3 rounded-[8px] bg-[#fff7ed] px-3 py-2 text-[13px] font-medium leading-5 text-[#9a3412]">{error}</p> : null}

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[14px] font-medium leading-5 text-[#334155]">
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="min-h-11 rounded-[8px] border !border-[#1d4ed8] bg-[#1d4ed8] px-3 py-2 text-[14px] font-medium leading-5 text-white transition hover:!border-[#1e40af] hover:bg-[#1e40af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:!border-[#cbd5e1] disabled:bg-[#cbd5e1]"
          >
            {saving ? "등록 중" : "예약 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}


