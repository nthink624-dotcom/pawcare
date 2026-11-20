import { createHash } from "node:crypto";
import { expandRecurringEvent, sync, type DateWithTimeZone, type EventInstance, type VEvent } from "node-ical";
import type { ShopCalendarEventInput } from "@petmanager/shared/contracts/owner-calendar";
import { seoulCalendarInstant, shiftCalendarDate } from "@petmanager/shared/lib/owner-calendar";

export const calendarImportLimit = 500;
export const calendarImportTextLimit = 500_000;

export class CalendarImportError extends Error {}

type ImportedEvent = ShopCalendarEventInput & { key: string };
type AdditionalDate = string | { val: string; params?: { TZID?: string } };

function allDayDate(date: DateWithTimeZone) {
  // Floating DATE values are parsed at midnight in the server's local timezone.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: date.tz }).format(date);
}

function floatingTimesInSeoul(ics: string) {
  return ics.replace(/\r?\n[ \t]/g, "").replace(
    /^((?:DTSTART|DTEND|RECURRENCE-ID|EXDATE|RDATE)(?:;[^:\r\n]*)?):(\d{8}T\d{6}(?:,\d{8}T\d{6})*)$/gim,
    (line, property: string, values: string) => /;TZID=/i.test(property) ? line : `${property};TZID=Asia/Seoul:${values}`,
  );
}

function normalizedInstance(instance: EventInstance, uid: string, series: boolean): ImportedEvent | null {
  const { start, end, isFullDay, event, summary } = instance;
  if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end))) return null;
  const titleValue = typeof summary === "string" ? summary : summary?.val;
  const title = String(titleValue ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 160) || "제목 없는 일정";
  let startsAt = start.toISOString();
  let endsAt = end.toISOString();
  const original = event.recurrenceid ?? start;
  const occurrence = series ? (original.dateOnly ? allDayDate(original) : original.toISOString()) : "single";
  if (isFullDay) {
    const first = allDayDate(start);
    const last = allDayDate(end);
    startsAt = seoulCalendarInstant(first);
    endsAt = seoulCalendarInstant(last > first ? last : shiftCalendarDate(first, 1));
  } else if (end.getTime() === start.getTime()) {
    // An event with DTSTART only denotes a point in time.
    endsAt = new Date(start.getTime() + 1).toISOString();
  }
  const length = Date.parse(endsAt) - Date.parse(startsAt);
  if (length <= 0 || length > 366 * 86_400_000) return null;
  const key = createHash("sha256").update(JSON.stringify([uid, occurrence])).digest("hex");
  return { key, title, startsAt, endsAt, allDay: isFullDay };
}

function additionalCalendarInstances(event: VEvent, zones: string[]) {
  const rdate = (event as VEvent & { rdate?: AdditionalDate | AdditionalDate[] }).rdate;
  if (!rdate) return [];
  const entries = (Array.isArray(rdate) ? rdate : [rdate]).flatMap(property => {
    const tz = typeof property === "string" ? undefined : property.params?.TZID;
    if (tz && /[\r\n;]/.test(tz)) throw new CalendarImportError("반복 일정의 시간대를 확인해 주세요.");
    return (typeof property === "string" ? property : property.val).split(",").map(value => ({ value, tz }));
  });
  if (entries.length > 1_000) throw new CalendarImportError("추가 반복 날짜가 너무 많아요. 기간을 나눠 내보내 주세요.");

  function dateLine(name: string, value: string, tz?: string) {
    if (/^\d{8}$/.test(value)) return `${name};VALUE=DATE:${value}`;
    if (!/^\d{8}T\d{6}Z?$/i.test(value)) throw new CalendarImportError("반복 일정의 날짜 형식을 확인해 주세요.");
    return value.endsWith("Z") ? `${name}:${value}` : `${name};TZID=${tz ?? "Asia/Seoul"}:${value}`;
  }

  const components = sync.parseICS([
    "BEGIN:VCALENDAR", "VERSION:2.0", ...zones,
    ...entries.flatMap(({ value, tz }, index) => {
      const [start, end] = value.split("/");
      const endLine = end ? (/^P[\dHMWDTS]+$/i.test(end) ? `DURATION:${end}` : dateLine("DTEND", end, tz)) : null;
      return ["BEGIN:VEVENT", `UID:rdate-${index}`, dateLine("DTSTART", start, tz), ...(endLine ? [endLine] : []), "END:VEVENT"];
    }),
    "END:VCALENDAR",
  ].join("\r\n"));
  const instances: EventInstance[] = [];
  for (const occurrence of Object.values(components)) {
    if (occurrence?.type !== "VEVENT") continue;
    const original = occurrence.start;
    const day = allDayDate(original);
    const key = original.dateOnly ? day : original.toISOString();
    if (event.exdate?.[key] || event.exdate?.[day]?.dateOnly) continue;
    const changed = event.recurrences?.[key] as VEvent | undefined;
    const start = changed?.start ?? original;
    let end = changed ? (changed.end ?? changed.start) : (occurrence.end ?? original);
    const isFullDay = Boolean(start.dateOnly);
    if (!changed && !entries[Number(occurrence.uid.slice(6))].value.includes("/")) {
      const originalEnd = event.end ?? event.start;
      if (isFullDay) {
        const span = Math.round((Date.parse(allDayDate(originalEnd)) - Date.parse(allDayDate(event.start))) / 86_400_000);
        const last = shiftCalendarDate(day, Math.max(1, span));
        end = new Date(seoulCalendarInstant(last)) as DateWithTimeZone;
        end.tz = "Asia/Seoul";
      } else {
        end = new Date(original.getTime() + (originalEnd.getTime() - event.start.getTime()));
      }
    }
    instances.push({ start, end, summary: changed?.summary ?? event.summary ?? "", isFullDay, isRecurring: true, isOverride: !!changed, event: { ...(changed ?? event), recurrenceid: original } });
  }
  return instances;
}

