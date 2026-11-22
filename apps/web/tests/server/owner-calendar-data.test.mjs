import assert from "node:assert/strict";
import test from "node:test";

import { parseCalendarHolidays } from "../../src/server/calendar-holidays.ts";
import { parseCalendarImport } from "../../src/server/parse-calendar-import.ts";
import { calendarMonthBounds, isCalendarDate, layoutShopEventBars, shopEventDayRange, shopEventsOnDate } from "@petmanager/shared/lib/owner-calendar";

function ics(...lines) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PetManager test//KO", ...lines, "END:VCALENDAR"].join("\r\n");
}

function event(...lines) {
  return ["BEGIN:VEVENT", "DTSTAMP:20261101T000000Z", ...lines, "END:VEVENT"];
}

test("공휴일 조회는 공공기관 휴일만 반환하고 다중 이름을 보존한다", () => {
  const item = (date, name, isHoliday) => `<item><locdate>${date}</locdate><dateName>${name}</dateName><isHoliday>${isHoliday}</isHoliday></item>`;
  const entries = [item("20261225", "성탄절", "Y"), item("20261225", "성탄절", "Y"), item("20261226", "기념일", "N"), item("20261231", "임시공휴일", "Y")];
  const xml = `<response><header><resultCode>00</resultCode></header><body><items>${entries.join("")}</items><totalCount>4</totalCount></body></response>`;
  assert.deepEqual(parseCalendarHolidays(xml, "2026-12"), [
    { date: "2026-12-25", name: "성탄절" },
    { date: "2026-12-31", name: "임시공휴일" },
  ]);
  assert.deepEqual(parseCalendarHolidays("<response><header><resultCode>00</resultCode></header><body><items/><totalCount>0</totalCount></body></response>", "2026-12"), []);
  assert.throws(() => parseCalendarHolidays(xml, "2027-01"), /Invalid holiday row/);
  assert.throws(() => parseCalendarHolidays(xml.replace("totalCount>4", "totalCount>5"), "2026-12"), /Incomplete/);
  assert.throws(() => parseCalendarHolidays(xml.replace("resultCode>00", "resultCode>30"), "2026-12"), /Holiday service/);
});

test("date windows use Korea days and an exclusive month/day end", () => {
  assert.deepEqual(calendarMonthBounds("2026-12"), { from: "2026-12-01", until: "2027-01-01" });
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
  const overnight = { id: "test", startsAt: "2026-12-30T14:00:00.000Z", endsAt: "2026-12-30T15:00:00.000Z", allDay: false, source: "manual", title: "일정" };
  assert.equal(shopEventsOnDate([overnight], "2026-12-30").length, 1);
  assert.equal(shopEventsOnDate([overnight], "2026-12-31").length, 0);
});

