"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Clock3, MessageCircle, X } from "lucide-react";

import { fetchApiJson } from "@/lib/api";
import { currentDateInTimeZone, currentMinutesInTimeZone, formatClockTime, formatServicePrice, minutesFromTime, phoneNormalize } from "@/lib/utils";
import type { Appointment, BootstrapStaffMember, GroomingRecord, Service, Shop } from "@/types/domain";

type LookupPayload = {
  guardians: Array<{ id: string; name: string; phone: string }>;
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  pets: Array<{ id: string; name: string; guardian_id: string; breed?: string }>;
};

type AvailabilityPayload = { slots: string[] };

type DateOption = {
  value: string;
  label: string;
  weekday: string;
};

type ManageForm = {
  appointmentId: string;
  serviceId: string;
  date: string;
  timeSlot: string;
  note: string;
};

type Feedback = {
  type: "success" | "error";
  title: string;
  message: string;
};

const statusLabelMap: Record<Appointment["status"], string> = {
  pending: "승인 대기",
  confirmed: "확정",
  in_progress: "미용 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "미승인",
  noshow: "노쇼",
};

const progressSteps: Array<{ status: Appointment["status"]; label: string }> = [
  { status: "pending", label: "요청" },
  { status: "confirmed", label: "확정" },
  { status: "in_progress", label: "미용 중" },
  { status: "almost_done", label: "픽업 준비" },
  { status: "completed", label: "완료" },
];

function getStatusTone(status: Appointment["status"]) {
  if (status === "cancelled" || status === "rejected" || status === "noshow") return "border-[#f1c7c7] bg-[#fff5f5] text-[#a04455]";
  if (status === "pending") return "border-[#ead6a8] bg-[#fff8e7] text-[#9a640f]";
  if (status === "completed") return "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]";
  return "border-[#b7d8cd] bg-[#eef8f4] text-[#2f7866]";
}

function getProgressIndex(status: Appointment["status"]) {
  const index = progressSteps.findIndex((step) => step.status === status);
  return index < 0 ? 0 : index;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  return fetchApiJson<T>(String(input), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

function buildDateOptions(shop: Shop): DateOption[] {
  const options: DateOption[] = [];
  const today = currentDateInTimeZone();
  const todayDate = parseISO(`${today}T00:00:00`);
  let offset = 0;

  while (options.length < 8 && offset < 45) {
    const date = addDays(todayDate, offset);
    const value = format(date, "yyyy-MM-dd");
    const weekdayNumber = date.getDay();
    const hours = shop.business_hours[weekdayNumber];
    const isClosed = shop.regular_closed_days.includes(weekdayNumber) || shop.temporary_closed_dates.includes(value) || !hours?.enabled;

    if (!isClosed) {
      options.push({
        value,
        label: value === today ? "오늘" : format(date, "M/d"),
        weekday: format(date, "EEE", { locale: ko }),
      });
    }

    offset += 1;
  }

  return options;
}

function canManageAppointment(appointment: Appointment) {
  if (!["pending", "confirmed"].includes(appointment.status)) return false;

  const today = currentDateInTimeZone();
  if (appointment.appointment_date > today) return true;
  if (appointment.appointment_date < today) return false;

  return minutesFromTime(appointment.appointment_time) > currentMinutesInTimeZone();
}

function formatDateLabel(value: string) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "M월 d일 EEEE", { locale: ko });
}

function formatVisitedAt(value: string) {
  if (!value) return "방문 기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "yy.MM.dd", { locale: ko });
}

function getCustomerActionLabel(status: Appointment["status"]) {
  if (status === "pending") return "예약 요청 취소";
  if (status === "confirmed") return "예약 취소 문의";
  if (status === "almost_done") return "매장에 문의하기";
  if (status === "completed") return "다시 예약하기";
  return "예약 문의";
}

function ManageInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] font-semibold text-[#8b7767]">{label}</span>
      <span className="text-right text-[15px] font-semibold tracking-[-0.02em] text-[#2b241f]">{value}</span>
    </div>
  );
}

