"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Info, Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OwnerInitialSetupSaveNextActions } from "@/components/owner-web/owner-initial-setup-guide";
import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { bookingCloseGraceMinuteOptions } from "@/lib/booking-last-start-cutoff";
import { normalizeBookingBlockedWindows, normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
import { cn } from "@/lib/utils";
import type { BusinessHours, RegularClosedCycle, Shop } from "@/types/domain";

type BusinessDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type OperatingHoursTab = "business" | "booking";
type RegularHolidayCycle = RegularClosedCycle;

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
  closeGraceMinutes: 0 | 15 | 30 | 60;
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
];

const extendedRegularHolidayCycleOptions: Array<{ value: RegularHolidayCycle; label: string }> = [
  ...regularHolidayCycleOptions,
  { value: "monthly_1_3", label: "1·3주" },
  { value: "monthly_2_4", label: "2·4주" },
];

const bookingSettingsStorageKey = "petmanager.ownerWeb.operatingHours";

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

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
    const cycle = shop.reservation_policy_settings.regular_closed_cycle ?? "weekly";
    return cycle === "biweekly" ? "weekly" : cycle;
  }
  return shop?.regular_closed_cycle === "biweekly" ? "weekly" : shop?.regular_closed_cycle ?? "weekly";
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

function getWeekAnchorDateKey(offsetWeeks = 0) {
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + offsetWeeks * 7);
  return formatDateKey(weekStart);
}