test("ICS import retains Korean dates, recurrence exceptions, overrides, and stable deduplication keys", () => {
  const raw = ics(
    ...event("UID:all-day", "SUMMARY:직원 교육", "DTSTART;VALUE=DATE:20261225", "DTEND;VALUE=DATE:20261227", "DESCRIPTION:private", "ATTENDEE:mailto:private@example.test"),
    ...event("UID:weekly", "SUMMARY:주간 점검", "DTSTART:20261201T100000", "DTEND:20261201T110000", "RRULE:FREQ=WEEKLY;COUNT=3", "EXDATE:20261208T100000"),
    ...event("UID:weekly", "RECURRENCE-ID:20261215T100000", "SUMMARY:일정 변경", "DTSTART;TZID=Asia/Seoul:20261216T130000", "DTEND;TZID=Asia/Seoul:20261216T140000"),
    ...event("UID:utc-point", "SUMMARY:월말 알림", "DTSTART:20261231T150000Z"),
  );
  const december = parseCalendarImport(raw, "2026-12-01", "2026-12-31");
  assert.deepEqual(december.items.map(({ title, startsAt, allDay }) => ({ title, startsAt, allDay })), [
    { title: "주간 점검", startsAt: "2026-12-01T01:00:00.000Z", allDay: false },
    { title: "일정 변경", startsAt: "2026-12-16T04:00:00.000Z", allDay: false },
    { title: "직원 교육", startsAt: "2026-12-24T15:00:00.000Z", allDay: true },
  ]);
  assert.equal(december.items.at(-1).endsAt, "2026-12-26T15:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(december), /private/);
  assert.deepEqual(parseCalendarImport(raw.replaceAll("\r\n", "\n"), "2026-12-01", "2026-12-31"), december);
  const movedAgain = parseCalendarImport(raw.replace("20261216T130000", "20261216T120000"), "2026-12-01", "2026-12-31");
  assert.equal(movedAgain.items[1].key, december.items[1].key);
  assert.equal(parseCalendarImport(raw, "2027-01-01", "2027-01-01").items[0].startsAt, "2026-12-31T15:00:00.000Z");
});

test("ICS rejects unsupported high-frequency recurrence and malformed calendars", () => {
  assert.throws(() => parseCalendarImport("not an .ics file", "2026-12-01", "2026-12-31"), /\.ics/);
  const raw = ics(...event("UID:unsafe", "DTSTART:20261201T000000Z", "RRULE:FREQ=SECONDLY"));
  assert.throws(() => parseCalendarImport(raw, "2026-12-01", "2026-12-31"), /분·초/);
});

test("ICS includes RDATE additions, separate periods, and matching exceptions", () => {
  const raw = ics(...event(
    "UID:additional-days", "SUMMARY:매장 브리핑",
    "DTSTART;TZID=Asia/Seoul:20261201T100000", "DTEND;TZID=Asia/Seoul:20261201T110000",
    "RDATE;TZID=Asia/Seoul:20261203T100000,20261204T100000",
    "RDATE;VALUE=PERIOD:20261205T010000Z/PT2H",
    "EXDATE;TZID=Asia/Seoul:20261203T100000",
  ));
  const { items } = parseCalendarImport(raw, "2026-12-01", "2026-12-31");
  assert.deepEqual(items.map(item => [item.startsAt, item.endsAt]), [
    ["2026-12-01T01:00:00.000Z", "2026-12-01T02:00:00.000Z"],
    ["2026-12-04T01:00:00.000Z", "2026-12-04T02:00:00.000Z"],
    ["2026-12-05T01:00:00.000Z", "2026-12-05T03:00:00.000Z"],
  ]);
});

test("note bars split by week row, stack longer notes first, and cap the lanes", () => {
  const note = (id, first, last) => ({ id, title: id, source: "manual", allDay: true,
    startsAt: new Date(`${first}T00:00:00+09:00`).toISOString(),
    endsAt: new Date(Date.parse(`${last}T00:00:00+09:00`) + 86_400_000).toISOString() });
  assert.deepEqual(shopEventDayRange(note("a", "2026-11-05", "2026-11-09")), { first: "2026-11-05", last: "2026-11-09" });
  assert.deepEqual(shopEventDayRange({ startsAt: "2026-11-05T01:00:00.000Z", endsAt: "2026-11-05T03:00:00.000Z" }), { first: "2026-11-05", last: "2026-11-05" });
  // November 2026 starts on a Sunday: rows are 1-7, 8-14, 15-21, 22-28, 29-30 + blanks.
  const cells = Array.from({ length: 30 }, (_, index) => `2026-11-${String(index + 1).padStart(2, "0")}`);
  cells.push(null, null, null, null, null);
  const { bars, lanesByRow } = layoutShopEventBars([
    note("short", "2026-11-06", "2026-11-06"),
    note("long", "2026-11-05", "2026-11-09"),
    note("third", "2026-11-06", "2026-11-07"),
    note("hidden", "2026-11-06", "2026-11-06"),
  ], cells, 2);
  const summary = bars.map(({ event, row, startColumn, endColumn, lane, continuesBefore, continuesAfter }) =>
    [event.id, row, startColumn, endColumn, lane, continuesBefore, continuesAfter].join(":"));
  assert.deepEqual(summary, [
    "long:0:4:6:0:false:true",
    "third:0:5:6:1:false:false",
    "long:1:0:1:0:true:false",
  ]);
  assert.deepEqual(lanesByRow, [2, 1, 0, 0, 0]);
});
