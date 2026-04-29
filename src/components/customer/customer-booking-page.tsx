"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";

import {
  ActionButton,
  AddPetButton,
  BookingBottomSheet,
  BookingFieldCard,
  BookingStageCard,
  BookingTextArea,
  BookingTextInput,
  BottomBar,
  DateGrid,
  FeedbackDialog,
  FlowHeader,
  InfoRow,
  ReservationSlotPicker,
  SecondaryButton,
  SectionCard,
  ServiceCards,
  ServiceSelect,
  StepHeader,
  StepSection,
  SummaryRow,
  TimeGrid,
} from "@/components/customer/customer-booking-flow-ui";
import CustomerBookingManagePanel from "@/components/customer/customer-booking-manage-panel";
import LegalLinksFooter from "@/components/legal/legal-links-footer";
import CustomerShopInfoContent from "@/components/customer/customer-shop-info-content";
import { fetchApiJson } from "@/lib/api";
import { currentDateInTimeZone, formatServicePrice, phoneNormalize } from "@/lib/utils";
import type { Appointment, GroomingRecord, Service, Shop } from "@/types/domain";

type ActiveMode = "first" | "returning" | "manage" | null;
type FirstVisitStep = 1 | 2 | 3 | 4;

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

type AdditionalPetDraft = {
  id: string;
  name: string;
  breed: string;
};

type FirstVisitState = {
  ownerName: string;
  phone: string;
  petName: string;
  breed: string;
  extraPets: AdditionalPetDraft[];
  date: string;
  timeSlot: string;
  serviceId: string;
  customServiceName: string;
  note: string;
};

type ReturningVisitState = {
  phone: string;
  guardianName: string;
  petName: string;
  date: string;
  timeSlot: string;
  serviceId: string;
  customServiceName: string;
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
  action?: "dismiss" | "reset";
};

type BookingCreateResponse = {
  appointment: Appointment;
  bookingAccessToken: string;
  bookingManageUrl: string;
};

const initialFirstVisitState: FirstVisitState = {
  ownerName: "",
  phone: "",
  petName: "",
  breed: "",
  extraPets: [],
  date: "",
  timeSlot: "",
  serviceId: "",
  customServiceName: "",
  note: "",
};

const initialReturningVisitState: ReturningVisitState = {
  phone: "",
  guardianName: "",
  petName: "",
  date: "",
  timeSlot: "",
  serviceId: "",
  customServiceName: "",
  note: "",
};

const CUSTOM_SERVICE_ID = "__custom__";
const FIRST_VISIT_DRAFT_STORAGE_KEY_PREFIX = "petmanager:first-visit-draft:";

type FirstVisitDraftPayload = {
  version: 1;
  step: FirstVisitStep;
  firstVisit: FirstVisitState;
  savedAt: string;
};

function getFirstVisitDraftStorageKey(shopId: string) {
  return `${FIRST_VISIT_DRAFT_STORAGE_KEY_PREFIX}${shopId}`;
}

