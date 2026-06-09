import type { BusinessHours, Shop } from "@/types/domain";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

type BusinessHoursEntry = {
  open: string;
  close: string;
  enabled: boolean;
};

const defaultBusinessHours: Record<number, BusinessHoursEntry> = {
  0: { open: "10:00", close: "19:00", enabled: false },
  1: { open: "10:00", close: "19:00", enabled: true },
  2: { open: "10:00", close: "19:00", enabled: true },
  3: { open: "10:00", close: "19:00", enabled: true },
  4: { open: "10:00", close: "19:00", enabled: true },
  5: { open: "10:00", close: "19:00", enabled: true },
  6: { open: "10:00", close: "19:00", enabled: true },
};

function normalizeClock(value: string | null | undefined, fallback: string) {
  const text = (value ?? "").slice(0, 5);
  return timePattern.test(text) ? text : fallback;
}

export function isValidBusinessHoursRange(open: string, close: string) {
  return timePattern.test(open) && timePattern.test(close) && open < close;
}

export function normalizeBusinessHoursEntry(hours: BusinessHours[number], weekday: number): BusinessHoursEntry {
  const fallback = defaultBusinessHours[weekday] ?? defaultBusinessHours[1];
  const enabled = typeof hours?.enabled === "boolean" ? hours.enabled : fallback.enabled;
  const open = normalizeClock(hours?.open, fallback.open);
  const close = normalizeClock(hours?.close, fallback.close);

  if (enabled && !isValidBusinessHoursRange(open, close)) {
    return { ...fallback, enabled };
  }

  return { open, close, enabled };
}

export function normalizeBusinessHours(hours: BusinessHours | null | undefined): BusinessHours {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, weekday) => [weekday, normalizeBusinessHoursEntry(hours?.[weekday], weekday)]),
  ) as BusinessHours;
}

export function getBusinessHoursForWeekday(shop: Pick<Shop, "business_hours">, weekday: number) {
  return normalizeBusinessHoursEntry(shop.business_hours?.[weekday], weekday);
}
