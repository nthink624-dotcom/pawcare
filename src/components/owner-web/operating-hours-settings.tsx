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

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={label}
      onClick={onChange}
      className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition", checked ? "bg-[#2f7866]" : "bg-[#cbd5e1]")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition", checked ? "left-6" : "left-1")} />
    </button>
  );
}

function TimeInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
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
    <div className="inline-flex h-10 w-[188px] overflow-hidden rounded-[8px] border border-[#dbe2ea] bg-white transition focus-within:border-[#2f7866] focus-within:ring-[3px] focus-within:ring-[#2f7866]/10">
      <div className="relative h-full w-[88px] shrink-0 border-r border-[#e2e8f0]">
        <select
          value={period}
          disabled={disabled}
          onChange={(event) => commit(event.target.value, displayValue)}
          className="h-full w-full appearance-none bg-transparent pl-4 pr-9 text-[16px] font-medium text-[#334155] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
        >
          <option value="AM">오전</option>
          <option value="PM">오후</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
      </div>
      <div className="relative min-w-0 flex-1">
        <select
          value={displayValue}
          disabled={disabled}
          onChange={(event) => commit(period, event.target.value)}
          className="h-full w-full appearance-none bg-transparent pl-5 pr-9 text-[16px] font-normal text-[#111827] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
        >
          {twelveHourTimeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]" />
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
}: {
  businessHoursValue: string | boolean | number;
  closedDaysValue: string | boolean | number;
  onBusinessHoursChange: (value: string) => void;
  onClosedDaysChange: (value: string) => void;
  shop?: Shop;
  onShopChange?: (shop: Shop) => void;
  persistToSupabase?: boolean;
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

  return (
    <div>
      {saveError ? (
        <p className="mb-3 rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[14px] leading-5 text-[#b42318]">
          {saveError}
        </p>
      ) : null}
      <div className="mb-3 flex items-center gap-5 border-b border-[#dbe2ea] pb-3">
        {[
          { key: "business" as const, label: "매장 운영시간" },
          { key: "booking" as const, label: "미용 예약 가능 시간" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={cn(
              "h-10 rounded-[8px] px-4 text-[16px] font-medium transition",
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <WebSurface className="p-4">
            <div className="divide-y divide-[#edf2f7]">
              <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-5 bg-[#fbfcfd] px-4 py-3.5">
                <div>
                  <div className="group relative inline-flex items-center gap-1.5">
                    <p className="whitespace-nowrap text-[16px] font-semibold text-[#111827] [word-break:keep-all]">모든 요일 적용 시간</p>
                    <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#2f7866]" aria-label="모든 요일 적용 시간 도움말">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-7 z-20 w-[240px] rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                      공통 시간을 먼저 맞춘 뒤 예외 요일만 수정합니다.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <TimeInput value={bulkOpenTime} onChange={setBulkOpenTime} />
                  <span className="text-center text-[16px] font-semibold text-[#94a3b8]">-</span>
                  <TimeInput value={bulkCloseTime} onChange={setBulkCloseTime} />
                  <button
                    type="button"
                    onClick={applyBulkTimeToAllDays}
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[15px] font-medium text-[#334155] transition hover:border-[#bad8cd] hover:bg-[#f8fafc]"
                  >
                    전체 적용
                  </button>
                </div>
              </div>
              {businessDays.map((day) => (
                <div key={day.key} className="grid grid-cols-[110px_160px_minmax(400px,1fr)] items-center gap-5 py-3.5">
                    <p className="text-[16px] font-normal text-[#111827]">{day.label}</p>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} />
                    <span className={cn("text-[16px] font-normal", day.enabled ? "text-[#2f7866]" : "text-[#64748b]")}>
                      {day.enabled ? "영업함" : "휴무일"}
                    </span>
                  </div>
                  <div className="ml-auto grid grid-cols-[188px_24px_188px] items-center gap-3">
                    {day.enabled ? (
                      <>
                        <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} />
                        <span className="text-center text-[16px] font-semibold text-[#94a3b8]">-</span>
                        <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} />
                      </>
                    ) : (
                      <>
                        <span />
                        <span className="whitespace-nowrap text-center text-[16px] font-normal text-[#64748b] [word-break:keep-all]">휴무</span>
                        <span />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </WebSurface>

          <WebSurface className="p-4">
            <div className="border-b border-[#edf2f7] pb-4">
              <p className="text-[18px] font-semibold text-[#111827]">정기 휴무일</p>
              <div className="mt-4 grid grid-cols-2 gap-1 rounded-[10px] border border-[#e4ebf2] bg-[#f8fafc] p-1">
                {regularHolidayCycleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateRegularHolidayCycle(option.value)}
                    className={cn(
                      "h-10 rounded-[8px] text-[16px] font-semibold transition",
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
                    <p className="text-[15px] font-semibold text-[#334155]">격주 기준일</p>
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
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[15px] font-medium text-[#111827] outline-none focus:border-[#2f7866]"
                  />
                </div>
                {regularHolidayHelpOpen ? (
                  <div className="mt-3 rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[13px] leading-5 text-[#64748b]">
                    선택한 날짜가 포함된 주를 쉬는 주로 계산합니다. 예를 들어 기준일이 2026-05-25이고 월요일을 휴무로 선택하면 5월 25일, 6월 8일, 6월 22일처럼 한 주 건너 월요일이 휴무로 표시됩니다.
                  </div>
                ) : null}
              </div>
            ) : null}
              <div className="mt-3 grid grid-cols-7 gap-2">
                {weekdayLabels.map((day) => {
                  const active = !businessDays.find((item) => item.key === day.key)?.enabled;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => updateBusinessDay(day.key, { enabled: !businessDays.find((item) => item.key === day.key)?.enabled })}
                      className={cn(
                        "h-10 rounded-[8px] border text-[16px] font-semibold transition",
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

            <p className="mt-4 text-[18px] font-semibold text-[#111827]">임시 휴무일 설정</p>
            <div className="mt-3 p-1">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTemporaryHolidayMonth((current) => moveMonth(current, -1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-[16px] font-semibold text-[#111827]">{temporaryHolidayMonthLabel}</p>
                <button
                  type="button"
                  onClick={() => setTemporaryHolidayMonth((current) => moveMonth(current, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="다음 달"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[13px] font-semibold text-[#94a3b8]">
                {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                  <span key={label} className={cn(label === "일" && "text-[#c13f52]")}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {temporaryHolidayCalendarCells.map((dateKey, index) => {
                  if (!dateKey) return <span key={`empty-${index}`} className="h-9" />;
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
                        "h-9 rounded-[8px] text-[15px] font-semibold transition hover:bg-[#f8fafc]",
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
                    <span className="text-[15px] font-medium text-[#334155]">{holiday.date}</span>
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
                <p className="text-[18px] font-semibold text-[#111827]">임시 휴무일 지정</p>
                <p className="mt-3 text-[15px] leading-6 text-[#475569]">
                  {pendingTemporaryHolidayDate}을 임시 휴무일로 지정할까요?
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingTemporaryHolidayDate("")}
                    className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[15px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => addTemporaryHoliday(pendingTemporaryHolidayDate)}
                    className="h-11 rounded-[8px] bg-[#2f7866] text-[15px] font-semibold text-white hover:bg-[#286b5b]"
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
        <WebSurface className="p-4">
          <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-3">
            <p className="text-[16px] font-semibold text-[#334155]">예약 가능 시간</p>
            <div className="flex items-center gap-4">
              <TimeInput value={bookingSettings.firstBookingTime} onChange={(value) => updateBookingSetting("firstBookingTime", value, true)} />
              <span className="text-[#94a3b8]">-</span>
              <TimeInput value={bookingSettings.lastBookingTime} onChange={(value) => updateBookingSetting("lastBookingTime", value, true)} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3">
            <p className="pt-2 text-[16px] font-semibold text-[#334155]">예약 간격</p>
            <div className="min-w-0">
              <div className="relative w-[188px]">
                <select
                  value={bookingSettings.intervalMinutes}
                  onChange={(event) => updateBookingSetting("intervalMinutes", event.target.value, true)}
                  className="h-10 w-full appearance-none rounded-[8px] border border-[#dbe2ea] bg-white px-3 pr-9 text-[16px] font-semibold text-[#111827] outline-none transition focus:border-[#2f7866] focus:ring-[3px] focus:ring-[#2f7866]/10"
                >
                  <option value="15">15분</option>
                  <option value="30">30분</option>
                  <option value="60">1시간</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111827]" />
              </div>
              <p className="mt-2 text-[16px] leading-6 text-[#64748b]">설정한 예약 가능 시간과 간격은 고객 예약 화면에도 동일하게 보입니다.</p>
            </div>
          </div>

          <div className="mt-4 border-t border-[#edf2f7] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[16px] font-semibold text-[#334155]">예약 제외 시간</p>
              <button type="button" onClick={addBlockedWindow} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#2f7866] hover:bg-[#f8fafc]">
                <Plus className="h-4 w-4" />
                시간 추가
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {bookingSettings.blockedWindows.map((windowItem) => (
                <div key={windowItem.id} className="grid grid-cols-[188px_188px_minmax(0,1fr)_36px] items-center gap-3 rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] p-2">
                  <TimeInput value={windowItem.start} onChange={(value) => updateBlockedWindow(windowItem.id, { start: value })} />
                  <TimeInput value={windowItem.end} onChange={(value) => updateBlockedWindow(windowItem.id, { end: value })} />
                  <input
                    value={windowItem.label}
                    onChange={(event) => updateBlockedWindow(windowItem.id, { label: event.target.value })}
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#111827] outline-none focus:border-[#2f7866]"
                  />
                  <button type="button" onClick={() => removeBlockedWindow(windowItem.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8]" aria-label="예약 제외 시간 삭제">
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
