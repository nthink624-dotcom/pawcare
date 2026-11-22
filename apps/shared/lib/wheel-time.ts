export type WheelTimeValue = Record<string, string>;

/** Clock values stay HH:mm in API payloads. Twelve AM is midnight; twelve PM is noon. */
export function parseClock(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function clockToWheel(value: string): WheelTimeValue {
  const total = parseClock(value) ?? 9 * 60;
  const hour = Math.floor(total / 60);
  return { period: hour < 12 ? "am" : "pm", hour: String(hour % 12 || 12), minute: String(total % 60) };
}

export function wheelToClock(value: WheelTimeValue): string {
  const hour = Number(value.hour);
  const minute = Number(value.minute);
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59 || !["am", "pm"].includes(value.period)) return "";
  return `${String(hour % 12 + (value.period === "pm" ? 12 : 0)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatWheelTime(value: string): string {
  if (parseClock(value) === null) return "시간 선택";
  const time = clockToWheel(value);
  return `${time.period === "am" ? "오전" : "오후"} ${time.hour}:${time.minute.padStart(2, "0")}`;
}

export function availableClockTimes({ allowedTimes, min, max, step = 60 }: {
  allowedTimes?: readonly string[]; min?: string; max?: string; step?: number | "any";
}): string[] {
  const lower = min ? parseClock(min) : null;
  const upper = max ? parseClock(max) : null;
  const seconds = step === "any" || !(Number(step) > 0) ? 60 : Number(step);
  return [...new Set(allowedTimes ?? Array.from({ length: 1440 }, (_, index) => `${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`))]
    .filter((value) => {
      const total = parseClock(value);
      if (total === null) return false;
      const inRange = lower !== null && upper !== null && lower > upper
        ? total >= lower || total <= upper
        : (lower === null || total >= lower) && (upper === null || total <= upper);
      return inRange && (allowedTimes !== undefined || ((total - (lower ?? 0)) * 60) % seconds === 0);
    }).sort();
}

/** Prefer the requested period/hour before choosing the closest available minute. */
export function constrainWheelTime(value: WheelTimeValue, times: readonly string[]): WheelTimeValue {
  if (!times.length) return value;
  const samePeriod = times.filter((time) => clockToWheel(time).period === value.period);
  const sameHour = samePeriod.filter((time) => clockToWheel(time).hour === value.hour);
  const choices = sameHour.length ? sameHour : samePeriod.length ? samePeriod : times;
  const target = parseClock(wheelToClock(value)) ?? 9 * 60;
  const nearest = choices.reduce((best, time) => Math.abs(parseClock(time)! - target) < Math.abs(parseClock(best)! - target) ? time : best);
  return clockToWheel(nearest);
}
