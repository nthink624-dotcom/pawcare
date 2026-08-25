import type { CSSProperties } from "react";

import type { StaffChipTone } from "@/lib/staff-chip-colors";

export function CalendarTimeRailHeader({ tone }: { tone: StaffChipTone }) {
  return (
    <div
      className="flex h-[68px] w-[68px] shrink-0 items-center justify-center border-r text-[11px] font-semibold tracking-[0.08em]"
      style={{ backgroundColor: tone.background, borderColor: tone.border, color: tone.text }}
    >
      시간
    </div>
  );
}

export function CalendarTimeRail({
  hours,
  height,
  getLabelTop,
  formatHourLabel,
  showCurrentTime,
  currentTimeTop,
  currentHour,
  tone,
}: {
  hours: number[];
  height: number;
  getLabelTop: (hour: number) => number;
  formatHourLabel: (hour: number) => string;
  showCurrentTime: boolean;
  currentTimeTop: number;
  currentHour: number;
  tone: StaffChipTone;
}) {
  return (
    <aside
      className="w-[68px] shrink-0 border border-l-0 border-t-0"
      style={{ backgroundColor: tone.background, borderColor: tone.border }}
      aria-label="시간 레일"
    >
      <div className="relative" style={{ height }}>
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 z-10 flex items-center justify-center text-[11px] font-medium leading-none"
            style={{ top: getLabelTop(hour), transform: "translateY(-50%)" }}
          >
            <span className="px-1" style={{ backgroundColor: tone.background, color: tone.mutedText }}>
              {formatHourLabel(hour)}
            </span>
          </div>
        ))}
        {showCurrentTime ? (
          <div
            className="absolute inset-x-0 z-30 flex items-center justify-center"
            style={{ top: Math.max(11, Math.min(currentTimeTop, height - 11)), transform: "translateY(-50%)" }}
            aria-label={`현재 시간 ${formatHourLabel(currentHour)}`}
          >
            <span
              className="rounded-full px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-[0_3px_10px_rgba(15,23,42,0.16)] ring-2"
              style={{ backgroundColor: tone.selectedBackground, "--tw-ring-color": tone.background } as CSSProperties}
            >
              {formatHourLabel(currentHour)}
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
