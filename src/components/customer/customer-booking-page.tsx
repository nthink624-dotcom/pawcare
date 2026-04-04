"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";

import CustomerBookingManagePanel from "@/components/customer/customer-booking-manage-panel";
import LegalLinksFooter from "@/components/legal/legal-links-footer";
import CustomerShopInfoContent from "@/components/customer/customer-shop-info-content";
import { fetchApiJson } from "@/lib/api";
import { currentDateInTimeZone, formatServicePrice, phoneNormalize } from "@/lib/utils";
import type { Appointment, GroomingRecord, Service, Shop } from "@/types/domain";

type ActiveMode = "first" | "returning" | "manage" | null;
type FirstVisitStep = 1 | 2 | 3 | 4 | 5;

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

type FirstVisitState = {
  ownerName: string;
  phone: string;
  petName: string;
  breed: string;
  date: string;
  timeSlot: string;
  serviceId: string;
  note: string;
};

type ReturningVisitState = {
  phone: string;
  petName: string;
  date: string;
  timeSlot: string;
  serviceId: string;
  note: string;
};

type ReturningHistory = {
  guardianName: string;
  phone: string;
  petName: string;
  lastServiceId: string;
  lastServiceLabel: string;
  lastVisitedAt: string;
  lastNote: string;
};

type SubmitFeedback = {
  type: "success" | "error";
  title: string;
  message: string;
};

const initialFirstVisitState: FirstVisitState = {
  ownerName: "",
  phone: "",
  petName: "",
  breed: "",
  date: "",
  timeSlot: "",
  serviceId: "",
  note: "",
};

const initialReturningVisitState: ReturningVisitState = {
  phone: "",
  petName: "",
  date: "",
  timeSlot: "",
  serviceId: "",
  note: "",
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

function formatVisitedAt(value: string) {
  if (!value) return "방문 기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "yyyy.MM.dd", { locale: ko });
}

function formatDateLabel(value: string) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "M월 d일 EEEE", { locale: ko });
}

function getLatestAppointment(appointments: Appointment[]) {
  return [...appointments].sort((a, b) => `${b.appointment_date} ${b.appointment_time}`.localeCompare(`${a.appointment_date} ${a.appointment_time}`))[0];
}

function getLatestRecord(records: GroomingRecord[]) {
  return [...records].sort((a, b) => (b.groomed_at || "").localeCompare(a.groomed_at || ""))[0];
}

function getCustomerBookingSuccessFeedback(approvalMode: Shop["approval_mode"]): SubmitFeedback {
  if (approvalMode === "auto") {
    return {
      type: "success",
      title: "예약이 바로 확정되었어요",
      message: "선택한 일정이 바로 반영되었어요. 안내 메시지를 확인해 주세요.",
    };
  }

  return {
    type: "success",
    title: "예약 신청이 완료되었어요",
    message: "매장에서 확인한 뒤 승인 여부를 안내해드려요.",
  };
}

