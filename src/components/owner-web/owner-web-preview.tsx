"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import CalendarManagementScreen, { type OwnerScheduleCreateRequest } from "@/components/owner-web/calendar-management-screen";
import { type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import OwnerWebAppShell from "@/components/owner-web/owner-web-app-shell";
import {
  demoOwnerWebStaffStorageKey,
  parseStoredOwnerWebStaff,
  type OwnerWebStaffMember,
} from "@/components/owner-web/owner-web-staff-data";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { buildCustomerServiceSourceOptions } from "@/lib/customer-service-options";
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
  return data.shop.id === "demo-shop" || data.shop.id === "owner-demo";
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
  const priceGuideOptions = buildCustomerServiceSourceOptions(data.services, { priceGuideOnly: true });
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
  const screen = new URLSearchParams(window.location.search).get("screen") as OwnerWebScreenKey | null;
  if (screen && ["schedule", "bookingPageManagement", "bookingLink", "customers", "calendarRecords", "services", "staff", "ownerProfile", "shopInfo", "operatingHours", "benefits", "alerts", "help"].includes(screen)) {
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
    case "services":
      return (
        <ServiceManagementScreen
          shopId={initialData.shop.id}
          shop={initialData.shop}
          ownerProfile={initialData.ownerProfile ?? null}
          initialServices={initialData.services}
          staffMembers={staffMembers}
          demoMode={isDemoOwnerWebData(initialData)}
          priceGuideOnboarding={priceGuideOnboarding}
          onServicesChange={(services) => onDataChange({ ...initialData, services })}
          onShopChange={onShopChange}
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
          automaticVisitReminderAvailable={automaticVisitReminderAvailable}
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
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>(() => getInitialOwnerWebScreen(initialData));
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [alimtalkCreditMenuOpen, setAlimtalkCreditMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [ownerData, setOwnerData] = useState(initialData);
  const [scheduleCreateRequest, setScheduleCreateRequest] = useState<OwnerScheduleCreateRequest | null>(null);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);
  const alimtalkCreditMenuRef = useRef<HTMLDivElement | null>(null);
  const demoMode = isDemoOwnerWebData(initialData);
  const [liveStaffMembers, setLiveStaffMembers] = useState<OwnerWebStaffMember[]>(() => initialData.staffMembers ?? []);
  const [demoStaffMembers, setDemoStaffMembers] = useState<OwnerWebStaffMember[]>(() => {
    if (!demoMode) return [];
    if (typeof window === "undefined") return demoStaffFallback;
    return parseStoredOwnerWebStaff(window.localStorage.getItem(demoOwnerWebStaffStorageKey)) ?? demoStaffFallback;
  });
  const staffMembers = demoMode ? demoStaffMembers : liveStaffMembers;
  const staffSource = demoMode ? "demo-local-storage-or-default" : "live-bootstrap";
  const shopDisplayName = ownerData.shop.name.trim() || PETMANAGER_SERVICE_NAME;
  const shopInitials = buildShopInitials(shopDisplayName);
  const currentPlanLabel = currentPlanCode
    ? getOwnerPlanDisplayName(currentPlanCode)
    : "플랜 확인";
  const automaticVisitReminderAvailable = true;
  const priceGuideOnboarding = shouldStartWithPriceGuideSetup(ownerData);

  useEffect(() => {
    setOwnerData(initialData);
    if (!isDemoOwnerWebData(initialData)) {
      setLiveStaffMembers(initialData.staffMembers ?? []);
    }
  }, [initialData]);

  useEffect(() => {
    const ownerWebStorageKeys =
      typeof window !== "undefined"
        ? Object.keys(window.localStorage).filter((key) => key.startsWith("petmanager") && key.includes("ownerWeb"))
        : [];

    console.log("[OWNER DEBUG] owner-web-preview", {
      mode: initialData.mode,
      shopId: initialData.shop.id,
      bootstrapAppointmentsCount: initialData.appointments?.length ?? 0,
      bootstrapStaffCount: initialData.staffMembers?.length ?? 0,
      demoMode,
      staffSource,
      finalStaffMembersCount: staffMembers.length,
      finalStaffMembers: staffMembers.map((staff) => ({ id: staff.id, name: staff.name })),
      ownerWebStorageKeys,
    });
  }, [demoMode, initialData, staffMembers, staffSource]);

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
      setDemoStaffMembers(nextStaff);
      try {
        window.localStorage.setItem(demoOwnerWebStaffStorageKey, JSON.stringify(nextStaff));
      } catch {
        // Keep the shared staff list active in memory even if local storage is blocked.
      }
      return;
    }

    const previousStaff = liveStaffMembers;
    const previousOwnerData = ownerData;
    setLiveStaffMembers(nextStaff);
    setOwnerData((current) => ({ ...current, staffMembers: nextStaff }));
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
      setLiveStaffMembers(previousStaff);
      setOwnerData(previousOwnerData);
      throw error;
    }
  }

  function handleScreenSelect(screen: OwnerWebScreenKey) {
    setActiveScreen(screen);
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
    setLoggingOut(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      clearOwnerAuthTokenCache();
    } finally {
      window.location.href = "/login";
    }
  }

  return (
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
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
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
      )}
    </OwnerWebAppShell>
  );
}