function isBiweeklyClosedDate(dateKey: string, anchorDateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const anchor = new Date(`${anchorDateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(anchor.getTime())) return true;
  const diffDays = Math.round((getWeekStart(date).getTime() - getWeekStart(anchor).getTime()) / (24 * 60 * 60 * 1000));
  return Math.abs(Math.trunc(diffDays / 7)) % 2 === 0;
}

function getWeekOfMonthFromDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return 0;
  return Math.ceil(date.getDate() / 7);
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
  const normalizedPolicy = normalizeReservationPolicySettings(shop?.reservation_policy_settings);
  const base: BookingSettingsState = {
    firstBookingTime: shop?.booking_available_start_time ?? "10:00",
    lastBookingTime: shop?.booking_available_end_time ?? "17:00",
    closeGraceMinutes: normalizedPolicy.booking_close_grace_minutes ?? 0,
    blockedWindows: blockedWindows.map((windowItem, index) => ({
      id: windowItem.id ?? `block-${index + 1}`,
      start: windowItem.start,
      end: windowItem.end,
      label: windowItem.label ?? "",
    })),
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
        "relative inline-flex translate-y-px shrink-0 items-center rounded-full align-middle transition",
        compact ? "h-[26px] w-[48px]" : "h-[26px] w-[48px]",
        checked ? "bg-[#2f7866]" : "bg-[#e2e8f0]",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition",
          checked ? "left-[24px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

function getWheelOption(options: string[], value: string, offset: number) {
  const currentIndex = Math.max(0, options.indexOf(value));
  const nextIndex = (currentIndex + offset + options.length) % options.length;
  return options[nextIndex] ?? value;
}

function TimeWheelColumn({
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  ariaLabel,
  getLabel = (option) => option,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  ariaLabel: string;
  getLabel?: (option: string) => string;
}) {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const previousValue = getWheelOption(options, value, -1);
  const farPreviousValue = getWheelOption(options, value, -2);
  const nextValue = getWheelOption(options, value, 1);
  const farNextValue = getWheelOption(options, value, 2);

  function move(offset: number) {
    if (disabled) return;
    onChange(getWheelOption(options, value, offset));
  }

  useEffect(() => {
    const element = wheelRef.current;
    if (!element || disabled) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      move(event.deltaY > 0 ? 1 : -1);
    }

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleNativeWheel);
  }, [disabled, options, value]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    }
  }

  return (
    <div
      ref={wheelRef}
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuetext={getLabel(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex min-w-0 flex-1 select-none flex-col items-center justify-center rounded-[8px] outline-none transition focus:bg-[#f8fafc] focus:ring-[2px] focus:ring-[#64748b]/12",
        disabled && "pointer-events-none text-[#94a3b8]",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => move(-2)}
        className={cn(
          "w-full text-center font-normal text-[#c3cad4] transition hover:text-[#64748b]",
          compact ? "h-4 text-[12px] leading-4" : "h-5 text-[14px] leading-5",
        )}
      >
        {getLabel(farPreviousValue)}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => move(-1)}
        className={cn(
          "w-full text-center font-normal text-[#a8b0bd] transition hover:text-[#64748b]",
          compact ? "h-5 text-[13px] leading-5" : "h-6 text-[14px] leading-5",
        )}
      >
        {getLabel(previousValue)}
      </button>
      <div
        className={cn(
          "relative flex w-full items-center justify-center border-y border-[#dbe2ea] bg-[#f8fafc] text-center font-normal text-[#111827]",
          compact ? "h-7 text-[16px]" : "h-8 text-[18px]",
        )}
      >
        {getLabel(value)}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => move(1)}
        className={cn(
          "w-full text-center font-normal text-[#a8b0bd] transition hover:text-[#64748b]",
          compact ? "h-5 text-[13px] leading-5" : "h-6 text-[14px] leading-5",
        )}
      >
        {getLabel(nextValue)}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => move(2)}
        className={cn(
          "w-full text-center font-normal text-[#c3cad4] transition hover:text-[#64748b]",
          compact ? "h-4 text-[12px] leading-4" : "h-5 text-[14px] leading-5",
        )}
      >
        {getLabel(farNextValue)}
      </button>
    </div>
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
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const popoverWidth = compact ? 228 : 256;
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 });
  const displayHourValue = hourOptions.includes(hourText) ? hourText : "10";
  const displayMinuteValue = minuteOptions.includes(minuteText) ? minuteText : "00";
  const displayValue = `${displayHourValue}:${displayMinuteValue}`;

  const updatePopoverPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - popoverWidth),
      window.innerWidth - popoverWidth - viewportPadding,
    );
    setPopoverPosition({
      left,
      top: rect.bottom + 6,
    });
  }, [popoverWidth, setPopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(updatePopoverPosition);

    function handleDocumentMouseDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  function commit(nextDisplayHour: string, nextDisplayMinute: string) {
    const nextValue = `${nextDisplayHour}:${nextDisplayMinute}`;
    onChange(nextValue);
  }

  return (
    <div ref={pickerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label="시간 선택"
        aria-expanded={open}
        onClick={() => {
          if (!open) updatePopoverPosition();
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex items-center justify-between rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] leading-6 font-medium text-[#111827] outline-none transition hover:bg-[#f8fafc] focus:border-[#94a3b8] focus:ring-[3px] focus:ring-[#64748b]/10 disabled:bg-[#f8fafc] disabled:text-[#94a3b8]",
          compact ? "min-h-11 w-[88px] px-2" : "min-h-11 w-[116px] px-3",
        )}
      >
        <span>{displayValue}</span>
        <ChevronDown className={cn("text-[#64748b]", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </button>

      {open ? (
        <div
          className={cn(
            "fixed z-[120] rounded-[12px] border border-[#dbe2ea] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.14)]",
          )}
          style={{ left: popoverPosition.left, top: popoverPosition.top, width: popoverWidth }}
        >
          <div className={cn("flex items-center", compact ? "gap-4" : "gap-5")}>
            <TimeWheelColumn
              value={displayHourValue}
              disabled={disabled}
              compact={compact}
              options={hourOptions}
              onChange={(nextDisplayHour) => commit(nextDisplayHour, displayMinuteValue)}
              ariaLabel="시 조정"
            />
            <span className={cn("shrink-0 text-center font-normal text-[#111827]", compact ? "w-3 text-[16px]" : "w-4 text-[18px]")}>:</span>
            <TimeWheelColumn
              value={displayMinuteValue}
              disabled={disabled}
              compact={compact}
              options={minuteOptions}
              onChange={(nextDisplayMinute) => commit(displayHourValue, nextDisplayMinute)}
              ariaLabel="분 조정"
            />
          </div>
        </div>
      ) : null}
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
  onSaveSuccess,
  onInitialSetupNext,
  persistToSupabase = false,
  initialSetupMode = false,
  compact = false,
}: {
  businessHoursValue: string | boolean | number;
  closedDaysValue: string | boolean | number;
  onBusinessHoursChange: (value: string) => void;
  onClosedDaysChange: (value: string) => void;
  shop?: Shop;
  onShopChange?: (shop: Shop) => void;
  onSaveSuccess?: () => void;
  onInitialSetupNext?: () => void;
  persistToSupabase?: boolean;
  initialSetupMode?: boolean;
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
  const [initialSetupSubview, setInitialSetupSubview] = useState<"hours" | "closures">("hours");
  const [regularHolidayCycle, setRegularHolidayCycle] = useState<RegularHolidayCycle>(getRegularHolidayCycle(shop));
  const [regularHolidayAnchorDate, setRegularHolidayAnchorDate] = useState(getRegularHolidayAnchorDate(shop) ?? getWeekAnchorDateKey());

  useEffect(() => {
    if (initialSetupMode) {
      setActiveTab("business");
      setInitialSetupSubview("hours");
    }
  }, [initialSetupMode]);
  const [regularHolidayMonth, setRegularHolidayMonth] = useState(() => createMonthCursor());
  const [pendingTemporaryHolidayDate, setPendingTemporaryHolidayDate] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isCompletingInitialSetup, setIsCompletingInitialSetup] = useState(false);
  useEffect(() => {
    if (persistToSupabase) return;
    try {
      window.localStorage.setItem(bookingSettingsStorageKey, JSON.stringify(bookingSettings));
    } catch {
      // Keep edited values for the current session if local storage is blocked.
    }
  }, [bookingSettings, persistToSupabase]);

  const temporaryHolidayDates = useMemo(() => new Set(bookingSettings.temporaryHolidays.map((holiday) => holiday.date)), [bookingSettings.temporaryHolidays]);
  const regularHolidayCalendarCells = getMonthCalendarCells(regularHolidayMonth);
  const [regularHolidayYear, regularHolidayMonthNumber] = regularHolidayMonth.split("-");
  const regularHolidayMonthLabel = `${regularHolidayYear}년 ${Number(regularHolidayMonthNumber)}월`;
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
      booking_slot_interval_minutes: 15,
      booking_available_start_time: nextSettings.firstBookingTime,
      booking_available_end_time: nextSettings.lastBookingTime,
      reservation_policy_settings: {
        ...normalizeReservationPolicySettings(shop.reservation_policy_settings),
        regular_closed_cycle: cycle,
        regular_closed_anchor_date: cycle === "biweekly" ? anchorDate : null,
        booking_close_grace_minutes: nextSettings.closeGraceMinutes,
        booking_blocked_windows: normalizeBookingBlockedWindows(nextSettings.blockedWindows),
      },
    };
  }

  async function persistShopOperatingHours(
    nextDays: BusinessDay[],
    nextSettings: BookingSettingsState,
    cycle = regularHolidayCycle,
    anchorDate = regularHolidayAnchorDate,
    notifySuccess = !initialSetupMode,
  ) {
    const nextShop = buildNextShop(nextDays, nextSettings, cycle, anchorDate);
    if (!nextShop) return false;

    onShopChange?.(nextShop);
    if (!persistToSupabase || nextShop.id === "demo-shop" || nextShop.id === "owner-demo") {
      if (notifySuccess) onSaveSuccess?.();
      return true;
    }

    try {
      setSaveError("");
      const savedShop = await fetchApiJsonWithAuth<Shop>("/api/settings", {
        method: "PATCH",
        cache: "no-store",
        body: JSON.stringify(initialSetupMode ? {
          shopId: nextShop.id,
          bookingAvailableStartTime: nextShop.booking_available_start_time,
          bookingAvailableEndTime: nextShop.booking_available_end_time,
          regularClosedDays: nextShop.regular_closed_days,
          regularClosedCycle: nextShop.regular_closed_cycle ?? "weekly",
          regularClosedAnchorDate: nextShop.regular_closed_anchor_date ?? null,
          temporaryClosedDates: nextShop.temporary_closed_dates,
          businessHours: nextShop.business_hours,
        } : {
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
      if (notifySuccess) onSaveSuccess?.();
      return true;
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
    if (!initialSetupMode) void persistShopOperatingHours(nextDays, nextSettings);
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
    if (shouldPersistShop && !initialSetupMode) void persistShopOperatingHours(businessDays, nextSettings);
  }

  function updateRegularHolidayCycle(cycle: RegularHolidayCycle) {
    setRegularHolidayCycle(cycle);
    if (!initialSetupMode) void persistShopOperatingHours(businessDays, bookingSettings, cycle, regularHolidayAnchorDate);
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
    if (!initialSetupMode) void persistShopOperatingHours(businessDays, nextSettings);
    setPendingTemporaryHolidayDate("");
  }

  function removeTemporaryHoliday(id: string) {
    const nextSettings = {
      ...bookingSettings,
      temporaryHolidays: bookingSettings.temporaryHolidays.filter((holiday) => holiday.id !== id),
    };
    setBookingSettings(nextSettings);
    if (!initialSetupMode) void persistShopOperatingHours(businessDays, nextSettings);
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
    if (!initialSetupMode) void persistShopOperatingHours(businessDays, nextSettings);
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
    if (regularHolidayCycle === "biweekly") return isBiweeklyClosedDate(dateKey, regularHolidayAnchorDate);
    if (regularHolidayCycle === "monthly_1_3") return [1, 3].includes(getWeekOfMonthFromDateKey(dateKey));
    if (regularHolidayCycle === "monthly_2_4") return [2, 4].includes(getWeekOfMonthFromDateKey(dateKey));
    return false;
  }

  async function completeInitialSetupStep() {
    if (isCompletingInitialSetup) return;
    setIsCompletingInitialSetup(true);
    setSaveError("");
    try {
      return await persistShopOperatingHours(
        businessDays,
        bookingSettings,
        regularHolidayCycle,
        regularHolidayAnchorDate,
        true,
      );
    } finally {
      setIsCompletingInitialSetup(false);
    }
  }

  function renderRegularHolidayCalendarPreview() {
    return (
      <div className="mt-2 rounded-[8px] border border-[#e5e7eb] bg-white p-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRegularHolidayMonth((current) => moveMonth(current, -1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <p className="text-[16px] leading-6 font-normal text-[#111827]">{regularHolidayMonthLabel}</p>
          <button
            type="button"
            onClick={() => setRegularHolidayMonth((current) => moveMonth(current, 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[7px] border border-[#dbe2ea] bg-white text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="다음 달"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[13px] leading-5 font-normal text-[#64748b]">
          {weekdayLabels.map((day) => (
            <span key={day.key} className={cn(day.key === "sun" && "text-[#c13f52]")}>
              {day.shortLabel}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {regularHolidayCalendarCells.map((dateKey, index) => {
            if (!dateKey) return <span key={`regular-empty-${index}`} className="h-11" />;
            const savedTemporaryHoliday = bookingSettings.temporaryHolidays.find((holiday) => holiday.date === dateKey);
            const saved = Boolean(savedTemporaryHoliday);
            const regularClosed = isRegularClosedDate(dateKey);
            const closed = saved || regularClosed;
            const isToday = dateKey === todayKey();
            return (
              <button
                key={dateKey}
                type="button"
                disabled={dateKey < todayKey()}
                onClick={() => {
                  if (savedTemporaryHoliday) {
                    removeTemporaryHoliday(savedTemporaryHoliday.id);
                    return;
                  }
                  if (dateKey >= todayKey()) {
                    if (initialSetupMode) {
                      addTemporaryHoliday(dateKey);
                    } else {
                      setPendingTemporaryHolidayDate(dateKey);
                    }
                  }
                }}
                className={cn(
                  "flex h-11 items-center justify-center rounded-[7px] border text-[16px] leading-6 font-medium transition",
                  saved ? "border-[#a04455] bg-[#fff1f3] text-[#a04455]" : regularClosed ? "border-[#f0a8b4] bg-[#fff7f8] text-[#c13f52]" : "border-transparent text-[#334155] hover:bg-[#f8fafc]",
                  isToday && !closed && "border-[#dbe2ea] bg-[#f8fafc] text-[#111827]",
                  regularClosed && !saved && "cursor-default",
                )}
              >
                {Number(dateKey.slice(-2))}
              </button>
            );
          })}
        </div>
        {bookingSettings.temporaryHolidays.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {bookingSettings.temporaryHolidays.map((holiday) => (
              <span key={holiday.id} className="inline-flex h-7 items-center gap-1 rounded-full border border-[#dbe2ea] bg-[#fbfcfd] pl-2 pr-1 text-[12px] font-normal text-[#334155]">
                {holiday.date.slice(5)}
                <button type="button" onClick={() => removeTemporaryHoliday(holiday.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#a04455] hover:bg-[#fff1f3]" aria-label="임시 휴무 삭제">
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {saveError ? (
          <p className="rounded-[8px] border border-[#f3c7c7] bg-[#fffafa] px-3 py-2 text-[14px] leading-5 text-[#b42318]">
            {saveError}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] bg-[#fbfcfd] px-4 py-3">
            <div>
              <p className="text-[16px] font-medium leading-6 text-[#111827]">공통 적용</p>
              <p className="mt-0.5 text-[13px] leading-5 font-normal text-[#64748b]">예외 요일만 따로 수정</p>
            </div>
            <div className="grid grid-cols-[88px_12px_88px_auto] items-center justify-end gap-1 sm:gap-2">
              <TimeInput value={bulkOpenTime} onChange={setBulkOpenTime} compact />
              <span className="inline-flex h-8 items-center justify-center text-[13px] font-normal text-[#94a3b8]">~</span>
              <TimeInput value={bulkCloseTime} onChange={setBulkCloseTime} compact />
              <button
                type="button"
                onClick={applyBulkTimeToAllDays}
                className="min-h-11 whitespace-nowrap rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[16px] leading-6 font-medium text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                적용
              </button>
            </div>
          </div>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.86fr)]">
            <div className="divide-y divide-[#f1f5f9]">
              {businessDays.map((day) => (
                <div key={day.key} className="grid min-h-[48px] grid-cols-[28px_minmax(0,1fr)] items-center gap-2 px-4 py-2 sm:grid-cols-[28px_90px_minmax(0,1fr)]">
                  <span className="text-[16px] leading-6 font-normal text-[#111827]">{day.shortLabel}</span>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} compact />
                    <span className={cn("whitespace-nowrap text-[16px] leading-6 font-normal", day.enabled ? "text-[#334155]" : "text-[#64748b]")}>{day.enabled ? "영업" : "휴무"}</span>
                  </div>
                  {day.enabled ? (
                    <div className="col-span-2 ml-auto grid grid-cols-[88px_20px_88px] sm:col-span-1 items-center justify-end gap-2">
                      <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} compact />
                      <span className="inline-flex h-8 items-center justify-center text-[13px] font-normal text-[#94a3b8]">~</span>
                      <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} compact />
                    </div>
                  ) : (
                    <p className="col-span-2 ml-auto rounded-[8px] bg-[#f8fafc] sm:col-span-1 px-3 py-1.5 text-[16px] leading-6 font-normal text-[#64748b]">예약 없음</p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-[#edf2f7] px-4 py-3 xl:border-l xl:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[16px] leading-6 font-normal text-[#111827]">정기 휴무일</p>
                <div className="grid w-[190px] grid-cols-3 gap-1 rounded-[8px] border border-[#e4ebf2] bg-[#f8fafc] p-1">
                  {extendedRegularHolidayCycleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateRegularHolidayCycle(option.value)}
                      className={cn(
                        "min-h-11 rounded-[7px] text-[16px] leading-6 font-medium transition",
                        regularHolidayCycle === option.value ? "bg-white text-[#111827] shadow-sm" : "text-[#64748b] hover:bg-white/70",
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
                        "min-h-11 rounded-[8px] border text-[16px] leading-6 font-medium transition",
                        active ? "border-[#f0a8b4] bg-[#fff7f8] text-[#c13f52]" : "border-[#dbe2ea] bg-white text-[#475569]",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>
              {renderRegularHolidayCalendarPreview()}
            </div>
          </div>

          <div className="border-t border-[#edf2f7] px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
              <label htmlFor="compact-booking-close-grace" className="text-[16px] font-medium leading-6 text-[#111827]">마감 여유</label>
              <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <select
                  id="compact-booking-close-grace"
                  value={bookingSettings.closeGraceMinutes}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value) as (typeof bookingCloseGraceMinuteOptions)[number];
                    updateBookingSetting("closeGraceMinutes", nextValue, true);
                  }}
                  className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 text-[#15213b] outline-none transition hover:bg-[#f8fafc] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
                >
                  {bookingCloseGraceMinuteOptions.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "여유 없음" : `${minutes}분${minutes === 15 ? " · 권장" : ""}`}
                    </option>
                  ))}
                </select>
                <p className="text-[13px] font-normal leading-5 text-[#64748b] sm:shrink-0">
                  영업 마감 뒤 허용할 종료 여유
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-[#edf2f7] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[16px] font-medium leading-6 text-[#111827]">예약 금지 시간</p>
                <button type="button" onClick={addBlockedWindow} className="inline-flex min-h-11 items-center gap-1 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] leading-6 font-medium text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
                  <Plus className="h-3.5 w-3.5" />
                  금지 시간 추가
                </button>
              </div>
              {bookingSettings.blockedWindows.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  <p className="text-[13px] font-normal leading-5 text-[#64748b]">등록한 시간에는 예약을 받지 않습니다.</p>
                  {bookingSettings.blockedWindows.map((windowItem) => (
                    <div key={windowItem.id} className="grid min-w-0 grid-cols-[minmax(0,88px)_18px_minmax(0,88px)_minmax(0,1fr)_44px] items-center gap-2 rounded-[10px] border border-[#edf2f7] bg-[#fbfcfd] p-2">
                      <TimeInput value={windowItem.start} onChange={(value) => updateBlockedWindow(windowItem.id, { start: value })} compact />
                      <span className="text-center text-[16px] leading-6 font-normal text-[#94a3b8]">~</span>
                      <TimeInput value={windowItem.end} onChange={(value) => updateBlockedWindow(windowItem.id, { end: value })} compact />
                      <input
                        value={windowItem.label}
                        onChange={(event) => updateBlockedWindow(windowItem.id, { label: event.target.value })}
                        className="min-h-11 min-w-0 rounded-[8px] border border-[#dbe2ea] bg-white px-2.5 text-[16px] leading-6 font-normal text-[#111827] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
                      />
                      <button type="button" onClick={() => removeBlockedWindow(windowItem.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" aria-label="예약 제외 시간 삭제">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {pendingTemporaryHolidayDate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/20 px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-[360px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
              <p className="text-[20px] leading-7 font-semibold text-[#111827]">임시 휴무일 지정</p>
              <p className="mt-3 text-[16px] leading-6 font-normal leading-6 text-[#475569]">
                {pendingTemporaryHolidayDate}을 임시 휴무일로 지정할까요?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPendingTemporaryHolidayDate("")}
                  className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] font-medium leading-6 text-[#334155] hover:bg-[#f8fafc]"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => addTemporaryHoliday(pendingTemporaryHolidayDate)}
                  className="h-11 rounded-[8px] bg-[#2f7866] text-[16px] font-medium leading-6 text-white hover:bg-[#286b5b]"
                >
                  지정하기
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
      {!initialSetupMode ? (
        <div className={cn("flex items-center border-b border-[#dbe2ea]", compact ? "mb-2 gap-2 pb-2" : "mb-3 gap-5 pb-3")}>
          {[
            { key: "business" as const, label: "매장 영업 시간" },
            { key: "booking" as const, label: "예약 시간 설정" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={cn(
                "rounded-[8px] font-medium transition",
                compact ? "min-h-11 px-3 text-[14px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" : "min-h-11 px-4 text-[16px] leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]",
                activeTab === item.key
                  ? "border border-[#dbe2ea] bg-white text-[#111827] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                  : "text-[#64748b] hover:text-[#111827]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "business" ? (
        <div className={cn("grid", initialSetupMode ? "gap-5" : compact ? "gap-3 xl:grid-cols-[minmax(560px,1fr)_minmax(440px,520px)]" : "gap-4 xl:grid-cols-[minmax(560px,1fr)_minmax(440px,520px)]")}>
          {!initialSetupMode || initialSetupSubview === "hours" ? (
          <WebSurface className={cn("min-w-0 xl:order-2", initialSetupMode ? "rounded-none border-0 p-0" : compact ? "p-3" : "p-4")}>
            <div className="divide-y divide-[#edf2f7]">
              <div
                className={cn(
                  "grid items-center bg-[#fbfcfd]",
                  initialSetupMode
                    ? "grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5 sm:px-4 sm:py-3.5"
                    : compact
                      ? "grid-cols-[118px_minmax(0,1fr)] gap-3 px-3 py-2"
                      : "grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5",
                )}
              >
                <div>
                  <div className="group relative inline-flex items-center gap-1.5">
                    <p className={cn("whitespace-nowrap font-medium text-[#111827] [word-break:keep-all]", compact ? "text-[14px] leading-5" : "text-[16px] leading-6")}>모든 요일 적용 시간</p>
                    <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]" aria-label="모든 요일 적용 시간 도움말">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                    <div className="pointer-events-none absolute left-0 top-7 z-20 w-[240px] rounded-[8px] border border-[#dbe2ea] bg-white px-3 py-2 text-[12px] leading-5 text-[#475569] opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.12)] transition group-hover:opacity-100 group-focus-within:opacity-100">
                      공통 시간을 먼저 맞춘 뒤 예외 요일만 수정합니다.
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "grid items-center",
                  initialSetupMode
                    ? "grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] justify-stretch gap-2 sm:grid-cols-[116px_24px_116px_auto] sm:justify-start sm:gap-3"
                    : compact
                      ? "grid-cols-[96px_24px_96px_auto] justify-start gap-2"
                      : "grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] justify-stretch gap-2 sm:grid-cols-[116px_24px_116px_auto] sm:justify-start sm:gap-3",
                )}>
                  <TimeInput value={bulkOpenTime} onChange={setBulkOpenTime} compact={compact} />
                  <span className={cn("inline-flex items-center justify-center font-normal text-[#94a3b8]", compact ? "h-8 text-[14px]" : "h-10 text-[16px]")}>-</span>
                  <TimeInput value={bulkCloseTime} onChange={setBulkCloseTime} compact={compact} />
                  <button
                    type="button"
                    onClick={applyBulkTimeToAllDays}
                    className={cn(
                      "rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#334155] transition hover:border-[#94a3b8] hover:bg-[#f8fafc]",
                      initialSetupMode
                        ? "col-span-3 min-h-11 w-full px-4 text-[16px] font-medium leading-6 sm:col-span-1 sm:h-10 sm:min-h-0 sm:w-auto"
                        : compact
                          ? "h-8 px-3 text-[14px]"
                          : "col-span-3 min-h-11 w-full px-4 text-[16px] font-medium leading-6 sm:col-span-1 sm:w-auto",
                    )}
                  >
                    적용
                  </button>
                </div>
              </div>
              {businessDays.map((day) => (
                <div
                  key={day.key}
                  className={cn(
                    "grid items-center",
                    initialSetupMode
                      ? "grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 sm:grid-cols-[110px_150px_minmax(0,1fr)] sm:gap-4"
                      : compact
                        ? "grid-cols-[76px_108px_minmax(305px,1fr)] gap-3 py-2"
                        : "grid-cols-[110px_160px_minmax(400px,1fr)] gap-5 py-3.5",
                  )}
                >
                  <p className={cn("font-medium text-[#111827]", compact ? "text-[14px] leading-5" : "text-[16px] leading-6")}>{day.label}</p>
                  <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
                    <ToggleSwitch checked={day.enabled} onChange={() => updateBusinessDay(day.key, { enabled: !day.enabled })} label={`${day.label} 영업 여부`} compact={compact} />
                    <span className={cn("font-normal", compact ? "text-[14px] leading-5" : "text-[16px] leading-6", day.enabled ? "text-[#334155]" : "text-[#64748b]")}>
                      {day.enabled ? "영업함" : "휴무일"}
                    </span>
                  </div>
                  <div className={cn(
                    "grid items-center justify-end",
                    initialSetupMode
                      ? "col-span-2 ml-0 w-full grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] gap-2 sm:col-span-1 sm:ml-auto sm:w-auto sm:grid-cols-[116px_24px_116px] sm:gap-3"
                      : compact
                        ? "ml-auto grid-cols-[96px_24px_96px] gap-2"
                        : "ml-auto grid-cols-[116px_24px_116px] gap-3",
                  )}>
                    {day.enabled ? (
                      <>
                        <TimeInput value={day.open} onChange={(value) => updateBusinessDay(day.key, { open: value })} compact={compact} />
                        <span className={cn("inline-flex items-center justify-center font-normal text-[#94a3b8]", compact ? "h-8 text-[14px]" : "h-10 text-[16px]")}>-</span>
                        <TimeInput value={day.close} onChange={(value) => updateBusinessDay(day.key, { close: value })} compact={compact} />
                      </>
                    ) : (
                      <p className={cn("col-span-3 whitespace-nowrap text-left font-normal text-[#64748b] [word-break:keep-all]", compact ? "text-[14px] leading-5" : "text-[16px] leading-6")}>
                        예약을 받지 않습니다.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {initialSetupMode ? (
              <div className="mt-4 border-t border-[#dbe2ea] pt-4">
                <button
                  type="button"
                  onClick={() => setInitialSetupSubview("closures")}
                  className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-medium leading-6 text-[#15213b] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                >
                  휴무일 추가
                </button>
              </div>
            ) : null}
          </WebSurface>
          ) : null}

          {!initialSetupMode || initialSetupSubview === "closures" ? (
          <WebSurface className={cn("xl:order-1", initialSetupMode ? "rounded-none border-0 p-0" : compact ? "p-3" : "p-4")}>
            {initialSetupMode ? (
              <button
                type="button"
                onClick={() => setInitialSetupSubview("hours")}
                className="mb-4 inline-flex min-h-11 items-center justify-center gap-1 rounded-[8px] px-2 text-[16px] font-medium leading-6 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                영업시간으로 돌아가기
              </button>
            ) : null}
            <div className={cn("border-b border-[#edf2f7]", compact ? "pb-3" : "pb-4")}>
              <p className={cn("text-[#111827]", initialSetupMode ? "text-[20px] font-semibold leading-7" : compact ? "text-[18px] font-semibold leading-[26px]" : "text-[18px] font-semibold leading-[26px]")}>{initialSetupMode ? "휴무일 추가" : "정기 휴무일"}</p>
              <div className={cn("grid grid-cols-3 gap-1 rounded-[10px] border border-[#e4ebf2] bg-[#f8fafc] p-1", compact ? "mt-2" : "mt-4")}>
                {extendedRegularHolidayCycleOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateRegularHolidayCycle(option.value)}
                    className={cn(
                      "rounded-[8px] font-medium transition",
                      compact ? "h-8 text-[14px] leading-5" : "h-10 text-[16px] leading-6",
                      regularHolidayCycle === option.value
                        ? "bg-white text-[#111827] shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                        : "text-[#64748b] hover:bg-white/70 hover:text-[#111827]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className={cn("mt-3 grid grid-cols-7", compact ? "gap-1" : "gap-2")}>
                {weekdayLabels.map((day) => {
                  const active = !businessDays.find((item) => item.key === day.key)?.enabled;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => updateBusinessDay(day.key, { enabled: !businessDays.find((item) => item.key === day.key)?.enabled })}
                      className={cn(
                        "rounded-[8px] border font-medium transition",
                        compact ? "h-8 text-[14px] leading-5" : "h-10 text-[16px] leading-6",
                        active
                          ? "border-[#f0a8b4] bg-[#fff7f8] text-[#d43f57] shadow-[0_1px_4px_rgba(212,63,87,0.08)]"
                          : "border-[#dbe2ea] bg-white text-[#475569] hover:border-[#94a3b8] hover:bg-[#f8fafc]",
                      )}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>
              {renderRegularHolidayCalendarPreview()}
            </div>

          </WebSurface>
          ) : null}

          {!initialSetupMode && pendingTemporaryHolidayDate ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/20 px-4" role="dialog" aria-modal="true">
              <div className="w-full max-w-[360px] rounded-[12px] border border-[#dbe2ea] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
                <p className="text-[18px] font-semibold leading-[26px] text-[#111827]">임시 휴무일 지정</p>
                <p className="mt-3 text-[16px] font-normal leading-6 text-[#475569]">
                  {pendingTemporaryHolidayDate}을 임시 휴무일로 지정할까요?
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingTemporaryHolidayDate("")}
                    className="h-11 rounded-[8px] border border-[#dbe2ea] bg-white text-[16px] font-medium leading-6 text-[#334155] hover:bg-[#f8fafc]"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => addTemporaryHoliday(pendingTemporaryHolidayDate)}
                    className="h-11 rounded-[8px] bg-[#2f7866] text-[16px] font-medium leading-6 text-white hover:bg-[#286b5b]"
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
          <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
            <div>
              <label htmlFor="booking-close-grace" className="text-[16px] font-medium leading-6 text-[#334155]">마감 여유</label>
              <p className="mt-1 text-[13px] font-normal leading-5 text-[#64748b]">
                영업 마감 뒤 예약 종료를 허용할 시간입니다. 15분을 권장합니다.
              </p>
            </div>
            <select
              id="booking-close-grace"
              value={bookingSettings.closeGraceMinutes}
              onChange={(event) => {
                const nextValue = Number(event.target.value) as (typeof bookingCloseGraceMinuteOptions)[number];
                updateBookingSetting("closeGraceMinutes", nextValue, true);
              }}
              className="min-h-11 w-full rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[16px] font-medium leading-6 text-[#15213b] outline-none transition hover:bg-[#f8fafc] focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
            >
              {bookingCloseGraceMinuteOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? "여유 없음" : `${minutes}분${minutes === 15 ? " · 권장" : ""}`}
                </option>
              ))}
            </select>
          </div>

          <div className={cn("border-t border-[#edf2f7]", compact ? "mt-3 pt-3" : "mt-4 pt-4")}>
            <div className="flex items-center justify-between gap-3">
              <p className={cn("font-normal text-[#334155]", "text-[16px]")}>예약 금지 시간 설정</p>
              <button type="button" onClick={addBlockedWindow} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]", compact ? "px-2.5 text-[14px]" : "px-3 text-[16px]")}>
                <Plus className="h-4 w-4" />
                금지 시간 추가
              </button>
            </div>
            <div className={cn("mt-2 flex items-start gap-2 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]", compact ? "px-2.5 py-2 text-[13px] leading-5" : "px-3 py-2.5 text-[14px] leading-5")}>
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#607080]" />
              <p>금지 시간을 넣으면 서비스 소요 시간이나 예약 간격과 겹쳐 예약 가능한 시간이 애매하게 끊길 수 있어요. 꼭 필요한 시간만 설정해 주세요.</p>
            </div>

            <div className="mt-3 space-y-2">
              {bookingSettings.blockedWindows.map((windowItem) => (
                <div key={windowItem.id} className={cn("grid items-center rounded-[8px] border border-[#edf2f7] bg-[#fbfcfd]", compact ? "grid-cols-[88px_16px_88px_minmax(0,1fr)_32px] gap-2 p-1.5" : "grid-cols-[116px_20px_116px_minmax(0,1fr)_36px] gap-3 p-2")}>
                  <TimeInput value={windowItem.start} onChange={(value) => updateBlockedWindow(windowItem.id, { start: value })} compact={compact} />
                  <span className={cn("inline-flex items-center justify-center font-normal text-[#94a3b8]", compact ? "h-8 text-[14px]" : "h-10 text-[16px]")}>~</span>
                  <TimeInput value={windowItem.end} onChange={(value) => updateBlockedWindow(windowItem.id, { end: value })} compact={compact} />
                  <input
                    value={windowItem.label}
                    onChange={(event) => updateBlockedWindow(windowItem.id, { label: event.target.value })}
                    className={cn("min-h-11 rounded-[8px] border border-[#dbe2ea] bg-white font-normal text-[#111827] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20", compact ? "px-2.5 text-[14px]" : "px-3 text-[16px]")}
                  />
                  <button type="button" onClick={() => removeBlockedWindow(windowItem.id)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] text-[#a04455] hover:bg-[#fff7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" aria-label="예약 제외 시간 삭제">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </WebSurface>
      ) : null}

      {initialSetupMode && initialSetupSubview === "hours" ? (
        <OwnerInitialSetupSaveNextActions
          onSave={completeInitialSetupStep}
          onNext={() => onInitialSetupNext?.()}
          saving={isCompletingInitialSetup}
        />
      ) : null}

    </div>
  );
}
