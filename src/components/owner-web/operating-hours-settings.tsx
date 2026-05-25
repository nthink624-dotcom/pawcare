"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
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
  regularHolidays: string[];
  temporaryHolidays: TemporaryHoliday[];
};

const weekdayLabels: Array<{ key: BusinessDayKey; label: string; shortLabel: string }> = [
  { key: "mon", label: "월요일", shortLabel: "월" },
  { key: "tue", label: "화요일", shortLabel: "화" },
  { key: "wed", label: "수요일", shortLabel: "수" },
  { key: "thu", label: "목요일", shortLabel: "목" },
  { key: "fri", label: "금요일", shortLabel: "금" },
  { key: "sat", label: "토요일", shortLabel: "토" },
  { key: "sun", label: "일요일", shortLabel: "일" },
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

const weekdayIndexByShortLabel = new Map(weekdayLabels.map((day) => [day.shortLabel, weekdayIndexByKey[day.key]]));

const bookingSettingsStorageKey = "petmanager.ownerWeb.operatingHours";
const regularHolidayCycleOptions: Array<{ value: RegularHolidayCycle; label: string }> = [
  { value: "weekly", label: "매주" },
  { value: "biweekly", label: "격주" },
];

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

function createMonthCursor(dateKey?: string) {
  const source = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  return `${source.getFullYear()}-${String(source.getMonth() + 1).padStart(2, "0")}`;
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

function getDateWeekdayShortLabel(dateKey: string) {
  const weekdayShortLabels = ["일", "월", "화", "수", "목", "금", "토"];
  return weekdayShortLabels[new Date(`${dateKey}T00:00:00`).getDay()] ?? "";
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
    const hours = shop.business_hours[weekday] ?? { open: "10:00", close: "19:00", enabled: !shop.regular_closed_days.includes(weekday) };
    return {
      ...day,
      enabled: Boolean(hours.enabled) && !shop.regular_closed_days.includes(weekday),
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
        enabled: day.enabled,
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
  return [...shop.temporary_closed_dates]
    .sort()
    .map((date, index) => ({ id: `holiday-${index + 1}`, date, label: "임시 휴무" }));
}

function defaultBookingSettings(shop?: Shop): BookingSettingsState {
  const base: BookingSettingsState = {
    firstBookingTime: shop?.booking_available_start_time ?? "10:00",
    lastBookingTime: shop?.booking_available_end_time ?? "17:00",
    intervalMinutes: String(shop?.booking_slot_interval_minutes ?? 30),
    blockedWindows: [
      { id: "lunch", start: "13:00", end: "14:00", label: "점심시간" },
      { id: "cleaning", start: "16:00", end: "16:30", label: "정리 시간" },
    ],
    regularHolidays: shop ? createRegularHolidayLabelsFromShop(shop) : ["일"],
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
          className="h-full w-full appearance-none bg-transparent pl-5 pr-9 text-[16px] font-semibold text-[#111827] outline-none disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
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
  const [activeTab, setActiveTab] = useState<OperatingHoursTab>("business");
  const [regularHolidayCycle, setRegularHolidayCycle] = useState<RegularHolidayCycle>("weekly");
  const [temporaryHolidayMonth, setTemporaryHolidayMonth] = useState(() => createMonthCursor(readInitialBookingSettings(shop).temporaryHolidays[0]?.date));
  const [pendingTemporaryHolidayDate, setPendingTemporaryHolidayDate] = useState("");

  useEffect(() => {
    if (persistToSupabase) return;
    try {
      window.localStorage.setItem(bookingSettingsStorageKey, JSON.stringify(bookingSettings));
    } catch {
      // Keep edited values for the current session if local storage is blocked.
    }
  }, [bookingSettings, persistToSupabase]);

  const tabItems: Array<{ key: OperatingHoursTab; label: string }> = [
    { key: "business", label: "매장 운영시간" },
    { key: "booking", label: "미용 예약 가능 시간" },
  ];
  const temporaryHolidayDates = new Set(bookingSettings.temporaryHolidays.map((holiday) => holiday.date));
  const temporaryHolidayCalendarCells = getMonthCalendarCells(temporaryHolidayMonth);
  const temporaryHolidayMonthLabel = temporaryHolidayMonth.replace("-", "년 ") + "월";
  const regularClosedDayLabels = new Set(businessDays.filter((day) => !day.enabled).map((day) => day.shortLabel));

  function buildNextShop(nextDays: BusinessDay[], nextSettings: BookingSettingsState) {
    if (!shop) return null;

    return {
      ...shop,
      business_hours: createBusinessHoursPayload(nextDays),
      regular_closed_days: createRegularClosedDaysPayload(nextDays),
      temporary_closed_dates: nextSettings.temporaryHolidays.map((holiday) => holiday.date).sort(),
      booking_slot_interval_minutes: Number(nextSettings.intervalMinutes),
      booking_available_start_time: nextSettings.firstBookingTime,
      booking_available_end_time: nextSettings.lastBookingTime,
    };
  }

  async function persistShopOperatingHours(nextDays: BusinessDay[], nextSettings: BookingSettingsState) {
    const nextShop = buildNextShop(nextDays, nextSettings);
    if (!nextShop) return;

    onShopChange?.(nextShop);
    if (!persistToSupabase || nextShop.id === "demo-shop" || nextShop.id === "owner-demo") return;

    try {
      const savedShop = await fetchApiJsonWithAuth<Shop>("/api/settings", {
        method: "PATCH",
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
          temporaryClosedDates: nextShop.temporary_closed_dates,
          businessHours: nextShop.business_hours,
          notificationSettings: {
            enabled: nextShop.notification_settings.enabled,
            revisitEnabled: nextShop.notification_settings.revisit_enabled,
            bookingConfirmedEnabled: nextShop.notification_settings.booking_confirmed_enabled,
            bookingRejectedEnabled: nextShop.notification_settings.booking_rejected_enabled,
            bookingCancelledEnabled: nextShop.notification_settings.booking_cancelled_enabled,
            bookingRescheduledEnabled: nextShop.notification_settings.booking_rescheduled_enabled,
            groomingAlmostDoneEnabled: nextShop.notification_settings.grooming_almost_done_enabled,
            groomingCompletedEnabled: nextShop.notification_settings.grooming_completed_enabled,
          },
        }),
      });
      onShopChange?.(savedShop);
    } catch (error) {
      console.error("[OWNER SETTINGS] failed to save operating hours", error);
    }
  }

  function commitBusinessDays(nextDays: BusinessDay[], nextSettings = bookingSettings) {
    setBusinessDays(nextDays);
    const firstEnabled = nextDays.find((day) => day.enabled);
    if (firstEnabled) onBusinessHoursChange(`${firstEnabled.open} - ${firstEnabled.close}`);
    onClosedDaysChange(formatClosedDays(nextDays.filter((day) => !day.enabled).map((day) => day.shortLabel)));
    void persistShopOperatingHours(nextDays, nextSettings);
  }

  function updateBusinessDay(dayKey: BusinessDayKey, patch: Partial<BusinessDay>) {
    const nextDays = businessDays.map((day) => (day.key === dayKey ? { ...day, ...patch } : day));
    const target = nextDays.find((day) => day.key === dayKey);
    if (target) {
      const nextRegularHolidays = target.enabled
        ? bookingSettings.regularHolidays.filter((day) => day !== target.shortLabel)
        : Array.from(new Set([...bookingSettings.regularHolidays, target.shortLabel]));
      const nextSettings = { ...bookingSettings, regularHolidays: nextRegularHolidays };
      setBookingSettings(nextSettings);
      commitBusinessDays(nextDays, nextSettings);
      return;
    }
    commitBusinessDays(nextDays);
  }

  function applyMondayTimeToAllDays() {
    const monday = businessDays.find((day) => day.key === "mon") ?? businessDays[0];
    commitBusinessDays(businessDays.map((day) => ({ ...day, open: monday.open, close: monday.close })));
  }

  function updateBookingSetting<K extends keyof BookingSettingsState>(key: K, value: BookingSettingsState[K], shouldPersistShop = false) {
    const nextSettings = { ...bookingSettings, [key]: value };
    setBookingSettings((current) => ({ ...current, [key]: value }));
    if (shouldPersistShop) void persistShopOperatingHours(businessDays, nextSettings);
  }

  function toggleRegularHoliday(dayLabel: string) {
    const nextRegularHolidays = bookingSettings.regularHolidays.includes(dayLabel)
      ? bookingSettings.regularHolidays.filter((day) => day !== dayLabel)
      : [...bookingSettings.regularHolidays, dayLabel];
    const nextSettings = { ...bookingSettings, regularHolidays: nextRegularHolidays };
    setBookingSettings(nextSettings);
    commitBusinessDays(
      businessDays.map((day) => (day.shortLabel === dayLabel ? { ...day, enabled: !nextRegularHolidays.includes(dayLabel) } : day)),
      nextSettings,
    );
  }

  function addTemporaryHoliday(dateKey: string) {
    if (!dateKey || temporaryHolidayDates.has(dateKey)) return;
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

  function updateTemporaryHoliday(id: string, patch: Partial<TemporaryHoliday>) {
    const nextSettings = {
      ...bookingSettings,
      temporaryHolidays: bookingSettings.temporaryHolidays.map((holiday) => (holiday.id === id ? { ...holiday, ...patch } : holiday)),
    };
    setBookingSettings(nextSettings);
    void persistShopOperatingHours(businessDays, nextSettings);
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
    setBookingSettings((current) => ({
      ...current,
      blockedWindows: [
        ...current.blockedWindows,
        { id: createNextItemId(current.blockedWindows, "block"), start: "15:00", end: "15:30", label: "예약 제외 시간" },
      ],
    }));
  }

  function updateBlockedWindow(id: string, patch: Partial<BookingWindow>) {
    updateBookingSetting(
      "blockedWindows",
      bookingSettings.blockedWindows.map((windowItem) => (windowItem.id === id ? { ...windowItem, ...patch } : windowItem)),
    );
  }

  function removeBlockedWindow(id: string) {
    updateBookingSetting("blockedWindows", bookingSettings.blockedWindows.filter((windowItem) => windowItem.id !== id));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-5 border-b border-[#dbe2ea] pb-3">
        {tabItems.map((item) => (
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
            <div className="border-b border-[#edf2f7] pb-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[16px] font-semibold text-[#111827]">정기 휴무일</p>
                <span className="text-[15px] font-medium text-[#64748b]">{regularHolidayCycle === "weekly" ? "매주" : "격주"}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-[10px] bg-[#f3f4f6] p-1">
                {regularHolidayCycleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRegularHolidayCycle(option.value)}
                    className={cn(
                      "h-10 rounded-[8px] text-[16px] font-semibold transition",
                      regularHolidayCycle === option.value
                        ? "bg-white text-[#111827] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                        : "text-[#64748b] hover:text-[#111827]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {weekdayLabels.map((day) => {
                  const active = bookingSettings.regularHolidays.includes(day.shortLabel);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleRegularHoliday(day.shortLabel)}
                      className={cn(
                        "h-10 rounded-[8px] text-[16px] font-semibold transition",
                        active ? "bg-[#64748b] text-white" : "bg-[#f3f4f6] text-[#64748b] hover:bg-[#e9edf2] hover:text-[#111827]",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-[#edf2f7]">
              {businessDays.map((day) => (
                <div key={day.key} className="grid grid-cols-[92px_150px_minmax(420px,1fr)_190px] items-center gap-6 py-3.5">
                  <p className="text-[16px] font-semibold text-[#111827]">{day.label}</p>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} />
                    <span className={cn("text-[16px] font-medium", day.enabled ? "text-[#2f7866]" : "text-[#64748b]")}>
                      {day.enabled ? "영업함" : "휴무일"}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-4">
                    {day.enabled ? (
                      <>
                        <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} />
                        <span className="text-[16px] font-semibold text-[#94a3b8]">-</span>
                        <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} />
                      </>
                    ) : (
                      <span className="inline-flex h-10 w-[280px] items-center justify-center text-[16px] font-semibold text-[#64748b]">휴무</span>
                    )}
                  </div>
                  <div className="flex justify-end">
                    {day.key === "mon" ? (
                      <button type="button" onClick={applyMondayTimeToAllDays} className="h-9 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#334155] hover:bg-[#f8fafc]">
                        월요일 시간 전체 적용
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </WebSurface>

          <WebSurface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[18px] font-semibold text-[#111827]">임시 휴무일 설정</p>
            </div>
            <div className="mt-3 rounded-[10px] border border-[#edf2f7] bg-[#fbfcfd] p-3">
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
                  <span key={label} className={cn(label === "일" && "text-[#a04455]")}>
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {temporaryHolidayCalendarCells.map((dateKey, index) => {
                  if (!dateKey) return <span key={`empty-${index}`} className="h-9" />;
                  const saved = temporaryHolidayDates.has(dateKey);
                  const weekdayLabel = getDateWeekdayShortLabel(dateKey);
                  const isSunday = weekdayLabel === "일";
                  const regularClosed = regularClosedDayLabels.has(weekdayLabel);
                  const closed = saved || regularClosed;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => {
                        if (!saved) setPendingTemporaryHolidayDate(dateKey);
                      }}
                      className={cn(
                        "h-9 rounded-[8px] text-[15px] font-semibold transition",
                        closed || isSunday ? "text-[#a04455] hover:text-[#8f2438]" : "text-[#334155] hover:text-[#2f7866]",
                      )}
                    >
                      {Number(dateKey.slice(-2))}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {bookingSettings.temporaryHolidays.map((holiday) => (
                <div key={holiday.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd] p-2">
                  <input
                    type="date"
                    value={holiday.date}
                    onChange={(event) => updateTemporaryHoliday(holiday.id, { date: event.target.value })}
                    className="h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-semibold text-[#111827] outline-none focus:border-[#2f7866]"
                  />
                  <button type="button" onClick={() => removeTemporaryHoliday(holiday.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8]" aria-label="임시 휴무 삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <input
                    value={holiday.label}
                    onChange={(event) => updateTemporaryHoliday(holiday.id, { label: event.target.value })}
                    className="col-span-2 h-10 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium text-[#111827] outline-none focus:border-[#2f7866]"
                  />
                </div>
              ))}
            </div>
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
