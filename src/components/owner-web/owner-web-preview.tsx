"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  MessageCircle,
  Store,
} from "lucide-react";
import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";

import CalendarManagementScreen, { type OwnerScheduleCreateRequest } from "@/components/owner-web/calendar-management-screen";
import BookingLinkManagementScreen from "@/components/owner-web/booking-link-management-screen";
import CustomerBookingPageManagementScreen from "@/components/owner-web/customer-booking-page-management-screen";
import CustomerManagementScreen from "@/components/owner-web/customer-management-screen";
import CalendarRecordsScreen from "@/components/owner-web/calendar-records-screen";
import { type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import {
  demoOwnerWebStaffStorageKey,
  parseStoredOwnerWebStaff,
  type OwnerWebStaffMember,
} from "@/components/owner-web/owner-web-staff-data";
import ServiceManagementScreen from "@/components/owner-web/service-management-screen";
import SettingsManagementScreen from "@/components/owner-web/settings-management-screen";
import StaffManagementScreen from "@/components/owner-web/staff-management-screen";
import { SoftSelect } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { clearOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";
import { concurrentCapacityForApprovalMode } from "@/lib/booking-slot-settings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, currentDateInTimeZone } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const screenIconPaths: Record<OwnerWebScreenKey, string> = {
  schedule: "/icons/phosphor/clipboard-text.svg",
  bookingPageManagement: "/icons/phosphor/storefront.svg",
  bookingLink: "/icons/phosphor/line-segments.svg",
  calendarRecords: "/icons/phosphor/calendar-dots.svg",
  customers: "/icons/phosphor/user-circle.svg",
  services: "/icons/phosphor/projector-screen-chart.svg",
  staff: "/icons/phosphor/users.svg",
  shopInfo: "/icons/phosphor/storefront.svg",
  operatingHours: "/icons/phosphor/clock.svg",
  alerts: "/icons/phosphor/bell.svg",
};

const ownerWebNavigationItems: Array<{ key: OwnerWebScreenKey; label: string }> = [
  { key: "schedule", label: "예약 관리" },
  { key: "calendarRecords", label: "캘린더" },
  { key: "customers", label: "고객 관리" },
  { key: "bookingLink", label: "예약 링크" },
  { key: "services", label: "미용 요금" },
  { key: "staff", label: "직원 관리" },
  { key: "shopInfo", label: "매장 정보" },
  { key: "alerts", label: "알림 설정" },
];

function PhosphorSidebarIcon({ screen, active }: { screen: OwnerWebScreenKey; active: boolean }) {
  return (
    <span
      className={cn("block h-[21px] w-[21px]", active ? "bg-[#1f6b5b]" : "bg-[#64748b]")}
      style={
        {
          WebkitMaskImage: `url(${screenIconPaths[screen]})`,
          maskImage: `url(${screenIconPaths[screen]})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

const approvalModeStorageKey = "petmanager.ownerWeb.approvalMode";

function isDemoOwnerWebData(data: BootstrapPayload) {
  return data.shop.id === "demo-shop" || data.shop.id === "owner-demo";
}

function formatAlimtalkCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR");
}

function buildShopInitials(shopName: string) {
  const compactName = shopName.replace(/\s+/g, "");
  return Array.from(compactName).slice(0, 2).join("").toUpperCase() || "PM";
}

function KakaoTalkIconMark() {
  return <MessageCircle className="h-4 w-4" strokeWidth={1.9} />;
}

function AlimtalkCreditMenu({
  summary,
  open,
  onToggle,
}: {
  summary: BootstrapPayload["alimtalkCreditSummary"];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative hidden lg:block">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
        aria-label="알림톡 잔여 건수"
        aria-expanded={open}
      >
        <KakaoTalkIconMark />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 w-[218px] rounded-[8px] border border-[#dbe2ea] bg-white p-3 shadow-[0_14px_32px_rgba(15,23,42,0.14)]">
          <div className="flex items-center gap-2 border-b border-[#edf2f7] pb-2.5">
            <KakaoTalkIconMark />
            <div>
              <p className="text-[13px] font-semibold text-[#111827]">알림톡 잔여 건수</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">무료분과 결제분을 따로 봅니다.</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[#64748b]">무료 잔여</span>
              <span className="text-[15px] font-semibold text-[#111827]">
                {formatAlimtalkCount(summary?.included_remaining)}건
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[#64748b]">결제 잔여</span>
              <span className="text-[15px] font-semibold text-[#111827]">
                {formatAlimtalkCount(summary?.purchased_remaining)}건
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function settingsTabForScreen(screen: OwnerWebScreenKey): SettingsTabKey | null {
  if (screen === "shopInfo") return "shop";
  if (screen === "operatingHours") return "hours";
  if (screen === "alerts") return "alerts";
  return null;
}

const screenBySettingsTab: Record<SettingsTabKey, OwnerWebScreenKey> = {
  shop: "shopInfo",
  hours: "operatingHours",
  alerts: "alerts",
};

function renderScreen(
  screen: OwnerWebScreenKey,
  manualApprovalEnabled: boolean,
  onManualApprovalChange: (enabled: boolean) => void,
  initialData: BootstrapPayload,
  onDataChange: (data: BootstrapPayload) => void,
  onShopChange: (shop: BootstrapPayload["shop"]) => void,
  staffMembers: OwnerWebStaffMember[],
  onStaffMembersChange: (staff: OwnerWebStaffMember[]) => void | Promise<void>,
  createRequest: OwnerScheduleCreateRequest | null,
  onCreateRequestHandled: (requestId: number) => void,
  onCreateReservationForCustomer: (params: { guardianId: string; petId: string | null }) => void,
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
          manualApprovalEnabled={manualApprovalEnabled}
          onManualApprovalChange={onManualApprovalChange}
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
      return <CalendarRecordsScreen initialData={initialData} />;
    case "services":
      return (
        <ServiceManagementScreen
          shopId={initialData.shop.id}
          shop={initialData.shop}
          initialServices={initialData.services}
          staffMembers={staffMembers}
          demoMode={isDemoOwnerWebData(initialData)}
          onServicesChange={(services) => onDataChange({ ...initialData, services })}
          onShopChange={onShopChange}
        />
      );
    case "staff":
      return (
        <StaffManagementScreen
          shopId={initialData.shop.id}
          staffMembers={staffMembers}
          staffScheduleOverrides={initialData.staffScheduleOverrides ?? []}
          onStaffMembersChange={onStaffMembersChange}
          onStaffScheduleOverridesChange={handleStaffScheduleOverridesChange}
        />
      );
    case "shopInfo":
    case "operatingHours":
    case "alerts":
      return (
        <SettingsManagementScreen
          activeTab={settingsTabForScreen(screen) ?? "shop"}
          showTabNavigation={false}
          shop={initialData.shop}
          services={initialData.services}
          onShopChange={onShopChange}
          onServicesChange={(services: BootstrapPayload["services"]) => onDataChange({ ...initialData, services })}
          persistShopProfile={!isDemoOwnerWebData(initialData)}
          manualApprovalEnabled={manualApprovalEnabled}
          onManualApprovalChange={onManualApprovalChange}
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
}: {
  initialData: BootstrapPayload;
  demoStaffFallback?: OwnerWebStaffMember[];
  onDataChange?: (data: BootstrapPayload) => void;
}) {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>("schedule");
  const [manualApprovalEnabled, setManualApprovalEnabled] = useState(initialData.shop.approval_mode !== "auto");
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [alimtalkCreditMenuOpen, setAlimtalkCreditMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [ownerData, setOwnerData] = useState(initialData);
  const [scheduleCreateRequest, setScheduleCreateRequest] = useState<OwnerScheduleCreateRequest | null>(null);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);
  const demoMode = isDemoOwnerWebData(initialData);
  const [liveStaffMembers, setLiveStaffMembers] = useState<OwnerWebStaffMember[]>(() => initialData.staffMembers ?? []);
  const [demoStaffMembers, setDemoStaffMembers] = useState<OwnerWebStaffMember[]>(() => {
    if (!demoMode) return [];
    if (typeof window === "undefined") return demoStaffFallback;
    return parseStoredOwnerWebStaff(window.localStorage.getItem(demoOwnerWebStaffStorageKey)) ?? demoStaffFallback;
  });
  const staffMembers = demoMode ? demoStaffMembers : liveStaffMembers;
  const staffSource = demoMode ? "demo-local-storage-or-default" : "live-bootstrap";
  const shopDisplayName = ownerData.shop.name.trim() || "PetManager";
  const shopInitials = buildShopInitials(shopDisplayName);

  useEffect(() => {
    setManualApprovalEnabled(initialData.shop.approval_mode !== "auto");
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
    if (!demoMode) return;
    try {
      const storedApprovalMode = window.localStorage.getItem(approvalModeStorageKey);
      if (storedApprovalMode === "instant") {
        setManualApprovalEnabled(false);
      }
      if (storedApprovalMode === "manual") {
        setManualApprovalEnabled(true);
      }
    } catch {
      window.localStorage.removeItem(approvalModeStorageKey);
    }
  }, [demoMode]);

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

  function handleManualApprovalChange(enabled: boolean) {
    setManualApprovalEnabled(enabled);
    const nextMode = enabled ? "manual" : "auto";
    setOwnerData((current) => ({
      ...current,
      shop: {
        ...current.shop,
        approval_mode: nextMode,
        concurrent_capacity: concurrentCapacityForApprovalMode(nextMode),
      },
      appointments:
        nextMode === "auto"
          ? current.appointments.map((appointment) =>
              appointment.status === "pending" ? { ...appointment, status: "confirmed" } : appointment,
            )
          : current.appointments,
    }));
    try {
      window.localStorage.setItem(approvalModeStorageKey, enabled ? "manual" : "instant");
    } catch {
      // Keep the mode active for the current session even if local storage is blocked.
    }
    if (!demoMode) {
      void fetchApiJsonWithAuth("/api/owner/shops", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: ownerData.shop.id,
          approvalMode: nextMode,
        }),
      }).catch((error) => {
        console.error("[OWNER WEB] failed to save approval mode", error);
      });
    }
  }

  function handleShopProfileChange(shop: BootstrapPayload["shop"]) {
    setOwnerData((current) => ({
      ...current,
      shop,
    }));
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
  }

  function handleScheduleCreateRequestHandled(requestId: number) {
    setScheduleCreateRequest((current) => (current?.requestId === requestId ? null : current));
  }

  function openSettingsTab(tab: SettingsTabKey) {
    setActiveScreen(screenBySettingsTab[tab]);
    setStoreMenuOpen(false);
    setAlimtalkCreditMenuOpen(false);
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
    <div className="min-h-screen bg-white text-[#111827]">
      <header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-[#dbe2ea] bg-white px-4 text-[#111827] shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex min-w-[250px] items-center gap-3">
          <Image src="/images/brand/ododok-petmanager-logo.png" alt="펫매니저" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
          <span className="font-['SUIT_Variable','Pretendard_Variable','Pretendard',sans-serif] text-[24px] font-extrabold tracking-[-0.02em] text-[#146757]">
            펫매니저
          </span>
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <AlimtalkCreditMenu
            summary={ownerData.alimtalkCreditSummary}
            open={alimtalkCreditMenuOpen}
            onToggle={() => {
              setAlimtalkCreditMenuOpen((current) => !current);
              setStoreMenuOpen(false);
            }}
          />
          <button
            type="button"
            onClick={() => openSettingsTab("shop")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="매장 정보"
          >
            <Store className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openSettingsTab("alerts")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="알림"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div ref={storeMenuRef} className="relative w-[218px]">
            <button
              type="button"
              onClick={() => {
                setStoreMenuOpen((current) => !current);
                setAlimtalkCreditMenuOpen(false);
              }}
              className="grid h-9 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full px-2 text-[14px] font-semibold text-[#111827] hover:bg-[#f8fafc]"
                aria-expanded={storeMenuOpen}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e6f3ef] text-[11px] font-bold text-[#1f6b5b]">
                  {shopInitials}
                </span>
                <span className="min-w-0 truncate text-right">{shopDisplayName}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#64748b]" />
              </button>
            {storeMenuOpen ? (
              <div className="absolute right-0 top-11 w-full overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white py-1 shadow-[0_14px_32px_rgba(15,23,42,0.14)]">
                <button type="button" onClick={() => openSettingsTab("shop")} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                  매장 정보
                </button>
                <div className="my-1 border-t border-[#edf2f7]" />
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#b45309] hover:bg-[#fffaf0] disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-52px)]">
        <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-[184px] shrink-0 self-start border-r border-[#dbe2ea] bg-white lg:block">
          <div className="flex h-full flex-col">
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-0.5">
                {ownerWebNavigationItems.map((screen) => {
                  const active = activeScreen === screen.key;
                  return (
                    <div key={screen.key}>
                      <button
                        type="button"
                        onClick={() => handleScreenSelect(screen.key)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition",
                          active ? "bg-[#f8fafc] text-[#111827]" : "text-[#475569] hover:bg-[#f8fafc]",
                        )}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                          <PhosphorSidebarIcon screen={screen.key} active={active} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[16px] font-normal leading-[22px]">{screen.label}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </nav>

          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-[#dbe2ea] bg-white px-5 py-3 lg:hidden">
            <SoftSelect<OwnerWebScreenKey>
              value={activeScreen}
              onChange={handleScreenSelect}
              options={ownerWebNavigationItems.map((screen) => ({ value: screen.key, label: screen.label }))}
              align="left"
              className="max-w-[240px]"
              buttonClassName="h-10"
            />
          </div>
          <div className="p-5">
            {renderScreen(
              activeScreen,
              manualApprovalEnabled,
              handleManualApprovalChange,
              ownerData,
              setOwnerData,
              handleShopProfileChange,
              staffMembers,
              handleStaffMembersChange,
              scheduleCreateRequest,
              handleScheduleCreateRequestHandled,
              handleCreateReservationForCustomer,
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
