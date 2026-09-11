"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import CalendarManagementScreen, { type OwnerScheduleCreateRequest } from "@/components/owner-web/calendar-management-screen";
import { type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import OwnerWebAppShell from "@/components/owner-web/owner-web-app-shell";
import OwnerInitialSetupGuide, {
  OwnerInitialSetupResumeCard,
} from "@/components/owner-web/owner-initial-setup-guide";
import type { InitialSetupStaffSessionDraft } from "@/components/owner-web/initial-setup-staff-management-panel";
import type { StaffProfilePhotoUploader } from "@/components/owner-web/staff-profile-photo-field";
import {
  saveStaffMembersWithDeferredRefresh,
  type StaffMembersChangeOptions,
  type StaffMembersChangeResult,
} from "@/components/owner-web/staff-members-save-sync";
import {
  demoOwnerWebStaffStorageKey,
  parseStoredOwnerWebStaff,
  type OwnerWebStaffMember,
} from "@/components/owner-web/owner-web-staff-data";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerAuthTokenCache, waitForOwnerAuthHydration } from "@/lib/auth/owner-auth-handoff";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { LANDING_DEMO_SHOP_ID } from "@/lib/development-demo";
import { buildCustomerServiceSourceOptions } from "@/lib/customer-service-options";
import {
  deriveOwnerInitialSetupReadiness,
  getBootstrapOwnerInitialSetupReadiness,
  resolveOwnerInitialSetupVisibility,
} from "@/lib/owner-initial-setup-readiness";
import { shouldInitializeOwnerWebNavigation } from "@/lib/owner-web-navigation-state";
import { defaultStaffProfileMessage } from "@/lib/staff-display";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload, OwnerInitialSetupStepKey, OwnerProfile } from "@/types/domain";

function OwnerScreenLoading() {
  return (
    <div className="flex min-h-[420px] items-center justify-center bg-white text-sm font-medium text-[#64748b]">
      화면을 불러오고 있어요.
    </div>
  );
}

const BookingLinkManagementScreen = dynamic(
  () => import("@/components/owner-web/booking-link-management-screen"),
  { loading: OwnerScreenLoading },
);
const CustomerBookingPageManagementScreen = dynamic(
  () => import("@/components/owner-web/customer-booking-page-management-screen"),
  { loading: OwnerScreenLoading },
);
const CustomerManagementScreen = dynamic(
  () => import("@/components/owner-web/customer-management-screen"),
  { loading: OwnerScreenLoading },
);
const CalendarRecordsScreen = dynamic(
  () => import("@/components/owner-web/calendar-records-screen"),
  { loading: OwnerScreenLoading },
);
const ProfitabilityAnalyticsScreen = dynamic(
  () => import("@/components/owner-web/profitability-analytics-screen"),
  { loading: OwnerScreenLoading },
);
const OwnerHelpScreen = dynamic(
  () => import("@/components/owner-web/owner-help-screen"),
  { loading: OwnerScreenLoading },
);
const ServiceManagementScreen = dynamic(
  () => import("@/components/owner-web/service-management-screen"),
  { loading: OwnerScreenLoading },
);
const SettingsManagementScreen = dynamic(
  () => import("@/components/owner-web/settings-management-screen"),
  { loading: OwnerScreenLoading },
);
const StaffManagementScreen = dynamic(
  () => import("@/components/owner-web/staff-management-screen"),
  { loading: OwnerScreenLoading },
);

function isDemoOwnerWebData(data: BootstrapPayload) {
  return data.mode !== "supabase" || data.shop.id === "demo-shop" || data.shop.id === "owner-demo" || data.shop.id === LANDING_DEMO_SHOP_ID;
}

function buildShopInitials(shopName: string) {
  const compactName = shopName.replace(/\s+/g, "");
  return Array.from(compactName).slice(0, 2).join("").toUpperCase() || "PM";
}

function settingsTabForScreen(screen: OwnerWebScreenKey): SettingsTabKey | null {
  if (screen === "ownerProfile") return "profile";
  if (screen === "shopInfo") return "shop";
  if (screen === "operatingHours") return "hours";
  if (screen === "benefits") return "benefits";
  if (screen === "alerts") return "alerts";
  return null;
}

function screenForInitialSetupStep(step: OwnerInitialSetupStepKey): OwnerWebScreenKey {
  if (step === "staff") return "staff";
  if (step === "pricing") return "services";
  return "operatingHours";
}

