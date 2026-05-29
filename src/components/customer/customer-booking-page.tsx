"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import type { CSSProperties } from "react";
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
  CustomerGroomingPriceGuide,
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
import CustomerFirstVisitFlow from "@/components/customer/customer-first-visit-flow";
import CustomerShopInfoContent from "@/components/customer/customer-shop-info-content";
import { isShopClosedOnDate } from "@/lib/availability";
import { fetchApiJson } from "@/lib/api";
import {
  applyCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import { currentDateInTimeZone, formatServicePrice, phoneNormalize } from "@/lib/utils";
import type { Appointment, BootstrapStaffMember, GroomingRecord, Service, Shop } from "@/types/domain";

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

type BookingProfilePet = Pick<AdditionalPetDraft, "id" | "name" | "breed">;

type FirstVisitState = {
  ownerName: string;
  phone: string;
  petName: string;
  breed: string;
  extraPets: AdditionalPetDraft[];
  date: string;
  timeSlot: string;
  serviceId: string;
  customerServiceOptionId: string;
  staffId: string;
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
  customerServiceOptionId: string;
  staffId: string;
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
  customerServiceOptionId: "",
  staffId: "",
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
  customerServiceOptionId: "",
  staffId: "",
  customServiceName: "",
  note: "",
};

const CUSTOM_SERVICE_ID = "__custom__";
const FIRST_VISIT_DRAFT_STORAGE_KEY_PREFIX = "petmanager:first-visit-draft:";
const BOOKING_PROFILE_STORAGE_KEY = "petmanager:booking-profile";

type FirstVisitDraftPayload = {
  version: 1;
  step: FirstVisitStep;
  firstVisit: FirstVisitState;
  savedAt: string;
};

type BookingProfilePayload = {
  version: 1 | 2;
  ownerName: string;
  phone: string;
  petName?: string;
  extraPets?: Array<Partial<AdditionalPetDraft>>;
  pets?: BookingProfilePet[];
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

function buildReusableFirstVisitDraft(source: FirstVisitState, defaultServiceId: string, defaultServiceOptionId: string): FirstVisitState {
  return {
    ...initialFirstVisitState,
    ownerName: source.ownerName.trim(),
    phone: source.phone.trim(),
    petName: source.petName.trim(),
    breed: "",
    extraPets: [],
    serviceId: defaultServiceId,
    customerServiceOptionId: defaultServiceOptionId,
  };
}

function mergeBookingProfilePets(pets: BookingProfilePet[]) {
  const seenNames = new Set<string>();
  return pets
    .map((pet, index) => ({
      id: pet.id || `profile-pet-${index + 1}`,
      name: pet.name.trim(),
      breed: pet.breed.trim(),
    }))
    .filter((pet) => {
      const key = pet.name.replace(/\s+/g, "").toLowerCase();
      if (!key || seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
}

function getProfilePetsFromFirstVisit(source: FirstVisitState) {
  return mergeBookingProfilePets([
    { id: "primary", name: source.petName, breed: source.breed },
    ...source.extraPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed })),
  ]);
}

function getBookingProfilePets(profile: Partial<BookingProfilePayload>) {
  if (Array.isArray(profile.pets) && profile.pets.length > 0) {
    return mergeBookingProfilePets(
      profile.pets.map((pet, index) => ({
        id: pet?.id || `profile-${index + 1}`,
        name: pet?.name ?? "",
        breed: pet?.breed ?? "",
      })),
    );
  }

  return mergeBookingProfilePets([
    { id: "primary", name: profile.petName ?? "", breed: "" },
    ...(Array.isArray(profile.extraPets)
      ? profile.extraPets.map((pet, index) => ({
          id: pet?.id || `profile-${index + 1}`,
          name: pet?.name ?? "",
          breed: pet?.breed ?? "",
        }))
      : []),
  ]);
}

function buildBookingProfile(source: FirstVisitState, savedPets: BookingProfilePet[] = []): BookingProfilePayload {
  const currentPets = getProfilePetsFromFirstVisit(source);
  const pets = mergeBookingProfilePets([...currentPets, ...savedPets]);
  return {
    version: 2,
    ownerName: source.ownerName.trim(),
    phone: formatBookingPhoneNumber(source.phone),
    petName: pets[0]?.name ?? "",
    extraPets: pets.slice(1).map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed })),
    pets,
    savedAt: new Date().toISOString(),
  };
}

