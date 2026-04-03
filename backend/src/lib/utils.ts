import { clsx, type ClassValue } from "clsx";
import { addDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function decodeUnicodeEscapes(value: string | null | undefined) {
  if (!value) return "";

  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n/g, "\n");
}

export function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function wonFrom(value: number) {
  return `${value.toLocaleString("ko-KR")}원 ~`;
}

export function formatPrice(value: number, priceType: "fixed" | "starting" = "starting") {
  return priceType === "fixed" ? won(value) : wonFrom(value);
}

export function formatServicePrice(value: number, priceType: "fixed" | "starting" = "starting") {
  return formatPrice(value, priceType);
}

export function shortDate(date: string) {
  return format(parseISO(`${date}T00:00:00`), "M/d(EEE)", { locale: ko });
}

export function addDate(date: string, days: number) {
  return format(addDays(parseISO(`${date}T00:00:00`), days), "yyyy-MM-dd");
}

export function minutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function currentDateInTimeZone(timeZone = "Asia/Seoul") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentTimeInTimeZone(timeZone = "Asia/Seoul") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function currentMinutesInTimeZone(timeZone = "Asia/Seoul") {
  return minutesFromTime(currentTimeInTimeZone(timeZone));
}

export function phoneNormalize(value: string) {
  return value.replace(/[^\d]/g, "");
}
