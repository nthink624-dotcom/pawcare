"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CreditCard,
  LogOut,
  LockKeyhole,
  Phone,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import CalendarManagementScreen from "@/components/owner-web/calendar-management-screen";
import CustomerManagementScreen from "@/components/owner-web/customer-management-screen";
import GroomingManagementScreen from "@/components/owner-web/grooming-management-screen";
import { ownerWebScreenLabels, settingsTabs, type OwnerWebScreenKey, type SettingsTabKey } from "@/components/owner-web/owner-web-data";
import ServiceManagementScreen from "@/components/owner-web/service-management-screen";
import SettingsManagementScreen from "@/components/owner-web/settings-management-screen";
import StaffManagementScreen from "@/components/owner-web/staff-management-screen";
import StatsManagementScreen from "@/components/owner-web/stats-management-screen";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

const screenIcons: Record<OwnerWebScreenKey, typeof CalendarDays> = {
  schedule: CalendarDays,
  customers: Users,
  grooming: Stethoscope,
  revenue: CreditCard,
  services: Scissors,
  staff: Users,
  settings: Settings,
};

const approvalModeStorageKey = "petmanager.ownerWeb.approvalMode";

function renderScreen(
  screen: OwnerWebScreenKey,
  settingsTab: SettingsTabKey,
  onSettingsTabChange: (tab: SettingsTabKey) => void,
  manualApprovalEnabled: boolean,
  onManualApprovalChange: (enabled: boolean) => void,
  initialData: BootstrapPayload,
) {
  switch (screen) {
    case "schedule":
      return (
        <CalendarManagementScreen
          initialData={initialData}
          manualApprovalEnabled={manualApprovalEnabled}
          onManualApprovalChange={onManualApprovalChange}
        />
      );
    case "customers":
      return <CustomerManagementScreen initialData={initialData} />;
    case "grooming":
      return <GroomingManagementScreen />;
    case "revenue":
      return <StatsManagementScreen />;
    case "services":
      return <ServiceManagementScreen />;
    case "staff":
      return <StaffManagementScreen />;
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

export default function OwnerWebPreview({ initialData }: { initialData: BootstrapPayload }) {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>("schedule");
  const [revenueUnlocked, setRevenueUnlocked] = useState(false);
  const [revenueGateOpen, setRevenueGateOpen] = useState(false);
  const [revenuePasswordEnabled, setRevenuePasswordEnabled] = useState(true);
  const [revenuePassword, setRevenuePassword] = useState("");
  const [revenueGateError, setRevenueGateError] = useState("");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabKey>("policy");
  const [manualApprovalEnabled, setManualApprovalEnabled] = useState(true);
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const currentUserName = "정우진";
  const revenueAllowedUsers = ["정우진", "우유 미용실"];
  const canCurrentUserOpenRevenue = revenueAllowedUsers.includes(currentUserName);

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

  function handleScreenSelect(screen: OwnerWebScreenKey) {
    if (screen !== "revenue") {
      setActiveScreen(screen);
      return;
    }

    if (revenueUnlocked) {
      setActiveScreen("revenue");
      return;
    }

    setRevenueGateOpen(true);
    setRevenueGateError("");
  }

  function unlockRevenue() {
    if (!canCurrentUserOpenRevenue) {
      setRevenueGateError("매출 화면을 볼 수 있는 사용자로 지정되어 있지 않습니다.");
      return;
    }

    if (revenuePasswordEnabled && revenuePassword !== "1234") {
      setRevenueGateError("비밀번호를 다시 확인해 주세요. 데모 비밀번호는 1234입니다.");
      return;
    }

    setRevenueUnlocked(true);
    setRevenueGateOpen(false);
    setRevenuePassword("");
    setRevenueGateError("");
    setActiveScreen("revenue");
  }

  function openSettingsTab(tab: SettingsTabKey) {
    setActiveSettingsTab(tab);
    setActiveScreen("settings");
    setStoreMenuOpen(false);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-[#dbe2ea] bg-white px-4 text-[#111827] shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex min-w-[250px] items-center gap-3">
          <img src="/images/brand/ododok-petmanager-logo.png" alt="펫매니저" className="h-10 w-10 shrink-0 object-contain" />
          <span className="font-['SUIT_Variable','Pretendard_Variable','Pretendard',sans-serif] text-[24px] font-extrabold tracking-[-0.02em] text-[#146757]">
            펫매니저
          </span>
        </div>

        <div className="ml-auto hidden items-center gap-1 lg:flex">
          <a href="/owner/billing?compare=1" className="inline-flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] font-semibold text-[#1f6b5b] hover:bg-[#f6fbf9]">
            요금제
          </a>
          <span className="mx-1 h-6 w-px bg-[#dbe2ea]" />
          <button
            type="button"
            onClick={() => {
              setStoreMenuOpen(false);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef7f4] text-[#1f6b5b] hover:bg-[#e6f3ef]"
            aria-label="전화 상담"
          >
            <Phone className="h-4 w-4" />
          </button>
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
            onClick={() => {
              setStoreMenuOpen(false);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="도움말"
          >
            <CircleHelp className="h-4 w-4" />
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
          <span className="mx-1 h-6 w-px bg-[#dbe2ea]" />
          <button
            type="button"
            onClick={() => {
              setStoreMenuOpen(false);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            <Sparkles className="h-4 w-4" />
            도우미
          </button>
          <span className="mx-1 h-6 w-px bg-[#dbe2ea]" />
          <div className="relative w-[218px]">
            <button
              type="button"
              onClick={() => {
                setStoreMenuOpen((current) => !current);
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
            <select
              value={activeScreen}
              onChange={(event) => handleScreenSelect(event.target.value as OwnerWebScreenKey)}
              className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#1f2937]"
            >
              {ownerWebScreenLabels.map((screen) => (
                <option key={screen.key} value={screen.key}>
                  {screen.label}
                </option>
              ))}
            </select>
          </div>
          <div className="p-5">
            {renderScreen(
              activeScreen,
              activeSettingsTab,
              setActiveSettingsTab,
              manualApprovalEnabled,
              handleManualApprovalChange,
              initialData,
            )}
          </div>
        </main>
      </div>
      {revenueGateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/28 px-4" onClick={() => setRevenueGateOpen(false)}>
          <div className="w-full max-w-[420px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef7f4] text-[#1f6b5b]">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[18px] font-semibold text-[#111827]">매출 권한 확인</h2>
                <p className="mt-1 text-[13px] leading-5 text-[#64748b]">매출은 지정 사용자만 볼 수 있습니다.</p>
              </div>
            </div>

            <div className="mt-4 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#334155]">
                <ShieldCheck className="h-4 w-4 text-[#1f6b5b]" />
                허용 사용자
              </div>
              <p className="mt-2 text-[13px] text-[#64748b]">{revenueAllowedUsers.join(", ")}</p>
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 rounded-[8px] border border-[#e2e8f0] bg-white px-3 py-2.5">
              <span>
                <span className="block text-[13px] font-semibold text-[#111827]">비밀번호 확인 사용</span>
                <span className="mt-0.5 block text-[12px] text-[#94a3b8]">오너가 켜고 끌 수 있는 설정입니다.</span>
              </span>
              <input
                type="checkbox"
                checked={revenuePasswordEnabled}
                onChange={(event) => {
                  setRevenuePasswordEnabled(event.target.checked);
                  setRevenueGateError("");
                }}
                className="h-4 w-4 accent-[#1f6b5b]"
              />
            </label>

            {revenuePasswordEnabled ? (
              <label className="mt-3 block">
                <span className="text-[13px] font-semibold text-[#334155]">비밀번호</span>
                <input
                  type="password"
                  value={revenuePassword}
                  onChange={(event) => {
                    setRevenuePassword(event.target.value);
                    setRevenueGateError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") unlockRevenue();
                  }}
                  className="mt-2 h-11 w-full rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-3 text-[15px] outline-none focus:border-[#cfded8] focus:bg-white"
                  placeholder="데모 비밀번호 1234"
                />
              </label>
            ) : null}

            {revenueGateError ? <p className="mt-3 text-[13px] font-medium text-[#b91c1c]">{revenueGateError}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRevenueGateOpen(false)} className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white text-[14px] font-medium text-[#334155]">
                취소
              </button>
              <button type="button" onClick={unlockRevenue} className="h-10 rounded-[8px] bg-[#1f6b5b] text-[14px] font-semibold text-white">
                매출 열기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
