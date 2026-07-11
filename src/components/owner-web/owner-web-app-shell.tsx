"use client";

import { ChevronDown, LogOut, Search } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, type ReactNode, type RefObject } from "react";

import { type OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
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
      { key: "billing", label: "요금/결제", href: "/owner/billing?compare=1" as Route },
    ],
  },
];

const ownerWebNavigationItems = ownerWebSidebarGroups
  .flatMap((group) => group.items)
  .filter((item): item is Extract<OwnerWebNavigationItem, { key: OwnerWebScreenKey }> => !("href" in item));

const ownerWebScreenGradients: Record<OwnerWebScreenKey, string> = {
  schedule: "linear-gradient(135deg, #eaf2ff 0%, #dff8ff 36%, #f8fbff 58%, #e7efff 100%)",
  bookingPageManagement: "linear-gradient(135deg, #eef4ff 0%, #d9fbff 34%, #f9fcff 58%, #e8f0ff 100%)",
  bookingLink: "linear-gradient(135deg, #eaf4ff 0%, #ddf7ff 38%, #fbfdff 60%, #eaf1ff 100%)",
  calendarRecords: "linear-gradient(135deg, #eef6ff 0%, #dffaff 34%, #f8fbff 56%, #e6efff 100%)",
  customers: "linear-gradient(135deg, #eaf6ff 0%, #dcf8ff 36%, #fbfdff 60%, #edf1ff 100%)",
  services: "linear-gradient(135deg, #edf3ff 0%, #def7ff 35%, #f9fcff 58%, #e8f2ff 100%)",
  staff: "linear-gradient(135deg, #eaf4ff 0%, #e2f9ff 34%, #fbfdff 58%, #e8efff 100%)",
  ownerProfile: "linear-gradient(135deg, #eef5ff 0%, #dcf8ff 38%, #f8fbff 60%, #e7f0ff 100%)",
  shopInfo: "linear-gradient(135deg, #eaf3ff 0%, #e0faff 34%, #fbfdff 58%, #e8f0ff 100%)",
  operatingHours: "linear-gradient(135deg, #eaf2ff 0%, #dff7ff 36%, #f9fcff 60%, #edf1ff 100%)",
  benefits: "linear-gradient(135deg, #eaf4ff 0%, #daf8ff 36%, #fbfdff 58%, #e6f0ff 100%)",
  alerts: "linear-gradient(135deg, #edf4ff 0%, #e0f8ff 34%, #f8fbff 58%, #e9efff 100%)",
  help: "linear-gradient(135deg, #eef6ff 0%, #def9ff 36%, #fbfdff 60%, #e8f1ff 100%)",
};

