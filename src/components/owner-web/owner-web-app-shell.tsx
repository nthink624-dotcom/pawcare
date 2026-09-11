"use client";

import { CalendarPlus, ChevronDown, ChevronUp, CircleHelp, ClipboardCheck, HelpCircle, LogOut, MessageSquareText, MessageSquareWarning, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import type { OwnerFeedbackKind } from "@/components/owner-web/owner-feedback-adapter";
import { type OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import OwnerFeatureRequestDialog from "@/components/owner-web/owner-feature-request-dialog";
import { SoftSelect } from "@/components/owner-web/owner-web-ui";
import { cn } from "@/lib/utils";
import type { BootstrapPayload } from "@/types/domain";

type OwnerWebNavigationKey = OwnerWebScreenKey | "billing";
type OwnerWebNavigationItem =
  | { key: OwnerWebScreenKey; label: string; href?: never }
  | { key: "billing"; label: string; href: Route };

const screenIconPaths: Record<OwnerWebNavigationKey, string> = {
  schedule: "/icons/phosphor/clipboard-text.svg",
  bookingPageManagement: "/icons/phosphor/storefront.svg",
  bookingLink: "/icons/phosphor/line-segments.svg",
  calendarRecords: "/icons/phosphor/calendar-dots.svg",
  customers: "/icons/phosphor/user-circle.svg",
  profitability: "/icons/phosphor/projector-screen-chart.svg",
  services: "/icons/phosphor/projector-screen-chart.svg",
  staff: "/icons/phosphor/users.svg",
  ownerProfile: "/icons/phosphor/user-circle.svg",
  shopInfo: "/icons/phosphor/storefront.svg",
  operatingHours: "/icons/phosphor/clock.svg",
  benefits: "/icons/phosphor/projector-screen-chart.svg",
  alerts: "/icons/phosphor/bell.svg",
  help: "/icons/phosphor/WarningCircle.svg",
  billing: "/icons/phosphor/projector-screen-chart.svg",
};

const ownerWebNavigationGroups: Array<{
  label: string;
  items: OwnerWebNavigationItem[];
}> = [
  {
    label: "운영",
    items: [
      { key: "schedule", label: "예약 관리" },
      { key: "calendarRecords", label: "캘린더" },
      { key: "customers", label: "고객 관리" },
      { key: "profitability", label: "수익 분석" },
      { key: "bookingLink", label: "예약 링크" },
    ],
  },
  {
    label: "설정",
    items: [
      { key: "shopInfo", label: "매장 정보" },
      { key: "benefits", label: "혜택 관리" },
      { key: "staff", label: "직원 관리" },
      { key: "alerts", label: "알림 설정" },
    ],
  },
];

const ownerWebSidebarGroups: Array<{
  label: string;
  items: OwnerWebNavigationItem[];
}> = [
  {
    label: "운영",
    items: [
      { key: "schedule", label: "예약 관리" },
      { key: "calendarRecords", label: "캘린더" },
      { key: "customers", label: "고객 관리" },
      { key: "profitability", label: "수익 분석" },
      { key: "bookingLink", label: "예약 링크" },
    ],
  },
  {
    label: "설정",
    items: [
      { key: "shopInfo", label: "매장 정보" },
      { key: "benefits", label: "혜택 관리" },
      { key: "staff", label: "직원 관리" },
      { key: "alerts", label: "알림 설정" },
    ],
  },
];

const ownerWebNavigationItems = ownerWebSidebarGroups
  .flatMap((group) => group.items)
  .filter((item): item is Extract<OwnerWebNavigationItem, { key: OwnerWebScreenKey }> => !("href" in item));

/**
 * Only these cores own their full shell footprint. Other owner surfaces keep
 * the existing neutral wrapper until their dedicated slice is accepted.
 */
const ownerWebSinglePlaneCoreScreens = new Set<OwnerWebScreenKey>([
  "schedule",
  "calendarRecords",
  "customers",
  "profitability",
  "bookingLink",
  "shopInfo",
  "alerts",
]);

function PhosphorSidebarIcon({ screen, active }: { screen: OwnerWebNavigationKey; active: boolean }) {
  return (
    <span
      className={cn("block h-[18px] w-[18px] shrink-0 transition-colors", active ? "bg-[var(--acc)]" : "bg-[#9aa3af]")}
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

const OWNER_HEADER_UTILITY_BUTTON_CLASS =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-transparent bg-transparent px-3 text-[13px] font-semibold text-[var(--mid)] transition hover:bg-[#eef1f5] hover:text-[var(--ink)]";

export default function OwnerWebAppShell({
  activeScreen,
  onScreenSelect,
  shopDisplayName,
  shopId,
  ownerName,
  ownerPhone,
  shopInitials,
  currentPlanLabel,
  alimtalkCreditSummary,
  alimtalkCreditMenuOpen,
  alimtalkCreditMenuRef,
  onAlimtalkCreditToggle,
  storeMenuOpen,
  storeMenuRef,
  onStoreMenuToggle,
  onOpenProfile,
  onOpenShop,
  onOpenAlerts,
  onOpenHelp,
  onOpenInitialSetup,
  onAddReservation,
  showInitialSetupAction = true,
  onLogout,
  loggingOut,
  isTester = false,
  feedbackFixtureMode = false,
  setupMode = false,
  children,
}: {
  activeScreen: OwnerWebScreenKey;
  onScreenSelect: (screen: OwnerWebScreenKey) => void;
  shopDisplayName: string;
  shopId: string;
  ownerName: string;
  ownerPhone: string;
  shopInitials: string;
  currentPlanLabel: string;
  alimtalkCreditSummary: BootstrapPayload["alimtalkCreditSummary"];
  alimtalkCreditMenuOpen: boolean;
  alimtalkCreditMenuRef: RefObject<HTMLDivElement | null>;
  onAlimtalkCreditToggle: () => void;
  storeMenuOpen: boolean;
  storeMenuRef: RefObject<HTMLDivElement | null>;
  onStoreMenuToggle: () => void;
  onOpenProfile: () => void;
  onOpenShop: () => void;
  onOpenAlerts: () => void;
  onOpenHelp: () => void;
  onOpenInitialSetup: () => void;
  onAddReservation: () => void;
  showInitialSetupAction?: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  isTester?: boolean;
  feedbackFixtureMode?: boolean;
  setupMode?: boolean;
  children: ReactNode;
}) {
  const [featureRequestOpen, setFeatureRequestOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<OwnerFeedbackKind>("inquiry");
  const [hanmadiOpen, setHanmadiOpen] = useState(false);
  const hanmadiMenuId = useId();
  const hanmadiContainerRef = useRef<HTMLDivElement>(null);
  const hanmadiTriggerRef = useRef<HTMLButtonElement>(null);
  const hanmadiMenuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const usesSinglePlaneCore = ownerWebSinglePlaneCoreScreens.has(activeScreen);

  useEffect(() => {
    if (!hanmadiOpen) return;

    hanmadiMenuItemRefs.current[0]?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !hanmadiContainerRef.current?.contains(event.target)) {
        setHanmadiOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setHanmadiOpen(false);
      hanmadiTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [hanmadiOpen]);

  const handleHanmadiMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = hanmadiMenuItemRefs.current.filter((item): item is HTMLButtonElement => item !== null);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    <div className="owner-font pm-owner-web flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <aside className={cn(
        "pm-owner-sidebar hidden h-screen w-[236px] shrink-0 flex-col border-r border-[var(--nav-bd)] bg-[var(--nav-bg)]",
        setupMode ? "hidden" : "lg:flex",
      )}>
        <div className="flex items-center pb-4 pl-[34px] pr-5 pt-[22px]">
          <PetManagerBrand
            imageClassName="h-5 w-auto"
            nameClassName="text-[15px] text-[#1f2937]"
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-5 pb-4 pt-1">
          <div className="space-y-5">
            {ownerWebSidebarGroups.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && "border-t border-dashed border-[#e1e5ec] pt-5")}>
                <p className="mb-2.5 px-1 text-[13px] font-medium tracking-[0.01em] text-[#8f98a6]">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((screen) => {
                    const active = activeScreen === screen.key;
                    const itemClassName = cn(
                      "relative flex h-11 w-full items-center gap-3 rounded-[10px] px-3.5 text-left text-[15px] font-medium text-[#273142] transition hover:bg-[#eef2f7] hover:text-[#111827]",
                      active &&
                        "bg-[#eff6ff] font-semibold text-[var(--acc)] shadow-none hover:bg-[#eff6ff] hover:text-[var(--acc)]",
                    );
                    if (screen.key === "billing") {
                      return (
                        <Link key={screen.key} href={screen.href} prefetch className={itemClassName}>
                          <PhosphorSidebarIcon screen={screen.key} active={false} />
                          <span className="min-w-0 truncate">{screen.label}</span>
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={screen.key}
                        type="button"
                        onClick={() => onScreenSelect(screen.key)}
                        className={itemClassName}
                      >
                        <PhosphorSidebarIcon screen={screen.key} active={active} />
                        <span className="min-w-0 truncate">{screen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-[var(--nav-bd)] px-5 py-4">
          <Link
            href="/owner/billing?compare=1"
            prefetch
            aria-label={`${currentPlanLabel} 요금표 보기`}
            className="block rounded-[13px] border border-[#dbe2ea] bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-[#b8c7dc] hover:bg-[#f8fbff]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-semibold text-[#273142]">{currentPlanLabel}</p>
              <span className="shrink-0 rounded-full bg-[#edf4ff] px-2.5 py-1 text-[12px] font-bold text-[#316fe8]">
                이용 플랜
              </span>
            </div>
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className={cn(
          "hidden h-[60px] shrink-0 items-center gap-4 border-b border-[var(--line2)] bg-[var(--card)] px-[22px]",
          setupMode ? "hidden" : "lg:flex",
        )}>
          <label className="flex h-[38px] w-[300px] items-center gap-2 rounded-[10px] border border-transparent bg-[#eef1f5] px-3 text-[14px] text-[var(--mid)] transition focus-within:border-[var(--acc)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--acc-tint)]">
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <input className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--mut)]" placeholder="검색" />
          </label>

          <div className="ml-auto flex items-center gap-2">
            {showInitialSetupAction ? (
              <button
                type="button"
                onClick={onOpenInitialSetup}
                className={OWNER_HEADER_UTILITY_BUTTON_CLASS}
              >
                <ClipboardCheck className="h-4 w-4" strokeWidth={1.8} />
                초기 설정
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFeatureRequestOpen(true)}
              className={cn(
                OWNER_HEADER_UTILITY_BUTTON_CLASS,
                isTester && "!border-[#decda9] !bg-[#fffaf0] !text-[#80643f] hover:!bg-[#fbf2df] hover:!text-[#6f5534]",
              )}
            >
              <MessageSquareText className="h-4 w-4" strokeWidth={1.8} />
              문의·의견 보내기
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className={OWNER_HEADER_UTILITY_BUTTON_CLASS}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
              도움·문의
            </button>
            <div className="mx-2 h-6 w-px bg-[var(--line2)]" />
            <div ref={storeMenuRef} className="relative">
              <button
                type="button"
                onClick={onStoreMenuToggle}
                className="grid h-[42px] min-w-[178px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] px-2.5 text-left transition hover:bg-[#eef1f5]"
                aria-expanded={storeMenuOpen}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--acc-soft)] text-[12px] font-bold text-[var(--acc-dk)]">
                  {shopInitials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold leading-[18px] text-[var(--ink)]">{shopDisplayName}</span>
                  <span className="block truncate text-[11px] font-medium leading-[14px] text-[var(--mut)]">운영 계정</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[var(--mid)]" strokeWidth={1.6} />
              </button>
              {storeMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded-[10px] border border-[var(--bd)] bg-white py-1 shadow-[0_18px_40px_rgba(15,23,42,0.13)]">
                  <button type="button" onClick={onOpenProfile} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ink2)] hover:bg-[#eef1f5]">
                    프로필
                  </button>
                  <button type="button" onClick={onOpenShop} className="block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[var(--ink2)] hover:bg-[#eef1f5]">
                    매장 정보
                  </button>
                  <div className="my-1 border-t border-[var(--line)]" />
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#a04455] hover:bg-[#fff1f2] disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.6} />
                    {loggingOut ? "로그아웃 중..." : "로그아웃"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <header className={cn(
          "flex min-h-[60px] shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line2)] bg-[var(--card)] px-4 py-2 sm:h-[60px] sm:flex-nowrap sm:px-5 sm:py-0",
          setupMode ? "hidden" : "lg:hidden",
        )}>
          <div className="shrink-0">
            <PetManagerBrand
              imageClassName="h-5 w-auto"
              nameClassName="text-[15px] text-[#1f2937]"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            {showInitialSetupAction ? (
              <button
                type="button"
                onClick={onOpenInitialSetup}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white text-[#475569]"
                aria-label="초기 설정 가이드"
                title="초기 설정 가이드"
              >
                <ClipboardCheck className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFeatureRequestOpen(true)}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white text-[#475569]",
                isTester && "!border-[#decda9] !bg-[#fffaf0] !text-[#80643f]",
              )}
              aria-label="문의·의견 보내기"
              title="문의·의견 보내기"
            >
              <MessageSquareText className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[9px] border border-[#dbe2ea] bg-white text-[#475569]"
              aria-label="도움·문의"
              title="도움·문의"
            >
              <HelpCircle className="h-4.5 w-4.5" strokeWidth={1.8} />
            </button>
            <SoftSelect<OwnerWebScreenKey>
              value={activeScreen}
              onChange={onScreenSelect}
              options={ownerWebNavigationItems.map((screen) => ({ value: screen.key, label: screen.label }))}
              align="right"
              className="order-3 basis-full min-w-0 sm:order-none sm:basis-auto sm:max-w-[180px]"
              buttonClassName="h-11"
              valueClassName="whitespace-nowrap"
              menuClassName="[&_[role=option]]:h-auto [&_[role=option]]:min-h-11"
            />
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-hidden bg-[var(--bg)] p-3 sm:p-4">
          {usesSinglePlaneCore ? (
            <div className="h-full min-h-0 min-w-0">{children}</div>
          ) : (
            <div
              className="h-full min-w-0 overflow-hidden rounded-[14px] border border-[var(--bd)] bg-white shadow-none"
            >
              <div className={cn(
                "h-full min-h-0 overscroll-contain p-3 sm:p-4",
                setupMode ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden",
              )}>
                {children}
              </div>
            </div>
          )}
        </section>
      </main>
      {!setupMode ? (
        <div ref={hanmadiContainerRef} className="fixed bottom-6 right-6 z-[110]">
          {hanmadiOpen ? (
            <div id={hanmadiMenuId} role="menu" aria-label="한마디" onKeyDown={handleHanmadiMenuKeyDown} className="absolute bottom-[calc(100%+8px)] right-0 w-[156px] overflow-hidden rounded-[14px] border border-[#d9e0e8] bg-white p-1 shadow-[0_10px_28px_rgba(17,26,48,0.14)]">
              <button ref={(element) => { hanmadiMenuItemRefs.current[0] = element; }} type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium text-[#111a30] hover:bg-[#f6f8fb]" onClick={() => { setHanmadiOpen(false); onAddReservation(); }}><CalendarPlus className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />새 예약 추가</button>
              <button ref={(element) => { hanmadiMenuItemRefs.current[1] = element; }} type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium text-[#111a30] hover:bg-[#f6f8fb]" onClick={() => { setHanmadiOpen(false); setFeedbackKind("inquiry"); setFeatureRequestOpen(true); }}><CircleHelp className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />문의 남기기</button>
              <button ref={(element) => { hanmadiMenuItemRefs.current[2] = element; }} type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 text-left text-[14px] font-medium text-[#111a30] hover:bg-[#f6f8fb]" onClick={() => { setHanmadiOpen(false); setFeedbackKind("bug"); setFeatureRequestOpen(true); }}><MessageSquareWarning className="h-4.5 w-4.5 text-[#526176]" aria-hidden="true" />함께 고쳐요</button>
            </div>
          ) : null}
          <button ref={hanmadiTriggerRef} type="button" aria-label="한마디 메뉴 열기" aria-haspopup="menu" aria-controls={hanmadiMenuId} aria-expanded={hanmadiOpen} onClick={() => setHanmadiOpen((current) => !current)} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#cfd8e3] bg-white text-[#111a30] shadow-[0_5px_16px_rgba(17,26,48,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
            <ChevronUp className={`h-5 w-5 transition-transform motion-reduce:transition-none ${hanmadiOpen ? "rotate-180" : ""}`} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <OwnerFeatureRequestDialog
        open={featureRequestOpen}
        shopId={shopId}
        activeScreen={activeScreen}
        initialKind={feedbackKind}
        fixtureMode={feedbackFixtureMode}
        onClose={() => setFeatureRequestOpen(false)}
      />
    </div>
  );
}