export default function CustomerBookingPage({ shopId, initialShop, initialServices, initialMode = null, entryHref }: { shopId: string; initialShop: Shop; initialServices: Service[]; initialAppointments?: Appointment[]; initialRecords?: GroomingRecord[]; initialMode?: ActiveMode; entryHref?: string }) {
  const services = initialServices.filter((service) => service.is_active);
  const dateOptions = useMemo(() => buildDateOptions(initialShop), [initialShop]);
  const [activeMode, setActiveMode] = useState<ActiveMode>(initialMode);
  const [firstVisitStep, setFirstVisitStep] = useState<FirstVisitStep>(1);
  const [firstVisit, setFirstVisit] = useState<FirstVisitState>({ ...initialFirstVisitState, serviceId: services[0]?.id || "" });
  const [returningVisit, setReturningVisit] = useState<ReturningVisitState>({ ...initialReturningVisitState, serviceId: services[0]?.id || "" });
  const [returningHistory, setReturningHistory] = useState<ReturningHistory | null>(null);
  const [returningError, setReturningError] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [firstVisitSlots, setFirstVisitSlots] = useState<string[]>([]);
  const [returningVisitSlots, setReturningVisitSlots] = useState<string[]>([]);
  const [loadingFirstVisitSlots, setLoadingFirstVisitSlots] = useState(false);
  const [loadingReturningVisitSlots, setLoadingReturningVisitSlots] = useState(false);
  const [shopInfoOpen, setShopInfoOpen] = useState(false);

  const selectedFirstService = services.find((service) => service.id === firstVisit.serviceId);
  const selectedReturningService = services.find((service) => service.id === returningVisit.serviceId);
  const firstVisitProgress = (firstVisitStep / 5) * 100;

  useEffect(() => {
    if (!firstVisit.serviceId && services[0]?.id) setFirstVisit((prev) => ({ ...prev, serviceId: services[0].id }));
    if (!returningVisit.serviceId && services[0]?.id) setReturningVisit((prev) => ({ ...prev, serviceId: services[0].id }));
  }, [firstVisit.serviceId, returningVisit.serviceId, services]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firstVisit.date || !firstVisit.serviceId) {
        setFirstVisitSlots([]);
        return;
      }
      setLoadingFirstVisitSlots(true);
      try {
        const query = new URLSearchParams({ shopId, date: firstVisit.date, serviceId: firstVisit.serviceId });
        const result = await fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`);
        if (!active) return;
        setFirstVisitSlots(result.slots);
        if (!result.slots.includes(firstVisit.timeSlot)) setFirstVisit((prev) => ({ ...prev, timeSlot: "" }));
      } finally {
        if (active) setLoadingFirstVisitSlots(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [firstVisit.date, firstVisit.serviceId, firstVisit.timeSlot, shopId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!returningVisit.date || !returningVisit.serviceId) {
        setReturningVisitSlots([]);
        return;
      }
      setLoadingReturningVisitSlots(true);
      try {
        const query = new URLSearchParams({ shopId, date: returningVisit.date, serviceId: returningVisit.serviceId });
        const result = await fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`);
        if (!active) return;
        setReturningVisitSlots(result.slots);
        if (!result.slots.includes(returningVisit.timeSlot)) setReturningVisit((prev) => ({ ...prev, timeSlot: "" }));
      } finally {
        if (active) setLoadingReturningVisitSlots(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [returningVisit.date, returningVisit.serviceId, returningVisit.timeSlot, shopId]);

  function resetView() {
    setActiveMode(null);
    setFirstVisitStep(1);
    setFirstVisit({ ...initialFirstVisitState, serviceId: services[0]?.id || "" });
    setReturningVisit({ ...initialReturningVisitState, serviceId: services[0]?.id || "" });
    setFirstVisitSlots([]);
    setReturningVisitSlots([]);
    setSubmitFeedback(null);
    setReturningError(null);
    setReturningHistory(null);
    setShopInfoOpen(false);
  }

  function getFirstVisitStepValidity(step: FirstVisitStep) {
    if (step === 1) return Boolean(firstVisit.ownerName && firstVisit.phone && firstVisit.petName && firstVisit.breed);
    if (step === 2) return Boolean(firstVisit.date);
    if (step === 3) return Boolean(firstVisit.timeSlot);
    if (step === 4) return Boolean(firstVisit.serviceId);
    return Boolean(firstVisit.ownerName && firstVisit.phone && firstVisit.petName && firstVisit.breed && firstVisit.date && firstVisit.timeSlot && firstVisit.serviceId);
  }

  async function submitFirstVisit() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitFeedback(null);
    try {
      await fetchJson("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          guardianName: firstVisit.ownerName,
          phone: firstVisit.phone,
          petName: firstVisit.petName,
          breed: firstVisit.breed,
          serviceId: firstVisit.serviceId,
          appointmentDate: firstVisit.date,
          appointmentTime: firstVisit.timeSlot,
          memo: firstVisit.note.trim(),
        }),
      });
      setSubmitFeedback(getCustomerBookingSuccessFeedback(initialShop.approval_mode));
    } catch (error) {
      setSubmitFeedback({
        type: "error",
        title: "예약 신청에 실패했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupReturningHistory() {
    setSubmitting(true);
    try {
      setReturningError(null);
      const result = await fetchJson<LookupPayload>(`/api/customer-lookup?shopId=${shopId}&phone=${returningVisit.phone}`);
      const pet = result.pets.find((item) => item.name.trim() === returningVisit.petName.trim());
      if (!pet) {
        setReturningHistory(null);
        setReturningError("지난 방문 정보를 찾지 못했어요. 연락처와 아기 이름을 다시 확인해 주세요.");
        return;
      }
      const petAppointments = result.appointments.filter((item) => item.pet_id === pet.id);
      const petRecords = result.groomingRecords.filter((item) => item.pet_id === pet.id);
      const latestAppointment = getLatestAppointment(petAppointments);
      const latestRecord = getLatestRecord(petRecords);
      const lastServiceId = latestRecord?.service_id || latestAppointment?.service_id || services[0]?.id || "";
      const guardian = result.guardians.find((item) => item.id === pet.guardian_id);
      setReturningHistory({
        guardianName: guardian?.name || `${returningVisit.petName} 보호자`,
        phone: returningVisit.phone,
        petName: pet.name,
        lastServiceId,
        lastServiceLabel: services.find((service) => service.id === lastServiceId)?.name || "지난 서비스 정보 없음",
        lastVisitedAt: latestRecord?.groomed_at || latestAppointment?.appointment_date || "",
        lastNote: latestRecord?.style_notes || latestRecord?.memo || latestAppointment?.memo || "지난 참고사항이 없어요.",
      });
      setReturningVisit((prev) => ({ ...prev, serviceId: lastServiceId, date: "", timeSlot: "", note: "" }));
    } catch (error) {
      setReturningHistory(null);
      setReturningError(error instanceof Error ? error.message : "조회에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReturningVisit() {
    if (!returningHistory || submitting) return;

    setSubmitting(true);
    setSubmitFeedback(null);
    try {
      await fetchJson("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          guardianName: returningHistory.guardianName,
          phone: returningHistory.phone,
          petName: returningHistory.petName,
          serviceId: returningVisit.serviceId,
          appointmentDate: returningVisit.date,
          appointmentTime: returningVisit.timeSlot,
          memo: [returningVisit.note ? `참고: ${returningVisit.note}` : ""].filter(Boolean).join(" / "),
        }),
      });
      setSubmitFeedback(getCustomerBookingSuccessFeedback(initialShop.approval_mode));
    } catch (error) {
      setSubmitFeedback({
        type: "error",
        title: "예약 신청에 실패했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setSubmitting(false);
    }
  }



  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] pb-28">
        <section className="bg-[var(--accent)] px-5 pb-8 pt-10 text-white">
          {activeMode === "first" ? (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold opacity-80">첫 방문 예약</p>
                <h1 className="mt-2 text-[26px] font-extrabold leading-tight">{initialShop.name}</h1>
                <p className="mt-3 text-sm text-white/80">한 단계씩 입력하고 마지막에 예약을 확인해 주세요.</p>
              </div>
              <button type="button" onClick={() => setShopInfoOpen(true)} className="shrink-0 rounded-[14px] border border-white/25 bg-white/12 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                매장 정보
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="mt-2 text-[28px] font-extrabold leading-tight">{initialShop.name}<br />모바일 예약</h1>
                </div>
              <button type="button" onClick={() => setShopInfoOpen(true)} className="shrink-0 rounded-[14px] border border-white/25 bg-white/12 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                매장 정보
              </button>
            </div>
          )}
        </section>

        <div className="-mt-4 space-y-4 px-4">
          {activeMode === null ? (
            <section className="rounded-[28px] bg-white p-4 shadow-sm">
              <div className="space-y-3">
                <ModeCard title="첫방문 예약하기" onClick={() => { setActiveMode("first"); setFirstVisitStep(1); setSubmitFeedback(null); }} />
                <ModeCard title="재방문 예약하기" onClick={() => { setActiveMode("returning"); setSubmitFeedback(null); }} />
                <ModeCard title="예약 확인 / 취소 / 변경" onClick={() => { setActiveMode("manage"); setSubmitFeedback(null); }} />
              </div>
            </section>
          ) : null}


          {activeMode === "first" ? (
            <>
              <StepHeader title="첫 방문 예약" step={firstVisitStep} total={5} progress={firstVisitProgress} onBack={() => { if (firstVisitStep === 1) { resetView(); } else { setFirstVisitStep((prev) => (prev - 1) as FirstVisitStep); } }} onOpenShopInfo={() => setShopInfoOpen(true)} />
              <section className="rounded-[28px] bg-white p-4 shadow-sm">
                {firstVisitStep === 1 ? (
                  <StepSection title="기본 정보">
                    <input value={firstVisit.ownerName} onChange={(event) => setFirstVisit((prev) => ({ ...prev, ownerName: event.target.value }))} placeholder="보호자 이름" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                    <input value={firstVisit.phone} onChange={(event) => setFirstVisit((prev) => ({ ...prev, phone: phoneNormalize(event.target.value) }))} placeholder="연락처" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                    <input value={firstVisit.petName} onChange={(event) => setFirstVisit((prev) => ({ ...prev, petName: event.target.value }))} placeholder="아기 이름" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                    <input value={firstVisit.breed} onChange={(event) => setFirstVisit((prev) => ({ ...prev, breed: event.target.value }))} placeholder="견종" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                  </StepSection>
                ) : null}

                {firstVisitStep === 2 ? (
                  <StepSection title="날짜 선택">
                    <DateGrid dateOptions={dateOptions} selectedDate={firstVisit.date} onSelect={(value) => setFirstVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))} />
                  </StepSection>
                ) : null}

                {firstVisitStep === 3 ? (
                  <StepSection title="시간 선택">
                    <TimeGrid timeSlot={firstVisit.timeSlot} availableSlots={firstVisitSlots} loading={loadingFirstVisitSlots} onSelect={(value) => setFirstVisit((prev) => ({ ...prev, timeSlot: value }))} />
                  </StepSection>
                ) : null}

                {firstVisitStep === 4 ? (
                  <StepSection title="서비스 선택">
                    <ServiceCards services={services} selectedServiceId={firstVisit.serviceId} onSelect={(value) => setFirstVisit((prev) => ({ ...prev, serviceId: value }))} />
                  </StepSection>
                ) : null}

                {firstVisitStep === 5 ? (
                  <StepSection title="최종 확인">
                    <SummaryRow label="보호자 이름" value={firstVisit.ownerName} />
                    <SummaryRow label="연락처" value={firstVisit.phone} />
                    <SummaryRow label="아기 이름" value={firstVisit.petName} />
                    <SummaryRow label="견종" value={firstVisit.breed} />
                    <SummaryRow label="예약 날짜" value={formatDateLabel(firstVisit.date)} />
                    <SummaryRow label="예약 시간" value={firstVisit.timeSlot} />
                    <SummaryRow label="서비스" value={selectedFirstService?.name || "선택 안 됨"} />
                    <SummaryRow label="예상 금액" value={selectedFirstService ? formatServicePrice(selectedFirstService.price, selectedFirstService.price_type ?? "starting") : "-"} />
                    <label className="block text-sm font-semibold text-[var(--text)]">
                      <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">참고사항</span>
                      <textarea value={firstVisit.note} onChange={(event) => setFirstVisit((prev) => ({ ...prev, note: event.target.value }))} placeholder="메모가 있으면 남겨 주세요." className="field min-h-24 rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                    </label>
                  </StepSection>
                ) : null}
              </section>
            </>
          ) : null}

          {activeMode === "returning" ? (
            <>
              <FlowHeader title="재방문 예약" onBack={resetView} />
              <SectionCard title="고객 확인">
                <input value={returningVisit.phone} onChange={(event) => setReturningVisit((prev) => ({ ...prev, phone: phoneNormalize(event.target.value) }))} placeholder="연락처" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                <input value={returningVisit.petName} onChange={(event) => setReturningVisit((prev) => ({ ...prev, petName: event.target.value }))} placeholder="아기 이름" className="field rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                {returningError ? <p className="text-sm text-red-600">{returningError}</p> : null}
                <ActionButton disabled={submitting || !returningVisit.phone || !returningVisit.petName} onClick={lookupReturningHistory}>지난 방문 불러오기</ActionButton>
              </SectionCard>
              {returningHistory ? (
                <SectionCard title="지난 방문 정보">
                  <InfoRow label="아기 이름" value={returningHistory.petName} />
                  <InfoRow label="지난 서비스" value={returningHistory.lastServiceLabel} />
                  <InfoRow label="최근 방문" value={formatVisitedAt(returningHistory.lastVisitedAt)} />
                  <InfoRow label="지난 메모" value={returningHistory.lastNote} />
                  <ReservationSlotPicker date={returningVisit.date} timeSlot={returningVisit.timeSlot} dateOptions={dateOptions} availableSlots={returningVisitSlots} loading={loadingReturningVisitSlots} onDateChange={(value) => setReturningVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))} onTimeChange={(value) => setReturningVisit((prev) => ({ ...prev, timeSlot: value }))} />
                  <ServiceSelect services={services} value={returningVisit.serviceId} onChange={(value) => setReturningVisit((prev) => ({ ...prev, serviceId: value, timeSlot: "" }))} />
                  <div className="rounded-[24px] border border-[var(--border)] bg-[#f7f2e9] px-4 py-4 text-[14px] text-[var(--muted)]">{selectedReturningService ? `${selectedReturningService.name} · ${formatServicePrice(selectedReturningService.price, selectedReturningService.price_type ?? "starting")}` : "서비스를 선택해 주세요."}</div>
                  <textarea value={returningVisit.note} onChange={(event) => setReturningVisit((prev) => ({ ...prev, note: event.target.value }))} placeholder="추가 참고사항" className="field min-h-24 rounded-[22px] border-[var(--border)] bg-[var(--surface)] px-4 py-4" />
                  <ActionButton disabled={submitting || !returningVisit.date || !returningVisit.timeSlot || !returningVisit.serviceId} onClick={submitReturningVisit}>재방문 예약 요청</ActionButton>
                </SectionCard>
              ) : null}
            </>
          ) : null}

          {activeMode === "manage" ? (
            <CustomerBookingManagePanel
              shopId={shopId}
              shop={initialShop}
              services={services}
              onBack={initialMode === "manage" ? () => { window.location.href = entryHref || `/entry/${shopId}`; } : resetView}
            />
          ) : null}

        </div>
      </div>

      {activeMode === "first" ? (
        <BottomBar>
          <div className="flex items-center gap-3">
            <SecondaryButton disabled={firstVisitStep === 1} onClick={() => setFirstVisitStep((prev) => (Math.max(1, prev - 1)) as FirstVisitStep)}>
              이전
            </SecondaryButton>
            {firstVisitStep < 5 ? (
              <ActionButton disabled={!getFirstVisitStepValidity(firstVisitStep)} onClick={() => setFirstVisitStep((prev) => (prev + 1) as FirstVisitStep)}>다음</ActionButton>
            ) : (
              <ActionButton disabled={submitting || !getFirstVisitStepValidity(5)} onClick={submitFirstVisit}>{submitting ? "예약 신청 중..." : "예약하기"}</ActionButton>
            )}
          </div>
        </BottomBar>
      ) : null}


      {submitFeedback ? (
        <FeedbackDialog
          title={submitFeedback.title}
          message={submitFeedback.message}
          tone={submitFeedback.type}
          onConfirm={() => {
            if (submitFeedback.type === "success") {
              resetView();
            } else {
              setSubmitFeedback(null);
            }
          }}
        />
      ) : null}

      {shopInfoOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 px-4" onClick={() => setShopInfoOpen(false)}>
          <div className="w-full max-w-[430px] rounded-t-[32px] bg-[var(--background)] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-stone-200" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text)]">매장 정보</h3>
              <button type="button" className="text-sm font-semibold text-[var(--muted)]" onClick={() => setShopInfoOpen(false)}>닫기</button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto pb-2">
              <CustomerShopInfoContent shop={initialShop} services={services} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-5 pb-[120px]">
        <LegalLinksFooter />
      </div>
    </>
  );
}

