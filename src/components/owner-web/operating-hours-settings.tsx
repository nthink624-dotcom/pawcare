"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { normalizeBookingBlockedWindows, normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { cn } from "@/lib/utils";
import type { BusinessHours, Shop } from "@/types/domain";

type BusinessDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type OperatingHoursTab = "business" | "booking";
type RegularHolidayCycle = "weekly" | "biweekly";

type BusinessDay = {
  key: BusinessDayKey;
  label: string;
  shortLabel: string;
  enabled: boolean;
  open: string;
  close: string;
};

type BookingWindow = {
  id: string;
  start: string;
  end: string;
  label: string;
};

type TemporaryHoliday = {
  id: string;
  date: string;
  label: string;
};

type BookingSettingsState = {
  firstBookingTime: string;
  lastBookingTime: string;
  intervalMinutes: string;
  blockedWindows: BookingWindow[];
  temporaryHolidays: TemporaryHoliday[];
};

const weekdayLabels: Array<{ key: BusinessDayKey; label: string; shortLabel: string }> = [
  { key: "sun", label: "일요일", shortLabel: "일" },
  { key: "mon", label: "월요일", shortLabel: "월" },
  { key: "tue", label: "화요일", shortLabel: "화" },
  { key: "wed", label: "수요일", shortLabel: "수" },
  { key: "thu", label: "목요일", shortLabel: "목" },
  { key: "fri", label: "금요일", shortLabel: "금" },
  { key: "sat", label: "토요일", shortLabel: "토" },
];

const weekdayIndexByKey: Record<BusinessDayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const regularHolidayCycleOptions: Array<{ value: RegularHolidayCycle; label: string }> = [
  { value: "weekly", label: "매주" },
  { value: "biweekly", label: "격주" },
];

const bookingSettingsStorageKey = "petmanager.ownerWeb.operatingHours";

const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

const twelveHourTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const displayHour = hours === 0 ? 12 : hours;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return formatDateKey(new Date());
}

function createMonthCursor(dateKey?: string | null) {
  const source = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  return `${source.getFullYear()}-${String(source.getMonth() + 1).padStart(2, "0")}`;
}

function getRegularHolidayCycle(shop?: Shop): RegularHolidayCycle {
  if (
    shop?.reservation_policy_settings &&
    Object.prototype.hasOwnProperty.call(shop.reservation_policy_settings, "regular_closed_cycle")
  ) {
    return shop.reservation_policy_settings.regular_closed_cycle ?? "weekly";
  }
  return shop?.regular_closed_cycle ?? "weekly";
}

function getRegularHolidayAnchorDate(shop?: Shop) {
  if (
    shop?.reservation_policy_settings &&
    Object.prototype.hasOwnProperty.call(shop.reservation_policy_settings, "regular_closed_cycle")
  ) {
    return shop.reservation_policy_settings.regular_closed_anchor_date ?? null;
  }
  return shop?.regular_closed_anchor_date ?? null;
}