function PhosphorSidebarIcon({ screen, active }: { screen: OwnerWebNavigationKey; active: boolean }) {
  return (
    <span
      className={cn("block h-[18px] w-[18px] shrink-0 transition-colors", active ? "bg-white" : "bg-[#9aa3af]")}
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

function formatAlimtalkCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR");
}

function getAlimtalkIncludedProgress(summary: BootstrapPayload["alimtalkCreditSummary"]) {
  const total = typeof summary?.included_total === "number" && Number.isFinite(summary.included_total)
    ? Math.max(0, summary.included_total)
    : 0;
  const remaining = typeof summary?.included_remaining === "number" && Number.isFinite(summary.included_remaining)
    ? Math.max(0, summary.included_remaining)
    : 0;

  if (total <= 0) {
    return {
      total,
      remaining,
      percent: 0,
    };
  }

  return {
    total,
    remaining: Math.min(remaining, total),
    percent: Math.max(0, Math.min(100, (remaining / total) * 100)),
  };
}

function AlimtalkCreditMenu({
  summary,
  open,
  onToggle,
  containerRef,
}: {
  summary: BootstrapPayload["alimtalkCreditSummary"];
  open: boolean;
  onToggle: () => void;
  containerRef?: RefObject<HTMLDivElement | null>;
}) {
  const includedRemaining = formatAlimtalkCount(summary?.included_remaining);
  const includedTotal = formatAlimtalkCount(summary?.included_total);
  const purchasedRemaining = formatAlimtalkCount(summary?.purchased_remaining);
  const totalRemaining = formatAlimtalkCount(summary?.remaining_total);
  const includedProgress = getAlimtalkIncludedProgress(summary);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-[#dbe6f2] bg-white px-3 text-[13px] font-semibold text-[#334155] transition hover:border-[var(--pm-brand-blue-border)] hover:bg-[#f8fbff]"
        aria-label="알림톡"
        title="알림톡"
      >
        <span>알림톡</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-[#94a3b8] transition-transform", open && "rotate-180")} strokeWidth={1.8} />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-[80] w-[260px] rounded-[10px] border border-[var(--bd)] bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.13)]">
          <div className="border-b border-[var(--line)] pb-2.5">
            <p className="text-[13px] font-semibold text-[var(--ink)]">알림톡 잔여 건수</p>
            <p className="mt-1 text-[12px] font-medium text-[var(--mut)]">무료 제공분을 먼저 사용하고, 부족하면 유료 충전분을 사용합니다.</p>
          </div>
          <div className="mt-3 space-y-3">
            <div className="rounded-[9px] border border-[#dbeafe] bg-[#f8fbff] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#334155]">무료 잔여</span>
                <span className="text-[13px] font-bold tabular-nums text-[var(--pm-brand-blue)]">
                  {includedRemaining}/{includedTotal}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
                <div
                  className="h-full rounded-full bg-[#2563eb] transition-[width]"
                  style={{ width: `${includedProgress.percent}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-[var(--mid)]">결제 잔여</span>
              <span className="text-[15px] font-semibold text-[var(--ink)]">
                {purchasedRemaining}건
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2">
              <span className="text-[13px] font-semibold text-[var(--ink2)]">전체 잔여</span>
              <span className="text-[15px] font-semibold text-[var(--pm-brand-blue)]">{totalRemaining}건</span>
            </div>
          </div>
          <p className="mt-3 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[12px] font-medium leading-5 text-[#64748b]">
            무료 제공분은 다음 결제 주기에 초기화되고, 유료 충전분은 사용 전까지 이월됩니다.
          </p>
          <Link
            href={{ pathname: "/owner/alimtalk-credits" }}
            prefetch
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-[9px] border border-[#cbd5e1] bg-white text-[13px] font-semibold text-[#334155] transition hover:border-[#94a3b8] hover:bg-[#f8fafc]"
          >
            알림톡 충전하기
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function OwnerWebAppShell({
  activeScreen,
  onScreenSelect,
  shopDisplayName,
  shopInitials,
  currentPlanLabel,
  currentPlanMeta,
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
  onLogout,
  loggingOut,
  children,
}: {
  activeScreen: OwnerWebScreenKey;
  onScreenSelect: (screen: OwnerWebScreenKey) => void;
  shopDisplayName: string;
  shopInitials: string;
  currentPlanLabel: string;
  currentPlanMeta: string;
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
  onLogout: () => void;
  loggingOut: boolean;
  children: ReactNode;
}) {
  const screenGradientStyle = {
    "--pm-owner-screen-gradient": ownerWebScreenGradients[activeScreen],
  } as CSSProperties;
  const alimtalkRemainingTotal =
    typeof alimtalkCreditSummary?.remaining_total === "number" ? alimtalkCreditSummary.remaining_total : null;
  const alimtalkCreditsExhausted = alimtalkRemainingTotal !== null && alimtalkRemainingTotal <= 0;

  return (
    <div className="owner-font pm-owner-web flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <aside className="pm-owner-sidebar hidden h-screen w-[236px] shrink-0 flex-col border-r border-[var(--nav-bd)] bg-[var(--nav-bg)] lg:flex">
        <div className="flex items-center pb-4 pl-[34px] pr-5 pt-[22px]">
          <Image src="/icons/logo/넘친 Day.svg" alt="넘친 Day" width={142} height={48} className="h-[30px] w-auto shrink-0 object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto px-5 pb-4 pt-1">
          <div className="space-y-5">
            {ownerWebSidebarGroups.map((group, groupIndex) => (
              <div key={group.label} className={cn(groupIndex > 0 && "border-t border-dashed border-[#e1e5ec] pt-5")}>
                <p className="mb-2.5 px-1 text-[13px] font-medium tracking-[0.01em] text-[#8f98a6]">
                  {group.label}
                </p>
                <div className="space-y-1.5">
                  {group.items.filter((item) => item.key !== "billing").map((screen) => {
                    const active = activeScreen === screen.key;
                    const itemClassName = cn(
                      "relative flex h-[40px] w-full items-center gap-3 rounded-[10px] px-3.5 text-left text-[15px] font-medium text-[#273142] transition hover:bg-[#eef2f7] hover:text-[#111827]",
                      active &&
                        "bg-[#316fe8] font-semibold text-white shadow-[0_10px_22px_rgba(49,111,232,0.20)] hover:bg-[#316fe8] hover:text-white",
                    );
                    if (screen.href) {
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
            className="group block rounded-[13px] border border-[#dbe2ea] bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-[#b8c6d8] hover:shadow-[0_12px_24px_rgba(49,111,232,0.10)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[#273142]">{currentPlanLabel}</p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[#8b95a3]">{currentPlanMeta}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#edf4ff] px-2.5 py-1 text-[12px] font-bold text-[#316fe8] transition group-hover:bg-[#316fe8] group-hover:text-white">
                플랜 확인
              </span>
            </div>
          </Link>
          <div className="hidden rounded-[12px] border border-[var(--nav-bd)] bg-white/55 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--nav-ink)]">{currentPlanLabel}</p>
                <p className="mt-1 text-[12px] font-medium text-[var(--nav-mut)]">{currentPlanMeta}</p>
              </div>
              <Link href="/owner/billing?compare=1" prefetch className="text-[13px] font-bold text-[var(--acc)]">
                플랜 확인
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-[60px] shrink-0 items-center gap-4 border-b border-[var(--line2)] bg-[var(--card)] px-[22px] lg:flex">
          <label className="flex h-[38px] w-[300px] items-center gap-2 rounded-[10px] border border-transparent bg-[#eef1f5] px-3 text-[14px] text-[var(--mid)] transition focus-within:border-[var(--acc)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--acc-tint)]">
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <input className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--mut)]" placeholder="검색" />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenHelp}
              className="inline-flex h-[38px] items-center justify-center rounded-[10px] px-3 text-[13px] font-semibold text-[var(--mid)] transition hover:bg-[#eef1f5] hover:text-[var(--ink)]"
            >
              1:1 문의
            </button>
            <AlimtalkCreditMenu
              summary={alimtalkCreditSummary}
              open={alimtalkCreditMenuOpen}
              containerRef={alimtalkCreditMenuRef}
              onToggle={onAlimtalkCreditToggle}
            />
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

        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--line2)] bg-[var(--card)] px-5 lg:hidden">
          <Image src="/icons/logo/넘친 Day.svg" alt="넘친 Day" width={142} height={48} className="h-8 w-auto shrink-0 object-contain" />
          <SoftSelect<OwnerWebScreenKey>
            value={activeScreen}
            onChange={onScreenSelect}
            options={ownerWebNavigationItems.map((screen) => ({ value: screen.key, label: screen.label }))}
            align="right"
            className="max-w-[180px]"
            buttonClassName="h-10"
          />
        </header>

        {alimtalkCreditsExhausted ? (
          <div className="shrink-0 border-b border-[#f3d7aa] bg-[#fff8ec] px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#8a4f08]">알림톡 잔여 건수가 모두 소진되었습니다</p>
                <p className="mt-0.5 text-[13px] font-medium text-[#9a5d12]">
                  고객 예약 안내와 미용 상태 알림톡을 더 보낼 수 없습니다. 유료 충전 또는 상위 플랜을 확인해 주세요.
                </p>
              </div>
              <Link
                href={{ pathname: "/owner/alimtalk-credits" }}
                prefetch
                className="inline-flex h-9 shrink-0 items-center rounded-[9px] bg-[#b98121] px-3 text-[13px] font-semibold text-white transition hover:bg-[#9a681a]"
              >
                알림톡 충전하기
              </Link>
            </div>
          </div>
        ) : null}

        <section className="min-h-0 flex-1 overflow-hidden bg-[image:var(--pm-owner-screen-gradient)] p-5" style={screenGradientStyle}>
          <div className="h-full min-w-0 overflow-hidden rounded-[18px] border border-white/75 bg-white/90 shadow-[0_18px_44px_rgba(37,99,235,0.10)] backdrop-blur-sm">
            <div className="h-full min-h-0 overflow-hidden overscroll-contain p-5">
              {children}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
