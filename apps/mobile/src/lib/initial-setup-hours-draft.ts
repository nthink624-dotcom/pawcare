import type { BusinessHours, RegularClosedCycle } from "@/types/domain";

export type HoursDraft = { hours: BusinessHours; bookingStart: string; bookingEnd: string; regularClosedDays: number[]; cycle?: RegularClosedCycle; anchor?: string; temporaryClosedDates?: string[]; temporaryClosedDatesBaseline?: string[] };
const TTL = 24 * 60 * 60 * 1000;
const storageKey = (key: string) => `${key}:hours-draft`;

export function readHoursDraft(key: string): HoursDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const value = JSON.parse(raw);
    const time = (v: unknown) => typeof v === "string" && (v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > TTL || value.savedAt > Date.now() ||
      !value.hours || typeof value.hours !== "object" || Array.isArray(value.hours) ||
      !Object.entries(value.hours).every(([day, item]) => {
        const v = item as { enabled?: unknown; open?: unknown; close?: unknown } | null;
        return /^[0-6]$/.test(day) && v && typeof v.enabled === "boolean" && time(v.open) && time(v.close);
      }) || !time(value.bookingStart) || !time(value.bookingEnd) ||
      (value.cycle !== undefined && !["weekly", "biweekly", "monthly_1_3", "monthly_2_4"].includes(value.cycle)) ||
      (value.anchor !== undefined && (typeof value.anchor !== "string" || (value.anchor !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value.anchor)))) ||
      ([value.temporaryClosedDates, value.temporaryClosedDatesBaseline].some((dates) => dates !== undefined && (!Array.isArray(dates) || dates.length > 730 || !dates.every((date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date)))) ||
      !Array.isArray(value.regularClosedDays) || !value.regularClosedDays.every((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)) {
      window.localStorage.removeItem(storageKey(key)); return null;
    }
    return { hours: value.hours, bookingStart: value.bookingStart, bookingEnd: value.bookingEnd, regularClosedDays: value.regularClosedDays, ...(value.cycle !== undefined ? { cycle: value.cycle } : {}), ...(value.anchor !== undefined ? { anchor: value.anchor } : {}), ...(value.temporaryClosedDates !== undefined ? { temporaryClosedDates: value.temporaryClosedDates } : {}), ...(value.temporaryClosedDatesBaseline !== undefined ? { temporaryClosedDatesBaseline: value.temporaryClosedDatesBaseline } : {}) };
  } catch { return null; }
}

export function saveHoursDraft(key: string, value: HoursDraft) {
  const serialized = JSON.stringify({ hours: value.hours, bookingStart: value.bookingStart, bookingEnd: value.bookingEnd, regularClosedDays: value.regularClosedDays, cycle: value.cycle, anchor: value.anchor, temporaryClosedDates: value.temporaryClosedDates, temporaryClosedDatesBaseline: value.temporaryClosedDatesBaseline, savedAt: Date.now() });
  window.localStorage.setItem(storageKey(key), serialized);
  if (window.localStorage.getItem(storageKey(key)) !== serialized) throw new Error("Draft readback failed");
}

export function clearHoursDraft(key: string) {
  try { window.localStorage.removeItem(storageKey(key)); } catch { /* Do not turn a successful server save into a failure. */ }
}