export function parseCalendarImport(raw: string, startDate: string, endDate: string) {
  const source = floatingTimesInSeoul(raw.trim());
  if (!/^BEGIN:VCALENDAR\r?$/mi.test(source) || !/^END:VCALENDAR\r?$/mi.test(source)) {
    throw new CalendarImportError("네이버에서 내보낸 .ics 파일인지 확인해 주세요.");
  }
  if ((source.match(/^BEGIN:VEVENT\r?$/gim)?.length ?? 0) > 1_000) {
    throw new CalendarImportError("일정이 너무 많아요. 네이버에서 기간을 나눠 내보내 주세요.");
  }
  if (/^RRULE:[^\r\n]*(?:FREQ=(?:SECONDLY|MINUTELY)|BYSECOND=|BYMINUTE=)/im.test(source)) {
    throw new CalendarImportError("분·초 단위로 반복되는 일정은 가져올 수 없어요.");
  }

  const from = new Date(seoulCalendarInstant(startDate));
  const until = new Date(seoulCalendarInstant(shiftCalendarDate(endDate, 1)));
  // DATE values can be represented at midnight in the source zone, so allow a buffer.
  // The normalized Korea date range below is authoritative.
  const bufferedFrom = new Date(from.getTime() - 86_400_000);
  const bufferedTo = new Date(until.getTime() + 86_400_000);
  const items = new Map<string, ImportedEvent>();
  let skipped = 0;
  const components = sync.parseICS(source);
  const zones = source.match(/^BEGIN:VTIMEZONE\r?$[\s\S]*?^END:VTIMEZONE\r?$/gim) ?? [];

  for (const event of Object.values(components)) {
    if (event?.type !== "VEVENT" || event.status === "CANCELLED") continue;
    if (!event.uid || !Number.isFinite(Number(event.start))) {
      skipped++;
      continue;
    }
    let instances: EventInstance[];
    try {
      instances = [
        ...expandRecurringEvent(event, { from: bufferedFrom, to: bufferedTo, expandOngoing: true, maxIterations: 2_500 }),
        ...additionalCalendarInstances(event, zones),
      ];
    } catch (error) {
      if (error instanceof CalendarImportError) throw error;
      throw new CalendarImportError("반복 일정을 계산하지 못했어요. 기간을 줄이거나 해당 일정을 확인해 주세요.");
    }
    for (const instance of instances) {
      if (instance.event.status === "CANCELLED") continue;
      const item = normalizedInstance(instance, event.uid, Boolean(event.rrule || event.recurrenceid || "rdate" in event || instance.isRecurring));
      if (!item) {
        skipped++;
        continue;
      }
      if (Date.parse(item.startsAt) >= until.getTime() || Date.parse(item.endsAt) <= from.getTime()) continue;
      items.set(item.key, item);
      if (items.size > calendarImportLimit) throw new CalendarImportError("한 번에 500개까지 가져올 수 있어요. 기간을 줄여 주세요.");
    }
  }
  return { items: [...items.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), skipped };
}
