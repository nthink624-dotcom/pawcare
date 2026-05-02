"use client";

import { useState } from "react";
import { BarChart3, CalendarDays, LayoutGrid, PawPrint, Settings, Users } from "lucide-react";

import { ownerWebScreenLabels, type OwnerWebScreenKey } from "@/components/owner-web/owner-web-data";
import CalendarManagementScreen from "@/components/owner-web/calendar-management-screen";
import CustomerManagementScreen from "@/components/owner-web/customer-management-screen";
import ReservationManagementScreen from "@/components/owner-web/reservation-management-screen";
import SettingsManagementScreen from "@/components/owner-web/settings-management-screen";
import StatsManagementScreen from "@/components/owner-web/stats-management-screen";
import { cn } from "@/lib/utils";

const screenIcons: Record<OwnerWebScreenKey, typeof LayoutGrid> = {
  reservations: LayoutGrid,
  customers: Users,
  calendar: CalendarDays,
  stats: BarChart3,
  settings: Settings,
};

function renderScreen(screen: OwnerWebScreenKey) {
  switch (screen) {
    case "reservations":
      return <ReservationManagementScreen />;
    case "customers":
      return <CustomerManagementScreen />;
    case "calendar":
      return <CalendarManagementScreen />;
    case "stats":
      return <StatsManagementScreen />;
    case "settings":
      return <SettingsManagementScreen />;
    default:
      return null;
  }
}

export default function OwnerWebPreview() {
  const [activeScreen, setActiveScreen] = useState<OwnerWebScreenKey>("reservations");

  return (
    <div className="min-h-screen bg-[#f5f1eb]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-6 py-6">
        <aside className="hidden w-[280px] shrink-0 xl:flex">
          <div className="sticky top-6 flex w-full flex-col rounded-[28px] border border-[#e7ddd4] bg-[#1f6b5b] p-5 text-white shadow-[0_18px_40px_rgba(31,107,91,0.18)]">
            <div className="rounded-[22px] bg-white/10 p-4">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-white/70">PETMANAGER WEB</p>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.05em]">우유 미용실</h1>
              <p className="mt-3 text-[14px] leading-6 text-white/78">모바일 오너 페이지를 기반으로, 예약·고객·캘린더·통계·설정을 웹 운영 화면으로 확장한 프리뷰입니다.</p>
            </div>

            <div className="mt-6 space-y-2">
              {ownerWebScreenLabels.map((screen) => {
                const Icon = screenIcons[screen.key];
                const active = activeScreen === screen.key;
                return (
                  <button
                    key={screen.key}
                    type="button"
                    onClick={() => setActiveScreen(screen.key)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[20px] px-4 py-4 text-left transition",
                      active ? "bg-white text-[#1f6b5b]" : "bg-transparent text-white/85 hover:bg-white/10",
                    )}
                  >
                    <span className={cn("mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-[14px]", active ? "bg-[#e9f5f1]" : "bg-white/10")}>
                      <Icon className={cn("h-4.5 w-4.5", active ? "text-[#1f6b5b]" : "text-white")} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold tracking-[-0.02em]">{screen.label}</span>
                      <span className={cn("mt-1 block text-[12px] leading-5", active ? "text-[#6d7f79]" : "text-white/66")}>{screen.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-[22px] border border-white/14 bg-white/8 p-4">
              <p className="text-[13px] font-medium text-white/84">웹 화면 메모</p>
              <p className="mt-2 text-[12px] leading-6 text-white/64">테이블, 우측 상세 패널, 다중 선택, 필터 도구를 한 화면에 올리는 방향으로 구성했습니다.</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between gap-4 rounded-[24px] border border-[#e9e0d8] bg-white px-5 py-4 shadow-[0_12px_30px_rgba(34,30,24,0.05)] xl:hidden">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#e9f5f1]">
                <PawPrint className="h-5 w-5 text-[#1f6b5b]" />
              </span>
              <div>
                <p className="text-[12px] font-medium text-[#8a8178]">PETMANAGER WEB</p>
                <p className="text-[20px] font-semibold tracking-[-0.04em] text-[#17211f]">우유 미용실</p>
              </div>
            </div>
            <select
              value={activeScreen}
              onChange={(event) => setActiveScreen(event.target.value as OwnerWebScreenKey)}
              className="h-[42px] rounded-[14px] border border-[#e6ddd6] bg-[#fbfaf8] px-4 text-[14px] font-medium text-[#263430]"
            >
              {ownerWebScreenLabels.map((screen) => (
                <option key={screen.key} value={screen.key}>
                  {screen.label}
                </option>
              ))}
            </select>
          </div>

          {renderScreen(activeScreen)}
        </main>
      </div>
    </div>
  );
}