function moveMonth(cursor: string, offset: number) {
  const [yearText = "2026", monthText = "1"] = cursor.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthCalendarCells(cursor: string) {
  const [yearText = "2026", monthText = "1"] = cursor.split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) cells.push(null);
  for (let date = 1; date <= lastDate; date += 1) cells.push(formatDateKey(new Date(year, month, date)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getDateWeekdayIndex(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).getDay();
}

function getWeekStart(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() - (day === 0 ? 6 : day - 1));
  next.setHours(0, 0, 0, 0);
  return next;
}

function isBiweeklyClosedDate(dateKey: string, anchorDateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const anchor = new Date(`${anchorDateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(anchor.getTime())) return true;
  const diffDays = Math.round((getWeekStart(date).getTime() - getWeekStart(anchor).getTime()) / (24 * 60 * 60 * 1000));
  return Math.abs(Math.trunc(diffDays / 7)) % 2 === 0;
}

function parseBusinessHours(value: string | boolean | number) {
  const [open = "10:00", close = "19:00"] = String(value).split("-").map((item) => item.trim());
  return { open, close };
}

function parseClosedDays(value: string | boolean | number) {
  const text = String(value).trim();
  if (!text || text === "없음") return [];
  return text
    .replaceAll("매주", "")
    .replaceAll("격주", "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatClosedDays(days: string[]) {
  return days.length > 0 ? days.join(", ") : "없음";
}

function createInitialBusinessDays(businessHoursValue: string | boolean | number, closedDaysValue: string | boolean | number): BusinessDay[] {
  const { open, close } = parseBusinessHours(businessHoursValue);
  const closedDays = parseClosedDays(closedDaysValue);

  return weekdayLabels.map((day) => ({
    ...day,
    enabled: !closedDays.includes(day.shortLabel),
    open,
    close: day.key === "sat" && close === "19:00" ? "18:00" : close,
  }));
}

function createBusinessDaysFromShop(shop: Shop): BusinessDay[] {
  return weekdayLabels.map((day) => {
    const weekday = weekdayIndexByKey[day.key];
    const hours = shop.business_hours[weekday] ?? { open: "10:00", close: "19:00", enabled: true };
    return {
      ...day,
      enabled: !shop.regular_closed_days.includes(weekday),
      open: hours.open,
      close: hours.close,
    };
  });
}

function createBusinessHoursPayload(days: BusinessDay[]): BusinessHours {
  return Object.fromEntries(
    days.map((day) => [
      weekdayIndexByKey[day.key],
      {
        open: day.open,
        close: day.close,
        enabled: true,
      },
    ]),
  );
}

function createRegularClosedDaysPayload(days: BusinessDay[]) {
  return days
    .filter((day) => !day.enabled)
    .map((day) => weekdayIndexByKey[day.key])
    .sort((left, right) => left - right);
}

function createRegularHolidayLabelsFromShop(shop: Shop) {
  return weekdayLabels
    .filter((day) => shop.regular_closed_days.includes(weekdayIndexByKey[day.key]))
    .map((day) => day.shortLabel);
}

function createTemporaryHolidaysFromShop(shop: Shop): TemporaryHoliday[] {
  const today = todayKey();
  return [...shop.temporary_closed_dates]
    .filter((date) => date >= today)
    .sort()
    .map((date, index) => ({ id: `holiday-${index + 1}`, date, label: "임시 휴무" }));
}

function defaultBookingSettings(shop?: Shop): BookingSettingsState {
  const blockedWindows = normalizeBookingBlockedWindows(shop?.reservation_policy_settings?.booking_blocked_windows);
  const base: BookingSettingsState = {
    firstBookingTime: shop?.booking_available_start_time ?? "10:00",
    lastBookingTime: shop?.booking_available_end_time ?? "17:00",
    intervalMinutes: String(shop?.booking_slot_interval_minutes ?? 30),
    blockedWindows:
      blockedWindows.length > 0
        ? blockedWindows.map((windowItem, index) => ({
            id: windowItem.id ?? `block-${index + 1}`,
            start: windowItem.start,
            end: windowItem.end,
            label: windowItem.label ?? "",
          }))
        : [
            { id: "lunch", start: "13:00", end: "14:00", label: "점심시간" },
            { id: "cleaning", start: "16:00", end: "16:30", label: "정리 시간" },
          ],
    temporaryHolidays: shop ? createTemporaryHolidaysFromShop(shop) : [],
  };

  return base;
}

function readInitialBookingSettings(shop?: Shop) {
  if (shop) return defaultBookingSettings(shop);
  if (typeof window === "undefined") return defaultBookingSettings();

  try {
    const stored = window.localStorage.getItem(bookingSettingsStorageKey);
    return stored ? { ...defaultBookingSettings(), ...JSON.parse(stored) } : defaultBookingSettings();
  } catch {
    window.localStorage.removeItem(bookingSettingsStorageKey);
    return defaultBookingSettings();
  }
}

function createNextItemId(items: Array<{ id: string }>, prefix: string) {
  const existingIds = new Set(items.map((item) => item.id));
  let index = items.length + 1;
  while (existingIds.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  compact = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition",
        compact ? "h-6 w-10" : "h-7 w-12",
        checked ? "bg-[#2f7866]" : "bg-[#cbd5e1]",
      )}
    >
      <span
        className={cn(
          "absolute top-1 rounded-full bg-white shadow-sm transition",
          compact ? "h-4 w-4" : "h-5 w-5",
          checked ? (compact ? "left-5" : "left-6") : "left-1",
        )}
      />
    </button>
  );
}

function TimeInput({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [hourText = "10", minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  const displayValue = `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  function commit(nextPeriod: string, nextDisplayValue: string) {
    const [displayHourText = "12", displayMinuteText = "00"] = nextDisplayValue.split(":");
    const parsedDisplayHour = Number(displayHourText);
    const parsedMinute = Number(displayMinuteText);
    const nextHour =
      nextPeriod === "AM"
        ? parsedDisplayHour === 12
          ? 0
          : parsedDisplayHour
        : parsedDisplayHour === 12
          ? 12
          : parsedDisplayHour + 12;
    const nextValue = `${String(nextHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
    if (timeOptions.includes(nextValue)) onChange(nextValue);
  }

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white transition focus-within:border-[#2f7866] focus-within:ring-[3px] focus-within:ring-[#2f7866]/10",
        compact ? "h-8 w-[146px]" : "h-10 w-[188px]",
      )}
    >
      <div className={cn("relative h-full shrink-0 border-r border-[#e2e8f0]", compact ? "w-[64px]" : "w-[88px]")}>
        <select
          value={period}
          disabled={disabled}
          onChange={(event) => commit(event.target.value, displayValue)}
          className={cn(
            "h-full w-full appearance-none bg-transparent font-normal text-[#334155] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]",
            compact ? "pl-2.5 pr-6 text-[14px]" : "pl-4 pr-9 text-[16px]",
          )}
        >
          <option value="AM">오전</option>
          <option value="PM">오후</option>
        </select>
        <ChevronDown className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#475569]", compact ? "right-2 h-3.5 w-3.5" : "right-3 h-4 w-4")} />
      </div>
      <div className="relative min-w-0 flex-1">
        <select
          value={displayValue}
          disabled={disabled}
          onChange={(event) => commit(period, event.target.value)}
          className={cn(
            "h-full w-full appearance-none bg-transparent font-normal text-[#111827] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]",
            compact ? "pl-3 pr-6 text-[14px]" : "pl-5 pr-9 text-[16px]",
          )}
        >
          {twelveHourTimeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#111827]", compact ? "right-2 h-3.5 w-3.5" : "right-3 h-4 w-4")} />
      </div>
    </div>
  );
}

export default function OperatingHoursSettings({
  businessHoursValue,
  closedDaysValue,
  onBusinessHoursChange,
  onClosedDaysChange,
  shop,
  onShopChange,
  persistToSupabase = false,
  compact = false,
}: {
  businessHoursValue: string | boolean | number;
  closedDaysValue: string | boolean | number;
  onBusinessHoursChange: (value: string) => void;
  onClosedDaysChange: (value: string) => void;
  shop?: Shop;
  onShopChange?: (shop: Shop) => void;
  persistToSupabase?: boolean;
  compact?: boolean;
}) {
  const [businessDays, setBusinessDays] = useState(() => (shop ? createBusinessDaysFromShop(shop) : createInitialBusinessDays(businessHoursValue, closedDaysValue)));
  const [bookingSettings, setBookingSettings] = useState<BookingSettingsState>(() => readInitialBookingSettings(shop));
  const [bulkOpenTime, setBulkOpenTime] = useState(() => {
    const initialDays = shop ? createBusinessDaysFromShop(shop) : createInitialBusinessDays(businessHoursValue, closedDaysValue);
    return (initialDays.find((day) => day.enabled) ?? initialDays[0])?.open ?? "10:00";
  });
  const [bulkCloseTime, setBulkCloseTime] = useState(() => {
    const initialDays = shop ? createBusinessDaysFromShop(shop) : createInitialBusinessDays(businessHoursValue, closedDaysValue);
    return (initialDays.find((day) => day.enabled) ?? initialDays[0])?.close ?? "19:00";
  });
  const [activeTab, setActiveTab] = useState<OperatingHoursTab>("business");
  const [regularHolidayCycle, setRegularHolidayCycle] = useState<RegularHolidayCycle>(getRegularHolidayCycle(shop));
  const [regularHolidayAnchorDate, setRegularHolidayAnchorDate] = useState(getRegularHolidayAnchorDate(shop) ?? todayKey());
  const [temporaryHolidayMonth, setTemporaryHolidayMonth] = useState(() => createMonthCursor(getRegularHolidayAnchorDate(shop) ?? readInitialBookingSettings(shop).temporaryHolidays[0]?.date));
  const [pendingTemporaryHolidayDate, setPendingTemporaryHolidayDate] = useState("");
  const [saveError, setSaveError] = useState("");
  const [regularHolidayHelpOpen, setRegularHolidayHelpOpen] = useState(false);

  useEffect(() => {
    if (persistToSupabase) return;
    try {
      window.localStorage.setItem(bookingSettingsStorageKey, JSON.stringify(bookingSettings));
    } catch {
      // Keep edited values for the current session if local storage is blocked.
    }
  }, [bookingSettings, persistToSupabase]);

  const temporaryHolidayDates = useMemo(() => new Set(bookingSettings.temporaryHolidays.map((holiday) => holiday.date)), [bookingSettings.temporaryHolidays]);
  const temporaryHolidayCalendarCells = getMonthCalendarCells(temporaryHolidayMonth);
  const temporaryHolidayMonthLabel = temporaryHolidayMonth.replace("-", "년 ") + "월";
  const regularClosedWeekdays = useMemo(() => new Set(createRegularClosedDaysPayload(businessDays)), [businessDays]);

  function buildNextShop(nextDays: BusinessDay[], nextSettings: BookingSettingsState, cycle = regularHolidayCycle, anchorDate = regularHolidayAnchorDate) {
    if (!shop) return null;

    return {
      ...shop,
      business_hours: createBusinessHoursPayload(nextDays),
      regular_closed_days: createRegularClosedDaysPayload(nextDays),
      regular_closed_cycle: cycle,
      regular_closed_anchor_date: cycle === "biweekly" ? anchorDate : null,
      temporary_closed_dates: nextSettings.temporaryHolidays
        .map((holiday) => holiday.date)
        .filter((date) => date >= todayKey())
        .sort(),
      booking_slot_interval_minutes: Number(nextSettings.intervalMinutes),
      booking_available_start_time: nextSettings.firstBookingTime,
      booking_available_end_time: nextSettings.lastBookingTime,
      reservation_policy_settings: {
        ...normalizeReservationPolicySettings(shop.reservation_policy_settings),
        regular_closed_cycle: cycle,
        regular_closed_anchor_date: cycle === "biweekly" ? anchorDate : null,
        booking_blocked_windows: normalizeBookingBlockedWindows(nextSettings.blockedWindows),
      },
    };
  }

  async function persistShopOperatingHours(nextDays: BusinessDay[], nextSettings: BookingSettingsState, cycle = regularHolidayCycle, anchorDate = regularHolidayAnchorDate) {
    const nextShop = buildNextShop(nextDays, nextSettings, cycle, anchorDate);
    if (!nextShop) return;

    onShopChange?.(nextShop);
    if (!persistToSupabase || nextShop.id === "demo-shop" || nextShop.id === "owner-demo") return;

    try {
      setSaveError("");
      const savedShop = await fetchApiJsonWithAuth<Shop>("/api/settings", {
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify({
          shopId: nextShop.id,
          name: nextShop.name,
          phone: nextShop.phone,
          address: nextShop.address,
          description: nextShop.description,
          concurrentCapacity: nextShop.concurrent_capacity,
          bookingSlotIntervalMinutes: nextShop.booking_slot_interval_minutes,
          bookingSlotOffsetMinutes: nextShop.booking_slot_offset_minutes,
          bookingAvailableStartTime: nextShop.booking_available_start_time,
          bookingAvailableEndTime: nextShop.booking_available_end_time,
          approvalMode: nextShop.approval_mode,
          regularClosedDays: nextShop.regular_closed_days,
          regularClosedCycle: nextShop.regular_closed_cycle ?? "weekly",
          regularClosedAnchorDate: nextShop.regular_closed_anchor_date ?? null,
          temporaryClosedDates: nextShop.temporary_closed_dates,
          businessHours: nextShop.business_hours,
          reservationPolicySettings: nextShop.reservation_policy_settings,
          notificationSettings: {
            enabled: nextShop.notification_settings.enabled,
            revisitEnabled: nextShop.notification_settings.revisit_enabled,
            bookingConfirmedEnabled: nextShop.notification_settings.booking_confirmed_enabled,
            bookingRejectedEnabled: nextShop.notification_settings.booking_rejected_enabled,
            bookingCancelledEnabled: nextShop.notification_settings.booking_cancelled_enabled,
            bookingRescheduledEnabled: nextShop.notification_settings.booking_rescheduled_enabled,
            appointmentReminder10mEnabled: nextShop.notification_settings.appointment_reminder_10m_enabled,
            groomingStartedEnabled: nextShop.notification_settings.grooming_started_enabled,
            groomingAlmostDoneEnabled: nextShop.notification_settings.grooming_almost_done_enabled,
            groomingCompletedEnabled: nextShop.notification_settings.grooming_completed_enabled,
            groomingStartWithoutPhotoEnabled: nextShop.notification_settings.grooming_start_without_photo_enabled,
            groomingCompleteWithoutPhotoEnabled: nextShop.notification_settings.grooming_complete_without_photo_enabled,
          },
        }),
      });
      onShopChange?.(savedShop);
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to save operating hours", error);
      setSaveError(error instanceof Error ? error.message : "운영시간 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.");
    }
  }

  function commitBusinessDays(nextDays: BusinessDay[], nextSettings = bookingSettings) {
    setBusinessDays(nextDays);
    const firstOpenDay = nextDays.find((day) => day.open && day.close) ?? nextDays[0];
    if (firstOpenDay) onBusinessHoursChange(`${firstOpenDay.open} - ${firstOpenDay.close}`);
    onClosedDaysChange(formatClosedDays(nextDays.filter((day) => !day.enabled).map((day) => day.shortLabel)));
    void persistShopOperatingHours(nextDays, nextSettings);
  }

  function updateBusinessDay(dayKey: BusinessDayKey, patch: Partial<BusinessDay>) {
    commitBusinessDays(businessDays.map((day) => (day.key === dayKey ? { ...day, ...patch } : day)));
  }

  function applyBulkTimeToAllDays() {
    commitBusinessDays(businessDays.map((day) => ({ ...day, open: bulkOpenTime, close: bulkCloseTime })));
  }

  function updateBookingSetting<K extends keyof BookingSettingsState>(key: K, value: BookingSettingsState[K], shouldPersistShop = false) {
    const nextSettings = { ...bookingSettings, [key]: value };
    setBookingSettings(nextSettings);
    if (shouldPersistShop) void persistShopOperatingHours(businessDays, nextSettings);
  }

  function updateRegularHolidayCycle(cycle: RegularHolidayCycle) {
    setRegularHolidayCycle(cycle);
    void persistShopOperatingHours(businessDays, bookingSettings, cycle, regularHolidayAnchorDate);
  }

  function updateRegularHolidayAnchorDate(dateKey: string) {
    setRegularHolidayAnchorDate(dateKey);
    void persistShopOperatingHours(businessDays, bookingSettings, regularHolidayCycle, dateKey);
  }

  function addTemporaryHoliday(dateKey: string) {
    if (!dateKey || dateKey < todayKey() || temporaryHolidayDates.has(dateKey)) {
      setPendingTemporaryHolidayDate("");
      return;
    }
    const nextSettings = {
      ...bookingSettings,
      temporaryHolidays: [
        ...bookingSettings.temporaryHolidays,
        { id: createNextItemId(bookingSettings.temporaryHolidays, "holiday"), date: dateKey, label: "임시 휴무" },
      ].sort((left, right) => left.date.localeCompare(right.date)),
    };
    setBookingSettings(nextSettings);
    void persistShopOperatingHours(businessDays, nextSettings);
    setPendingTemporaryHolidayDate("");
  }

  function removeTemporaryHoliday(id: string) {
    const nextSettings = {
      ...bookingSettings,
      temporaryHolidays: bookingSettings.temporaryHolidays.filter((holiday) => holiday.id !== id),
    };
    setBookingSettings(nextSettings);
    void persistShopOperatingHours(businessDays, nextSettings);
  }

  function addBlockedWindow() {
    const nextSettings = {
      ...bookingSettings,
      blockedWindows: [
        ...bookingSettings.blockedWindows,
        { id: createNextItemId(bookingSettings.blockedWindows, "block"), start: "15:00", end: "15:30", label: "예약 제외 시간" },
      ],
    };
    setBookingSettings(nextSettings);
    void persistShopOperatingHours(businessDays, nextSettings);
  }

  function updateBlockedWindow(id: string, patch: Partial<BookingWindow>) {
    updateBookingSetting(
      "blockedWindows",
      bookingSettings.blockedWindows.map((windowItem) => (windowItem.id === id ? { ...windowItem, ...patch } : windowItem)),
      true,
    );
  }

  function removeBlockedWindow(id: string) {
    updateBookingSetting("blockedWindows", bookingSettings.blockedWindows.filter((windowItem) => windowItem.id !== id), true);
  }

  function isRegularClosedDate(dateKey: string) {
    const weekday = getDateWeekdayIndex(dateKey);
    if (!regularClosedWeekdays.has(weekday)) return false;
    if (regularHolidayCycle === "weekly") return true;
    return isBiweeklyClosedDate(dateKey, regularHolidayAnchorDate);
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {saveError ? (
          <p className="rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[14px] leading-5 text-[#b42318]">
            {saveError}
          </p>
        ) : null}

        <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(560px,1fr)_minmax(360px,420px)]">
          <WebSurface className="h-full border-0 bg-transparent p-0 shadow-none">
            <div className="h-full overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white">
              <div className="grid items-center gap-1.5 border-b border-[#edf2f7] bg-[#fbfcfd] px-3 py-2 lg:grid-cols-[112px_minmax(0,1fr)]">
                <p className="text-[16px] font-normal text-[#111827]">공통 적용</p>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <TimeInput value={bulkOpenTime} onChange={setBulkOpenTime} compact />
                  <span className="text-[13px] font-normal text-[#94a3b8]">-</span>
                  <TimeInput value={bulkCloseTime} onChange={setBulkCloseTime} compact />
                  <button
                    type="button"
                    onClick={applyBulkTimeToAllDays}
                    className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-normal text-[#334155] hover:bg-[#f8fafc]"
                  >
                    전체 적용
                  </button>
                </div>
              </div>
              {businessDays.map((day) => (
                <div key={day.key} className="grid min-h-[48px] items-center gap-2 border-b border-[#edf2f7] px-3 py-2.5 last:border-b-0 lg:grid-cols-[36px_128px_minmax(0,1fr)]">
                  <span className="text-[16px] font-normal text-[#111827]">{day.shortLabel}</span>
                  <div className="ml-7 flex items-center gap-1.5">
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} compact />
                    <span className={cn("whitespace-nowrap text-[16px] font-normal", day.enabled ? "text-[#2f7866]" : "text-[#64748b]")}>{day.enabled ? "영업" : "휴무"}</span>
                  </div>
                  {day.enabled ? (
                    <div className="ml-auto grid items-center gap-1.5 sm:grid-cols-[146px_14px_146px]">
                      <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} compact />
                      <span className="text-center text-[13px] font-normal text-[#94a3b8]">-</span>
                      <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} compact />
                    </div>
                  ) : (
                    <p className="ml-auto w-full text-left text-[16px] font-normal text-[#64748b] sm:w-[318px]">예약을 받지 않습니다.</p>
                  )}
                </div>
              ))}
            </div>
          </WebSurface>

          <div className="grid min-w-0 gap-2">
            <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[16px] font-normal text-[#111827]">정기 휴무일</p>
                <div className="grid w-[136px] grid-cols-2 gap-1 rounded-[8px] border border-[#e4ebf2] bg-[#f8fafc] p-1">
                  {regularHolidayCycleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateRegularHolidayCycle(option.value)}
                      className={cn(
                        "h-7 rounded-[7px] text-[13px] font-normal transition",
                        regularHolidayCycle === option.value ? "bg-white text-[#2f7866] shadow-sm" : "text-[#64748b] hover:bg-white/70",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {weekdayLabels.map((day) => {
                  const active = !businessDays.find((item) => item.key === day.key)?.enabled;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => updateBusinessDay(day.key, { enabled: !businessDays.find((item) => item.key === day.key)?.enabled })}
                      className={cn(
                        "h-8 rounded-[8px] border text-[14px] font-normal transition",
                        active ? "border-[#f0a8b4] bg-[#fff7f8] text-[#d43f57]" : "border-[#bad8cd] bg-[#f7fbf9] text-[#2f7866]",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-2.5">
              <p className="text-[16px] font-normal text-[#111827]">임시 휴무일</p>
              <div className="mt-2 flex gap-1.5">
                <input
                  type="date"
                  value={pendingTemporaryHolidayDate}
                  onChange={(event) => setPendingTemporaryHolidayDate(event.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2 text-[14px] text-[#111827] outline-none focus:border-[#2f7866]"
                />
                <button
                  type="button"
                  onClick={() => addTemporaryHoliday(pendingTemporaryHolidayDate)}
                  className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-normal text-[#2f7866] hover:bg-[#f8fafc]"
                >
                  추가
                </button>
              </div>
              {bookingSettings.temporaryHolidays.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bookingSettings.temporaryHolidays.slice(0, 5).map((holiday) => (
                    <span key={holiday.id} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#dbe2ea] bg-[#fbfcfd] pl-2 pr-1 text-[12px] font-normal text-[#334155]">
                      {holiday.date.slice(5)}
                      <button type="button" onClick={() => removeTemporaryHoliday(holiday.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#a04455] hover:bg-[#fff1f3]" aria-label="임시 휴무 삭제">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {bookingSettings.temporaryHolidays.length > 5 ? <span className="h-7 rounded-full bg-[#f8fafc] px-2 text-[12px] leading-7 text-[#64748b]">+{bookingSettings.temporaryHolidays.length - 5}</span> : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-[10px] border border-[#e5e7eb] bg-white p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[16px] font-normal text-[#111827]">미용 예약 가능 시간</p>
                <button type="button" onClick={addBlockedWindow} className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[14px] font-normal text-[#2f7866] hover:bg-[#f8fafc]">
                  <Plus className="h-3.5 w-3.5" />
                  제외 시간
                </button>
              </div>
              <div className="mt-2 grid items-center gap-1.5 sm:grid-cols-[146px_14px_146px]">
                <TimeInput value={bookingSettings.firstBookingTime} onChange={(value) => updateBookingSetting("firstBookingTime", value, true)} compact />
                <span className="text-center text-[13px] font-normal text-[#94a3b8]">-</span>
                <TimeInput value={bookingSettings.lastBookingTime} onChange={(value) => updateBookingSetting("lastBookingTime", value, true)} compact />
              </div>
              <div className="relative mt-1.5 w-full">
                <select
                  value={bookingSettings.intervalMinutes}
                  onChange={(event) => updateBookingSetting("intervalMinutes", event.target.value, true)}
                  className="h-8 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white px-2 pr-7 text-[14px] font-normal text-[#111827] outline-none focus:border-[#2f7866]"
                >
                  <option value="15">15분</option>
                  <option value="30">30분</option>
                  <option value="60">1시간</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
              </div>

              {bookingSettings.blockedWindows.length > 0 ? (
                <div className="mt-2 grid gap-1.5">
                  {bookingSettings.blockedWindows.map((windowItem) => (
                    <div key={windowItem.id} className="grid items-center gap-1.5 rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] p-1.5">
                      <div className="grid items-center gap-1.5 sm:grid-cols-[1fr_1fr_30px]">
                        <TimeInput value={windowItem.start} onChange={(value) => updateBlockedWindow(windowItem.id, { start: value })} compact />
                        <TimeInput value={windowItem.end} onChange={(value) => updateBlockedWindow(windowItem.id, { end: value })} compact />
                        <button type="button" onClick={() => removeBlockedWindow(windowItem.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8]" aria-label="예약 제외 시간 삭제">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={windowItem.label}
                        onChange={(event) => updateBlockedWindow(windowItem.id, { label: event.target.value })}
                        className="h-8 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[14px] font-normal text-[#111827] outline-none focus:border-[#2f7866]"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(compact && "space-y-2")}>
      {saveError ? (
        <p className="mb-3 rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[14px] leading-5 text-[#b42318]">
          {saveError}
        </p>
      ) : null}
      <div className={cn("flex items-center border-b border-[#dbe2ea]", compact ? "mb-2 gap-2 pb-2" : "mb-3 gap-5 pb-3")}>
        {[
          { key: "business" as const, label: "매장 운영시간" },
          { key: "booking" as const, label: "미용 예약 가능 시간" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={cn(
              "rounded-[8px] font-normal transition",
              compact ? "h-8 px-3 text-[15px]" : "h-10 px-4 text-[16px]",
              activeTab === item.key
                ? "border border-[#dbe2ea] bg-white text-[#111827] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                : "text-[#64748b] hover:text-[#111827]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === "business" ? (
        <div className={cn("grid", compact ? "gap-3 xl:grid-cols-[minmax(0,1fr)_330px]" : "gap-4 xl:grid-cols-[minmax(0,1fr)_360px]")}>
          <WebSurface className={cn(compact ? "p-3" : "p-4")}>
            <div className="divide-y divide-[#edf2f7]">
              <div
                className={cn(
                  "grid items-center bg-[#fbfcfd]",
                  compact ? "grid-cols-[118px_minmax(0,1fr)] gap-3 px-3 py-2" : "grid-cols-[150px_minmax(0,1fr)] gap-5 px-4 py-3.5",
                )}
              >
                <div>
                  <div className="group relative inline-flex items-center gap-1.5">
                    <p className={cn("whitespace-nowrap font-normal text-[#111827] [word-break:keep-all]", compact ? "text-[15px]" : "text-[16px]")}>모든 요일 적용 시간</p>
                    <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#2f7866]" aria-label="모든 요일 적용 시간 도움말">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-7 z-20 w-[240px] rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                      공통 시간을 먼저 맞춘 뒤 예외 요일만 수정합니다.
                    </div>
                  </div>
                </div>
                <div className={cn("flex flex-wrap items-center", compact ? "gap-2" : "gap-3")}>
                  <TimeInput value={bulkOpenTime} onChange={setBulkOpenTime} compact={compact} />
                  <span className={cn("text-center font-normal text-[#94a3b8]", compact ? "text-[14px]" : "text-[16px]")}>-</span>
                  <TimeInput value={bulkCloseTime} onChange={setBulkCloseTime} compact={compact} />
                  <button
                    type="button"
                    onClick={applyBulkTimeToAllDays}
                    className={cn(
                      "rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#334155] transition hover:border-[#bad8cd] hover:bg-[#f8fafc]",
                      compact ? "h-8 px-3 text-[14px]" : "h-10 px-4 text-[15px]",
                    )}
                  >
                    전체 적용
                  </button>
                </div>
              </div>
              {businessDays.map((day) => (
                <div
                  key={day.key}
                  className={cn(
                    "grid items-center",
                    compact ? "grid-cols-[76px_108px_minmax(305px,1fr)] gap-3 py-2" : "grid-cols-[110px_160px_minmax(400px,1fr)] gap-5 py-3.5",
                  )}
                >
                  <p className={cn("font-normal text-[#111827]", compact ? "text-[15px]" : "text-[16px]")}>{day.label}</p>
                  <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} compact={compact} />
                    <span className={cn("font-normal", compact ? "text-[15px]" : "text-[16px]", day.enabled ? "text-[#2f7866]" : "text-[#64748b]")}>
                      {day.enabled ? "영업함" : "휴무일"}
                    </span>
                  </div>
                  <div className={cn("ml-auto grid items-center", compact ? "grid-cols-[146px_16px_146px] gap-2" : "grid-cols-[188px_24px_188px] gap-3")}>
                    {day.enabled ? (
                      <>
                        <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} compact={compact} />
                        <span className={cn("text-center font-normal text-[#94a3b8]", compact ? "text-[14px]" : "text-[16px]")}>-</span>
                        <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} compact={compact} />
                      </>
                    ) : (
                      <p className={cn("col-span-3 whitespace-nowrap text-left font-normal text-[#64748b] [word-break:keep-all]", compact ? "text-[15px]" : "text-[16px]")}>
                        예약을 받지 않습니다.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </WebSurface>

          <WebSurface className={cn(compact ? "p-3" : "p-4")}>
            <div className={cn("border-b border-[#edf2f7]", compact ? "pb-3" : "pb-4")}>
              <p className={cn("font-normal text-[#111827]", compact ? "text-[16px]" : "text-[18px]")}>정기 휴무일</p>
              <div className={cn("grid grid-cols-2 gap-1 rounded-[10px] border border-[#e4ebf2] bg-[#f8fafc] p-1", compact ? "mt-2" : "mt-4")}>
                {regularHolidayCycleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateRegularHolidayCycle(option.value)}
                    className={cn(
                      "rounded-[8px] font-normal transition",
                      compact ? "h-8 text-[15px]" : "h-10 text-[16px]",
                      regularHolidayCycle === option.value
                        ? "bg-white text-[#2f7866] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                        : "text-[#64748b] hover:bg-white/70 hover:text-[#111827]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            {regularHolidayCycle === "biweekly" ? (
              <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-[#fbfcfd] px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="text-[16px] font-normal text-[#334155]">격주 기준일</p>
                    <button
                      type="button"
                      onClick={() => setRegularHolidayHelpOpen((current) => !current)}
                      className={cn(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition",
                        regularHolidayHelpOpen ? "bg-[#e8f5f1] text-[#2f7866]" : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#2f7866]",
                      )}
                      aria-label="격주 기준일 설명"
                      aria-expanded={regularHolidayHelpOpen}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={regularHolidayAnchorDate}
                    onChange={(event) => updateRegularHolidayAnchorDate(event.target.value)}
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-normal text-[#111827] outline-none focus:border-[#2f7866]"
                  />
                </div>
                {regularHolidayHelpOpen ? (
                  <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[13px] leading-5 text-[#64748b]">
                    선택한 날짜가 포함된 주를 쉬는 주로 계산합니다. 예를 들어 기준일이 2026-05-25이고 월요일을 휴무로 선택하면 5월 25일, 6월 8일, 6월 22일처럼 한 주 건너 월요일이 휴무로 표시됩니다.
                  </div>
                ) : null}
              </div>
            ) : null}
              <div className={cn("mt-3 grid grid-cols-7", compact ? "gap-1" : "gap-2")}>
                {weekdayLabels.map((day) => {
                  const active = !businessDays.find((item) => item.key === day.key)?.enabled;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => updateBusinessDay(day.key, { enabled: !businessDays.find((item) => item.key === day.key)?.enabled })}
                      className={cn(
                        "rounded-[8px] border font-normal transition",
                        compact ? "h-8 text-[15px]" : "h-10 text-[16px]",
                        active
                          ? "border-[#f0a8b4] bg-[#fff7f8] text-[#d43f57] shadow-[0_1px_4px_rgba(212,63,87,0.08)]"
                          : "border-[#bad8cd] bg-[#f7fbf9] text-[#2f7866] hover:border-[#2f7866] hover:bg-[#eef7f4]",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className={cn("font-normal text-[#111827]", compact ? "mt-3 text-[16px]" : "mt-4 text-[18px]")}>임시 휴무일 설정</p>
            <div className={cn(compact ? "mt-2" : "mt-3 p-1")}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTemporaryHolidayMonth((current) => moveMonth(current, -1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className={cn("font-normal text-[#111827]", compact ? "text-[15px]" : "text-[16px]")}>{temporaryHolidayMonthLabel}</p>
                <button
                  type="button"
                  onClick={() => setTemporaryHolidayMonth((current) => moveMonth(current, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className={cn("grid grid-cols-7 gap-1 text-center font-normal text-[#94a3b8]", compact ? "mt-2 text-[12px]" : "mt-3 text-[13px]")}>
                {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                  <span key={label} className={cn(label === "일" && "text-[#c13f52]")}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {temporaryHolidayCalendarCells.map((dateKey, index) => {
                  if (!dateKey) return <span key={`empty-${index}`} className={cn(compact ? "h-7" : "h-9")} />;
                  const saved = temporaryHolidayDates.has(dateKey);
                  const regularClosed = isRegularClosedDate(dateKey);
                  const closed = saved || regularClosed;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => {
                        if (!saved) setPendingTemporaryHolidayDate(dateKey);
                      }}
                      className={cn(
                        "rounded-[8px] font-normal transition hover:bg-[#f8fafc]",
                        compact ? "h-7 text-[14px]" : "h-9 text-[15px]",
                        closed ? "text-[#c13f52] hover:text-[#ad3146]" : "text-[#334155] hover:text-[#2f7866]",
                      )}
                    >
                      {Number(dateKey.slice(-2))}
                    </button>
                  );
                })}
              </div>
            </div>
            {bookingSettings.temporaryHolidays.length > 0 ? (
              <div className="mt-3 space-y-2">
                {bookingSettings.temporaryHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between gap-2 rounded-[8px] bg-[#fbfcfd] px-3 py-2">
                    <span className="text-[15px] font-normal text-[#334155]">{holiday.date}</span>
                    <button type="button" onClick={() => removeTemporaryHoliday(holiday.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#c13f52] hover:bg-[#fff1f3]" aria-label="임시 휴무 삭제">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </WebSurface>

          {pendingTemporaryHolidayDate ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/20 px-4" role="dialog" aria-modal="true">
              <div className="w-full max-w-[360px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
                <p className="text-[18px] font-normal text-[#111827]">임시 휴무일 지정</p>
                <p className="mt-3 text-[15px] leading-6 text-[#475569]">
                  {pendingTemporaryHolidayDate}을 임시 휴무일로 지정할까요?
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingTemporaryHolidayDate("")}
                    className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-normal text-[#334155] hover:bg-[#f8fafc]"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => addTemporaryHoliday(pendingTemporaryHolidayDate)}
                    className="h-11 rounded-[8px] bg-[#2f7866] text-[15px] font-normal text-white hover:bg-[#286b5b]"
                  >
                    지정하기
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "booking" ? (
        <WebSurface className={cn(compact ? "p-3" : "p-4")}>
          <div className={cn("grid items-center", compact ? "grid-cols-[112px_minmax(0,1fr)] gap-2" : "grid-cols-[130px_minmax(0,1fr)] gap-3")}>
            <p className={cn("font-normal text-[#334155]", "text-[16px]")}>예약 가능 시간</p>
            <div className={cn("flex items-center", compact ? "gap-2" : "gap-4")}>
              <TimeInput value={bookingSettings.firstBookingTime} onChange={(value) => updateBookingSetting("firstBookingTime", value, true)} compact={compact} />
              <span className="text-[#94a3b8]">-</span>
              <TimeInput value={bookingSettings.lastBookingTime} onChange={(value) => updateBookingSetting("lastBookingTime", value, true)} compact={compact} />
            </div>
          </div>

          <div className={cn("grid items-start", compact ? "mt-3 grid-cols-[112px_minmax(0,1fr)] gap-2" : "mt-4 grid-cols-[130px_minmax(0,1fr)] gap-3")}>
            <p className={cn("font-normal text-[#334155]", compact ? "pt-1.5 text-[16px]" : "pt-2 text-[16px]")}>예약 간격</p>
            <div className="min-w-0">
              <div className={cn("relative", compact ? "w-[146px]" : "w-[188px]")}>
                <select
                  value={bookingSettings.intervalMinutes}
                  onChange={(event) => updateBookingSetting("intervalMinutes", event.target.value, true)}
                  className={cn(
                    "w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-[3px] focus:ring-[#2f7866]/10",
                    compact ? "h-8 px-2.5 pr-8 text-[14px]" : "h-10 px-3 pr-9 text-[16px]",
                  )}
                >
                  <option value="15">15분</option>
                  <option value="30">30분</option>
                  <option value="60">1시간</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]" />
              </div>
              <p className={cn("mt-2 text-[#64748b]", compact ? "text-[14px] leading-5" : "text-[16px] leading-6")}>설정한 예약 가능 시간과 간격은 고객 예약 화면에도 동일하게 보입니다.</p>
            </div>
          </div>

          <div className={cn("border-t border-[#edf2f7]", compact ? "mt-3 pt-3" : "mt-4 pt-4")}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn("font-normal text-[#334155]", "text-[16px]")}>예약 제외 시간</p>
              <button type="button" onClick={addBlockedWindow} className={cn("inline-flex items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#2f7866] hover:bg-[#f8fafc]", compact ? "h-8 px-2.5 text-[14px]" : "h-9 px-3 text-[16px]")}>
                <Plus className="h-4 w-4" />
                시간 추가
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {bookingSettings.blockedWindows.map((windowItem) => (
                <div key={windowItem.id} className={cn("grid items-center rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd]", compact ? "grid-cols-[146px_146px_minmax(0,1fr)_32px] gap-2 p-1.5" : "grid-cols-[188px_188px_minmax(0,1fr)_36px] gap-3 p-2")}>
                  <TimeInput value={windowItem.start} onChange={(value) => updateBlockedWindow(windowItem.id, { start: value })} compact={compact} />
                  <TimeInput value={windowItem.end} onChange={(value) => updateBlockedWindow(windowItem.id, { end: value })} compact={compact} />
                  <input
                    value={windowItem.label}
                    onChange={(event) => updateBlockedWindow(windowItem.id, { label: event.target.value })}
                    className={cn("rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#111827] outline-none focus:border-[#2f7866]", compact ? "h-8 px-2.5 text-[14px]" : "h-10 px-3 text-[16px]")}
                  />
                  <button type="button" onClick={() => removeBlockedWindow(windowItem.id)} className={cn("inline-flex items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8]", compact ? "h-8 w-8" : "h-9 w-9")} aria-label="예약 제외 시간 삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </WebSurface>
      ) : null}
    </div>
  );
}
