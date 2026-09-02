"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import CalendarManagementScreen, { type OwnerScheduleCreateRequest } from "@/components/owner-web/calendar-management-screen";
import { type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import OwnerWebAppShell from "@/components/owner-web/owner-web-app-shell";
import OwnerInitialSetupGuide, {
  confirmOwnerInitialSetupStep,
  getOwnerInitialSetupGuideStorageKey,
  getOwnerInitialSetupNextScreen,
  OwnerInitialSetupResumeCard,
  type OwnerInitialSetupStepKey,
} from "@/components/owner-web/owner-initial-setup-guide";
import type { InitialSetupStaffSessionDraft } from "@/components/owner-web/initial-setup-staff-management-panel";
import type { StaffProfilePhotoUploader } from "@/components/owner-web/staff-profile-photo-field";
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
import { shouldInitializeOwnerWebNavigation } from "@/lib/owner-web-navigation-state";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload, OwnerProfile } from "@/types/domain";

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
  onOwnerProfileChange: (profile: OwnerProfile) => void,
  staffMembers: OwnerWebStaffMember[],
  onStaffMembersChange: (staff: OwnerWebStaffMember[]) => void | Promise<void>,
  createRequest: OwnerScheduleCreateRequest | null,
  onCreateRequestHandled: (requestId: number) => void,
  onCreateReservationForCustomer: (params: { guardianId: string; petId: string | null }) => void,
  onCreateReservationForDate: (date: string) => void,
  automaticVisitReminderAvailable: boolean,
  priceGuideOnboarding: boolean,
  initialSetupMode: boolean,
  onInitialSetupStepSaved: (step: OwnerInitialSetupStepKey) => void,
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
          onPriceGuideSaveSuccess={() => onInitialSetupStepSaved("pricing")}
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
          onSaveSuccess={() => onInitialSetupStepSaved("staff")}
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
          onStaffMembersChange={onStaffMembersChange}
          persistShopProfile={!isDemoOwnerWebData(initialData)}
          initialSetupMode={initialSetupMode}
          automaticVisitReminderAvailable={automaticVisitReminderAvailable}
          onOperatingHoursSaveSuccess={() => onInitialSetupStepSaved("hours")}
          onOperatingHoursNext={onInitialSetupHoursNext}
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
}: {
  initialData: BootstrapPayload;
  demoStaffFallback?: OwnerWebStaffMember[];
  onDataChange?: (data: BootstrapPayload) => void;
  currentPlanCode?: string | null;
}) {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>("schedule");
  const [initialSetupScreen, setInitialSetupScreen] = useState<OwnerWebScreenKey>("operatingHours");
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [alimtalkCreditMenuOpen, setAlimtalkCreditMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [initialSetupOpen, setInitialSetupOpen] = useState(false);
  const [initialSetupEligible, setInitialSetupEligible] = useState(false);
  const [initialSetupStaffSessionDraft, setInitialSetupStaffSessionDraft] = useState<InitialSetupStaffSessionDraft | null>(null);
  const [ownerData, setOwnerData] = useState(initialData);
  const [scheduleCreateRequest, setScheduleCreateRequest] = useState<OwnerScheduleCreateRequest | null>(null);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);
  const alimtalkCreditMenuRef = useRef<HTMLDivElement | null>(null);
  const navigationInitializedShopIdRef = useRef<string | null>(null);
  const demoMode = isDemoOwnerWebData(initialData);
  const [liveStaffMembers, setLiveStaffMembers] = useState<OwnerWebStaffMember[]>(() => initialData.staffMembers ?? []);
  const [demoStaffMembers, setDemoStaffMembers] = useState<OwnerWebStaffMember[]>(() => {
    if (!demoMode) return [];
    return demoStaffFallback.length > 0 ? demoStaffFallback : initialData.staffMembers ?? [];
  });
  const staffMembers = demoMode ? demoStaffMembers : liveStaffMembers;
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
    setOwnerData(initialData);
    if (!isDemoOwnerWebData(initialData)) {
      setLiveStaffMembers(initialData.staffMembers ?? []);
    }
  }, [initialData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldInitializeOwnerWebNavigation(navigationInitializedShopIdRef.current, ownerData.shop.id)) return;
    navigationInitializedShopIdRef.current = ownerData.shop.id;
    const requestedAfterSignup = new URLSearchParams(window.location.search).get("initialSetup") === "1";
    const key = getOwnerInitialSetupGuideStorageKey(ownerData.shop.id);
    if (window.localStorage.getItem(key)) setInitialSetupEligible(true);
    if (requestedAfterSignup) {
      setInitialSetupEligible(true);
      setInitialSetupOpen(true);
      setActiveScreen("schedule");
      setInitialSetupScreen(getOwnerInitialSetupNextScreen(ownerData.shop.id));
      return;
    }
    setActiveScreen(getInitialOwnerWebScreen(ownerData));
    if (demoMode) return;
    const hasOperationalData =
      ownerData.appointments.length > 0 ||
      ownerData.guardians.length > 0 ||
      ownerData.pets.length > 0 ||
      ownerData.groomingRecords.length > 0;
    if (!hasOperationalData && !window.localStorage.getItem(key)) {
      setInitialSetupEligible(true);
      setInitialSetupOpen(true);
      setActiveScreen("schedule");
      setInitialSetupScreen("operatingHours");
    }
  }, [demoMode, ownerData.appointments.length, ownerData.groomingRecords.length, ownerData.guardians.length, ownerData.pets.length, ownerData.shop.id]);

  useEffect(() => {
    if (!demoMode) return;
    const storedStaff = parseStoredOwnerWebStaff(window.localStorage.getItem(demoOwnerWebStaffStorageKey));
    if (storedStaff) setDemoStaffMembers(storedStaff);
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const warmProfitability = () => {
      void import("@/components/owner-web/profitability-analytics-screen");
      void fetchApiJsonWithAuth(`/api/owner/profitability?shopId=${encodeURIComponent(initialData.shop.id)}&range=90d`).catch(() => undefined);
    };
    const timer = window.setTimeout(warmProfitability, 1_200);
    return () => window.clearTimeout(timer);
  }, [demoMode, initialData.shop.id]);

  useEffect(() => {
    if (!demoMode) return;
    setOwnerData((current) =>
      current.staffMembers === demoStaffMembers
        ? current
        : { ...current, staffMembers: demoStaffMembers },
    );
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

  function handleShopProfileChange(shop: BootstrapPayload["shop"]) {
    setOwnerData((current) => {
      const nextData = {
        ...current,
        shop: mergeOwnerWebShop(current.shop, shop),
      };
      onDataChange?.(nextData);
      return nextData;
    });
  }

  async function handleStaffMembersChange(nextStaff: OwnerWebStaffMember[]) {
    if (demoMode) {
      const nextOwnerData = { ...ownerData, staffMembers: nextStaff };
      setDemoStaffMembers(nextStaff);
      setOwnerData(nextOwnerData);
      onDataChange?.(nextOwnerData);
      try {
        window.localStorage.setItem(demoOwnerWebStaffStorageKey, JSON.stringify(nextStaff));
      } catch {
        // Keep the shared staff list active in memory even if local storage is blocked.
      }
      return;
    }

    try {
      const response = await fetchApiJsonWithAuth<{ staffMembers: OwnerWebStaffMember[] }>("/api/staff-members", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: ownerData.shop.id,
          staffMembers: nextStaff,
        }),
      });
      setLiveStaffMembers(response.staffMembers);
      const nextOwnerData = { ...ownerData, staffMembers: response.staffMembers };
      setOwnerData((current) => ({ ...current, staffMembers: response.staffMembers }));
      onDataChange?.(nextOwnerData);
    } catch (error) {
      throw error;
    }
  }

  function handleScreenSelect(screen: OwnerWebScreenKey) {
    setActiveScreen(screen);
  }

  function openInitialSetup() {
    setInitialSetupEligible(true);
    setInitialSetupOpen(true);
    setInitialSetupScreen(getOwnerInitialSetupNextScreen(ownerData.shop.id));
    setStoreMenuOpen(false);
    setAlimtalkCreditMenuOpen(false);
  }

  function handleInitialSetupStepSaved(step: OwnerInitialSetupStepKey) {
    confirmOwnerInitialSetupStep(ownerData.shop.id, step);
    setInitialSetupEligible(true);
  }

  function handleInitialSetupHoursNext() {
    setInitialSetupScreen("staff");
  }

  function handleInitialSetupPricingNext() {
    closeInitialSetup();
  }

  function closeInitialSetup() {
    setInitialSetupOpen(false);
    setActiveScreen("schedule");
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
    setActiveScreen(screenBySettingsTab[tab]);
    setStoreMenuOpen(false);
    setAlimtalkCreditMenuOpen(false);
  }

  function handleOwnerProfileChange(profile: OwnerProfile) {
    setOwnerData((current) => {
      const nextData = { ...current, ownerProfile: profile };
      onDataChange?.(nextData);
      return nextData;
    });
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
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      <div className={initialSetupEligible && activeScreen === "schedule" ? "grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3" : "h-full min-h-0 min-w-0"}>
        {!initialSetupOpen && initialSetupEligible && activeScreen === "schedule" ? (
          <OwnerInitialSetupResumeCard shopId={ownerData.shop.id} onResume={openInitialSetup} />
        ) : null}
        <div className="h-full min-h-0 min-w-0">
          {renderScreen(
            activeScreen,
            ownerData,
            setOwnerData,
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
            () => setInitialSetupScreen("services"),
            handleInitialSetupPricingNext,
            uploadDemoInitialSetupStaffPhoto,
          )}
        </div>
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
          {renderScreen(
            initialSetupScreen,
            ownerData,
            setOwnerData,
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
            () => setInitialSetupScreen("services"),
            handleInitialSetupPricingNext,
            uploadDemoInitialSetupStaffPhoto,
          )}
        </OwnerInitialSetupGuide>
      ) : null}
    </>
  );
}
