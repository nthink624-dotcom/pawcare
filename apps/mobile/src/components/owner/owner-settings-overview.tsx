"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import type { RefObject } from "react";

export type OwnerSettingsOverviewItem = Readonly<{
  key: string;
  icon: LucideIcon;
  title: string;
  badge?: string;
  disabled?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  testerEmphasis?: boolean;
  onClick: () => void;
}>;

export type OwnerSettingsOverviewGroup = Readonly<{
  title: string;
  items: readonly OwnerSettingsOverviewItem[];
}>;

export default function OwnerSettingsOverview({
  plan,
  groups,
}: {
  plan?: Readonly<{ name: string; endDate: string }>;
  groups: readonly OwnerSettingsOverviewGroup[];
}) {
  return (
    <section className="min-h-full bg-[#f6f9fc] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
      {plan ? (
        <div className="flex min-h-[76px] items-center justify-between gap-4 rounded-[14px] border border-[#dfe5ec] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-normal leading-5 text-[#64748b]">현재 플랜</p>
            <p className="truncate text-[16px] font-medium leading-6 text-[#0f172a]">{plan.name}</p>
          </div>
          <div className="max-w-[132px] shrink-0 text-right">
            <p className="text-[13px] font-normal leading-5 text-[#64748b]">서비스 종료일</p>
            <p className="tabular-nums text-[14px] font-medium leading-5 text-[#334155]">{plan.endDate}</p>
          </div>
        </div>
      ) : null}

      <div className={plan ? "mt-6 space-y-6" : "space-y-6"}>
        {groups.map((group, groupIndex) => (
          <section key={group.title} aria-labelledby={`settings-group-${groupIndex}`}>
            <h2
              id={`settings-group-${groupIndex}`}
              className="mb-2 px-1 text-[14px] font-semibold leading-5 text-[#334155]"
            >
              {group.title}
            </h2>
            <div className="divide-y divide-[#e7ebf0] overflow-hidden rounded-[14px] border border-[#dfe5ec] bg-white">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    ref={item.triggerRef}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`relative flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb] ${
                      item.testerEmphasis ? "bg-[#fffaf1] before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-[#b98121]" : ""
                    }`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${item.testerEmphasis ? "bg-[#fff3dc] text-[#8c6e53]" : "bg-[#f1f5f9] text-[#334155]"}`}>
                      <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium leading-6 text-[#0f172a]">{item.title}</span>
                    </span>
                    {item.badge ? <span className="shrink-0 text-[12px] font-medium leading-[18px] text-[#64748b]">{item.badge}</span> : null}
                    <ChevronRight className="size-4 shrink-0 text-[#94a3b8]" strokeWidth={1.9} aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