function hasAcknowledgedStaffPreferences(
  expectedStaffMembers: OwnerWebStaffMember[],
  actualStaffMembers: OwnerWebStaffMember[],
) {
  return expectedStaffMembers.every((expected) => {
    const actual = actualStaffMembers.find((staffMember) => staffMember.id === expected.id);
    if (!actual) return false;
    const expectedProfileMessage = expected.profileMessage?.trim() || defaultStaffProfileMessage;
    const actualProfileMessage = actual.profileMessage?.trim() || defaultStaffProfileMessage;
    return actualProfileMessage === expectedProfileMessage
      && (actual.chipColorIndex ?? null) === (expected.chipColorIndex ?? null);
  });
}

function withDemoInitialSetupReadiness(data: BootstrapPayload): BootstrapPayload {
  if (!isDemoOwnerWebData(data)) return data;
  return {
    ...data,
    initialSetupReadiness: deriveOwnerInitialSetupReadiness({
      shop: data.shop,
      services: data.services,
      persistedStaffMembers: data.staffMembers,
    }),
  };
}

function shouldStartWithPriceGuideSetup(data: BootstrapPayload) {
  if (isDemoOwnerWebData(data)) return false;
  const priceGuideOptions = buildCustomerServiceSourceOptions(data.services);
  if (priceGuideOptions.length === 0) return true;

  const hasOperationalData =
    (data.guardians?.length ?? 0) > 0 ||
    (data.pets?.length ?? 0) > 0 ||
    (data.appointments?.length ?? 0) > 0 ||
    (data.groomingRecords?.length ?? 0) > 0;
  const hasConfiguredCustomerMenu = Object.keys(data.shop.customer_page_settings.customer_service_overrides ?? {}).length > 0;

  return !hasOperationalData && !hasConfiguredCustomerMenu;
}

function getInitialOwnerWebScreen(data: BootstrapPayload): OwnerWebScreenKey {
  if (!getBootstrapOwnerInitialSetupReadiness(data).completed) return "operatingHours";
  if (typeof window === "undefined") return "schedule";
  const searchParams = new URLSearchParams(window.location.search);
  const screen = searchParams.get("screen") as OwnerWebScreenKey | null;
  if (screen && ["schedule", "bookingPageManagement", "bookingLink", "customers", "calendarRecords", "profitability", "services", "staff", "ownerProfile", "shopInfo", "operatingHours", "benefits", "alerts", "help"].includes(screen)) {
    return screen;
  }
  return shouldStartWithPriceGuideSetup(data) ? "services" : "schedule";
}

const screenBySettingsTab: Record<SettingsTabKey, OwnerWebScreenKey> = {
  profile: "ownerProfile",
  shop: "shopInfo",
  hours: "operatingHours",
  benefits: "benefits",
  alerts: "alerts",
};

type OwnerWebShop = BootstrapPayload["shop"];
type StaffMembersChangeHandler = (
  staff: OwnerWebStaffMember[],
  options?: StaffMembersChangeOptions,
) => void | StaffMembersChangeResult | Promise<void | StaffMembersChangeResult>;

function mergeOwnerWebShop(current: OwnerWebShop, incoming: OwnerWebShop): OwnerWebShop {
  return {
    ...current,
    ...incoming,
    reservation_policy_settings: incoming.reservation_policy_settings ?? current.reservation_policy_settings,
    customer_page_settings: {
      ...current.customer_page_settings,
      ...incoming.customer_page_settings,
      social_links: {
        ...(current.customer_page_settings.social_links ?? {}),
        ...(incoming.customer_page_settings.social_links ?? {}),
      },
      customer_service_overrides: {
        ...(current.customer_page_settings.customer_service_overrides ?? {}),
        ...(incoming.customer_page_settings.customer_service_overrides ?? {}),
      },
      discount_coupons:
        incoming.customer_page_settings.discount_coupons ?? current.customer_page_settings.discount_coupons,
    },
  };
}

