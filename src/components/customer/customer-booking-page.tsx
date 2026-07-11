"use client";

import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import CustomerBookingManagePanel from "@/components/customer/customer-booking-manage-panel";
import CustomerFirstVisitFlow from "@/components/customer/customer-first-visit-claude-flow";
import { isShopClosedOnDate } from "@/lib/availability";
import { fetchApiJson } from "@/lib/api";
import { getBusinessHoursForWeekday } from "@/lib/business-hours";
import {
  applyConfiguredCustomerServiceOverrides,
  buildCustomerServiceSourceOptions,
} from "@/lib/customer-service-options";
import type { CustomerDiscountQuote } from "@/lib/discount-coupons";
import { currentDateInTimeZone, phoneNormalize } from "@/lib/utils";
import type { Appointment, BootstrapStaffMember, Service, Shop, StaffScheduleOverride } from "@/types/domain";

type ActiveMode = "first" | "manage" | null;
type FirstVisitStep = 1 | 2 | 3 | 4 | 5;

type AvailabilityPayload = { slots: string[]; recommendedSlots?: string[] };

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
  profilePets?: BookingProfilePet[];
  discountQuote?: CustomerDiscountQuote;
};

type CustomerDiscountQuoteResponse = CustomerDiscountQuote & {
  customerRecognized: boolean;
  customerServiceOptionId: string;
};

