"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";

import { fetchApiJson } from "@/lib/api";
import { currentDateInTimeZone, currentMinutesInTimeZone, formatClockTime, formatServicePrice, minutesFromTime, phoneNormalize } from "@/lib/utils";
import { formatReservationCode } from "@/lib/reservation-code";
import type { Appointment, GroomingRecord, Service, Shop } from "@/types/domain";

type LookupPayload = {
  guardians: Array<{ id: string; name: string; phone: string }>;
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  pets: Array<{ id: string; name: string; guardian_id: string }>;
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
  return format(parsed, "yyyy.MM.dd", { locale: ko });
}

export default function CustomerBookingManagePanel({
  shopId,
  shop,
  services,
  onBack,
}: {
  shopId: string;
  shop: Shop;
  services: Service[];
  onBack: () => void;
}) {
  const dateOptions = useMemo(() => buildDateOptions(shop), [shop]);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupReservationCode, setLookupReservationCode] = useState("");
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
        const result = await fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`);
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

  async function lookupBookings(phone = lookupPhone, reservationCode = lookupReservationCode) {
    try {
      setLookupError(null);
      const query = new URLSearchParams({ shopId, phone, reservationCode });
      const result = await fetchJson<LookupPayload>(`/api/customer-lookup?${query.toString()}`);
      setLookupResult(result);
      setOpenAppointmentId(null);
      setManageForm(null);
      setFeedback(null);
      if (result.appointments.length === 0 && result.groomingRecords.length === 0) {
        setLookupError("해당 연락처와 예약번호로 조회된 예약이 없어요.");
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
    if (submitting || !lookupPhone || !lookupReservationCode) return;

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
          reservationCode: lookupReservationCode,
        }),
      });
      await lookupBookings(lookupPhone, lookupReservationCode);
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
    if (submitting || !lookupPhone || !lookupReservationCode || !manageForm?.date || !manageForm.timeSlot || !manageForm.serviceId) return;

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
          reservationCode: lookupReservationCode,
          serviceId: manageForm.serviceId,
          appointmentDate: manageForm.date,
          appointmentTime: manageForm.timeSlot,
          memo: manageForm.note,
        }),
      });
      await lookupBookings(lookupPhone, lookupReservationCode);
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

  return (
    <>
      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <button type="button" onClick={onBack} className="text-sm font-bold text-[var(--muted)]">{"← 처음 화면으로"}</button>
        <h2 className="mt-3 text-lg font-extrabold">{"예약 확인 / 취소 / 변경"}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{"연락처와 예약번호로 예약을 확인하고 가능한 건은 직접 취소하거나 시간 변경을 요청할 수 있어요."}</p>
      </section>

      <section className="rounded-[28px] bg-white p-4 shadow-sm">
        <h2 className="text-base font-extrabold">{"예약 조회"}</h2>
        <div className="mt-4 space-y-3">
          <input
            value={lookupPhone}
            onChange={(event) => setLookupPhone(phoneNormalize(event.target.value))}
            placeholder={"연락처 입력"}
            className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4"
          />
          <div className="flex gap-2">
            <input
              value={lookupReservationCode}
              onChange={(event) => setLookupReservationCode(event.target.value.toUpperCase())}
              placeholder={"예약번호 입력"}
              className="field flex-1 rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4"
            />
            <button type="button" onClick={() => void lookupBookings()} className="inline-flex h-[54px] items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[15px] font-semibold text-white">
              {"조회"}
            </button>
          </div>
        </div>

        {lookupError ? <p className="mt-3 text-sm text-red-600">{lookupError}</p> : null}

        {feedback ? (
          <div className={`mt-4 rounded-[22px] px-4 py-4 text-sm ${feedback.type === "success" ? "bg-[#eef8f1] text-[#25613a]" : "bg-[#fff1f1] text-[#b42318]"}`}>
            <p className="font-semibold">{feedback.title}</p>
            <p className="mt-1 leading-6">{feedback.message}</p>
          </div>
        ) : null}

        {lookupResult ? (
          <div className="mt-4 space-y-3">
            {sortedAppointments.map((appointment) => {
              const pet = petMap[appointment.pet_id];
              const service = services.find((item) => item.id === appointment.service_id);
              const manageable = canManageAppointment(appointment);
              const isOpen = openAppointmentId === appointment.id && manageForm?.appointmentId === appointment.id;

              return (
                <div key={appointment.id} className="rounded-[24px] border border-[var(--border)] bg-[#f7f2e9] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">{pet?.name || "예약"} · {service?.name || "서비스"}</p>
                      <p className="mt-2 text-[13px] text-[var(--muted)]">{formatDateLabel(appointment.appointment_date)}{" · "}{formatClockTime(appointment.appointment_time)}</p>
                      <p className="mt-1 text-[13px] text-[var(--muted)]">{"예약번호 "}{formatReservationCode(appointment.id)}</p>
                      <p className="mt-1 text-[13px] text-[var(--muted)]">{"상태: "}{statusLabelMap[appointment.status] || appointment.status}</p>
                      {appointment.memo ? <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">메모: {appointment.memo}</p> : null}
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${manageable ? "bg-white text-[var(--accent)]" : "bg-white text-[var(--muted)]"}`}>
                      {manageable ? "변경 가능" : "조회 전용"}
                    </span>
                  </div>

                  {manageable ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openRescheduleForm(appointment)} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]">
                        예약 변경
                      </button>
                      <button type="button" onClick={() => void cancelAppointment(appointment.id)} disabled={submitting} className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                        예약 취소
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm text-[var(--muted)]">
                      이미 진행 중이거나 지난 예약은 조회만 가능해요.
                    </div>
                  )}

                  {isOpen ? (
                    <div className="mt-4 space-y-3 rounded-[22px] border border-white/80 bg-white px-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">변경할 날짜</p>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {dateOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setManageForm((prev) => (prev ? { ...prev, date: option.value, timeSlot: "" } : prev))}
                              className={`rounded-2xl border px-2 py-3 text-center text-sm font-bold ${manageForm?.date === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[#fffdfa] text-[var(--text)]"}`}
                            >
                              <div>{option.label}</div>
                              <div className="mt-1 text-xs font-medium">{option.weekday}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">변경할 시간</p>
                        <div className="mt-2">
                          {loadingManageSlots ? (
                            <div className="rounded-2xl bg-[#faf5f1] px-4 py-5 text-sm text-[var(--muted)]">가능한 시간을 확인하고 있어요.</div>
                          ) : manageSlots.length === 0 ? (
                            <div className="rounded-2xl bg-[#faf5f1] px-4 py-5 text-sm text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {manageSlots.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setManageForm((prev) => (prev ? { ...prev, timeSlot: slot } : prev))}
                                  className={`rounded-2xl border px-2 py-3 text-sm font-bold ${manageForm?.timeSlot === slot ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[#fffdfa] text-[var(--text)]"}`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <label className="block text-sm font-semibold text-[var(--text)]">
                        <span className="mb-2 block text-xs text-[var(--muted)]">서비스 선택</span>
                        <select
                          value={manageForm?.serviceId || ""}
                          onChange={(event) => setManageForm((prev) => (prev ? { ...prev, serviceId: event.target.value, timeSlot: "" } : prev))}
                          className="field"
                        >
                          {services.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="rounded-[20px] border border-[var(--border)] bg-[#fcfaf7] px-4 py-4 text-sm text-[var(--muted)]">
                        {selectedService ? `${selectedService.name} · ${formatServicePrice(selectedService.price, selectedService.price_type ?? "starting")}` : "서비스를 선택해 주세요."}
                      </div>

                      <label className="block text-sm font-semibold text-[var(--text)]">
                        <span className="mb-2 block text-xs text-[var(--muted)]">추가 메모</span>
                        <textarea
                          value={manageForm?.note || ""}
                          onChange={(event) => setManageForm((prev) => (prev ? { ...prev, note: event.target.value } : prev))}
                          placeholder="변경하면서 전달할 메모가 있으면 남겨 주세요."
                          className="field min-h-24 rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={closeRescheduleForm} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--text)]">
                          닫기
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitReschedule()}
                          disabled={submitting || !manageForm?.date || !manageForm.timeSlot || !manageForm.serviceId}
                          className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {shop.approval_mode === "auto" ? "바로 변경하기" : "변경 요청 보내기"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {lookupResult.groomingRecords.slice(0, 2).map((record) => (
              <div key={record.id} className="rounded-[24px] border border-[var(--border)] bg-[#f7f2e9] px-4 py-4">
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">지난 기록</p>
                <p className="mt-2 text-[13px] text-[var(--muted)]">{formatVisitedAt(record.groomed_at)}</p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{record.style_notes || "스타일 메모 없음"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