function renderScreen(
  screen: OwnerWebScreenKey,
  initialData: BootstrapPayload,
  onDataChange: (data: BootstrapPayload) => void,
  onShopChange: (shop: BootstrapPayload["shop"]) => void,
  onOwnerProfileChange: (profile: OwnerProfile) => void | Promise<void>,
  staffMembers: OwnerWebStaffMember[],
  onStaffMembersChange: StaffMembersChangeHandler,
  createRequest: OwnerScheduleCreateRequest | null,
  onCreateRequestHandled: (requestId: number) => void,
  onCreateReservationForCustomer: (params: { guardianId: string; petId: string | null }) => void,
  onCreateReservationForDate: (date: string) => void,
  automaticVisitReminderAvailable: boolean,
  priceGuideOnboarding: boolean,
  initialSetupMode: boolean,
  onInitialSetupStepSaved: (step: OwnerInitialSetupStepKey, canonicalBootstrap?: BootstrapPayload) => void,
  onInitialSetupHoursNext: () => void,
  initialSetupStaffSessionDraft: InitialSetupStaffSessionDraft | null,
  onInitialSetupStaffSessionDraftChange: (sessionDraft: InitialSetupStaffSessionDraft) => void,
  onInitialSetupStaffNext: () => void,
  onInitialSetupPricingNext: () => void,
  uploadInitialSetupStaffPhoto?: StaffProfilePhotoUploader,
) {
  const handleStaffScheduleOverridesChange = (staffScheduleOverrides: BootstrapPayload["staffScheduleOverrides"]) => {
    onDataChange({ ...initialData, staffScheduleOverrides });
  };

  switch (screen) {
    case "schedule":
      return (
        <CalendarManagementScreen
          initialData={initialData}
          onDataChange={onDataChange}
          staffMembers={staffMembers}
          automaticVisitReminderAvailable={automaticVisitReminderAvailable}
          createRequest={createRequest}
          onCreateRequestHandled={onCreateRequestHandled}
        />
      );
    case "bookingPageManagement":
      return <CustomerBookingPageManagementScreen initialData={initialData} onDataChange={onDataChange} />;
    case "bookingLink":
      return <BookingLinkManagementScreen initialData={initialData} />;
    case "customers":
      return <CustomerManagementScreen initialData={initialData} onCreateReservationForCustomer={onCreateReservationForCustomer} onDataChange={onDataChange} />;
    case "calendarRecords":
      return <CalendarRecordsScreen initialData={initialData} onDataChange={onDataChange} onCreateReservationForDate={onCreateReservationForDate} />;
    case "profitability":
      return <ProfitabilityAnalyticsScreen shopId={initialData.shop.id} />;
    case "services":
      return (
        <ServiceManagementScreen
          shopId={initialData.shop.id}
          shop={initialData.shop}
          ownerProfile={initialData.ownerProfile ?? null}
          initialServices={initialData.services}
          staffMembers={staffMembers}
          demoMode={isDemoOwnerWebData(initialData)}
          priceGuideOnboarding={initialSetupMode || priceGuideOnboarding}
          onServicesChange={(services) => onDataChange({ ...initialData, services })}
          onShopChange={onShopChange}
          onPriceGuideSaveSuccess={(canonicalBootstrap) => onInitialSetupStepSaved("pricing", canonicalBootstrap)}
          onInitialSetupNext={onInitialSetupPricingNext}
        />
      );
    case "staff":
      return (
        <StaffManagementScreen
          shopId={initialData.shop.id}
          shop={initialData.shop}
          services={initialData.services}
          staffMembers={staffMembers}
          ownerProfile={initialData.ownerProfile ?? null}
          staffScheduleOverrides={initialData.staffScheduleOverrides ?? []}
          onStaffMembersChange={onStaffMembersChange}
          onStaffScheduleOverridesChange={handleStaffScheduleOverridesChange}
          onSaveSuccess={undefined}
          initialSetupMode={initialSetupMode}
          initialSetupSessionDraft={initialSetupStaffSessionDraft}
          onInitialSetupSessionDraftChange={onInitialSetupStaffSessionDraftChange}
          onInitialSetupNext={onInitialSetupStaffNext}
          uploadInitialSetupStaffPhoto={uploadInitialSetupStaffPhoto}
        />
      );
    case "help":
      return <OwnerHelpScreen initialData={initialData} />;
    case "shopInfo":
    case "operatingHours":
    case "ownerProfile":
    case "benefits":
    case "alerts":
      return (
        <SettingsManagementScreen
          activeTab={settingsTabForScreen(screen) ?? "shop"}
          showTabNavigation={false}
          shop={initialData.shop}
          services={initialData.services}
          staffMembers={staffMembers}
          ownerProfile={initialData.ownerProfile ?? null}
          onShopChange={onShopChange}
          onOwnerProfileChange={onOwnerProfileChange}
          onServicesChange={(services: BootstrapPayload["services"]) => onDataChange({ ...initialData, services })}
          onStaffMembersChange={async (nextStaff) => {
            await onStaffMembersChange(nextStaff);
          }}
          persistShopProfile={!isDemoOwnerWebData(initialData)}
          initialSetupMode={initialSetupMode}
          automaticVisitReminderAvailable={automaticVisitReminderAvailable}
          onOperatingHoursSaveSuccess={initialSetupMode ? () => onInitialSetupStepSaved("hours") : undefined}
          onOperatingHoursNext={initialSetupMode ? onInitialSetupHoursNext : undefined}
        />
      );
    default:
      return null;
  }
}

