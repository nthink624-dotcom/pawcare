"use client";

import { CalendarDays, ChevronDown, Scale } from "lucide-react";

import { CARE_REPORT_TYPOGRAPHY as OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import { addDate, currentDateInTimeZone } from "@/lib/utils";
import type { Service } from "@/types/domain";

export type GroomingCompletionDetails = {
  treatmentNotes: string;
  specialNotes: string;
  internalNotes: string;
  nextRecommendedVisitDate: string | null;
};

export function CalendarGroomingCompletionFields({
  value,
  onChange,
  serviceId,
  serviceName,
  services = [],
  onServiceChange,
  currentWeightKg,
  onWeightChange,
  disabled,
  saveError,
  onRetrySave,
}: {
  value: GroomingCompletionDetails;
  onChange: (value: GroomingCompletionDetails) => void;
  serviceId?: string;
  serviceName?: string;
  services?: Service[];
  onServiceChange?: (serviceId: string) => Promise<void> | void;
  currentWeightKg: string;
  onWeightChange: (value: string) => void;
  disabled?: boolean;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  const bookedService = serviceName?.trim() || value.treatmentNotes.trim() || "예약 서비스";
  const today = currentDateInTimeZone();
  const reminderEnabled = Boolean(value.nextRecommendedVisitDate);
  const activeServices = services.filter((service) => service.is_active || service.id === serviceId);

  return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="min-h-[72px] rounded-[14px] border border-[#dce1e7] bg-white px-3 py-2 shadow-[0_5px_16px_rgba(20,39,63,0.035)]">
            <p className={`${OWNER_TYPOGRAPHY.meta} mb-1.5 text-[#75808c]`}>예약 서비스</p>
            {activeServices.length > 0 ? (
              <div className="relative w-full">
                <select
                  aria-label="예약 서비스 수정"
                  value={serviceId ?? ""}
                  onChange={(event) => void onServiceChange?.(event.target.value)}
                  disabled={disabled || !onServiceChange}
                  className={`${OWNER_TYPOGRAPHY.bodyStrong} h-9 w-full appearance-none rounded-[9px] border-0 bg-[#f5f6f8] pl-2.5 pr-8 text-[#1b2d43] outline-none transition hover:bg-[#eef1f4] focus:ring-2 focus:ring-[#dce2e8] disabled:cursor-default disabled:opacity-70`}
                >
                  {!serviceId ? <option value="">{bookedService}</option> : null}
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#697684]" />
              </div>
            ) : (
              <p className={`${OWNER_TYPOGRAPHY.bodyStrong} min-w-0 text-right text-[#1b2d43]`}>{bookedService}</p>
            )}
          </div>
          <label className="min-h-[72px] rounded-[14px] border border-[#cddcf0] bg-[#f8fbff] px-3 py-2 shadow-[0_5px_16px_rgba(20,39,63,0.035)]">
            <span className={`${OWNER_TYPOGRAPHY.meta} flex items-center gap-1.5 text-[#60758d]`}><Scale className="h-3.5 w-3.5 text-[#2f6fd6]" /> 오늘 몸무게</span>
            <span className="mt-1 flex items-baseline gap-px">
              <span className="inline-flex w-[68px] flex-none">
                <input
                  data-modal-wheel-scope="self"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="200"
                  step="0.1"
                  aria-label="오늘 몸무게"
                  value={currentWeightKg}
                  onChange={(event) => onWeightChange(event.target.value)}
                  disabled={disabled}
                  placeholder="0.0"
                  style={{ fontSize: "28px", fontWeight: 600, lineHeight: "32px", padding: 0, width: "100%" }}
                  className="min-w-0 appearance-none bg-transparent text-right text-[28px] font-semibold leading-8 tracking-[-0.03em] text-[#172c46] outline-none disabled:opacity-60"
                />
              </span>
              <span className="shrink-0 text-[28px] font-semibold leading-8 tracking-[-0.03em] text-[#172c46]">kg</span>
            </span>
          </label>
        </div>

        <div className="rounded-[14px] border border-[#dce1e7] bg-white px-3 py-2 shadow-[0_5px_16px_rgba(20,39,63,0.035)]">
          <div className="flex items-center gap-2">
            <span className={`${OWNER_TYPOGRAPHY.bodyStrong} flex shrink-0 items-center gap-2 text-[#263547]`}><CalendarDays className="h-4 w-4 text-[#526171]" /> 재예약 알림</span>
            <input
              type="date"
              min={today}
              value={value.nextRecommendedVisitDate ?? ""}
              onChange={(event) => onChange({ ...value, nextRecommendedVisitDate: event.target.value || null })}
              disabled={disabled || !reminderEnabled}
              className={`${OWNER_TYPOGRAPHY.bodyStrong} ml-auto h-9 min-w-0 w-[150px] rounded-[9px] border-0 px-2.5 outline-none transition focus:ring-2 focus:ring-[#dce2e8] disabled:cursor-not-allowed ${
                reminderEnabled ? "bg-[#f4f6f8] text-[#263547]" : "bg-[#f1f3f5] text-[#9aa3ad]"
              }`}
            />
            <button
              type="button"
              onClick={() => onChange({
                ...value,
                nextRecommendedVisitDate: reminderEnabled ? null : addDate(today, 45),
              })}
              disabled={disabled}
              aria-pressed={reminderEnabled}
              className={`${OWNER_TYPOGRAPHY.badge} inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition disabled:opacity-50 ${
                reminderEnabled
                  ? "border-[#2f6fd6] bg-[#2f6fd6] text-white shadow-[0_3px_10px_rgba(47,111,214,0.18)]"
                  : "border-[#d3d9e0] bg-[#f3f4f6] text-[#6a7581]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${reminderEnabled ? "bg-white" : "bg-[#9aa3ad]"}`} />
              {reminderEnabled ? "알림 함" : "알림 안 함"}
            </button>
          </div>
        </div>

        {saveError ? (
      <div className={`${OWNER_TYPOGRAPHY.label} flex items-center justify-between gap-3 rounded-[12px] bg-[#f1f3f5] px-4 py-2.5 text-[#3f5266]`}>
            <span>{saveError}</span>
            {onRetrySave ? <button type="button" onClick={onRetrySave} className="shrink-0 font-semibold underline underline-offset-2">다시 저장</button> : null}
          </div>
        ) : null}
      </div>
  );
}