function formatBookingPhoneNumber(value: string) {
  const digits = phoneNormalize(value).slice(0, 11);
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

function buildReusableFirstVisitDraft(source: FirstVisitState, defaultServiceId: string): FirstVisitState {
  return {
    ...initialFirstVisitState,
    ownerName: source.ownerName.trim(),
    phone: source.phone.trim(),
    petName: source.petName.trim(),
    extraPets: source.extraPets
      .filter((pet) => pet.name.trim())
      .map((pet) => ({ ...pet, name: pet.name.trim(), breed: "" })),
    serviceId: defaultServiceId,
  };
}

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

async function fetchAvailabilitySlots(
  shopId: string,
  date: string,
  options: { serviceId?: string; previewDurationMinutes?: number },
) {
  const query = new URLSearchParams({ shopId, date });
  if (options.serviceId) query.set("serviceId", options.serviceId);
  if (options.previewDurationMinutes) query.set("previewDurationMinutes", String(options.previewDurationMinutes));
  return fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`);
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

function createAdditionalPetDraft(): AdditionalPetDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    breed: "",
  };
}

export default function CustomerBookingPage({
  shopId,
  initialShop,
  initialServices,
  initialMode = "first",
  initialAccessToken,
  entryHref,
}: {
  shopId: string;
  initialShop: Shop;
  initialServices: Service[];
  initialAppointments?: Appointment[];
  initialRecords?: GroomingRecord[];
  initialMode?: ActiveMode;
  initialAccessToken?: string;
  entryHref?: string;
}) {
  const services = useMemo(() => initialServices.filter((service) => service.is_active), [initialServices]);
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
  const [draftHydrated, setDraftHydrated] = useState(false);

  const selectedFirstService = services.find((service) => service.id === firstVisit.serviceId);
  const selectedReturningService = services.find((service) => service.id === returningVisit.serviceId);
  const firstVisitUsesCustomService = firstVisit.serviceId === CUSTOM_SERVICE_ID;
  const returningVisitUsesCustomService = returningVisit.serviceId === CUSTOM_SERVICE_ID;
  const firstVisitProgress = (firstVisitStep / 4) * 100;

  useEffect(() => {
    if (draftHydrated || typeof window === "undefined") return;

    const rawDraft = window.localStorage.getItem(getFirstVisitDraftStorageKey(shopId));
    if (!rawDraft) {
      setDraftHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as Partial<FirstVisitDraftPayload>;
      const nextStep = parsed.step && parsed.step >= 1 && parsed.step <= 4 ? parsed.step : 1;
      const draft = parsed.firstVisit;
      const defaultServiceId = services[0]?.id || "";

      if (draft) {
        setActiveMode("first");
        setFirstVisitStep(nextStep);
        setFirstVisit({
          ...initialFirstVisitState,
          ...draft,
          ownerName: draft.ownerName ?? "",
          phone: draft.phone ? formatBookingPhoneNumber(draft.phone) : "",
          petName: draft.petName ?? "",
          extraPets: Array.isArray(draft.extraPets)
            ? draft.extraPets.map((pet, index) => ({
                id: pet?.id || `restored-${index + 1}`,
                name: pet?.name ?? "",
                breed: "",
              }))
            : [],
          serviceId: draft.serviceId || defaultServiceId,
          customServiceName: draft.customServiceName ?? "",
          note: draft.note ?? "",
        });
      }
    } catch {
      window.localStorage.removeItem(getFirstVisitDraftStorageKey(shopId));
    } finally {
      setDraftHydrated(true);
    }
  }, [draftHydrated, services, shopId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firstVisit.date) {
        setFirstVisitSlots([]);
        return;
      }
      setLoadingFirstVisitSlots(true);
      try {
        const usesPreviewSlots = firstVisitStep < 3 || !firstVisit.serviceId || firstVisit.serviceId === CUSTOM_SERVICE_ID;
        const result = await fetchAvailabilitySlots(
          shopId,
          firstVisit.date,
          usesPreviewSlots
            ? { previewDurationMinutes: 30 }
            : { serviceId: firstVisit.serviceId },
        );
        if (!active) return;
        setFirstVisitSlots(result.slots);
        if (!result.slots.includes(firstVisit.timeSlot)) setFirstVisit((prev) => ({ ...prev, timeSlot: "" }));
      } finally {
        if (active) setLoadingFirstVisitSlots(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [firstVisit.date, firstVisit.serviceId, firstVisit.timeSlot, firstVisitStep, shopId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!returningVisit.date) {
        setReturningVisitSlots([]);
        return;
      }
      setLoadingReturningVisitSlots(true);
      try {
        const usesPreviewSlots = !returningVisit.serviceId || returningVisit.serviceId === CUSTOM_SERVICE_ID;
        const result = await fetchAvailabilitySlots(
          shopId,
          returningVisit.date,
          usesPreviewSlots
            ? { previewDurationMinutes: 30 }
            : { serviceId: returningVisit.serviceId },
        );
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
    window.location.href = entryHref || `/entry/${shopId}`;
  }

  function saveFirstVisitDraft() {
    if (typeof window === "undefined") return;

    const hasDraftContent = Boolean(
      firstVisit.ownerName.trim() ||
        firstVisit.phone.trim() ||
        firstVisit.petName.trim() ||
        firstVisit.extraPets.some((pet) => pet.name.trim()) ||
        firstVisit.date ||
        firstVisit.timeSlot ||
        firstVisit.note.trim() ||
        (firstVisitUsesCustomService && firstVisit.customServiceName.trim()),
    );

    if (!hasDraftContent) {
      setSubmitFeedback({
        type: "error",
        title: "저장할 내용이 없어요",
        message: "예약자 정보를 조금 입력한 뒤 임시저장해 주세요.",
        action: "dismiss",
      });
      return;
    }

    const payload: FirstVisitDraftPayload = {
      version: 1,
      step: firstVisitStep,
      firstVisit,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(getFirstVisitDraftStorageKey(shopId), JSON.stringify(payload));
    setSubmitFeedback({
      type: "success",
      title: "임시저장했어요",
      message: "같은 기기에서 다시 열면 예약자 정보와 선택 내용을 이어서 볼 수 있어요.",
      action: "dismiss",
    });
  }

  function getFirstVisitStepValidity(step: FirstVisitStep) {
    const basicInfoReady = Boolean(
      firstVisit.ownerName &&
        firstVisit.phone &&
        firstVisit.petName &&
        firstVisit.extraPets.every((pet) => pet.name.trim()),
    );
    if (step === 1) return basicInfoReady;
    if (step === 2) return Boolean(firstVisit.date && firstVisit.timeSlot);
    if (step === 3) return Boolean(firstVisit.serviceId && (!firstVisitUsesCustomService || firstVisit.customServiceName.trim()));
    return Boolean(
      basicInfoReady &&
        firstVisit.date &&
        firstVisit.timeSlot &&
        firstVisit.serviceId &&
        (!firstVisitUsesCustomService || firstVisit.customServiceName.trim()),
    );
  }

  async function submitFirstVisit() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitFeedback(null);
    try {
      const bookingPayload = {
        shopId,
        guardianName: firstVisit.ownerName,
        phone: phoneNormalize(firstVisit.phone),
        petName: firstVisit.petName,
        breed: firstVisit.breed,
        extraPets: firstVisit.extraPets
          .map((pet) => ({ name: pet.name.trim(), breed: "" }))
          .filter((pet) => pet.name),
        serviceId: firstVisit.serviceId,
        customServiceName: firstVisitUsesCustomService ? firstVisit.customServiceName.trim() : "",
        appointmentDate: firstVisit.date,
        appointmentTime: firstVisit.timeSlot,
        memo: firstVisit.note.trim(),
      };

      await fetchJson<BookingCreateResponse>("/api/customer-bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload),
      });

      if (typeof window !== "undefined") {
        const defaultServiceId = services[0]?.id || "";
        const reusableDraft: FirstVisitDraftPayload = {
          version: 1,
          step: 1,
          firstVisit: buildReusableFirstVisitDraft(firstVisit, defaultServiceId),
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(getFirstVisitDraftStorageKey(shopId), JSON.stringify(reusableDraft));
      }

      const nextFeedback = getCustomerBookingSuccessFeedback(initialShop.approval_mode);
      setSubmitFeedback({ ...nextFeedback, action: "reset" });
    } catch (error) {
      setSubmitFeedback({
        type: "error",
        title: "예약 신청에 실패했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        action: "dismiss",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupReturningHistory() {
    setSubmitting(true);
    try {
      setReturningError(null);
      const query = new URLSearchParams({
        shopId,
        phone: phoneNormalize(returningVisit.phone),
        guardianName: returningVisit.guardianName,
        petName: returningVisit.petName,
      });
      const result = await fetchJson<LookupPayload>(`/api/customer-lookup?${query.toString()}`);
      const guardian = result.guardians.find((item) => item.name.trim() === returningVisit.guardianName.trim());
      if (!guardian) {
        setReturningHistory(null);
        setReturningError("입력한 정보와 일치하는 지난 방문 정보를 찾지 못했어요.");
        return;
      }

      const guardianPets = result.pets.filter((item) => item.guardian_id === guardian.id);
      if (guardianPets.length === 0) {
        setReturningHistory(null);
        setReturningError("등록된 반려동물 정보를 찾지 못했어요. 매장에 문의해 주세요.");
        return;
      }

      const rankedPets = guardianPets
        .map((pet) => {
          const petAppointments = result.appointments.filter((item) => item.pet_id === pet.id);
          const petRecords = result.groomingRecords.filter((item) => item.pet_id === pet.id);
          const latestAppointment = getLatestAppointment(petAppointments);
          const latestRecord = getLatestRecord(petRecords);
          const latestVisitedAt = latestRecord?.groomed_at || latestAppointment?.appointment_date || "";

          return {
            pet,
            latestAppointment,
            latestRecord,
            latestVisitedAt,
          };
        })
        .sort((a, b) => `${b.latestVisitedAt}`.localeCompare(`${a.latestVisitedAt}`));

      const latestPet = rankedPets[0];
      const latestAppointment = latestPet?.latestAppointment;
      const latestRecord = latestPet?.latestRecord;
      const lastServiceId = latestRecord?.service_id || latestAppointment?.service_id || services[0]?.id || "";

      setReturningHistory({
        guardianName: guardian.name,
        phone: formatBookingPhoneNumber(returningVisit.phone),
        petName: latestPet.pet.name,
        lastServiceId,
        lastServiceLabel: services.find((service) => service.id === lastServiceId)?.name || "지난 서비스 정보 없음",
        lastVisitedAt: latestRecord?.groomed_at || latestAppointment?.appointment_date || "",
        lastNote: latestRecord?.style_notes || latestRecord?.memo || latestAppointment?.memo || "지난 참고사항이 없어요.",
      });
      setReturningVisit((prev) => ({
        ...prev,
        serviceId: lastServiceId,
        customServiceName: "",
        date: "",
        timeSlot: "",
        note: "",
      }));
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
      const bookingPayload = {
        shopId,
        guardianName: returningHistory.guardianName,
        phone: phoneNormalize(returningHistory.phone),
        petName: returningHistory.petName,
        breed: "",
        serviceId: returningVisit.serviceId,
        customServiceName: returningVisitUsesCustomService ? returningVisit.customServiceName.trim() : "",
        appointmentDate: returningVisit.date,
        appointmentTime: returningVisit.timeSlot,
        memo: [returningVisit.note ? `메모: ${returningVisit.note}` : ""].filter(Boolean).join(" / "),
      };

      await fetchJson<BookingCreateResponse>("/api/customer-bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload),
      });

      const nextFeedback = getCustomerBookingSuccessFeedback(initialShop.approval_mode);
      setSubmitFeedback({ ...nextFeedback, action: "reset" });
    } catch (error) {
      setSubmitFeedback({
        type: "error",
        title: "예약 신청에 실패했습니다",
        message: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
        action: "dismiss",
      });
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] pb-28">
        <div className="space-y-3.5 px-4 pt-4">
          {activeMode === "first" ? (
            <BookingBottomSheet>
              <BookingStageCard>
              <StepHeader
                title={
                  firstVisitStep === 1
                    ? "예약자 정보"
                    : firstVisitStep === 2
                      ? "날짜·시간 선택"
                      : firstVisitStep === 3
                        ? "서비스 선택"
                        : "최종 확인"
                }
                step={firstVisitStep}
                total={4}
                progress={firstVisitProgress}
                onBack={() => {
                  if (firstVisitStep === 1) {
                    resetView();
                  } else {
                    setFirstVisitStep((prev) => (prev - 1) as FirstVisitStep);
                  }
                }}
              />

              {firstVisitStep === 1 ? (
                <StepSection title="">
                  <div className="space-y-1">
                    <BookingFieldCard label="보호자 이름">
                      <BookingTextInput
                        value={firstVisit.ownerName}
                        onChange={(event) => setFirstVisit((prev) => ({ ...prev, ownerName: event.target.value }))}
                      />
                    </BookingFieldCard>
                    <BookingFieldCard label="아기 이름">
                      <BookingTextInput
                        value={firstVisit.petName}
                        onChange={(event) => setFirstVisit((prev) => ({ ...prev, petName: event.target.value }))}
                      />
                    </BookingFieldCard>
                    <BookingFieldCard label="연락처">
                      <BookingTextInput
                        value={firstVisit.phone}
                        onChange={(event) => setFirstVisit((prev) => ({ ...prev, phone: formatBookingPhoneNumber(event.target.value) }))}
                      />
                    </BookingFieldCard>

                    {firstVisit.extraPets.map((pet, index) => (
                      <div key={pet.id} className="space-y-2 rounded-[12px] border border-[#e5ddd2] bg-[#fffdfa] px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[14px] font-medium tracking-[-0.02em] text-[var(--text)]">아기 {index + 2}</p>
                          <button
                            type="button"
                            onClick={() =>
                              setFirstVisit((prev) => ({
                                ...prev,
                                extraPets: prev.extraPets.filter((item) => item.id !== pet.id),
                              }))
                            }
                            className="text-[13px] font-medium text-[var(--muted)]"
                          >
                            삭제
                          </button>
                        </div>
                        <BookingFieldCard label="아기 이름">
                          <BookingTextInput
                            value={pet.name}
                            onChange={(event) =>
                              setFirstVisit((prev) => ({
                                ...prev,
                                extraPets: prev.extraPets.map((item) =>
                                  item.id === pet.id ? { ...item, name: event.target.value } : item,
                                ),
                              }))
                            }
                          />
                        </BookingFieldCard>
                      </div>
                    ))}

                    <div className="pt-1.5">
                    <AddPetButton
                      disabled={!firstVisit.petName.trim()}
                      onClick={() =>
                        setFirstVisit((prev) => ({
                          ...prev,
                          extraPets: [...prev.extraPets, createAdditionalPetDraft()],
                        }))
                      }
                    />
                    </div>
                  </div>
                </StepSection>
              ) : null}

              {firstVisitStep === 2 ? (
                <StepSection title="">
                  <div className="space-y-2.5">
                    <p className="text-left text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">날짜 선택</p>
                    <DateGrid
                      dateOptions={dateOptions}
                      selectedDate={firstVisit.date}
                      onSelect={(value) => setFirstVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))}
                    />
                    {firstVisit.date ? (
                      <div className="space-y-2">
                        <p className="text-left text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">시간 선택</p>
                        <TimeGrid
                          timeSlot={firstVisit.timeSlot}
                          availableSlots={firstVisitSlots}
                          loading={loadingFirstVisitSlots}
                          onSelect={(value) => setFirstVisit((prev) => ({ ...prev, timeSlot: value }))}
                        />
                      </div>
                    ) : null}
                  </div>
                </StepSection>
              ) : null}

              {firstVisitStep === 3 ? (
                <StepSection title="">
                  <ServiceCards
                    services={services}
                    selectedServiceId={firstVisit.serviceId}
                    onSelect={(value) =>
                      setFirstVisit((prev) => ({
                        ...prev,
                        serviceId: value,
                        customServiceName: value === CUSTOM_SERVICE_ID ? prev.customServiceName : "",
                      }))
                    }
                    allowCustom
                  />
                  {firstVisitUsesCustomService ? (
                    <BookingFieldCard label="원하는 서비스">
                      <BookingTextInput
                        value={firstVisit.customServiceName}
                        onChange={(event) => setFirstVisit((prev) => ({ ...prev, customServiceName: event.target.value }))}
                      />
                    </BookingFieldCard>
                  ) : null}
                </StepSection>
              ) : null}

              {firstVisitStep === 4 ? (
                <StepSection title="">
                  <SummaryRow label="보호자 이름" value={firstVisit.ownerName} />
                  <SummaryRow label="연락처" value={firstVisit.phone} />
                  <SummaryRow label="아기 이름" value={firstVisit.petName} />
                  <SummaryRow label="예약 날짜" value={formatDateLabel(firstVisit.date)} />
                  <SummaryRow label="예약 시간" value={firstVisit.timeSlot} />
                  <SummaryRow
                    label="서비스"
                    value={
                      firstVisitUsesCustomService
                        ? `기타 · ${firstVisit.customServiceName || "직접 입력"}`
                        : selectedFirstService?.name || "선택 안 됨"
                    }
                  />
                  <BookingFieldCard label="참고사항">
                    <BookingTextArea
                      value={firstVisit.note}
                      onChange={(event) => setFirstVisit((prev) => ({ ...prev, note: event.target.value }))}
                      className="min-h-[92px]"
                    />
                  </BookingFieldCard>
                </StepSection>
              ) : null}
              </BookingStageCard>
            </BookingBottomSheet>
          ) : null}

          {activeMode === "returning" ? (
            <BookingBottomSheet>
              <div className="space-y-4">
              <FlowHeader title="재방문 예약" onBack={resetView} />
              <SectionCard title="고객 확인">
                <BookingFieldCard label="보호자 이름">
                  <BookingTextInput
                    value={returningVisit.guardianName}
                    onChange={(event) => setReturningVisit((prev) => ({ ...prev, guardianName: event.target.value }))}
                  />
                </BookingFieldCard>
                <BookingFieldCard label="연락처">
                  <BookingTextInput
                    value={returningVisit.phone}
                    onChange={(event) => setReturningVisit((prev) => ({ ...prev, phone: formatBookingPhoneNumber(event.target.value) }))}
                  />
                </BookingFieldCard>
                <BookingFieldCard label="반려동물 이름">
                  <BookingTextInput
                    value={returningVisit.petName}
                    onChange={(event) => setReturningVisit((prev) => ({ ...prev, petName: event.target.value }))}
                  />
                </BookingFieldCard>
                {returningError ? <p className="text-[13px] leading-5 text-[#c43d3d]">{returningError}</p> : null}
                <ActionButton
                  disabled={submitting || !returningVisit.phone || !returningVisit.guardianName || !returningVisit.petName}
                  onClick={lookupReturningHistory}
                >
                  지난 방문 불러오기
                </ActionButton>
              </SectionCard>
              {returningHistory ? (
                <SectionCard title="지난 방문 정보">
                  <InfoRow label="아기 이름" value={returningHistory.petName} />
                  <InfoRow label="지난 서비스" value={returningHistory.lastServiceLabel} />
                  <InfoRow label="최근 방문" value={formatVisitedAt(returningHistory.lastVisitedAt)} />
                  <InfoRow label="지난 메모" value={returningHistory.lastNote} />
                  <ReservationSlotPicker
                    date={returningVisit.date}
                    timeSlot={returningVisit.timeSlot}
                    dateOptions={dateOptions}
                    availableSlots={returningVisitSlots}
                    loading={loadingReturningVisitSlots}
                    onDateChange={(value) => setReturningVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))}
                    onTimeChange={(value) => setReturningVisit((prev) => ({ ...prev, timeSlot: value }))}
                  />
                  <ServiceSelect
                    services={services}
                    value={returningVisit.serviceId}
                    onChange={(value) =>
                      setReturningVisit((prev) => ({
                        ...prev,
                        serviceId: value,
                        customServiceName: value === CUSTOM_SERVICE_ID ? prev.customServiceName : "",
                        timeSlot: "",
                      }))
                    }
                    allowCustom
                  />
                  {returningVisitUsesCustomService ? (
                    <BookingFieldCard label="원하는 서비스">
                      <BookingTextInput
                        value={returningVisit.customServiceName}
                        onChange={(event) => setReturningVisit((prev) => ({ ...prev, customServiceName: event.target.value }))}
                      />
                    </BookingFieldCard>
                  ) : null}
                  <BookingFieldCard label="선택 서비스">
                    <p className="text-[15px] font-medium leading-6 tracking-[-0.02em] text-[var(--text)]">
                      {returningVisitUsesCustomService
                        ? `기타 · ${returningVisit.customServiceName || "직접 입력"}`
                        : selectedReturningService
                          ? `${selectedReturningService.name} · ${formatServicePrice(selectedReturningService.price, selectedReturningService.price_type ?? "starting")}`
                          : "서비스를 선택해 주세요."}
                    </p>
                  </BookingFieldCard>
                  <BookingFieldCard label="추가 참고사항">
                    <BookingTextArea
                      value={returningVisit.note}
                      onChange={(event) => setReturningVisit((prev) => ({ ...prev, note: event.target.value }))}
                      className="min-h-[92px]"
                    />
                  </BookingFieldCard>
                  <ActionButton
                    disabled={
                      submitting ||
                      !returningVisit.date ||
                      !returningVisit.timeSlot ||
                      !returningVisit.serviceId ||
                      (returningVisitUsesCustomService && !returningVisit.customServiceName.trim())
                    }
                    onClick={submitReturningVisit}
                  >
                    {submitting ? "예약 요청 중..." : "재방문 예약 요청"}
                  </ActionButton>
                </SectionCard>
              ) : null}
              </div>
            </BookingBottomSheet>
          ) : null}

          {activeMode === "manage" ? (
            <BookingBottomSheet>
              <CustomerBookingManagePanel
                shopId={shopId}
                shop={initialShop}
                services={services}
                initialAccessToken={initialAccessToken}
                onBack={initialMode === "manage" ? () => { window.location.href = entryHref || `/entry/${shopId}`; } : resetView}
              />
            </BookingBottomSheet>
          ) : null}
        </div>
      </div>

      {activeMode === "first" ? (
        <BottomBar>
          <div className="flex items-center gap-3">
            <SecondaryButton onClick={saveFirstVisitDraft}>
              임시저장
            </SecondaryButton>
            {firstVisitStep < 4 ? (
              <ActionButton disabled={!getFirstVisitStepValidity(firstVisitStep)} onClick={() => setFirstVisitStep((prev) => (prev + 1) as FirstVisitStep)}>다음</ActionButton>
            ) : (
              <ActionButton disabled={submitting || !getFirstVisitStepValidity(4)} onClick={submitFirstVisit}>{submitting ? "예약 신청 중..." : "예약하기"}</ActionButton>
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
            if (submitFeedback.action === "reset") {
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
