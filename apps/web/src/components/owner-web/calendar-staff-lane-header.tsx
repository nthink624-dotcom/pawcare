"use client";

import { Check, Clock3 } from "lucide-react";
import type { CSSProperties } from "react";

import { StableAvatar } from "@/components/owner-web/stable-avatar";
import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";

export function CalendarStaffLaneHeader({
  name,
  staffKey,
  avatarIdentity,
  chipColorIndex,
  profileImageUrl,
  profileImageUrls,
  profileImageAssetId,
  profileImageAssetIds,
  profileImageFallbackKey,
  startLabel,
  endLabel,
  bookingCount,
  selected,
  flexBasis,
  onSelect,
}: {
  name: string;
  staffKey: string;
  avatarIdentity: string;
  chipColorIndex?: number | null;
  profileImageUrl?: string | null;
  profileImageUrls?: string[] | null;
  profileImageAssetId?: string | null;
  profileImageAssetIds?: string[] | null;
  profileImageFallbackKey?: "korean-groomer-profile-01" | "korean-groomer-profile-02" | null;
  startLabel?: string;
  endLabel?: string;
  bookingCount: number;
  selected: boolean;
  flexBasis: string;
  onSelect: () => void;
}) {
  const headerTone = getStaffChipTone(staffKey, chipColorIndex);
  const selectedHeaderBackground = `color-mix(in srgb, ${headerTone.background} 84%, ${headerTone.selectedBackground})`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-schedule-staff-header={staffKey}
      data-schedule-staff-selected={selected ? "true" : "false"}
      className={cn(
        "relative @container/staff-header after:pointer-events-none after:absolute after:inset-y-3 after:right-0 after:w-px after:bg-[#cbd5e1]/70 after:content-[''] last:after:hidden h-[64px] min-w-[240px] cursor-pointer rounded-none bg-[var(--pm-staff-header-background)] px-3 py-1 text-left transition-colors hover:bg-[var(--pm-staff-header-hover)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]",
        selected && "z-10",
      )}
      style={{
        flex: flexBasis,
        "--pm-staff-header-background": selected ? selectedHeaderBackground : headerTone.background,
        "--pm-staff-header-hover": selected ? selectedHeaderBackground : `color-mix(in srgb, ${headerTone.background} 90%, ${headerTone.selectedBackground})`,
      } as CSSProperties}
    >
      <div className="flex h-full min-w-0 items-center gap-2.5">
        <span
          data-schedule-staff-header-accent="true"
          className="relative shrink-0 rounded-[18px] border-2 p-px"
          style={{ backgroundColor: headerTone.background, borderColor: headerTone.selectedBackground }}
        >
          <StableAvatar
            identity={avatarIdentity}
            name={name}
            imageUrl={profileImageUrl}
            imageUrls={profileImageUrls}
            imageAssetId={profileImageAssetId}
            imageAssetIds={profileImageAssetIds}
            profileImageFallbackKey={profileImageFallbackKey}
            size="sm"
            className="h-12 w-12 rounded-[18px] border-white bg-[#f8fbff] text-[#52657a]"
          />
          {selected ? (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#e2edff] bg-[#2563eb]">
              <Check aria-hidden="true" className="h-3 w-3 text-white" strokeWidth={2} />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium leading-6 text-[#203654]" title={name}>{name}</p>
          {startLabel && endLabel ? (
            <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[14px] font-normal leading-5 text-[#334155] tabular-nums">
              <Clock3 aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 @[320px]/staff-header:block" strokeWidth={1.5} />
              <span>{startLabel}–{endLabel}</span>
            </p>
          ) : null}
        </div>
        <div className="shrink-0 pl-1 text-right">
          <p className="text-[12px] font-normal leading-[18px] text-[#334155]">예약</p>
          <p className="mt-0.5 flex items-baseline justify-end gap-0.5 text-black">
            <span className="text-[20px] font-medium leading-6 tracking-[-0.025em] tabular-nums">{bookingCount}</span>
            <span className="text-[12px] font-normal leading-[18px]">건</span>
          </p>
        </div>
      </div>
    </button>
  );
}
