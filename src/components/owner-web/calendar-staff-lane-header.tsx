"use client";

import type { CSSProperties } from "react";

import { StableAvatar } from "@/components/owner-web/stable-avatar";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";

export function CalendarStaffLaneHeader({
  name,
  staffKey,
  chipColorIndex,
  profileImageUrl,
  profileImageAssetId,
  startLabel,
  endLabel,
  bookingCount,
  selected,
  flexBasis,
  onSelect,
}: {
  name: string;
  staffKey: string;
  chipColorIndex?: number | null;
  profileImageUrl?: string | null;
  profileImageAssetId?: string | null;
  startLabel?: string;
  endLabel?: string;
  bookingCount: number;
  selected: boolean;
  flexBasis: string;
  onSelect: () => void;
}) {
  const headerTone = getStaffChipTone(staffKey, chipColorIndex);
  const headerStyle = {
    backgroundColor: headerTone.background,
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-schedule-staff-header={staffKey}
      data-schedule-staff-selected={selected ? "true" : "false"}
      className={cn(
        "relative h-[68px] min-w-[160px] cursor-pointer border border-l-0 border-t-0 border-[#e8edf3] px-4 py-2 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]",
        selected && "z-10",
      )}
      style={{ flex: flexBasis, ...headerStyle } as CSSProperties}
    >
      <span
        aria-hidden="true"
        data-schedule-staff-header-accent="true"
        className="pointer-events-none absolute bottom-px left-[7%] h-[2px] w-[86%] rounded-full"
        style={{ backgroundColor: headerTone.selectedBackground }}
      />
      <div className="flex h-full min-w-0 items-center gap-3">
        <StableAvatar
          identity={staffKey}
          name={name}
          imageUrl={profileImageUrl}
          imageAssetId={profileImageAssetId}
          size="md"
          className="border-[#e8edf3] bg-[#f8fafc] text-[#52657a]"
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-[15px] font-semibold leading-5 text-[#334155]">{name}</p>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] font-medium leading-5 text-[#64748b] tabular-nums">
            {startLabel && endLabel ? <span className="truncate">{startLabel}–{endLabel}</span> : null}
            <span className="h-3 w-px shrink-0 bg-[#e8edf3]" aria-hidden="true" />
            <span className="shrink-0 text-[#475569]">예약 {bookingCount}건</span>
          </div>
        </div>
      </div>
    </button>
  );
}