function ProgressTracker({ status }: { status: Appointment["status"] }) {
  const currentIndex = getProgressIndex(status);

  if (status === "cancelled" || status === "rejected" || status === "noshow") {
    return (
      <div className="rounded-[16px] border border-[#f1c7c7] bg-[#fff5f5] px-3 py-3 text-[14px] font-semibold text-[#a04455]">
        {statusLabelMap[status] || status} 처리된 예약입니다.
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-[#eadbc9] bg-white px-3 py-3">
      <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#2b241f]">진행 상태</p>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {progressSteps.map((step, index) => {
          const active = index <= currentIndex;
          const current = index === currentIndex;
          return (
            <div key={step.status} className="text-center">
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                  active ? "border-[#8B5E3C] bg-[#8B5E3C] text-white" : "border-[#eadbc9] bg-[#fffaf3] text-[#b8a79a]"
                }`}
              >
                {active ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : index + 1}
              </span>
              <span className={`mt-1 block text-[11px] font-semibold ${current ? "text-[#8B5E3C]" : "text-[#8b7767]"}`}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerBookingManagePanel({
  shopId,
  shop,
  services,
  staffMembers = [],
  initialAccessToken,
  onBack,
}: {
  shopId: string;
  shop: Shop;
  services: Service[];
  staffMembers?: BootstrapStaffMember[];
  initialAccessToken?: string;
  onBack: () => void;
}) {
  const dateOptions = useMemo(() => buildDateOptions(shop), [shop]);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupGuardianName, setLookupGuardianName] = useState("");
  const [lookupPetName, setLookupPetName] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupPayload | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openAppointmentId, setOpenAppointmentId] = useState<string | null>(null);
  const [manageForm, setManageForm] = useState<ManageForm | null>(null);
  const [manageSlots, setManageSlots] = useState<string[]>([]);
  const [loadingManageSlots, setLoadingManageSlots] = useState(false);

  const petMap = useMemo(
    () => Object.fromEntries((lookupResult?.pets || []).map((pet) => [pet.id, pet])),
    [lookupResult?.pets],
  );
  const staffMap = useMemo(
    () => Object.fromEntries(staffMembers.map((staff) => [staff.id, staff.name])),
    [staffMembers],
  );
  const sortedAppointments = useMemo(
    () => [...(lookupResult?.appointments || [])].sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`)),
    [lookupResult?.appointments],
  );
  const selectedService = services.find((service) => service.id === manageForm?.serviceId);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!manageForm?.date || !manageForm.serviceId || !manageForm.appointmentId) {
        setManageSlots([]);
        return;
      }

      setLoadingManageSlots(true);
      try {
        const query = new URLSearchParams({
          shopId,
          date: manageForm.date,
          serviceId: manageForm.serviceId,
          excludeAppointmentId: manageForm.appointmentId,
        });
        const result = await fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`, { cache: "no-store" });
        if (!active) return;
        setManageSlots(result.slots);
        if (!result.slots.includes(manageForm.timeSlot)) {
          setManageForm((prev) => (prev ? { ...prev, timeSlot: "" } : prev));
        }
      } finally {
        if (active) setLoadingManageSlots(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [manageForm?.appointmentId, manageForm?.date, manageForm?.serviceId, manageForm?.timeSlot, shopId]);

  useEffect(() => {
    let active = true;

    async function loadFromToken() {
      if (!initialAccessToken) return;

      try {
        setLookupError(null);
        const query = new URLSearchParams({ shopId, t: initialAccessToken });
        const result = await fetchJson<LookupPayload>(`/api/customer-lookup?${query.toString()}`);
        if (!active) return;

        setLookupResult(result);
        const guardian = result.guardians[0];
        const pet = result.pets[0];
        if (guardian) setLookupGuardianName(guardian.name);
        if (guardian?.phone) setLookupPhone(guardian.phone);
        if (pet) setLookupPetName(pet.name);
        setOpenAppointmentId(null);
        setManageForm(null);
        setFeedback(null);
      } catch (error) {
        if (!active) return;
        setLookupError(error instanceof Error ? error.message : "예약 정보를 불러오지 못했어요.");
      }
    }

    void loadFromToken();
    return () => {
      active = false;
    };
  }, [initialAccessToken, shopId]);

  async function lookupBookings(phone = lookupPhone, guardianName = lookupGuardianName, petName = lookupPetName) {
    try {
      setLookupError(null);
      const query = new URLSearchParams({ shopId, phone, guardianName, petName });
      const result = await fetchJson<LookupPayload>(`/api/customer-lookup?${query.toString()}`);
      setLookupResult(result);
      setOpenAppointmentId(null);
      setManageForm(null);
      setFeedback(null);
      if (result.appointments.length === 0 && result.groomingRecords.length === 0) {
        setLookupError("입력한 정보와 일치하는 예약이 없어요.");
      }
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "조회에 실패했어요.");
      setLookupResult(null);
      setOpenAppointmentId(null);
      setManageForm(null);
    }
  }

  function openRescheduleForm(appointment: Appointment) {
    setFeedback(null);
    setOpenAppointmentId(appointment.id);
    setManageForm({
      appointmentId: appointment.id,
      serviceId: appointment.service_id,
      date: appointment.appointment_date,
      timeSlot: appointment.appointment_time,
      note: appointment.memo,
    });
  }

  function closeRescheduleForm() {
    setOpenAppointmentId(null);
    setManageForm(null);
    setManageSlots([]);
  }

  async function cancelAppointment(appointmentId: string) {
    if (submitting || !lookupPhone || !lookupGuardianName || !lookupPetName) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await fetchJson("/api/customer-appointments", {
        method: "PATCH",
        body: JSON.stringify({
          action: "cancel",
          shopId,
          appointmentId,
          phone: lookupPhone,
          guardianName: lookupGuardianName,
          petName: lookupPetName,
        }),
      });
      await lookupBookings(lookupPhone, lookupGuardianName, lookupPetName);
      closeRescheduleForm();
      setFeedback({
        type: "success",
        title: "예약이 취소되었어요",
        message: "취소 내용이 바로 반영되었습니다.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "예약 취소에 실패했어요",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReschedule() {
    if (submitting || !lookupPhone || !lookupGuardianName || !lookupPetName || !manageForm?.date || !manageForm.timeSlot || !manageForm.serviceId) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await fetchJson("/api/customer-appointments", {
        method: "PATCH",
        body: JSON.stringify({
          action: "reschedule",
          shopId,
          appointmentId: manageForm.appointmentId,
          phone: lookupPhone,
          guardianName: lookupGuardianName,
          petName: lookupPetName,
          serviceId: manageForm.serviceId,
          appointmentDate: manageForm.date,
          appointmentTime: manageForm.timeSlot,
          memo: manageForm.note,
        }),
      });
      await lookupBookings(lookupPhone, lookupGuardianName, lookupPetName);
      closeRescheduleForm();
      setFeedback({
        type: "success",
        title: shop.approval_mode === "auto" ? "예약 변경이 완료되었어요" : "예약 변경 요청을 보냈어요",
        message: shop.approval_mode === "auto" ? "변경된 일정이 바로 반영되었습니다." : "매장에서 확인한 뒤 변경 여부를 안내해드려요.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "예약 변경에 실패했어요",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const showLookupForm = !lookupResult || !initialAccessToken;

  return (
    <>
      <section className="rounded-[24px] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(139,106,85,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#8b7767]">예약 내역</p>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.05em] text-[#111827]">
              {lookupPetName && lookupGuardianName ? `${lookupPetName} · ${lookupGuardianName}` : "예약 확인"}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              예약 상태와 요청사항을 한눈에 확인할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f8fafc] hover:text-[#111827]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" strokeWidth={1.9} />
          </button>
        </div>
      </section>

      {showLookupForm ? (
        <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_32px_rgba(139,106,85,0.08)]">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-[#111827]">예약 조회</h2>
          <div className="mt-4 space-y-2.5">
            <input
              value={lookupGuardianName}
              onChange={(event) => setLookupGuardianName(event.target.value)}
              placeholder="보호자 이름 입력"
              className="field rounded-[14px] border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-[16px]"
            />
            <input
              value={lookupPhone}
              onChange={(event) => setLookupPhone(phoneNormalize(event.target.value))}
              placeholder="연락처 입력"
              className="field rounded-[14px] border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-[16px]"
            />
            <div className="flex gap-2">
              <input
                value={lookupPetName}
                onChange={(event) => setLookupPetName(event.target.value)}
                placeholder="반려동물 이름 입력"
                className="field flex-1 rounded-[14px] border-[#e2e8f0] bg-[#f8fafc] px-4 py-4 text-[16px]"
              />
              <button type="button" onClick={() => void lookupBookings()} disabled={!lookupPhone || !lookupGuardianName || !lookupPetName} className="inline-flex h-[54px] items-center justify-center rounded-[14px] bg-[#8B5E3C] px-5 text-[15px] font-semibold text-white disabled:opacity-50">
                조회
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {lookupError ? <p className="rounded-[16px] bg-[#fff1f1] px-4 py-3 text-sm text-red-600">{lookupError}</p> : null}

      {feedback ? (
        <div className={`rounded-[18px] px-4 py-4 text-sm ${feedback.type === "success" ? "bg-[#eef8f1] text-[#25613a]" : "bg-[#fff1f1] text-[#b42318]"}`}>
          <p className="font-semibold">{feedback.title}</p>
          <p className="mt-1 leading-6">{feedback.message}</p>
        </div>
      ) : null}

      {lookupResult ? (
        <section className="space-y-3">
          {sortedAppointments.map((appointment) => {
            const pet = petMap[appointment.pet_id];
            const service = services.find((item) => item.id === appointment.service_id);
            const staffName = appointment.staff_id ? staffMap[appointment.staff_id] : "";
            const manageable = canManageAppointment(appointment);
            const isOpen = openAppointmentId === appointment.id && manageForm?.appointmentId === appointment.id;
            const statusLabel = statusLabelMap[appointment.status] || appointment.status;
            const serviceLabel = service?.name || "서비스";
            const inquiryLabel = getCustomerActionLabel(appointment.status);

            return (
              <article key={appointment.id} className="overflow-hidden rounded-[24px] border border-[#dbe2ea] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                <div className="px-4 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-[-0.02em] text-[#94a3b8]">예약 내역</p>
                      <h3 className="mt-2 truncate text-[24px] font-semibold tracking-[-0.05em] text-[#111827]">
                        {pet?.name || "예약"} · {lookupGuardianName || "보호자"}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] font-medium text-[#64748b]">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" />
                          {formatDateLabel(appointment.appointment_date)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" />
                          {formatClockTime(appointment.appointment_time)}
                        </span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${getStatusTone(appointment.status)}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[#e2e8f0] bg-[#fbfdff] px-4 py-2">
                    <ManageInfoRow label="서비스" value={serviceLabel} />
                    <ManageInfoRow label="예약 상태" value={statusLabel} />
                    {pet?.breed ? <ManageInfoRow label="품종" value={pet.breed} /> : null}
                    {staffName ? <ManageInfoRow label="담당" value={staffName} /> : null}
                  </div>

                  <div className="mt-3">
                    <ProgressTracker status={appointment.status} />
                  </div>

                  <div className="mt-3 rounded-[16px] border border-[#e2e8f0] bg-white px-4 py-3">
                    <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#64748b]">고객 요청사항</p>
                    <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-[#111827]">
                      {appointment.memo?.trim() || "등록된 요청사항이 없습니다."}
                    </p>
                  </div>

                  <div className="mt-3 rounded-[16px] border border-dashed border-[#dbe2ea] bg-[#f8fafc] px-4 py-3">
                    <p className="text-[14px] font-semibold tracking-[-0.02em] text-[#64748b]">사진</p>
                    <p className="mt-1 text-[14px] leading-5 text-[#64748b]">
                      완료 사진이 등록되면 이곳에서 확인할 수 있어요.
                    </p>
                  </div>

                  {manageable ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openRescheduleForm(appointment)} className="h-11 rounded-[12px] border border-[#dbe2ea] bg-white text-[15px] font-semibold text-[#334155]">
                        예약 변경
                      </button>
                      <button type="button" onClick={() => void cancelAppointment(appointment.id)} disabled={submitting} className="h-11 rounded-[12px] bg-[#8B5E3C] text-[15px] font-semibold text-white disabled:opacity-50">
                        예약 취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (appointment.status === "completed") {
                          onBack();
                          return;
                        }
                        window.location.href = `tel:${shop.phone}`;
                      }}
                      className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[#dbe2ea] bg-white text-[15px] font-semibold text-[#334155]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {inquiryLabel}
                    </button>
                  )}

                  {isOpen ? (
                    <div className="mt-4 space-y-3 rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">변경할 날짜</p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {dateOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setManageForm((prev) => (prev ? { ...prev, date: option.value, timeSlot: "" } : prev))}
                              className={`rounded-[12px] border px-2 py-3 text-center text-sm font-bold ${manageForm?.date === option.value ? "border-[#8B5E3C] bg-[#f6eadc] text-[#8B5E3C]" : "border-[#dbe2ea] bg-white text-[#111827]"}`}
                            >
                              <div>{option.label}</div>
                              <div className="mt-1 text-xs font-medium">{option.weekday}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#111827]">변경할 시간</p>
                        <div className="mt-2">
                          {loadingManageSlots ? (
                            <div className="rounded-[12px] bg-white px-4 py-5 text-sm text-[#64748b]">가능한 시간을 확인하고 있어요.</div>
                          ) : manageSlots.length === 0 ? (
                            <div className="rounded-[12px] bg-white px-4 py-5 text-sm text-[#64748b]">선택한 날짜에 가능한 시간이 없어요.</div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {manageSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setManageForm((prev) => (prev ? { ...prev, timeSlot: slot } : prev))}
                                  className={`rounded-[12px] border px-2 py-3 text-sm font-bold ${manageForm?.timeSlot === slot ? "border-[#8B5E3C] bg-[#f6eadc] text-[#8B5E3C]" : "border-[#dbe2ea] bg-white text-[#111827]"}`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <label className="block text-sm font-semibold text-[#111827]">
                        <span className="mb-2 block text-xs text-[#64748b]">서비스 선택</span>
                        <select
                          value={manageForm?.serviceId || ""}
                          onChange={(event) => setManageForm((prev) => (prev ? { ...prev, serviceId: event.target.value, timeSlot: "" } : prev))}
                          className="field rounded-[12px] border-[#dbe2ea] bg-white"
                        >
                          {services.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="rounded-[14px] border border-[#dbe2ea] bg-white px-4 py-3 text-sm text-[#64748b]">
                        {selectedService ? `${selectedService.name} · ${formatServicePrice(selectedService.price, selectedService.price_type ?? "starting")}` : "서비스를 선택해 주세요."}
                      </div>

                      <label className="block text-sm font-semibold text-[#111827]">
                        <span className="mb-2 block text-xs text-[#64748b]">추가 메모</span>
                        <textarea
                          value={manageForm?.note || ""}
                          onChange={(event) => setManageForm((prev) => (prev ? { ...prev, note: event.target.value } : prev))}
                          placeholder="변경하면서 전달할 메모가 있으면 남겨 주세요."
                          className="field min-h-24 rounded-[12px] border-[#dbe2ea] bg-white px-4 py-4"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={closeRescheduleForm} className="rounded-[12px] border border-[#dbe2ea] bg-white px-4 py-3 text-sm font-semibold text-[#334155]">
                          닫기
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitReschedule()}
                          disabled={submitting || !manageForm?.date || !manageForm.timeSlot || !manageForm.serviceId}
                          className="rounded-[12px] bg-[#8B5E3C] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {shop.approval_mode === "auto" ? "바로 변경하기" : "변경 요청 보내기"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}

          {lookupResult.groomingRecords.slice(0, 2).map((record) => (
            <div key={record.id} className="rounded-[20px] border border-[#dbe2ea] bg-white px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#111827]">지난 방문 기록</p>
              <p className="mt-2 text-[13px] text-[#64748b]">{formatVisitedAt(record.groomed_at)}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#64748b]">{record.style_notes || "스타일 메모 없음"}</p>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}