function StepHeader({ title, step, total, progress, onBack, onOpenShopInfo }: { title: string; step: number; total: number; progress: number; onBack: () => void; onOpenShopInfo: () => void }) {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm font-bold text-[var(--muted)]">← 이전</button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--muted)]">{step}/{total}</span>
          <button type="button" onClick={onOpenShopInfo} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]">매장 정보</button>
        </div>
      </div>
      <h2 className="mt-3 text-lg font-extrabold">{title}</h2>
      <div className="mt-4 h-2 rounded-full bg-[#efebe4]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

function StepSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-4"><div><h3 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</h3></div>{children}</div>;
}

function FlowHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <section className="rounded-[28px] bg-white p-4 shadow-sm"><button type="button" onClick={onBack} className="text-sm font-bold text-[var(--muted)]">← 처음 화면으로</button><h2 className="mt-3 text-lg font-extrabold">{title}</h2></section>;
}

function FeedbackDialog({ title, message, tone, onConfirm }: { title: string; message: string; tone: "success" | "error"; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5" onClick={onConfirm}><div className="w-full max-w-[360px] rounded-[28px] bg-white p-5 shadow-[0_18px_48px_rgba(17,24,39,0.16)]" onClick={(event) => event.stopPropagation()}><div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone === "success" ? "bg-[#eef8f1] text-[#25613a]" : "bg-[#fff1f1] text-[#b42318]"}`}>{tone === "success" ? "예약 접수 완료" : "예약 접수 실패"}</div><h3 className="mt-4 text-[22px] font-extrabold leading-8 text-[var(--text)]">{title}</h3><p className="mt-3 text-[14px] leading-6 text-[var(--muted)]">{message}</p><button type="button" onClick={onConfirm} className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-sm font-bold text-white">확인</button></div></div>;
}

function ModeCard({ title, onClick, href }: { title: string; onClick?: () => void; href?: string }) {
  const className = "block w-full rounded-3xl border border-[var(--border)] bg-[#fffdfa] px-4 py-4 text-left shadow-sm";
  const content = <div className="flex min-h-[72px] items-center"><p className="text-base font-extrabold leading-6 text-[var(--text)]">{title}</p></div>;

  if (href) {
    return <a href={href} className={className}>{content}</a>;
  }

  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[28px] bg-white p-4 shadow-sm"><h2 className="text-base font-extrabold">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function DateGrid({ dateOptions, selectedDate, onSelect }: { dateOptions: DateOption[]; selectedDate: string; onSelect: (value: string) => void }) {
  return <div className="grid grid-cols-4 gap-2">{dateOptions.map((option) => <button key={option.value} type="button" onClick={() => onSelect(option.value)} className={`rounded-2xl border px-2 py-3 text-center text-sm font-bold ${selectedDate === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[#fffdfa] text-[var(--text)]"}`}><div>{option.label}</div><div className="mt-1 text-xs font-medium">{option.weekday}</div></button>)}</div>;
}

function TimeGrid({ timeSlot, availableSlots, loading, onSelect }: { timeSlot: string; availableSlots: string[]; loading: boolean; onSelect: (value: string) => void }) {
  if (loading) return <div className="rounded-2xl bg-[#faf5f1] px-4 py-5 text-sm text-[var(--muted)]">가능한 시간을 확인하고 있어요.</div>;
  if (availableSlots.length === 0) return <div className="rounded-2xl bg-[#faf5f1] px-4 py-5 text-sm text-[var(--muted)]">선택한 날짜에 가능한 시간이 없어요.</div>;
  return <div className="grid grid-cols-3 gap-2">{availableSlots.map((slot) => <button key={slot} type="button" onClick={() => onSelect(slot)} className={`rounded-2xl border px-2 py-3 text-sm font-bold ${timeSlot === slot ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[#fffdfa] text-[var(--text)]"}`}>{slot}</button>)}</div>;
}

function ServiceCards({ services, selectedServiceId, onSelect }: { services: Service[]; selectedServiceId: string; onSelect: (value: string) => void }) {
  return <div className="space-y-2.5">{services.map((service) => <button key={service.id} type="button" onClick={() => onSelect(service.id)} className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${selectedServiceId === service.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[#fffdfa]"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--text)]">{service.name}</p></div><span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)]">{formatServicePrice(service.price, service.price_type ?? "starting")}</span></div></button>)}</div>;
}

function ReservationSlotPicker({ date, timeSlot, dateOptions, availableSlots, loading, onDateChange, onTimeChange }: { date: string; timeSlot: string; dateOptions: DateOption[]; availableSlots: string[]; loading: boolean; onDateChange: (value: string) => void; onTimeChange: (value: string) => void }) {
  return <><DateGrid dateOptions={dateOptions} selectedDate={date} onSelect={onDateChange} /><TimeGrid timeSlot={timeSlot} availableSlots={availableSlots} loading={loading} onSelect={onTimeChange} /></>;
}

function ServiceSelect({ services, value, onChange }: { services: Service[]; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-[var(--text)]"><span className="mb-2 block text-xs text-[var(--muted)]">서비스 선택</span><select value={value} onChange={(event) => onChange(event.target.value)} className="field">{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[#fffdfa] px-4 py-3"><p className="text-xs font-bold text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{value}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[#fffdfa] px-4 py-3"><span className="text-xs font-semibold text-[var(--muted)]">{label}</span><span className="text-right text-sm font-semibold text-[var(--text)]">{value}</span></div>;
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[var(--border)] bg-[rgba(248,246,242,0.96)] px-4 pb-5 pt-3 backdrop-blur">{children}</div>;
}

function ActionButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void | Promise<void> }) {
  return <button type="button" disabled={disabled} onClick={() => void onClick()} className="w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-sm font-bold text-white disabled:opacity-50">{children}</button>;
}

function SecondaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="shrink-0 rounded-2xl border border-[var(--border)] bg-white px-5 py-4 text-sm font-bold text-[var(--text)] disabled:opacity-40">{children}</button>;
}