function hasBookingProfileContent(source: FirstVisitState) {
  return Boolean(
    source.ownerName.trim() ||
      source.phone.trim() ||
      source.petName.trim() ||
      source.extraPets.some((pet) => pet.name.trim()),
  );
}

function restoreBookingProfile(profile: Partial<BookingProfilePayload>, defaultServiceId: string, defaultServiceOptionId: string): FirstVisitState {
  const pets = getBookingProfilePets(profile);
  const selectedPet = pets[0];
  return {
    ...initialFirstVisitState,
    ownerName: profile.ownerName ?? "",
    phone: profile.phone ? formatBookingPhoneNumber(profile.phone) : "",
    petName: selectedPet?.name ?? "",
    breed: "",
    extraPets: [],
    serviceId: defaultServiceId,
    customerServiceOptionId: defaultServiceOptionId,
  };
}

function saveBookingProfile(source: FirstVisitState, savedPets: BookingProfilePet[] = []) {
  if (typeof window === "undefined" || !hasBookingProfileContent(source)) return savedPets;
  const profile = buildBookingProfile(source, savedPets);
  window.localStorage.setItem(BOOKING_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile.pets ?? savedPets;
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
  options: { serviceId?: string; previewDurationMinutes?: number; staffId?: string | null },
) {
  const query = new URLSearchParams({ shopId, date });
  if (options.serviceId) query.set("serviceId", options.serviceId);
  if (options.previewDurationMinutes) query.set("previewDurationMinutes", String(options.previewDurationMinutes));
  if (options.staffId) query.set("staffId", options.staffId);
  return fetchJson<AvailabilityPayload>(`/api/availability?${query.toString()}`, { cache: "no-store" });
}

function buildDateOptions(shop: Shop): DateOption[] {
  const options: DateOption[] = [];
  const today = currentDateInTimeZone();
  const todayDate = parseISO(`${today}T00:00:00`);
  let offset = 0;

  while (options.length < 8 && offset < 45) {
    const date = addDays(todayDate, offset);
    const value = format(date, "yyyy-MM-dd");
    const isClosed = isShopClosedOnDate(shop, value);

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
      title: "예약이 확정되었어요",
      message: "선택한 일정으로 예약이 잡혔어요. 매장 안내 메시지를 확인해 주세요.",
    };
  }

  return {
    type: "success",
    title: "예약 신청이 접수되었어요",
    message: "매장에서 확인한 뒤 승인 여부를 안내해드릴게요.",
  };
}

function createAdditionalPetDraft(): AdditionalPetDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    breed: "",
  };
}

