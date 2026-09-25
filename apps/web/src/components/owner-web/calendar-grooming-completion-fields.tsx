"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
  weightSaving,
  weightStatus,
  onWeightSave,
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
  weightSaving?: boolean;
  weightStatus?: string;
  onWeightSave?: () => void;
  disabled?: boolean;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  const bookedService = serviceName?.trim() || value.treatmentNotes.trim() || "예약 서비스";
  const today = currentDateInTimeZone();
  const reminderEnabled = Boolean(value.nextRecommendedVisitDate);
  const activeServices = services.filter((service) => service.is_active || service.id === serviceId);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const weightSummary = currentWeightKg.trim() ? `${currentWeightKg.trim()}kg` : "미입력";
  const reminderSummary = reminderEnabled
    ? `${value.nextRecommendedVisitDate} · 알림 함`
    : "알림 안 함";

  return (
    <div className="min-w-0 max-w-full space-y-2">
      <div data-care-report-metadata-strip className="min-w-0 overflow-hidden rounded-[10px] border border-[#dce1e7] bg-white">
        <button
          type="button"
          aria-label="예약 완료 정보 수정"
          aria-expanded={editingMetadata}
          aria-controls="care-report-metadata-controls"
          onClick={() => setEditingMetadata((current) => !current)}
          disabled={disabled}
          className="grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left text-[#263547] transition hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563eb] disabled:cursor-default disabled:opacity-60"
        >
          <span data-care-report-metadata-summary className="grid min-w-0 gap-y-1 text-[14px] [line-height:1.45]">
            <span data-care-report-metadata-row="service-weight" className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="inline-flex max-w-full items-baseline gap-1 whitespace-nowrap">
                <span className="font-medium">예약 서비스</span>
                <span className="font-normal">{bookedService}</span>
              </span>
              <span className="inline-flex max-w-full items-baseline gap-1 whitespace-nowrap max-sm:basis-full">
                <span className="font-medium">오늘 몸무게</span>
                <span className="font-normal">{weightSummary}</span>
              </span>
            </span>
            <span data-care-report-metadata-row="reminder" className="inline-flex max-w-full flex-wrap items-baseline gap-x-1 gap-y-1">
              <span className="whitespace-nowrap font-medium">재예약 알림</span>
              <span className="whitespace-nowrap font-normal">{reminderSummary}</span>
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#697684] transition-transform ${editingMetadata ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {editingMetadata ? (
          <div id="care-report-metadata-controls" className="space-y-2 border-t border-[#e8edf3] px-3 py-2.5">
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
              <span className={`${OWNER_TYPOGRAPHY.label} whitespace-nowrap text-[#526171]`}>예약 서비스</span>
              {activeServices.length > 0 ? (
                <div className="relative min-w-0">
                  <select
                    aria-label="예약 서비스 수정"
                    value={serviceId ?? ""}
                    onChange={(event) => void onServiceChange?.(event.target.value)}
                    disabled={disabled || !onServiceChange}
                    style={{ fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}
                    className="h-11 w-full appearance-none rounded-[9px] border border-[#dbe2ea] bg-white pl-2.5 pr-8 text-[#1b2d43] outline-none transition hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-default disabled:opacity-70"
                  >
                    {!serviceId ? <option value="">{bookedService}</option> : null}
                    {activeServices.map((service) => (
                      <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#697684]" />
                </div>
              ) : (
                <p className="min-w-0 break-words text-[14px] font-normal leading-5 text-[#1b2d43]">{bookedService}</p>
              )}
            </div>

            <div className="grid min-w-0 gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-2">
              <span className={`${OWNER_TYPOGRAPHY.label} flex min-h-11 items-center whitespace-nowrap text-[#526171]`}>오늘 몸무게</span>
              <div className="min-w-0">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-1">
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
                      style={{ height: "44px", fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}
                      className="min-h-11 w-full min-w-0 appearance-none rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-right text-[#172c46] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-60"
                    />
                    <span className="shrink-0 text-[14px] font-normal leading-5 text-[#526171]">kg</span>
                  </span>
                  {onWeightSave ? (
                    <button type="button" onClick={onWeightSave} disabled={disabled || weightSaving || !currentWeightKg.trim()} style={{ fontSize: "16px", fontWeight: 500, lineHeight: "24px" }} className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#15213b] px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:bg-[#cbd5e1]">
                      {weightSaving ? "저장 중" : "저장"}
                    </button>
                  ) : null}
                </div>
                {weightStatus ? <p className="mt-1 text-[14px] font-normal leading-5 text-[#64748b]" role="status">{weightStatus}</p> : null}
              </div>
            </div>

            <div className="grid min-w-0 gap-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
              <span className={`${OWNER_TYPOGRAPHY.label} flex min-h-11 items-center whitespace-nowrap text-[#526171]`}>재예약 알림</span>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <input
                  type="date"
                  min={today}
                  value={value.nextRecommendedVisitDate ?? ""}
                  onChange={(event) => onChange({ ...value, nextRecommendedVisitDate: event.target.value || null })}
                  disabled={disabled || !reminderEnabled}
                  style={{ fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}
                  className={`h-11 w-full min-w-0 rounded-[9px] border border-[#dbe2ea] px-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed ${
                    reminderEnabled ? "bg-white text-[#263547]" : "bg-[#f1f3f5] text-[#9aa3ad]"
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
                  style={{ fontSize: "16px", fontWeight: 500, lineHeight: "24px" }}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[9px] border px-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50 ${
                    reminderEnabled
                      ? "border-[#2f6fd6] bg-[#2f6fd6] text-white"
                      : "border-[#d3d9e0] bg-[#f3f4f6] text-[#6a7581]"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${reminderEnabled ? "bg-white" : "bg-[#9aa3ad]"}`} />
                  {reminderEnabled ? "알림 함" : "알림 안 함"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {saveError ? (
      <div className={`${OWNER_TYPOGRAPHY.label} flex items-center justify-between gap-3 rounded-[12px] bg-[#f1f3f5] px-4 py-2.5 text-[#3f5266]`}>
          <span>{saveError}</span>
          {onRetrySave ? <button type="button" onClick={onRetrySave} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] px-2 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">다시 저장</button> : null}
        </div>
      ) : null}
      </div>
  );
}
