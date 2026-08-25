"use client";

import { useState, type CSSProperties } from "react";

import { getStaffChipTone } from "@/lib/staff-chip-colors";
import { cn } from "@/lib/utils";

export function CalendarStaffLaneHeader({
  name,
  staffKey,
  chipColorIndex,
  profileImageUrl,
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
  startLabel?: string;
  endLabel?: string;
  bookingCount: number;
  selected: boolean;
  flexBasis: string;
  onSelect: () => void;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const staffTone = getStaffChipTone(staffKey, chipColorIndex);
  const selectedStyle = selected
    ? {
        backgroundColor: staffTone.background,
        "--staff-selected-color": staffTone.selectedBackground,
      }
    : {};

  return (
    <section
      onClick={onSelect}
      className={cn(
        "relative h-[68px] min-w-[160px] cursor-pointer border border-l-0 border-t-0 border-[#edf1f5] bg-white px-4 py-2 transition hover:bg-[#f8fbff]",
        selected && "after:absolute after:inset-x-4 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[var(--staff-selected-color)]",
      )}
      style={{ flex: flexBasis, ...selectedStyle } as CSSProperties}
    >
      <div className="flex h-full min-w-0 items-center gap-3">
        <div
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#eef3f8] text-[14px] font-semibold text-[#52657a] shadow-[0_4px_12px_rgba(15,23,42,0.1)] ring-1 ring-[#dce5ef]",
            selected && "ring-2",
          )}
          style={selected ? { boxShadow: `0 0 0 2px ${staffTone.border}, 0 4px 12px rgba(15,23,42,0.1)` } : undefined}
        >
          <span aria-hidden="true">{name.slice(0, 1)}</span>
          {profileImageUrl && profileImageUrl !== failedImageUrl ? (
            <img
              src={profileImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setFailedImageUrl(profileImageUrl)}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-[15px] font-semibold leading-5 text-[#334155]" style={selected ? { color: staffTone.text } : undefined}>{name}</p>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: selected ? staffTone.selectedBackground : "#1f9d55" }} aria-label="근무 중" />
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] font-medium leading-4 text-[#64748b]" style={selected ? { color: staffTone.mutedText } : undefined}>
            {startLabel && endLabel ? <span className="truncate">{startLabel}–{endLabel}</span> : null}
            <span className="h-3 w-px shrink-0 bg-[#dbe3ec]" aria-hidden="true" />
            <span className="shrink-0 text-[#475569]" style={selected ? { color: staffTone.text } : undefined}>예약 {bookingCount}건</span>
          </div>
        </div>
      </div>
    </section>
  );
}
