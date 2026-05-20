"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Link2,
  LogOut,
  MessageCircle,
  Scissors,
  Settings,
  Stethoscope,
  Store,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import CalendarManagementScreen from "@/components/owner-web/calendar-management-screen";
import BookingLinkManagementScreen from "@/components/owner-web/booking-link-management-screen";
import CustomerManagementScreen from "@/components/owner-web/customer-management-screen";
import GroomingManagementScreen from "@/components/owner-web/grooming-management-screen";
import { ownerWebScreenLabels, settingsTabs, type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const screenIcons: Record<OwnerWebScreenKey, typeof CalendarDays> = {
  schedule: CalendarDays,
  bookingLink: Link2,
  customers: Users,
  grooming: Stethoscope,
  services: Scissors,
  staff: Users,
  settings: Settings,
};

const approvalModeStorageKey = "petmanager.ownerWeb.approvalMode";

function isDemoOwnerWebData(data: BootstrapPayload) {
  return data.shop.id === "demo-shop" || data.shop.id === "owner-demo";
}

function formatAlimtalkCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR");
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

function renderScreen(
  screen: OwnerWebScreenKey,
  settingsTab: SettingsTabKey,
  onSettingsTabChange: (tab: SettingsTabKey) => void,
  manualApprovalEnabled: boolean,
  onManualApprovalChange: (enabled: boolean) => void,
  initialData: BootstrapPayload,
  onDataChange: (data: BootstrapPayload) => void,
  staffMembers: OwnerWebStaffMember[],
  onStaffMembersChange: (staff: OwnerWebStaffMember[]) => void | Promise<void>,
  onStaffMemberDeactivate: (staffId: string) => void | Promise<void>,
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
        />
      );
    case "bookingLink":
      return <BookingLinkManagementScreen initialData={initialData} />;
    case "customers":
      return <CustomerManagementScreen initialData={initialData} />;
    case "grooming":
      return <GroomingManagementScreen initialData={initialData} />;
    case "services":
      return <ServiceManagementScreen staffMembers={staffMembers} />;
    case "staff":
      return (
        <StaffManagementScreen
          shopId={initialData.shop.id}
          staffMembers={staffMembers}
          staffScheduleOverrides={initialData.staffScheduleOverrides ?? []}
          onStaffMembersChange={onStaffMembersChange}
          onStaffMemberDeactivate={onStaffMemberDeactivate}
          onStaffScheduleOverridesChange={handleStaffScheduleOverridesChange}
        />
      );
    case "settings":
      return (
        <SettingsManagementScreen
          activeTab={settingsTab}
          onActiveTabChange={onSettingsTabChange}
          showTabNavigation={false}
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
}: {
  initialData: BootstrapPayload;
  demoStaffFallback?: OwnerWebStaffMember[];
}) {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>("schedule");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabKey>("policy");
  const [manualApprovalEnabled, setManualApprovalEnabled] = useState(true);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [alimtalkCreditMenuOpen, setAlimtalkCreditMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [ownerData, setOwnerData] = useState(initialData);
  const demoMode = isDemoOwnerWebData(initialData);
  const [liveStaffMembers, setLiveStaffMembers] = useState<OwnerWebStaffMember[]>(() => initialData.staffMembers ?? []);
  const [demoStaffMembers, setDemoStaffMembers] = useState<OwnerWebStaffMember[]>(() => {
    if (!demoMode) return [];
    if (typeof window === "undefined") return demoStaffFallback;
    return parseStoredOwnerWebStaff(window.localStorage.getItem(demoOwnerWebStaffStorageKey)) ?? demoStaffFallback;
  });
  const staffMembers = demoMode ? demoStaffMembers : liveStaffMembers;
  const staffSource = demoMode ? "demo-local-storage-or-default" : "live-bootstrap";

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
  }, []);

  function handleManualApprovalChange(enabled: boolean) {
    setManualApprovalEnabled(enabled);
    try {
      window.localStorage.setItem(approvalModeStorageKey, enabled ? "manual" : "instant");
    } catch {
      // Keep the mode active for the current session even if local storage is blocked.
    }
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
      setOwnerData((current) => ({ ...current, staffMembers: response.staffMembers }));
    } catch (error) {
      setLiveStaffMembers(previousStaff);
      setOwnerData(previousOwnerData);
      throw error;
    }
  }

  async function handleStaffMemberDeactivate(staffId: string) {
    const nextStaff = staffMembers.filter((staffMember) => staffMember.id !== staffId);
    if (nextStaff.length === staffMembers.length) {
      return;
    }

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
      await fetchApiJsonWithAuth<{ ok: boolean }>("/api/staff-members", {
        method: "DELETE",
        body: JSON.stringify({
          shopId: ownerData.shop.id,
          staffId,
        }),
      });
    } catch (error) {
      setLiveStaffMembers(previousStaff);
      setOwnerData(previousOwnerData);
      throw error;
    }
  }

  function handleScreenSelect(screen: OwnerWebScreenKey) {
    setActiveScreen(screen);
  }

  function openSettingsTab(tab: SettingsTabKey) {
    setActiveSettingsTab(tab);
    setActiveScreen("settings");
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

        <div className="ml-auto hidden items-center gap-1 lg:flex">
          <AlimtalkCreditMenu
            summary={ownerData.alimtalkCreditSummary}
            open={alimtalkCreditMenuOpen}
            onToggle={() => {
              setAlimtalkCreditMenuOpen((current) => !current);
              setStoreMenuOpen(false);
            }}
          />
          <a
            href="/owner/billing?compare=1"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="요금제"
          >
            <CreditCard className="h-4 w-4" />
          </a>
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
            onClick={() => openSettingsTab("policy")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="설정"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openSettingsTab("alerts")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="알림"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="relative w-[218px]">
            <button
              type="button"
              onClick={() => {
                setStoreMenuOpen((current) => !current);
                setAlimtalkCreditMenuOpen(false);
              }}
              className="inline-flex h-9 w-full items-center gap-2 rounded-full px-1.5 text-[14px] font-semibold text-[#111827] hover:bg-[#f8fafc]"
              aria-expanded={storeMenuOpen}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f3ef] text-[11px] font-bold text-[#1f6b5b]">WJ</span>
              <span className="min-w-0 flex-1 truncate text-left">우유 미용실</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748b]" />
            </button>
            {storeMenuOpen ? (
              <div className="absolute right-0 top-11 w-full overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white py-1 shadow-[0_14px_32px_rgba(15,23,42,0.14)]">
                <button type="button" onClick={() => openSettingsTab("shop")} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                  매장 프로필
                </button>
                <button type="button" onClick={() => openSettingsTab("users")} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                  사용자 관리
                </button>
                <button type="button" onClick={() => openSettingsTab("billing")} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                  결제 설정
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
        <aside className="hidden w-[232px] shrink-0 border-r border-[#dbe2ea] bg-white lg:block">
          <div className="flex h-full flex-col">
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-0.5">
                {ownerWebScreenLabels.map((screen) => {
                  const Icon = screenIcons[screen.key];
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
                          <Icon className={cn("h-[21px] w-[21px]", active ? "text-[#1f6b5b]" : "text-[#64748b]")} strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold">{screen.label}</span>
                          <span className={cn("mt-0.5 block truncate text-[11px]", active ? "text-[#456b61]" : "text-[#94a3b8]")}>
                            {screen.description}
                          </span>
                        </span>
                      </button>
                      {screen.key === "settings" && active ? (
                        <div className="ml-[40px] mt-1 space-y-1 border-l border-[#e2e8f0] pl-2.5">
                          {settingsTabs.map((tab) => {
                            const tabActive = activeSettingsTab === tab.key;
                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                  setActiveSettingsTab(tab.key);
                                  handleScreenSelect("settings");
                                }}
                                className={cn(
                                  "flex h-9 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] font-medium transition",
                                  tabActive ? "bg-[#eef7f4] text-[#1f6b5b]" : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#111827]",
                                )}
                              >
                                <span>{tab.label}</span>
                                {tabActive ? <span className="text-[11px] text-[#2f7866]">선택됨</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
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
              options={ownerWebScreenLabels.map((screen) => ({ value: screen.key, label: screen.label }))}
              align="left"
              className="max-w-[240px]"
              buttonClassName="h-10"
            />
          </div>
          <div className="p-5">
            {renderScreen(
              activeScreen,
              activeSettingsTab,
              setActiveSettingsTab,
              manualApprovalEnabled,
              handleManualApprovalChange,
              ownerData,
              setOwnerData,
              staffMembers,
              handleStaffMembersChange,
              handleStaffMemberDeactivate,
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
