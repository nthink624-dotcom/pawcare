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

/** The first and last Korea calendar day an event covers; `endsAt` is exclusive. */
/** Notes saved before titles and bodies were separate keep every line in the title; edit them as a first-line title and a body. */
export function noteEditorText(event?: Pick<ShopCalendarEvent, "title" | "body">) {
  if (!event) return { title: "", body: "" };
  if (event.body) return { title: event.title, body: event.body };
  const [first, ...rest] = event.title.split(/\r?\n/);
  return { title: first.trim(), body: rest.join("\n").trim() };
}

export function shopEventDayRange(event: Pick<ShopCalendarEvent, "startsAt" | "endsAt">) {
  const first = seoulCalendarDate(event.startsAt);
  const end = Date.parse(event.endsAt);
  const last = end > Date.parse(event.startsAt) ? seoulCalendarDate(new Date(end - 1).toISOString()) : first;
  return { first, last: last < first ? first : last };
}

export type ShopEventBar = {
  event: ShopCalendarEvent;
  /** Week row (0-based) of the month grid. */
  row: number;
  /** First and last covered column (0-based, Sunday first) within the row. */
  startColumn: number;
  endColumn: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Lays events out as one bar per week row over a month grid of 7-day rows (`null` = blank cell).
 * Longer events take the upper lanes; bars that would need more than `maxLanes` lanes in a row are left out.
 */
export function layoutShopEventBars(events: ShopCalendarEvent[], cells: (string | null)[], maxLanes: number) {
  const ranges = events.map(event => ({ event, ...shopEventDayRange(event) }))
    .sort((a, b) => a.first.localeCompare(b.first) || b.last.localeCompare(a.last) || Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
  const bars: ShopEventBar[] = [];
  const lanesByRow: number[] = [];
  for (let row = 0; row * 7 < cells.length; row += 1) {
    const week = cells.slice(row * 7, row * 7 + 7);
    const laneEnds: number[] = [];
    for (const { event, first, last } of ranges) {
      const columns = week.flatMap((date, column) => date && date >= first && date <= last ? [column] : []);
      if (!columns.length) continue;
      const startColumn = columns[0];
      const endColumn = columns[columns.length - 1];
      let lane = laneEnds.findIndex(end => end < startColumn);
      if (lane < 0) lane = laneEnds.length;
      if (lane >= maxLanes) continue;
      laneEnds[lane] = endColumn;
      bars.push({ event, row, startColumn, endColumn, lane, continuesBefore: first < week[startColumn]!, continuesAfter: last > week[endColumn]! });
    }
    lanesByRow.push(laneEnds.length);
  }
  return { bars, lanesByRow };
}

export function shopEventsOnDate(events: ShopCalendarEvent[], date: string) {
  const start = Date.parse(seoulCalendarInstant(date));
  const end = Date.parse(seoulCalendarInstant(shiftCalendarDate(date, 1)));
  return events.filter(event => Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