type CustomerLookupProfilePayload = {
  pets?: BookingProfilePet[];
  visitType?: "first_visit" | "revisit";
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
  breed?: string;
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

function isValidBookingPhoneNumber(value: string) {
  const digits = phoneNormalize(value);
  if (digits.startsWith("02")) return digits.length === 9 || digits.length === 10;
  return digits.length === 10 || digits.length === 11;
}

function formatCustomerBusinessHoursRows(shop: Shop) {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return labels.map((label, index) => {
    const hours = getBusinessHoursForWeekday(shop, index);
    const isClosed = shop.regular_closed_days.includes(index) || !hours?.enabled;
    return {
      label,
      value: isClosed ? "휴무" : `${hours.open.slice(0, 5)} - ${hours.close.slice(0, 5)}`,
      closed: isClosed,
    };
  });
}

function CustomerBusinessHoursSheet({ shop }: { shop: Shop }) {
  const rows = formatCustomerBusinessHoursRows(shop);
  const note = shop.customer_page_settings.operating_hours_note.trim();

  return (
    <div className="space-y-3">
      {note ? (
        <div className="rounded-[12px] border border-[#FFE1B0] bg-[#FFF9EC] px-3 py-3 text-[16px] leading-6 text-[#8B6F4D]">
          {note}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[12px] border border-[#FFE1B0] bg-white">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 border-b border-[#FFE1B0] px-4 py-3 last:border-b-0">
            <span className="text-[16px] font-normal text-[#2b241f]">{row.label}</span>
            <span className={`text-[16px] font-normal ${row.closed ? "text-[#8B6F4D]" : "text-[#2b241f]"}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerBookingFeedbackDialog({
  title,
  message,
  tone,
  onConfirm,
}: {
  title: string;
  message: string;
  tone: SubmitFeedback["type"];
  onConfirm: () => void;
}) {
  const isError = tone === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3a2e2a]/35 px-5">
      <div className="w-full max-w-[360px] rounded-[18px] border border-[#efe2dc] bg-white p-5 text-center shadow-[0_22px_60px_rgba(58,46,42,0.18)]">
        <div
          className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-[19px] font-bold ${
            isError ? "bg-[#fff1f1] text-[#c84b4b]" : "bg-[#fce9e4] text-[#d35f50]"
          }`}
        >
          {isError ? "!" : "✓"}
        </div>
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#3a2e2a]">{title}</h2>
        <p className="mt-2 text-[15px] leading-6 tracking-[-0.02em] text-[#8a7a72]">{message}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 h-12 w-full rounded-[12px] bg-[#ec7f72] text-[16px] font-bold tracking-[-0.02em] text-white transition hover:bg-[#d35f50]"
        >
          확인
        </button>
      </div>
    </div>
  );
}

function buildReusableFirstVisitDraft(source: FirstVisitState, defaultServiceId: string, defaultServiceOptionId: string): FirstVisitState {
  return {
    ...initialFirstVisitState,
    ownerName: source.ownerName.trim(),
    phone: source.phone.trim(),
    petName: source.petName.trim(),
    breed: source.breed.trim(),
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
    { id: "primary", name: profile.petName ?? "", breed: profile.breed ?? "" },
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
    breed: pets[0]?.breed ?? "",
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
      source.breed.trim() ||
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
    breed: selectedPet?.breed ?? profile.breed ?? "",
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

function normalizeLookupPets(pets: BookingProfilePet[] | undefined) {
  return mergeBookingProfilePets(
    (pets ?? []).map((pet, index) => ({
      id: pet?.id || `lookup-${index + 1}`,
      name: pet?.name ?? "",
      breed: pet?.breed ?? "",
    })),
  );
}

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

  while (offset < 45) {
    const date = addDays(todayDate, offset);
    const value = format(date, "yyyy-MM-dd");
    const isClosed = isShopClosedOnDate(shop, value);

    if (!isClosed || offset === 0) {
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

function getDefaultDateOptionValue(dateOptions: DateOption[]) {
  return dateOptions.find((option) => option.label === "오늘")?.value ?? dateOptions[0]?.value ?? "";
}

export default function CustomerBookingPage({
  shopId,
  initialShop,
  initialServices,
  initialStaffMembers = [],
  initialStaffScheduleOverrides = [],
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
  initialStaffScheduleOverrides?: StaffScheduleOverride[];
  initialAppointments?: Appointment[];
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
      applyConfiguredCustomerServiceOverrides(
        buildCustomerServiceSourceOptions(
          services
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko")),
          { priceGuideOnly: true },
        ),
        initialShop.customer_page_settings.customer_service_overrides,
      ),
    [initialShop.customer_page_settings.customer_service_overrides, services],
  );
  const initialCustomerServiceOption =
    customerServiceOptions.find((option) => option.id === initialServiceOptionId) ??
    customerServiceOptions.find((option) => option.serviceId === initialServiceId);
  const initialSelectableServiceId = initialCustomerServiceOption?.serviceId ?? "";
  const initialSelectableServiceOptionId = initialCustomerServiceOption?.id || "";
  const staffMembers = useMemo(() => initialStaffMembers.filter((staff) => staff.name.trim()), [initialStaffMembers]);
  const fixedStaffId = staffMembers.length === 1 ? staffMembers[0].id : "";
  const dateOptions = useMemo(() => buildDateOptions(initialShop), [initialShop]);
  const defaultFirstVisitDate = getDefaultDateOptionValue(dateOptions);
  const [activeMode, setActiveMode] = useState<ActiveMode>(initialMode);
  const [firstVisitStep, setFirstVisitStep] = useState<FirstVisitStep>(initialFirstVisitStep);
  const [firstVisit, setFirstVisit] = useState<FirstVisitState>({
    ...initialFirstVisitState,
    date: initialDate || (initialMode === "first" && initialFirstVisitStep === 3 ? defaultFirstVisitDate : ""),
    timeSlot: initialTime,
    serviceId: initialSelectableServiceId,
    customerServiceOptionId: initialSelectableServiceOptionId,
  });
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [completedFirstVisitBooking, setCompletedFirstVisitBooking] = useState<BookingCreateResponse | null>(null);
  const [completionManageAccessToken, setCompletionManageAccessToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [firstVisitSlots, setFirstVisitSlots] = useState<string[]>([]);
  const [firstVisitRecommendedSlots, setFirstVisitRecommendedSlots] = useState<string[]>([]);
  const [loadingFirstVisitSlots, setLoadingFirstVisitSlots] = useState(false);
  const [shopInfoOpen, setShopInfoOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [savedPets, setSavedPets] = useState<BookingProfilePet[]>([]);
  const [discountQuote, setDiscountQuote] = useState<CustomerDiscountQuoteResponse | null>(null);
  const [discountQuoteLoading, setDiscountQuoteLoading] = useState(false);
  const [discountQuoteError, setDiscountQuoteError] = useState("");

  const selectedFirstService = services.find((service) => service.id === firstVisit.serviceId);
  const selectedFirstServiceOption =
    customerServiceOptions.find((option) => option.id === firstVisit.customerServiceOptionId) ??
    customerServiceOptions.find((option) => option.serviceId === firstVisit.serviceId);
  const firstVisitUsesCustomService = firstVisit.serviceId === CUSTOM_SERVICE_ID;
  const hasInitialFirstVisitSlot = Boolean(initialDate && initialTime);
  const shouldSkipFirstVisitDateTimeStep = false;
  const firstVisitDateOptionValues = useMemo(() => new Set(dateOptions.map((option) => option.value)), [dateOptions]);

  useEffect(() => {
    const quoteReady =
      firstVisitStep === 4 &&
      firstVisit.ownerName.trim().length > 0 &&
      isValidBookingPhoneNumber(firstVisit.phone) &&
      Boolean(firstVisit.serviceId) &&
      Boolean(firstVisit.date);

    if (!quoteReady) {
      setDiscountQuote(null);
      setDiscountQuoteLoading(false);
      setDiscountQuoteError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDiscountQuoteLoading(true);
      setDiscountQuoteError("");
      void fetchJson<CustomerDiscountQuoteResponse>("/api/customer-benefits/quote", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          shopId,
          guardianName: firstVisit.ownerName,
          phone: phoneNormalize(firstVisit.phone),
          serviceId: firstVisit.serviceId,
          customerServiceOptionId: selectedFirstServiceOption?.id ?? "",
          appointmentDate: firstVisit.date,
        }),
      })
        .then((quote) => setDiscountQuote(quote))
        .catch((error) => {
          if (controller.signal.aborted) return;
          setDiscountQuote(null);
          setDiscountQuoteError(error instanceof Error ? error.message : "혜택을 확인하지 못했습니다.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setDiscountQuoteLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    firstVisit.date,
    firstVisit.ownerName,
    firstVisit.phone,
    firstVisit.serviceId,
    firstVisitStep,
    selectedFirstServiceOption?.id,
    shopId,
  ]);

  useEffect(() => {
    if (shouldSkipFirstVisitDateTimeStep && firstVisitStep === 3) {
      setFirstVisitStep(4);
    }
  }, [firstVisitStep, shouldSkipFirstVisitDateTimeStep]);

  useEffect(() => {
    if (activeMode !== "first" || firstVisitStep !== 3 || !defaultFirstVisitDate) return;
    if (firstVisit.date && firstVisitDateOptionValues.has(firstVisit.date)) return;
    setFirstVisit((prev) => {
      if (prev.date && firstVisitDateOptionValues.has(prev.date)) return prev;
      return { ...prev, date: defaultFirstVisitDate, timeSlot: "" };
    });
  }, [activeMode, defaultFirstVisitDate, firstVisit.date, firstVisitDateOptionValues, firstVisitStep]);

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
            date: hasInitialSlot ? initialDate : restoredProfile.date || defaultFirstVisitDate,
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
      const nextStep = parsed.step && parsed.step >= 1 && parsed.step <= 4 ? parsed.step : 1;
      const draft = parsed.firstVisit;
      const defaultServiceId = initialSelectableServiceId;
      const defaultServiceOptionId = initialSelectableServiceOptionId;

      if (draft) {
        const storedProfilePets = (() => {
          try {
            const rawProfile = window.localStorage.getItem(BOOKING_PROFILE_STORAGE_KEY);
            return rawProfile ? getBookingProfilePets(JSON.parse(rawProfile) as Partial<BookingProfilePayload>) : [];
          } catch {
            return [];
          }
        })();
        const draftPets = mergeBookingProfilePets([
          { id: "primary", name: draft.petName ?? "", breed: draft.breed ?? "" },
          ...(Array.isArray(draft.extraPets)
            ? draft.extraPets.map((pet, index) => ({
                id: pet?.id || `draft-${index + 1}`,
                name: pet?.name ?? "",
                breed: pet?.breed ?? "",
              }))
            : []),
        ]);
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
          date: hasInitialSlot ? initialDate : draft.date || defaultFirstVisitDate,
          timeSlot: hasInitialSlot ? initialTime : draft.timeSlot ?? "",
          customServiceName: draft.customServiceName ?? "",
          note: draft.note ?? "",
        });
        setSavedPets(mergeBookingProfilePets([...storedProfilePets, ...draftPets]));
      }
    } catch {
      window.localStorage.removeItem(getFirstVisitDraftStorageKey(shopId));
    } finally {
      setDraftHydrated(true);
    }
  }, [defaultFirstVisitDate, draftHydrated, initialDate, initialFirstVisitStep, initialMode, initialSelectableServiceId, initialSelectableServiceOptionId, initialTime, shopId]);

  useEffect(() => {
    if (typeof window === "undefined" || activeMode !== "first" || !hasBookingProfileContent(firstVisit)) return;
    saveBookingProfile(firstVisit, savedPets);
  }, [activeMode, firstVisit.ownerName, firstVisit.phone, firstVisit.petName, firstVisit.breed, firstVisit.extraPets, savedPets]);

  useEffect(() => {
    let active = true;

    async function hydrateProfilePetsFromServer() {
      if (activeMode !== "first" || !firstVisit.ownerName.trim() || !isValidBookingPhoneNumber(firstVisit.phone)) return;

      try {
        const query = new URLSearchParams({
          shopId,
          guardianName: firstVisit.ownerName.trim(),
          phone: phoneNormalize(firstVisit.phone),
          profile: "1",
        });
        const result = await fetchJson<CustomerLookupProfilePayload>(`/api/customer-lookup?${query.toString()}`, { cache: "no-store" });
        if (!active) return;

        const profilePets = normalizeLookupPets(result.pets);
        if (profilePets.length === 0) return;

        setSavedPets((prev) => {
          const merged = mergeBookingProfilePets([...profilePets, ...prev, ...getProfilePetsFromFirstVisit(firstVisit)]);
          saveBookingProfile(firstVisit, merged);
          return merged;
        });
      } catch {
        // Local profile still works when the server cannot verify the customer yet.
      }
    }

    void hydrateProfilePetsFromServer();
    return () => {
      active = false;
    };
  }, [activeMode, firstVisit.ownerName, firstVisit.phone, shopId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firstVisit.date) {
        setFirstVisitSlots([]);
        setFirstVisitRecommendedSlots([]);
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
        setFirstVisitRecommendedSlots(result.recommendedSlots ?? []);
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

  function resetView() {
    window.location.href = entryHref || `/entry/${shopId}`;
  }

  async function loadProfilePetsFromCompletionToken() {
    const token = completedFirstVisitBooking?.bookingAccessToken;
    if (!token) return [];

    try {
      const query = new URLSearchParams({ shopId, t: token });
      const result = await fetchJson<CustomerLookupProfilePayload>(`/api/customer-lookup?${query.toString()}`, { cache: "no-store" });
      return normalizeLookupPets(result.pets);
    } catch {
      return [];
    }
  }

  async function startAdditionalBooking() {
    const defaultServiceOption = customerServiceOptions[0];
    const defaultServiceId = defaultServiceOption?.serviceId || "";
    const defaultServiceOptionId = defaultServiceOption?.id || "";
    const tokenPets = await loadProfilePetsFromCompletionToken();
    const responsePets = normalizeLookupPets(completedFirstVisitBooking?.profilePets);
    const nextSavedPets = mergeBookingProfilePets([
      ...tokenPets,
      ...responsePets,
      ...savedPets,
      ...getProfilePetsFromFirstVisit(firstVisit),
    ]);

    setSavedPets(nextSavedPets);
    saveBookingProfile(firstVisit, nextSavedPets);
    setCompletedFirstVisitBooking(null);
    setCompletionManageAccessToken(null);
    setSubmitFeedback(null);
    setActiveMode("first");
    setFirstVisitStep(1);
    setFirstVisit((prev) => ({
      ...initialFirstVisitState,
      ownerName: prev.ownerName,
      phone: prev.phone,
      petName: prev.petName,
      breed: prev.breed,
      serviceId: defaultServiceId,
      customerServiceOptionId: defaultServiceOptionId,
      staffId: fixedStaffId,
    }));
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

  function getFirstVisitStepValidity(step: FirstVisitStep) {
    const petInfoReady = Boolean(
      firstVisit.petName.trim() &&
        firstVisit.breed.trim() &&
        firstVisit.extraPets.every((pet) => pet.name.trim()),
    );
    const contactInfoReady = Boolean(firstVisit.ownerName.trim() && isValidBookingPhoneNumber(firstVisit.phone));
    if (step === 1) return petInfoReady;
    if (step === 2) return Boolean(firstVisit.serviceId && (!firstVisitUsesCustomService || firstVisit.customServiceName.trim()));
    if (step === 3) return Boolean(firstVisit.date && firstVisit.timeSlot);
    return Boolean(
      petInfoReady &&
        contactInfoReady &&
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
            ? "예약자 정보를 확인해 주세요"
              : firstVisitStep === 2
                ? "서비스를 선택해 주세요"
                : firstVisitStep === 3
                  ? "예약 시간을 선택해 주세요"
                  : "연락 정보를 확인해 주세요",
        message:
          firstVisitStep === 1
            ? "아기 이름과 품종을 입력하면 다음 단계로 넘어갈 수 있어요."
            : "필수 정보를 선택한 뒤 다시 눌러 주세요.",
        action: "dismiss",
      });
      return;
    }

    if (firstVisitStep === 2 && !firstVisit.date && dateOptions[0]) {
      setFirstVisit((prev) => ({ ...prev, date: defaultFirstVisitDate || dateOptions[0].value, timeSlot: "" }));
    }

    if (firstVisitStep === 2 && shouldSkipFirstVisitDateTimeStep) {
      setFirstVisitStep(5);
      return;
    }

    setFirstVisitStep((prev) => (prev + 1) as FirstVisitStep);
  }

  async function submitFirstVisit() {
    if (submitting) return;
    if (!getFirstVisitStepValidity(4)) {
      setSubmitFeedback({
        type: "error",
        title: "예약 정보를 확인해 주세요",
        message: "보호자 이름과 10~11자리 연락처, 예약 시간을 모두 입력하면 예약을 등록할 수 있어요.",
        action: "dismiss",
      });
      return;
    }

    if (selectedFirstServiceOption && !discountQuote) {
      setSubmitFeedback({
        type: "error",
        title: "혜택 확인이 필요합니다",
        message: discountQuoteError || "잠시 후 최종 금액을 다시 확인해 주세요.",
        action: "dismiss",
      });
      return;
    }

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
          .map((pet) => ({ name: pet.name.trim(), breed: pet.breed.trim() }))
          .filter((pet) => pet.name),
        serviceId: firstVisit.serviceId,
        customerServiceOptionId: selectedFirstServiceOption?.id ?? "",
        staffId: firstVisit.staffId || null,
        customServiceName: firstVisitUsesCustomService ? firstVisit.customServiceName.trim() : "",
        appointmentDate: firstVisit.date,
        appointmentTime: firstVisit.timeSlot,
        memo: firstVisit.note.trim(),
        expectedFinalAmount: discountQuote?.finalAmount,
      };

      const createdBooking = await fetchJson<BookingCreateResponse>("/api/customer-bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload),
      });

      if (typeof window !== "undefined") {
        const defaultServiceOption = customerServiceOptions[0];
        const defaultServiceId = defaultServiceOption?.serviceId || "";
        const defaultServiceOptionId = defaultServiceOption?.id || "";
        const reusableFirstVisit = buildReusableFirstVisitDraft(firstVisit, defaultServiceId, defaultServiceOptionId);
        const reusableDraft: FirstVisitDraftPayload = {
          version: 1,
          step: 1,
          firstVisit: reusableFirstVisit,
          savedAt: new Date().toISOString(),
        };
        const responsePets = normalizeLookupPets(createdBooking.profilePets);
        const nextSavedPets = mergeBookingProfilePets([...responsePets, ...savedPets, ...getProfilePetsFromFirstVisit(firstVisit)]);
        window.localStorage.setItem(getFirstVisitDraftStorageKey(shopId), JSON.stringify(reusableDraft));
        setSavedPets(saveBookingProfile(reusableFirstVisit, nextSavedPets));
      }

      setCompletedFirstVisitBooking(createdBooking);
      setFirstVisitStep(5);
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
        className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[var(--background)]"
        style={{
          "--background": "#ffffff",
          "--surface": "#fffaf8",
          "--border": "#FFE1B0",
          "--muted": "#8B6F4D",
          "--text": "#2b241f",
          "--accent": "#F5A623",
          "--accent-soft": "#FFF6E6",
          "--selection-soft": "rgba(245,166,35,0.10)",
          "--cta": "#F5A623",
          "--cta-hover": "#E99718",
          "--shadow-soft": "none",
        } as CSSProperties}
      >
        <div className={activeMode === "first" ? "" : "space-y-3.5 px-4 pt-4"}>
          {activeMode === "first" ? (
            <CustomerFirstVisitFlow
              shop={initialShop}
              customerServiceOptions={customerServiceOptions}
              dateOptions={dateOptions}
              staffMembers={staffMembers}
              staffScheduleOverrides={initialStaffScheduleOverrides}
              firstVisit={firstVisit}
              savedPets={savedPets}
              step={firstVisitStep}
              selectedService={selectedFirstService}
              selectedServiceOption={selectedFirstServiceOption}
              availableSlots={firstVisitSlots}
              recommendedSlots={firstVisitRecommendedSlots}
              loadingSlots={loadingFirstVisitSlots}
              submitting={submitting}
              completedBooking={completedFirstVisitBooking}
              discountQuote={discountQuote}
              discountQuoteLoading={discountQuoteLoading}
              discountQuoteError={discountQuoteError}
              onBackToEntry={resetView}
              onStepBack={() => {
                if (lockFirstVisitStep) return;
                if (firstVisitStep <= 1) {
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
              onStaffSelect={(staffId) => setFirstVisit((prev) => ({ ...prev, staffId, timeSlot: prev.staffId === staffId ? prev.timeSlot : "" }))}
              onDateSelect={(value) => setFirstVisit((prev) => ({ ...prev, date: value, timeSlot: "" }))}
              onTimeSelect={(value) => setFirstVisit((prev) => ({ ...prev, timeSlot: value }))}
              onOwnerNameChange={(value) => setFirstVisit((prev) => ({ ...prev, ownerName: value }))}
              onPhoneChange={(value) => setFirstVisit((prev) => ({ ...prev, phone: formatBookingPhoneNumber(value) }))}
              onPetNameChange={(value) => setFirstVisit((prev) => ({ ...prev, petName: value }))}
              onBreedChange={(value) => setFirstVisit((prev) => ({ ...prev, breed: value }))}
              onNoteChange={(value) => setFirstVisit((prev) => ({ ...prev, note: value }))}
              onGoManage={() => {
                if (completedFirstVisitBooking?.bookingAccessToken) {
                  setCompletionManageAccessToken(completedFirstVisitBooking.bookingAccessToken);
                  setActiveMode("manage");
                  return;
                }
                resetView();
              }}
              onAddBooking={startAdditionalBooking}
            />
          ) : null}

          {activeMode === "manage" ? (
            <CustomerBookingManagePanel
              shopId={shopId}
              shop={initialShop}
              services={initialServices}
              customerServiceOptions={customerServiceOptions}
              staffMembers={staffMembers}
              initialAccessToken={completionManageAccessToken || initialAccessToken}
              onBack={
                completionManageAccessToken
                  ? () => {
                      setCompletionManageAccessToken(null);
                      setFirstVisitStep(5);
                      setActiveMode("first");
                    }
                  : initialMode === "manage"
                    ? () => { window.location.href = entryHref || `/entry/${shopId}`; }
                    : resetView
              }
            />
          ) : null}
        </div>
      </div>

      {submitFeedback ? (
        <CustomerBookingFeedbackDialog
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
                <h3 className="text-[18px] font-medium text-[var(--text)]">전체 영업시간</h3>
                <button type="button" className="text-sm font-semibold text-[var(--muted)]" onClick={() => setShopInfoOpen(false)}>닫기</button>
              </div>
              <div className="max-h-[72vh] overflow-y-auto pb-2">
                <CustomerBusinessHoursSheet shop={initialShop} />
              </div>
            </div>
          </div>
        ) : null}

      </>
    );
  }