function StaffPreferenceCards({
  staffMembers,
  value,
  onChange,
}: {
  staffMembers: BootstrapStaffMember[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (staffMembers.length <= 1) return null;

  const options = [
    { id: "", name: "담당 디자이너 없음" },
    ...staffMembers.map((staff) => ({ id: staff.id, name: staff.name })),
  ];

  return (
    <div className="space-y-2.5">
      <p className="text-left text-[15px] font-medium tracking-[-0.02em] text-[var(--text)]">담당 디자이너</p>
      <div className="space-y-1.5">
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id || "none"}
              type="button"
              onClick={() => onChange(option.id)}
              className={`w-full rounded-[8px] border px-3.5 py-3 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--selection-soft)]"
                  : "border-[var(--border)] bg-white hover:bg-[var(--selection-soft)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-medium tracking-[-0.02em] text-[var(--text)]">{option.name}</p>
                </div>
                {active ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerBookingPage({
  shopId,
  initialShop,
  initialServices,
  initialStaffMembers = [],
  initialMode = "first",
  initialAccessToken,
  initialDate = "",
  initialTime = "",
  initialServiceId = "",
  initialServiceOptionId = "",
  initialFirstVisitStep = 1,
  lockFirstVisitStep = false,
  entryHref,
}: {
  shopId: string;
  initialShop: Shop;
  initialServices: Service[];
  initialStaffMembers?: BootstrapStaffMember[];
  initialAppointments?: Appointment[];
  initialRecords?: GroomingRecord[];
  initialMode?: ActiveMode;
  initialAccessToken?: string;
  initialDate?: string;
  initialTime?: string;
  initialServiceId?: string;
  initialServiceOptionId?: string;
  initialFirstVisitStep?: FirstVisitStep;
  lockFirstVisitStep?: boolean;
  entryHref?: string;
}) {
  const services = useMemo(() => initialServices.filter((service) => service.is_active), [initialServices]);
  const customerServiceOptions = useMemo(
    () =>
      applyCustomerServiceOverrides(
        buildCustomerServiceSourceOptions(
          services
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko")),
        ),
        initialShop.customer_page_settings.customer_service_overrides,
      ),
    [initialShop.customer_page_settings.customer_service_overrides, services],
  );
  const initialCustomerServiceOption =
    customerServiceOptions.find((option) => option.id === initialServiceOptionId) ??
    customerServiceOptions.find((option) => option.serviceId === initialServiceId) ??
    customerServiceOptions[0];
  const initialSelectableServiceId = services.some((service) => service.id === initialCustomerServiceOption?.serviceId)
    ? initialCustomerServiceOption.serviceId
    : services.some((service) => service.id === initialServiceId)
      ? initialServiceId
      : services[0]?.id || "";
  const initialSelectableServiceOptionId = initialCustomerServiceOption?.id || "";
  const staffMembers = useMemo(() => initialStaffMembers.filter((staff) => staff.name.trim()), [initialStaffMembers]);
  const fixedStaffId = staffMembers.length === 1 ? staffMembers[0].id : "";
  const dateOptions = useMemo(() => buildDateOptions(initialShop), [initialShop]);
  const [activeMode, setActiveMode] = useState<ActiveMode>(initialMode);
  const [firstVisitStep, setFirstVisitStep] = useState<FirstVisitStep>(initialFirstVisitStep);
  const [firstVisit, setFirstVisit] = useState<FirstVisitState>({
    ...initialFirstVisitState,
    date: initialDate,
    timeSlot: initialTime,
    serviceId: initialSelectableServiceId,
    customerServiceOptionId: initialSelectableServiceOptionId,
  });
  const [returningVisit, setReturningVisit] = useState<ReturningVisitState>({
    ...initialReturningVisitState,
    serviceId: initialSelectableServiceId,
    customerServiceOptionId: initialSelectableServiceOptionId,
  });
  const [returningHistory, setReturningHistory] = useState<ReturningHistory | null>(null);
  const [returningError, setReturningError] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [completedFirstVisitBooking, setCompletedFirstVisitBooking] = useState<BookingCreateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [firstVisitSlots, setFirstVisitSlots] = useState<string[]>([]);
  const [returningVisitSlots, setReturningVisitSlots] = useState<string[]>([]);
  const [loadingFirstVisitSlots, setLoadingFirstVisitSlots] = useState(false);
  const [loadingReturningVisitSlots, setLoadingReturningVisitSlots] = useState(false);
  const [shopInfoOpen, setShopInfoOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [savedPets, setSavedPets] = useState<BookingProfilePet[]>([]);

  const selectedFirstService = services.find((service) => service.id === firstVisit.serviceId);
  const selectedReturningService = services.find((service) => service.id === returningVisit.serviceId);
  const selectedFirstServiceOption =
    customerServiceOptions.find((option) => option.id === firstVisit.customerServiceOptionId) ??
    customerServiceOptions.find((option) => option.serviceId === firstVisit.serviceId);
  const selectedFirstStaffName = firstVisit.staffId
    ? staffMembers.find((staff) => staff.id === firstVisit.staffId)?.name
    : staffMembers.length > 1
      ? "담당 디자이너 없음"
      : staffMembers[0]?.name;
  const selectedReturningStaffName = returningVisit.staffId
    ? staffMembers.find((staff) => staff.id === returningVisit.staffId)?.name
    : staffMembers.length > 1
      ? "담당 디자이너 없음"
      : staffMembers[0]?.name;
  const firstVisitUsesCustomService = firstVisit.serviceId === CUSTOM_SERVICE_ID;
  const returningVisitUsesCustomService = returningVisit.serviceId === CUSTOM_SERVICE_ID;
  const hasInitialFirstVisitSlot = Boolean(initialDate && initialTime);
  const shouldSkipFirstVisitDateTimeStep = false;
  const displayedFirstVisitStep = firstVisitStep;
  const firstVisitStepTotal = 4;
  const firstVisitProgress = (displayedFirstVisitStep / firstVisitStepTotal) * 100;
  const selectedSavedPet = savedPets.find((pet) => pet.name.trim() && pet.name.trim() === firstVisit.petName.trim()) ?? null;
  const isNewPetInputActive = savedPets.length === 0 || !selectedSavedPet;

  useEffect(() => {
    if (shouldSkipFirstVisitDateTimeStep && firstVisitStep === 2) {
      setFirstVisitStep(3);
    }
  }, [firstVisitStep, shouldSkipFirstVisitDateTimeStep]);

  useEffect(() => {
    const validStaffIds = new Set(staffMembers.map((staff) => staff.id));
    const normalizeStaffId = (staffId: string) => {
      if (fixedStaffId) return fixedStaffId;
      return staffId && validStaffIds.has(staffId) ? staffId : "";
    };

    setFirstVisit((prev) => {
      const staffId = normalizeStaffId(prev.staffId);
      return staffId === prev.staffId
        ? prev
        : { ...prev, staffId, timeSlot: hasInitialFirstVisitSlot ? prev.timeSlot : "" };
    });
    setReturningVisit((prev) => {
      const staffId = normalizeStaffId(prev.staffId);
      return staffId === prev.staffId ? prev : { ...prev, staffId, timeSlot: "" };
    });
  }, [fixedStaffId, hasInitialFirstVisitSlot, staffMembers]);

  useEffect(() => {
    if (draftHydrated || typeof window === "undefined") return;

    if (initialMode === "manage") {
      setDraftHydrated(true);
      return;
    }

    const hasInitialSlot = Boolean(initialDate && initialTime);
    const rawDraft = window.localStorage.getItem(getFirstVisitDraftStorageKey(shopId));
    if (!rawDraft) {
      const rawProfile = window.localStorage.getItem(BOOKING_PROFILE_STORAGE_KEY);

      if (rawProfile) {
        try {
          const parsedProfile = JSON.parse(rawProfile) as Partial<BookingProfilePayload>;
          const defaultServiceId = initialSelectableServiceId;
          const defaultServiceOptionId = initialSelectableServiceOptionId;
          setSavedPets(getBookingProfilePets(parsedProfile));
          const restoredProfile = restoreBookingProfile(parsedProfile, defaultServiceId, defaultServiceOptionId);
          setFirstVisit((prev) => ({
            ...prev,
            ...restoredProfile,
            serviceId: initialSelectableServiceId || restoredProfile.serviceId,
            customerServiceOptionId: initialSelectableServiceOptionId || restoredProfile.customerServiceOptionId,
            date: hasInitialSlot ? initialDate : restoredProfile.date,
            timeSlot: hasInitialSlot ? initialTime : restoredProfile.timeSlot,
          }));
        } catch {
          window.localStorage.removeItem(BOOKING_PROFILE_STORAGE_KEY);
        }
      }

      setDraftHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as Partial<FirstVisitDraftPayload>;
      const nextStep = parsed.step && parsed.step >= 1 && parsed.step <= 3 ? parsed.step : 1;
      const draft = parsed.firstVisit;
      const defaultServiceId = initialSelectableServiceId;
      const defaultServiceOptionId = initialSelectableServiceOptionId;

      if (draft) {
        setActiveMode("first");
        setFirstVisitStep(initialFirstVisitStep !== 1 ? initialFirstVisitStep : hasInitialSlot ? 1 : nextStep);
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
          serviceId: initialSelectableServiceId || draft.serviceId || defaultServiceId,
          customerServiceOptionId: initialSelectableServiceOptionId || draft.customerServiceOptionId || defaultServiceOptionId,
          date: hasInitialSlot ? initialDate : draft.date ?? "",
          timeSlot: hasInitialSlot ? initialTime : draft.timeSlot ?? "",
          customServiceName: draft.customServiceName ?? "",
          note: draft.note ?? "",
        });
        setSavedPets(
          mergeBookingProfilePets([
            { id: "primary", name: draft.petName ?? "", breed: draft.breed ?? "" },
            ...(Array.isArray(draft.extraPets)
              ? draft.extraPets.map((pet, index) => ({
                  id: pet?.id || `draft-${index + 1}`,
                  name: pet?.name ?? "",
                  breed: pet?.breed ?? "",
                }))
              : []),
          ]),
        );
      }
    } catch {
      window.localStorage.removeItem(getFirstVisitDraftStorageKey(shopId));
    } finally {
      setDraftHydrated(true);
    }
  }, [draftHydrated, initialDate, initialFirstVisitStep, initialMode, initialSelectableServiceId, initialSelectableServiceOptionId, initialTime, shopId]);

  useEffect(() => {
    if (typeof window === "undefined" || activeMode !== "first" || !hasBookingProfileContent(firstVisit)) return;
    saveBookingProfile(firstVisit, savedPets);
  }, [activeMode, firstVisit.ownerName, firstVisit.phone, firstVisit.petName, firstVisit.breed, firstVisit.extraPets]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firstVisit.date) {
        setFirstVisitSlots([]);
        return;
      }
      setLoadingFirstVisitSlots(true);
      try {
        const usesPreviewSlots = !firstVisit.serviceId || firstVisit.serviceId === CUSTOM_SERVICE_ID;
        const selectedDurationMinutes = selectedFirstServiceOption?.durationMinutes;
        const result = await fetchAvailabilitySlots(
          shopId,
          firstVisit.date,
          {
            serviceId: usesPreviewSlots ? undefined : firstVisit.serviceId,
            previewDurationMinutes: selectedDurationMinutes ?? (usesPreviewSlots ? (firstVisit.serviceId === CUSTOM_SERVICE_ID ? 120 : 30) : undefined),
            staffId: firstVisit.staffId || null,
          },
        );
        if (!active) return;
        setFirstVisitSlots(result.slots);
        if (firstVisit.timeSlot && !result.slots.includes(firstVisit.timeSlot)) {
          setFirstVisit((prev) => ({ ...prev, timeSlot: "" }));
        }
      } finally {
        if (active) setLoadingFirstVisitSlots(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [firstVisit.date, firstVisit.serviceId, firstVisit.staffId, firstVisit.timeSlot, firstVisitStep, hasInitialFirstVisitSlot, selectedFirstServiceOption?.durationMinutes, shopId]);

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
            ? { previewDurationMinutes: returningVisit.serviceId === CUSTOM_SERVICE_ID ? 120 : 30, staffId: returningVisit.staffId || null }
            : { serviceId: returningVisit.serviceId, staffId: returningVisit.staffId || null },
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
  }, [returningVisit.date, returningVisit.serviceId, returningVisit.staffId, returningVisit.timeSlot, shopId]);

  function resetView() {
    window.location.href = entryHref || `/entry/${shopId}`;
  }

  function selectSavedPet(pet: BookingProfilePet) {
    setFirstVisit((prev) => ({
      ...prev,
      petName: pet.name,
      breed: "",
      extraPets: [],
    }));
  }

  function startNewPetInput() {
    setFirstVisit((prev) => ({
      ...prev,
      petName: "",
      breed: "",
      extraPets: [],
    }));
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
    setSavedPets(saveBookingProfile(firstVisit, savedPets));
    setSubmitFeedback({
      type: "success",
      title: "임시저장했어요",
      message: "같은 기기라면 다른 예약 링크에서도 예약자 정보를 이어서 쓸 수 있어요.",
      action: "dismiss",
    });
  }

  function getFirstVisitStepValidity(step: FirstVisitStep) {
    const basicInfoReady = Boolean(
      firstVisit.ownerName.trim() &&
        firstVisit.phone.trim() &&
        firstVisit.petName.trim() &&
        firstVisit.extraPets.every((pet) => pet.name.trim()),
    );
    if (step === 1) return Boolean(firstVisit.serviceId && (!firstVisitUsesCustomService || firstVisit.customServiceName.trim()));
    if (step === 2) return Boolean(firstVisit.date && firstVisit.timeSlot);
    if (step === 3) return basicInfoReady;
    return Boolean(
      basicInfoReady &&
        firstVisit.date &&
        firstVisit.timeSlot &&
        firstVisit.serviceId &&
        (!firstVisitUsesCustomService || firstVisit.customServiceName.trim()),
    );
  }

  function goToNextFirstVisitStep() {
    if (!getFirstVisitStepValidity(firstVisitStep)) {
      setSubmitFeedback({
        type: "error",
        title:
          firstVisitStep === 1
            ? "서비스를 선택해 주세요"
            : firstVisitStep === 2
              ? "예약 시간을 선택해 주세요"
              : "예약자 정보를 확인해 주세요",
        message:
          firstVisitStep === 3
            ? "보호자 이름, 연락처, 반려동물 이름을 입력하면 예약 요청을 보낼 수 있어요."
            : "필수 정보를 선택한 뒤 다시 눌러 주세요.",
        action: "dismiss",
      });
      return;
    }

    if (firstVisitStep === 1 && !firstVisit.date && dateOptions[0]) {
      setFirstVisit((prev) => ({ ...prev, date: dateOptions[0].value, timeSlot: "" }));
    }

    if (firstVisitStep === 1 && shouldSkipFirstVisitDateTimeStep) {
      setFirstVisitStep(3);
      return;
    }

    setFirstVisitStep((prev) => (prev + 1) as FirstVisitStep);
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
        breed: "",
        extraPets: firstVisit.extraPets
          .map((pet) => ({ name: pet.name.trim(), breed: "" }))
          .filter((pet) => pet.name),
        serviceId: firstVisit.serviceId,
        customerServiceOptionId: selectedFirstServiceOption?.id ?? "",
        staffId: firstVisit.staffId || null,
        customServiceName: firstVisitUsesCustomService ? firstVisit.customServiceName.trim() : "",
        appointmentDate: firstVisit.date,
        appointmentTime: firstVisit.timeSlot,
        memo: firstVisit.note.trim(),
      };

      const createdBooking = await fetchJson<BookingCreateResponse>("/api/customer-bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload),
      });

      if (typeof window !== "undefined") {
        const defaultServiceId = services[0]?.id || "";
        const defaultServiceOptionId = customerServiceOptions.find((option) => option.serviceId === defaultServiceId)?.id || "";
        const reusableFirstVisit = buildReusableFirstVisitDraft(firstVisit, defaultServiceId, defaultServiceOptionId);
        const reusableDraft: FirstVisitDraftPayload = {
          version: 1,
          step: 1,
          firstVisit: reusableFirstVisit,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(getFirstVisitDraftStorageKey(shopId), JSON.stringify(reusableDraft));
        setSavedPets(saveBookingProfile(reusableFirstVisit, savedPets));
      }

      setCompletedFirstVisitBooking(createdBooking);
      setFirstVisitStep(4);
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
        staffId: fixedStaffId,
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
        staffId: returningVisit.staffId || null,
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
      <div
        className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] pb-28"
        style={{
          "--background": "#fffaf3",
          "--surface": "#fffaf5",
          "--border": "#e7d8c9",
          "--muted": "#8B6A55",
          "--text": "#2b241f",
          "--accent": "#8B6A55",
          "--accent-soft": "#efe4d8",
          "--selection-soft": "rgba(139,106,85,0.10)",
          "--cta": "#1F7A68",
          "--cta-hover": "#176855",
          "--shadow-soft": "0 12px 28px rgba(139,106,85,0.10)",
        } as CSSProperties}
      >
        <div className={activeMode === "first" ? "" : "space-y-3.5 px-4 pt-4"}>
          {activeMode === "first" ? (
            <CustomerFirstVisitFlow
              shop={initialShop}
              customerServiceOptions={customerServiceOptions}
              dateOptions={dateOptions}
              firstVisit={firstVisit}
              step={firstVisitStep}
              selectedService={selectedFirstService}
              selectedServiceOption={selectedFirstServiceOption}
              availableSlots={firstVisitSlots}
              loadingSlots={loadingFirstVisitSlots}
              submitting={submitting}
              completedBooking={completedFirstVisitBooking}
              onBackToEntry={resetView}
              onStepBack={() => {
                if (lockFirstVisitStep) return;
                if (firstVisitStep <= 2) {
                  resetView();
                } else {
                  setFirstVisitStep((prev) => (prev - 1) as FirstVisitStep);
                }
              }}
              onNext={goToNextFirstVisitStep}
              onSubmit={submitFirstVisit}
              onOpenShopInfo={() => setShopInfoOpen(true)}
              onServiceSelect={(value) => {
                const selectedOption = customerServiceOptions.find((option) => option.id === value);
                setFirstVisit((prev) => {
                  const serviceId = selectedOption?.serviceId ?? value;
                  return {
                    ...prev,
                    serviceId,
                    customerServiceOptionId: selectedOption?.id ?? "",
                    customServiceName: serviceId === CUSTOM_SERVICE_ID ? "상담 후 결정" : "",
                    timeSlot: prev.serviceId === serviceId && prev.customerServiceOptionId === (selectedOption?.id ?? "") ? prev.timeSlot : "",
                  };
                });
              }}
              onDateSelect={(value) => setFirstVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))}
              onTimeSelect={(value) => setFirstVisit((prev) => ({ ...prev, timeSlot: value }))}
              onOwnerNameChange={(value) => setFirstVisit((prev) => ({ ...prev, ownerName: value }))}
              onPhoneChange={(value) => setFirstVisit((prev) => ({ ...prev, phone: formatBookingPhoneNumber(value) }))}
              onPetNameChange={(value) => setFirstVisit((prev) => ({ ...prev, petName: value }))}
              onNoteChange={(value) => setFirstVisit((prev) => ({ ...prev, note: value }))}
              onGoManage={() => {
                if (completedFirstVisitBooking?.bookingManageUrl) {
                  window.location.href = completedFirstVisitBooking.bookingManageUrl;
                  return;
                }
                resetView();
              }}
            />
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
                  <StaffPreferenceCards
                    staffMembers={staffMembers}
                    value={returningVisit.staffId}
                    onChange={(staffId) => setReturningVisit((prev) => ({ ...prev, staffId, timeSlot: "" }))}
                  />
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
                  {selectedReturningStaffName ? <InfoRow label="담당" value={selectedReturningStaffName} /> : null}
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
                staffMembers={staffMembers}
                initialAccessToken={initialAccessToken}
                onBack={initialMode === "manage" ? () => { window.location.href = entryHref || `/entry/${shopId}`; } : resetView}
              />
            </BookingBottomSheet>
          ) : null}
        </div>
      </div>

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

      </>
    );
  }
