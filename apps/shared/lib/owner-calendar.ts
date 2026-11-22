import type { CalendarHoliday, ShopCalendarEvent } from "../contracts/owner-calendar";

const seoulDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftCalendarDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calendarMonthBounds(month: string) {
  const from = `${month}-01`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { from, until: end.toISOString().slice(0, 10) };
}

export function seoulCalendarInstant(day: string, time = "00:00") {
  return new Date(`${day}T${time}:00+09:00`).toISOString();
}

export function seoulCalendarDate(instant: string) {
  return seoulDate.format(new Date(instant));
}

export function seoulCalendarTime(instant: string) {
  return seoulTime.format(new Date(instant));
}

export function calendarHolidaysByDate(holidays: CalendarHoliday[]) {
  const names = new Map<string, string[]>();
  for (const holiday of holidays) {
    const sameDay = names.get(holiday.date) ?? [];
    names.set(holiday.date, [...sameDay, holiday.name]);
  }
  return names;
}

export function shopEventsOnDate(events: ShopCalendarEvent[], date: string) {
  const start = Date.parse(seoulCalendarInstant(date));
  const end = Date.parse(seoulCalendarInstant(shiftCalendarDate(date, 1)));
  return events.filter(event => Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