export default function OwnerWebPreview({
  initialData,
  demoStaffFallback = [],
  onDataChange,
  currentPlanCode = null,
  feedbackFixtureMode = false,
}: {
  initialData: BootstrapPayload;
  demoStaffFallback?: OwnerWebStaffMember[];
  onDataChange?: (data: BootstrapPayload) => void;
  currentPlanCode?: string | null;
  feedbackFixtureMode?: boolean;
}) {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>(() => getInitialOwnerWebScreen(initialData));
  const [initialSetupScreen, setInitialSetupScreen] = useState<OwnerWebScreenKey>("operatingHours");
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [alimtalkCreditMenuOpen, setAlimtalkCreditMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [initialSetupOpen, setInitialSetupOpen] = useState(false);
  const [initialSetupSyncError, setInitialSetupSyncError] = useState<string | null>(null);
  const [initialSetupStaffSessionDraft, setInitialSetupStaffSessionDraft] = useState<InitialSetupStaffSessionDraft | null>(null);
  const [ownerData, setOwnerData] = useState(initialData);
  const [scheduleCreateRequest, setScheduleCreateRequest] = useState<OwnerScheduleCreateRequest | null>(null);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);
  const alimtalkCreditMenuRef = useRef<HTMLDivElement | null>(null);
  const navigationInitializedShopIdRef = useRef<string | null>(null);
  const ownerDataRef = useRef(initialData);
  const initialSetupRefreshRef = useRef<{ shopId: string; promise: Promise<BootstrapPayload> } | null>(null);
  const demoMode = isDemoOwnerWebData(ownerData);
  const [liveStaffMembers, setLiveStaffMembers] = useState<OwnerWebStaffMember[]>(() => initialData.staffMembers ?? []);
  const [demoStaffMembers, setDemoStaffMembers] = useState<OwnerWebStaffMember[]>(() => {
    if (!demoMode) return [];
    return demoStaffFallback.length > 0 ? demoStaffFallback : initialData.staffMembers ?? [];
  });
  const staffMembers = demoMode ? demoStaffMembers : liveStaffMembers;
  const initialSetupReadiness = getBootstrapOwnerInitialSetupReadiness(ownerData);
  const initialSetupEligible = !initialSetupReadiness.completed;
  const shopDisplayName = ownerData.shop.name.trim() || PETMANAGER_SERVICE_NAME;
  const shopInitials = buildShopInitials(shopDisplayName);
  const currentPlanLabel = currentPlanCode
    ? getOwnerPlanDisplayName(currentPlanCode)
    : "플랜 확인";
  const automaticVisitReminderAvailable = true;
  const priceGuideOnboarding = shouldStartWithPriceGuideSetup(ownerData);
  const uploadDemoInitialSetupStaffPhoto: StaffProfilePhotoUploader | undefined = demoMode
    ? async ({ staffId }, file) => ({
        mediaAssetId: `demo-staff-profile-${staffId}-${file.lastModified}`,
        signedUrl: URL.createObjectURL(file),
      })
    : undefined;

  useEffect(() => {
    ownerDataRef.current = initialData;
    setOwnerData(initialData);
    if (!isDemoOwnerWebData(initialData)) {
      setLiveStaffMembers(initialData.staffMembers ?? []);
    }
    if (getBootstrapOwnerInitialSetupReadiness(initialData).completed) {
      setInitialSetupOpen(false);
      setInitialSetupSyncError(null);
    } else {
      setActiveScreen((screen) => screen === "ownerProfile" || screen === "help" ? screen : "operatingHours");
    }
  }, [initialData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldInitializeOwnerWebNavigation(navigationInitializedShopIdRef.current, ownerData.shop.id)) return;
    navigationInitializedShopIdRef.current = ownerData.shop.id;
    const requestedAfterSignup = new URLSearchParams(window.location.search).get("initialSetup") === "1";
    const visibility = resolveOwnerInitialSetupVisibility(initialSetupReadiness, requestedAfterSignup);
    setActiveScreen(getInitialOwnerWebScreen(ownerData));
    setInitialSetupOpen(visibility.open);
    if (visibility.nextStep) {
      setInitialSetupScreen(screenForInitialSetupStep(visibility.nextStep));
    }
    if (visibility.open) setActiveScreen("operatingHours");
  }, [initialSetupReadiness, ownerData]);

  useEffect(() => {
    if (!demoMode) return;
    const storedStaff = parseStoredOwnerWebStaff(window.localStorage.getItem(demoOwnerWebStaffStorageKey));
    if (storedStaff) setDemoStaffMembers(storedStaff);
  }, [demoMode]);

  useEffect(() => {
    if (demoMode || initialSetupEligible) return;
    const warmProfitability = () => {
      void import("@/components/owner-web/profitability-analytics-screen");
      void fetchApiJsonWithAuth(`/api/owner/profitability?shopId=${encodeURIComponent(initialData.shop.id)}&range=90d`).catch(() => undefined);
    };
    const timer = window.setTimeout(warmProfitability, 1_200);
    return () => window.clearTimeout(timer);
  }, [demoMode, initialData.shop.id, initialSetupEligible]);

  useEffect(() => {
    if (!demoMode) return;
    setOwnerData((current) => {
      if (current.staffMembers === demoStaffMembers) return current;
      const next = withDemoInitialSetupReadiness({ ...current, staffMembers: demoStaffMembers });
      ownerDataRef.current = next;
      return next;
    });
  }, [demoMode, demoStaffMembers]);

  useEffect(() => {
    if (!storeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (storeMenuRef.current?.contains(target)) return;
      if (storeMenuOpen) setStoreMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [storeMenuOpen]);

  useEffect(() => {
    if (!alimtalkCreditMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (alimtalkCreditMenuRef.current?.contains(target)) return;
      setAlimtalkCreditMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [alimtalkCreditMenuOpen]);

  function applyOwnerData(nextData: BootstrapPayload, authoritative = false) {
    const preparedData = authoritative && isDemoOwnerWebData(nextData)
      ? withDemoInitialSetupReadiness(nextData)
      : nextData;
    ownerDataRef.current = preparedData;
    setOwnerData(preparedData);
    onDataChange?.(preparedData);

    if (authoritative && getBootstrapOwnerInitialSetupReadiness(preparedData).completed) {
      setInitialSetupOpen(false);
      setInitialSetupSyncError(null);
      setActiveScreen((currentScreen) => initialSetupOpen ? "schedule" : currentScreen);
    }
  }

  function handleOwnerDataChange(nextData: BootstrapPayload) {
    if (nextData === ownerDataRef.current) return;
    // Ordinary child updates (including the customer screen's local bootstrap)
    // are not an initial-setup completion signal. Only explicit setup refreshes
    // below may move the owner back to the schedule screen.
    applyOwnerData(nextData);
  }

  function handleShopProfileChange(shop: BootstrapPayload["shop"]) {
    const current = ownerDataRef.current;
    applyOwnerData({
      ...current,
      shop: mergeOwnerWebShop(current.shop, shop),
    });
  }

  async function handleStaffMembersChange(nextStaff: OwnerWebStaffMember[], options?: StaffMembersChangeOptions) {
    if (demoMode) {
      const nextOwnerData = withDemoInitialSetupReadiness({
        ...ownerDataRef.current,
        staffMembers: nextStaff,
      });
      setDemoStaffMembers(nextStaff);
      applyOwnerData(nextOwnerData);
      try {
        window.localStorage.setItem(demoOwnerWebStaffStorageKey, JSON.stringify(nextStaff));
      } catch {
        // Keep the shared staff list active in memory even if local storage is blocked.
      }
      return;
    }

    try {
      const shopId = ownerDataRef.current.shop.id;
      if (options?.deferEssentialRefresh) {
        return saveStaffMembersWithDeferredRefresh({
          patch: () => fetchApiJsonWithAuth<{ staffMembers: OwnerWebStaffMember[] }>("/api/staff-members", {
            method: "PATCH",
            body: JSON.stringify({ shopId, staffMembers: nextStaff }),
          }),
          verifyAcknowledged: (acknowledged) => hasAcknowledgedStaffPreferences(nextStaff, acknowledged.staffMembers),
          applyAcknowledged: (acknowledged) => {
            if (ownerDataRef.current.shop.id !== shopId) return;
            const acknowledgedOwnerData = { ...ownerDataRef.current, staffMembers: acknowledged.staffMembers };
            setLiveStaffMembers(acknowledged.staffMembers);
            applyOwnerData(acknowledgedOwnerData);
          },
          refresh: () => fetchApiJsonWithAuth<BootstrapPayload>(
            `/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=essential`,
            { cache: "no-store" },
          ).then((refreshed) => {
            if (ownerDataRef.current.shop.id !== shopId || refreshed.shop.id !== shopId) return;
            if (!hasAcknowledgedStaffPreferences(nextStaff, refreshed.staffMembers)) {
              throw new Error("저장 결과를 다시 확인하지 못했습니다. 입력 내용은 유지했습니다.");
            }
            setLiveStaffMembers(refreshed.staffMembers);
            applyOwnerData(refreshed);
          }),
        });
      }
      const acknowledged = await fetchApiJsonWithAuth<{ staffMembers: OwnerWebStaffMember[] }>("/api/staff-members", {
        method: "PATCH",
        body: JSON.stringify({ shopId, staffMembers: nextStaff }),
      });
      if (!hasAcknowledgedStaffPreferences(nextStaff, acknowledged.staffMembers)) {
        throw new Error("저장 결과에서 개인 칩 색과 프로필 멘트를 확인하지 못했습니다. 입력 내용은 유지했습니다.");
      }
      const refreshed = await fetchApiJsonWithAuth<BootstrapPayload>(
        `/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=essential`,
        { cache: "no-store" },
      );
      if (ownerDataRef.current.shop.id !== shopId || refreshed.shop.id !== shopId) return;
      if (!hasAcknowledgedStaffPreferences(nextStaff, refreshed.staffMembers)) {
        throw new Error("저장 결과를 다시 확인하지 못했습니다. 입력 내용은 유지했습니다.");
      }
      setLiveStaffMembers(refreshed.staffMembers);
      applyOwnerData(refreshed);
    } catch (error) {
      throw error;
    }
  }

  function handleScreenSelect(screen: OwnerWebScreenKey) {
    if (initialSetupEligible && screen !== "operatingHours" && screen !== "staff" && screen !== "services" && screen !== "ownerProfile" && screen !== "help") {
      setActiveScreen("operatingHours");
      return;
    }
    setActiveScreen(screen);
  }

  function openInitialSetup() {
    const readiness = getBootstrapOwnerInitialSetupReadiness(ownerDataRef.current);
    if (readiness.completed) return;
    setInitialSetupSyncError(null);
    setInitialSetupOpen(true);
    setInitialSetupScreen(screenForInitialSetupStep(readiness.nextStep ?? "hours"));
    setStoreMenuOpen(false);
    setAlimtalkCreditMenuOpen(false);
  }

  async function refreshInitialSetupReadiness() {
    const current = ownerDataRef.current;
    if (isDemoOwnerWebData(current)) {
      const refreshed = withDemoInitialSetupReadiness(current);
      applyOwnerData(refreshed, true);
      return refreshed;
    }

    const existing = initialSetupRefreshRef.current;
    if (existing?.shopId === current.shop.id) return existing.promise;

    const shopId = current.shop.id;
    const promise = fetchApiJsonWithAuth<BootstrapPayload>(
      `/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=essential`,
      { cache: "no-store" },
    );
    initialSetupRefreshRef.current = { shopId, promise };
    try {
      const refreshed = await promise;
      if (ownerDataRef.current.shop.id !== shopId || refreshed.shop.id !== shopId) return ownerDataRef.current;
      applyOwnerData(refreshed, true);
      return refreshed;
    } finally {
      if (initialSetupRefreshRef.current?.promise === promise) initialSetupRefreshRef.current = null;
    }
  }

  async function handleInitialSetupStepSaved(
    step: OwnerInitialSetupStepKey,
    canonicalBootstrap?: BootstrapPayload,
  ) {
    setInitialSetupSyncError(null);
    try {
      const refreshed = canonicalBootstrap
        ? canonicalBootstrap
        : await refreshInitialSetupReadiness();
      if (canonicalBootstrap) {
        if (canonicalBootstrap.shop.id !== ownerDataRef.current.shop.id) {
          throw new Error("다른 매장의 설정 결과는 적용할 수 없습니다.");
        }
        applyOwnerData(canonicalBootstrap, true);
      }
      const readiness = getBootstrapOwnerInitialSetupReadiness(refreshed);
      if (!readiness.steps[step]) {
        setInitialSetupSyncError("저장된 설정에서 필수 항목을 확인하지 못했어요. 입력값을 확인한 뒤 다시 저장해 주세요.");
        return;
      }
      if (!isDemoOwnerWebData(refreshed)) {
        await fetchApiJsonWithAuth("/api/owner/initial-setup/acquisition-milestone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: refreshed.shop.id, step }),
        }).catch(() => undefined);
      }
    } catch {
      setInitialSetupSyncError("저장은 요청했지만 최신 설정 상태를 확인하지 못했어요. 입력값은 유지되니 다시 저장해 주세요.");
    }
  }

  function handleInitialSetupHoursNext() {
    if (!getBootstrapOwnerInitialSetupReadiness(ownerDataRef.current).steps.hours) {
      setInitialSetupSyncError("영업시간을 저장한 뒤 다음 단계로 이동해 주세요.");
      return;
    }
    setInitialSetupSyncError(null);
    setInitialSetupScreen("staff");
  }

  function handleInitialSetupPricingNext() {
    if (!getBootstrapOwnerInitialSetupReadiness(ownerDataRef.current).completed) {
      setInitialSetupSyncError("서비스·가격을 저장하고 최신 상태가 확인되면 설정이 완료됩니다.");
      return;
    }
    closeInitialSetup();
  }

  function handleInitialSetupStaffNext() {
    if (!getBootstrapOwnerInitialSetupReadiness(ownerDataRef.current).steps.staff) {
      setInitialSetupSyncError("직원·근무시간을 저장한 뒤 다음 단계로 이동해 주세요.");
      return;
    }
    setInitialSetupSyncError(null);
    setInitialSetupScreen("services");
  }

  function closeInitialSetup() {
    setInitialSetupOpen(false);
    setInitialSetupSyncError(null);
    setActiveScreen(getBootstrapOwnerInitialSetupReadiness(ownerDataRef.current).completed ? "schedule" : "operatingHours");
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("initialSetup");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function handleCreateReservationForCustomer(params: { guardianId: string; petId: string | null }) {
    setScheduleCreateRequest({
      requestId: Date.now(),
      guardianId: params.guardianId,
      petId: params.petId,
      date: currentDateInTimeZone(),
    });
    setActiveScreen("schedule");
  }

  function handleCreateReservationForDate(date: string) {
    setScheduleCreateRequest({
      requestId: Date.now(),
      petId: null,
      date,
    });
    setActiveScreen("schedule");
  }

  function handleScheduleCreateRequestHandled(requestId: number) {
    setScheduleCreateRequest((current) => (current?.requestId === requestId ? null : current));
  }

  function openSettingsTab(tab: SettingsTabKey) {
    const nextScreen = screenBySettingsTab[tab];
    setActiveScreen(initialSetupEligible && nextScreen !== "ownerProfile" ? "operatingHours" : nextScreen);
    setStoreMenuOpen(false);
    setAlimtalkCreditMenuOpen(false);
  }

  function projectOwnerProfileToSyntheticStaff(data: BootstrapPayload, profile: OwnerProfile): BootstrapPayload {
    const syntheticOwnerStaffId = `${data.shop.id}-staff-owner`;
    const profileImageUrl = typeof profile.agreements?.profile_image_url === "string"
      ? profile.agreements.profile_image_url
      : "";
    return {
      ...data,
      ownerProfile: profile,
      staffMembers: data.staffMembers.map((staff) => staff.id === syntheticOwnerStaffId
        ? {
          ...staff,
          name: profile.name || staff.name,
          displayName: profile.name || staff.displayName,
          profileImageUrl,
        }
        : staff),
    };
  }

  async function handleOwnerProfileChange(profile: OwnerProfile) {
    const current = ownerDataRef.current;
    const projected = projectOwnerProfileToSyntheticStaff(current, profile);

    if (demoMode) {
      setDemoStaffMembers(projected.staffMembers);
      applyOwnerData(projected, true);
      return;
    }

    setLiveStaffMembers(projected.staffMembers);
    applyOwnerData(projected);

    const shopId = current.shop.id;
    const refreshed = await fetchApiJsonWithAuth<BootstrapPayload>(
      `/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=full`,
      { cache: "no-store" },
    );
    if (ownerDataRef.current.shop.id !== shopId || refreshed.shop.id !== shopId) {
      throw new Error("매장이 변경되어 프로필 정보를 다시 확인해 주세요.");
    }
    setLiveStaffMembers(refreshed.staffMembers);
    applyOwnerData(refreshed, true);
  }

  async function handleLogout() {
    if (loggingOut) return;
    if (demoMode) {
      window.location.href = "/login";
      return;
    }
    setLoggingOut(true);

    try {
      await waitForOwnerAuthHydration();
      clearOwnerAuthTokenCache();
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <div inert={initialSetupOpen ? true : undefined} aria-hidden={initialSetupOpen ? true : undefined}>
      <OwnerWebAppShell
      activeScreen={activeScreen}
      onScreenSelect={handleScreenSelect}
      shopDisplayName={shopDisplayName}
      shopId={ownerData.shop.id}
      ownerName={ownerData.ownerProfile?.name ?? ""}
      ownerPhone={ownerData.ownerProfile?.phone_number ?? ownerData.shop.phone ?? ""}
      shopInitials={shopInitials}
      currentPlanLabel={currentPlanLabel}
      alimtalkCreditSummary={ownerData.alimtalkCreditSummary}
      alimtalkCreditMenuOpen={alimtalkCreditMenuOpen}
      alimtalkCreditMenuRef={alimtalkCreditMenuRef}
      onAlimtalkCreditToggle={() => {
        setAlimtalkCreditMenuOpen((current) => !current);
        setStoreMenuOpen(false);
      }}
      storeMenuOpen={storeMenuOpen}
      storeMenuRef={storeMenuRef}
      onStoreMenuToggle={() => {
        setStoreMenuOpen((current) => !current);
        setAlimtalkCreditMenuOpen(false);
      }}
      onOpenProfile={() => openSettingsTab("profile")}
      onOpenShop={() => openSettingsTab("shop")}
      onOpenAlerts={() => openSettingsTab("alerts")}
      onOpenHelp={() => {
        setActiveScreen("help");
        setStoreMenuOpen(false);
        setAlimtalkCreditMenuOpen(false);
      }}
      onOpenInitialSetup={openInitialSetup}
      showInitialSetupAction={initialSetupEligible}
      onLogout={handleLogout}
      loggingOut={loggingOut}
      isTester={ownerData.pilotCohort?.isPilotMember === true}
      feedbackFixtureMode={feedbackFixtureMode}
      operationsLocked={initialSetupEligible}
    >
      <div className="h-full min-h-0 min-w-0">
        {!initialSetupOpen && initialSetupEligible && activeScreen !== "ownerProfile" && activeScreen !== "help" ? (
          <OwnerInitialSetupResumeCard readiness={initialSetupReadiness} onResume={openInitialSetup} />
        ) : null}
        {!initialSetupEligible || activeScreen === "ownerProfile" || activeScreen === "help" ? (
        <div className="h-full min-h-0 min-w-0">
          {renderScreen(
            activeScreen,
            ownerData,
            handleOwnerDataChange,
            handleShopProfileChange,
            handleOwnerProfileChange,
            staffMembers,
            handleStaffMembersChange,
            scheduleCreateRequest,
            handleScheduleCreateRequestHandled,
            handleCreateReservationForCustomer,
            handleCreateReservationForDate,
            automaticVisitReminderAvailable,
            priceGuideOnboarding,
            false,
            handleInitialSetupStepSaved,
            handleInitialSetupHoursNext,
            initialSetupStaffSessionDraft,
            setInitialSetupStaffSessionDraft,
            handleInitialSetupStaffNext,
            handleInitialSetupPricingNext,
            uploadDemoInitialSetupStaffPhoto,
          )}
        </div>
        ) : null}
      </div>
      </OwnerWebAppShell>
      </div>

      {initialSetupOpen ? (
        <OwnerInitialSetupGuide
          key={ownerData.shop.id}
          open
          data={ownerData}
          activeScreen={initialSetupScreen}
          onClose={closeInitialSetup}
          onNavigate={setInitialSetupScreen}
        >
          {initialSetupSyncError ? (
            <p className="mb-4 rounded-[10px] border border-[#e7c4c9] bg-[#fff8f8] px-4 py-3 text-[13px] font-normal leading-5 text-[#a04455]" role="alert">
              {initialSetupSyncError}
            </p>
          ) : null}
          {renderScreen(
              initialSetupScreen,
              ownerData,
              handleOwnerDataChange,
              handleShopProfileChange,
              handleOwnerProfileChange,
              staffMembers,
              handleStaffMembersChange,
              scheduleCreateRequest,
              handleScheduleCreateRequestHandled,
              handleCreateReservationForCustomer,
              handleCreateReservationForDate,
              automaticVisitReminderAvailable,
              priceGuideOnboarding,
              true,
              handleInitialSetupStepSaved,
              handleInitialSetupHoursNext,
              initialSetupStaffSessionDraft,
              setInitialSetupStaffSessionDraft,
              handleInitialSetupStaffNext,
              handleInitialSetupPricingNext,
              uploadDemoInitialSetupStaffPhoto,
            )}
        </OwnerInitialSetupGuide>
      ) : null}
    </>
  );
}
