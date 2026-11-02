const calendarTimeRailTone = {
  background: "#ffffff",
  border: "#d9e0e8",
  text: "#64748b",
  mutedText: "#64748b",
  current: "#3b6fd8",
  currentBackground: "#eff6ff",
};

export function CalendarTimeRailHeader() {
  return (
    <div
      className="flex h-[64px] w-[68px] shrink-0 items-center justify-center border-r border-[#e1e9f5] text-[12px] font-medium leading-[18px] text-[#64748b]"
      style={{ backgroundColor: "#ffffff" }}
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
}: {
  hours: number[];
  height: number;
  getLabelTop: (hour: number) => number;
  formatHourLabel: (hour: number) => string;
  showCurrentTime: boolean;
  currentTimeTop: number;
  currentHour: number;
}) {
  return (
    <aside
      className="w-[68px] shrink-0 border border-l-0 border-t-0"
      style={{ backgroundColor: calendarTimeRailTone.background, borderColor: calendarTimeRailTone.border }}
      aria-label="시간 레일"
    >
      <div className="relative" style={{ height }}>
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 z-10 flex items-center justify-center text-[14px] font-medium leading-5 tabular-nums"
            style={{ top: getLabelTop(hour), transform: "translateY(-50%)" }}
          >
            <span className="px-1" style={{ backgroundColor: calendarTimeRailTone.background, color: calendarTimeRailTone.mutedText }}>
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
              className="rounded px-1.5 py-0.5 text-[14px] font-medium leading-5 tabular-nums"
              style={{ backgroundColor: calendarTimeRailTone.currentBackground, color: calendarTimeRailTone.current }}
            >
              {formatHourLabel(currentHour)}
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
