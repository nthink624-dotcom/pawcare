import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("owner schedule keeps staff metadata readable and has no weekly view entry point", () => {
  const header = source("src/components/owner-web/calendar-staff-lane-header.tsx");
  const toolbar = source("src/components/owner-web/calendar-toolbar.tsx");
  const screen = source("src/components/owner-web/calendar-management-screen.tsx");

  assert.match(header, /text-\[13px\].*font-medium.*leading-5.*tabular-nums/);
  assert.match(header, /\{startLabel\}–\{endLabel\}/);
  assert.match(header, /예약 \{bookingCount\}건/);

  assert.doesNotMatch(toolbar, /CalendarViewMode|getRollingScheduleDates|WEEKLY_SCHEDULE_VISIBLE_DAYS|주간/);
  assert.doesNotMatch(screen, /CalendarViewMode|calendarViewMode|WeeklySchedule|WeeklyScheduleBooking|getRollingScheduleDates/);
  assert.match(screen, /fetchOwnerScheduleRange\(currentData\.shop\.id, selectedDate, selectedDate\)/);
  assert.match(screen, /<DailyScheduleGrid/);
});

test("schedule toolbar keeps the assignee filter and add-booking control on the Korean UI type scale", () => {
  const toolbar = source("src/components/owner-web/calendar-toolbar.tsx");

  assert.match(toolbar, /labelClassName="text-\[14px\] font-medium leading-5 tracking-\[-0\.005em\] text-\[#64748b\]"/);
  assert.match(toolbar, /valueClassName="text-\[16px\] font-medium leading-6 tracking-\[-0\.005em\] text-\[#111827\]"/);
  assert.match(toolbar, /buttonClassName="!h-11"/);
  assert.match(toolbar, /!text-\[16px\] !font-medium !leading-6 !tracking-\[-0\.005em\]/);
  assert.match(toolbar, /!bg-\[#1d4ed8\][\s\S]*focus-visible:ring-\[#2563eb\]/);
  assert.match(toolbar, /CalendarPlus className="h-4 w-4" aria-hidden="true"/);
});

test("booking dialog scopes editable-field focus to clear blue without changing global inputs", () => {
  const dialog = source("src/components/owner-web/calendar-create-dialog.tsx");
  const dropdown = source("src/components/owner-web/calendar-schedule-dropdown.tsx");

  assert.match(dialog, /const bookingFieldFocusClassName = "focus:border-\[#2563eb\] focus:ring-2 focus:ring-\[#2563eb\]\/15 focus-visible:ring-2 focus-visible:ring-\[#2563eb\]\/20"/);
  assert.match(dialog, /focusClassName=\{bookingFieldFocusClassName\}/);
  assert.doesNotMatch(dialog, /focus:(?:border|ring)-\[#1f6b5b\]/);
  assert.match(dropdown, /focusClassName\?: string/);
  assert.match(dropdown, /focusClassName,/);
});

test("booking dialog keeps selected time and submit primary blue with a 44px reflow-safe target", () => {
  const dialog = source("src/components/owner-web/calendar-create-dialog.tsx");

  assert.match(dialog, /overflow-y-auto bg-slate-900\/25 px-4 py-4/);
  assert.match(dialog, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
  assert.match(dialog, /grid-cols-\[repeat\(auto-fit,minmax\(5rem,1fr\)\)\]/);
  assert.match(dialog, /"h-11 min-w-0 rounded-\[8px\] border text-\[14px\][^"\n]*tabular-nums/);
  assert.match(dialog, /\? "border-\[#1d4ed8\] bg-\[#1d4ed8\] text-white hover:border-\[#1e40af\] hover:bg-\[#1e40af\]"/);
  assert.match(dialog, /grid-cols-\[repeat\(auto-fit,minmax\(8rem,1fr\)\)\]/);
  assert.match(dialog, /min-h-11 rounded-\[8px\] border !border-\[#1d4ed8\][^"\n]*px-3 py-2[^"\n]*focus-visible:ring-\[#2563eb\]/);
});

test("45-minute-and-longer booking cards project one request-note line without changing detail data", () => {
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");
  const screen = source("src/components/owner-web/calendar-management-screen.tsx");

  assert.match(grid, /memo\?: string/);
  assert.match(grid, /const requestNoteMinimumDuration = 0\.75/);
  assert.match(grid, /const showRequestNote = booking\.duration >= requestNoteMinimumDuration/);
  assert.match(grid, /const requestNoteText = requestNote \? `요청사항 \$\{requestNote\}` : "요청사항 없음"/);
  assert.match(grid, /data-booking-request-note=\{requestNote \? "present" : "empty"\}/);
  assert.match(grid, /grid-rows-\[18px_17px_18px\]/);
  assert.match(grid, /title=\{requestNoteText\}/);
  assert.match(screen, /return booking\.memo\?\.trim\(\) \|\| getCustomerRequest\(booking\.id\) \|\| "고객 요청사항이 없습니다\."/);
});

test("daily booking chips keep semantic status surfaces separate from staff identity and selection", () => {
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");
  assert.match(grid, /const statusTone = getBookingStatusEdgeTone\(timedStatus\)/);
  assert.match(grid, /border-\[#dbe3ec\] bg-\[#fffefd\]/);
  assert.doesNotMatch(grid, /backgroundColor: bookingIdentityTone\.bookingBackground/);
  assert.doesNotMatch(grid, /borderColor: bookingIdentityTone\.bookingBorder/);
  assert.match(grid, /borderLeftColor: statusIndicatorColor\[statusTone\]/);
  assert.match(grid, /data-booking-staff-identity=\{booking\.staffKey\}/);
  assert.match(grid, /"--pm-booking-status-edge": statusIndicatorColor\[statusTone\]/);
});

test("daily booking cards retain a 44px pointer and keyboard hit target without changing their visual roles", () => {
  const grid = source("src/components/owner-web/calendar-daily-schedule-grid.tsx");

  assert.match(grid, /const minimumBookingCardHitTarget = 44/);
  assert.match(grid, /return Math\.max\(minimumBookingCardHitTarget, duration \* pixelsPerHour - 4\)/);
  assert.match(grid, /flex min-h-11 items-center justify-start/);
  assert.match(grid, /focus-visible:ring-2 focus-visible:ring-\[#1677ff\]\/70/);
  assert.match(grid, /border-\[#dbe3ec\] bg-\[#fffefd\]/);
  assert.doesNotMatch(grid, /backgroundColor: bookingIdentityTone\.bookingBackground/);
  assert.doesNotMatch(grid, /borderColor: bookingIdentityTone\.bookingBorder/);
  assert.match(grid, /"--pm-booking-status-edge": statusIndicatorColor\[statusTone\]/);
});
