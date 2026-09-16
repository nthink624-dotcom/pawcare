import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const schedulePath = new URL("../src/components/owner/owner-booking-day-schedule.tsx", import.meta.url);
const lanesPath = new URL("../src/lib/owner-schedule-lanes.ts", import.meta.url);
const identityPath = new URL("../src/lib/staff-schedule-identity.ts", import.meta.url);
const reservationDateDisplayPath = new URL("../src/lib/reservation-date-display.ts", import.meta.url);
const refreshStabilityPath = new URL("../src/lib/owner-mobile-staff-refresh-stability.ts", import.meta.url);
const cardGapsPath = new URL("../src/lib/owner-schedule-card-gaps.ts", import.meta.url);
const profileFallbackPath = new URL("../src/lib/staff-profile-fallback.ts", import.meta.url);
const staffProfilePhotoPath = new URL("../src/components/owner/staff-profile-photo.tsx", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const schedulePreviewPath = new URL("../src/app/dev/owner-schedule-preview/page.tsx", import.meta.url);
const domainPath = new URL("../src/types/domain.ts", import.meta.url);
const bootstrapPath = new URL("../src/server/bootstrap.ts", import.meta.url);
const staffRoutePath = new URL("../src/app/api/staff-members/route.ts", import.meta.url);
const fallbackAssetPath = new URL("../public/images/profiles/korean-groomer-profile-01.jpg", import.meta.url);
const secondFallbackAssetPath = new URL("../public/images/profiles/korean-groomer-profile-02.jpg", import.meta.url);
const [schedule, lanesSource, identitySource, reservationDateDisplaySource, refreshStabilitySource, cardGapsSource, profileFallbackSource, staffProfilePhotoSource, ownerApp, schedulePreview, domainSource, bootstrapSource, staffRouteSource, fallbackAsset, secondFallbackAsset] = await Promise.all([
  readFile(schedulePath, "utf8"),
  readFile(lanesPath, "utf8"),
  readFile(identityPath, "utf8"),
  readFile(reservationDateDisplayPath, "utf8"),
  readFile(refreshStabilityPath, "utf8"),
  readFile(cardGapsPath, "utf8"),
  readFile(profileFallbackPath, "utf8"),
  readFile(staffProfilePhotoPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(schedulePreviewPath, "utf8"),
  readFile(domainPath, "utf8"),
  readFile(bootstrapPath, "utf8"),
  readFile(staffRoutePath, "utf8"),
  readFile(fallbackAssetPath),
  readFile(secondFallbackAssetPath),
]);

function loadLaneContract() {
  const output = ts.transpileModule(lanesSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

function loadIdentityContract() {
  const output = ts.transpileModule(identitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

function loadReservationDateDisplayContract() {
  const output = ts.transpileModule(reservationDateDisplaySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, Intl });
  return compiledModule.exports;
}

function loadRefreshStabilityContract() {
  const output = ts.transpileModule(refreshStabilitySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/require\([^)]*domain[^)]*\);/, "");
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, URL });
  return compiledModule.exports;
}

function loadCardGapsContract() {
  const output = ts.transpileModule(cardGapsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, Map });
  return compiledModule.exports;
}

function loadProfileFallbackContract() {
  const output = ts.transpileModule(profileFallbackSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

test("staff profile uses a registered image first and the explicit bundled preset", () => {
  const { getStaffProfileImageCandidates, resolveStaffProfileFallbackImageUrl, staffProfileFallbackImageUrl, staffProfileFallbackKey } = loadProfileFallbackContract();
  const registeredUrl = "https://signed.invalid/profile.jpg";

  assert.deepEqual([...getStaffProfileImageCandidates(registeredUrl, staffProfileFallbackKey)], [registeredUrl, staffProfileFallbackImageUrl]);
  assert.deepEqual([...getStaffProfileImageCandidates(null, staffProfileFallbackKey)], [staffProfileFallbackImageUrl]);
  assert.deepEqual([...getStaffProfileImageCandidates("", undefined)], [staffProfileFallbackImageUrl]);
  assert.deepEqual([...getStaffProfileImageCandidates(null, "legacy-or-unknown")], [staffProfileFallbackImageUrl]);
  assert.equal(createHash("sha256").update(fallbackAsset).digest("hex").toUpperCase(), "082DD497F8296D6434AE247B507A10B812038FE39E4888762EAD25A35F8E02CD");
  assert.equal(resolveStaffProfileFallbackImageUrl("korean-groomer-profile-02"), "/images/profiles/korean-groomer-profile-02.jpg");
  assert.equal(createHash("sha256").update(secondFallbackAsset).digest("hex").toUpperCase(), "2C1FD1DAFB250D1C8188A360339AF5814AD9EF6C7C9DA3F81B0665E794C7FAC8");
  assert.doesNotMatch(profileFallbackSource, /gender|female|male|staffIndex|arrayIndex/);
});

test("staff fallback key is projected from bootstrap and staff reads into the schedule", () => {
  assert.match(domainSource, /profileImageFallbackKey\?: "korean-groomer-profile-01" \| "korean-groomer-profile-02" \| null/);
  assert.match(bootstrapSource, /profileImageFallbackKey: staffProfileFallbackKey/g);
  assert.match(staffRouteSource, /profileImageFallbackKey: staffProfileFallbackKey/g);
  assert.match(ownerApp, /profileImageFallbackKey: staffMember\.profileImageFallbackKey/);
  assert.match(schedule, /fallbackKey=\{staff\.profileImageFallbackKey\}/);
  assert.match(staffProfilePhotoSource, /data-profile-source=\{usingRegisteredPhoto \? "registered" : "fallback"\}/);
  assert.match(staffProfilePhotoSource, /onError=\{\(\) => setCandidateIndex/);
});

test("persisted staff chip colors use the canonical palette independently of staff order", () => {
  const { getStaffScheduleIdentityTone, STAFF_SCHEDULE_IDENTITY_PALETTE } = loadIdentityContract();
  const canonicalPcPalette = [
    ["#1F5F69", "#E0F1F1"],
    ["#278D7F", "#E3F5F0"],
    ["#199A98", "#DDF7F3"],
    ["#4E9A68", "#EAF7ED"],
    ["#9A7D43", "#FBF6E8"],
    ["#AD7D08", "#FFF8D9"],
    ["#C46219", "#FFF0E4"],
    ["#B85B24", "#FDF0E7"],
    ["#B94A45", "#FFF0EF"],
    ["#953E3B", "#FBEDEC"],
  ];
  assert.equal(STAFF_SCHEDULE_IDENTITY_PALETTE.length, 10);
  for (const [index, [color, background]] of canonicalPcPalette.entries()) {
    const tone = getStaffScheduleIdentityTone(`staff-${9 - index}`, index);
    assert.equal(tone.color, color);
    assert.equal(tone.background, background);
  }
  assert.deepEqual({ ...getStaffScheduleIdentityTone("woojin-stable-id", 8) }, {
    color: "#B94A45",
    background: "#FFF0EF",
    bookingBackground: "#FFF4F2",
    bookingBorder: "#EBCFCC",
  });
});

test("missing and invalid staff chip colors fall back only by stable staff id", () => {
  const { getStaffScheduleIdentityTone } = loadIdentityContract();
  const stable = getStaffScheduleIdentityTone("stable-staff", null);
  assert.deepEqual(getStaffScheduleIdentityTone("stable-staff", -1), stable);
  assert.deepEqual(getStaffScheduleIdentityTone("stable-staff", 10), stable);
  assert.deepEqual(getStaffScheduleIdentityTone("stable-staff", 1.5), stable);
  assert.deepEqual(getStaffScheduleIdentityTone("stable-staff", Number.NaN), stable);
  assert.match(identitySource, /hashStaffId\(staffId\) % STAFF_SCHEDULE_IDENTITY_PALETTE\.length/);
  assert.doesNotMatch(identitySource, /staffIndex|arrayIndex/);
});

test("exact overrides win over normalized default days and off-day presence is deterministic", () => {
  const { getStaffScheduleAvailability, shouldRenderStaffScheduleLane } = loadIdentityContract();
  const base = { date: "2026-09-07", defaultDays: ["tue", "wed", "thu", "fri", "sat", "sun"], isShopClosed: false };

  const offDay = getStaffScheduleAvailability(base);
  const overrideWork = getStaffScheduleAvailability({ ...base, overrideStatus: "work" });
  assert.deepEqual({ ...offDay }, { isWorking: false, source: "default_days" });
  assert.equal(shouldRenderStaffScheduleLane(offDay, 0), false);
  assert.equal(shouldRenderStaffScheduleLane(offDay, 1), true);
  assert.deepEqual({ ...overrideWork }, { isWorking: true, source: "exact_override" });
  assert.equal(shouldRenderStaffScheduleLane(overrideWork, 0), true);
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, overrideStatus: "half" }) }, { isWorking: true, source: "exact_override" });
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, defaultDays: ["mon"], overrideStatus: "off" }) }, { isWorking: false, source: "exact_override" });
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, defaultDays: ["mon"], overrideStatus: "annual" }) }, { isWorking: false, source: "exact_override" });
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, defaultDays: ["mon"], isShopClosed: true }) }, { isWorking: false, source: "shop_closed" });
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, defaultDays: undefined }) }, { isWorking: true, source: "default_days" });
  assert.deepEqual({ ...getStaffScheduleAvailability({ ...base, defaultDays: [] }) }, { isWorking: false, source: "default_days" });
});

test("owner projection hides empty off-day lanes and retains booked off-day lanes as unavailable", () => {
  assert.match(ownerApp, /data\.staffMembers\.flatMap\(\(staffMember\) =>/);
  assert.match(ownerApp, /getStaffScheduleAvailability\(\{/);
  assert.match(ownerApp, /defaultDays: staffMember\.defaultDays/);
  assert.match(ownerApp, /overrideStatus: exactOverride\?\.status/);
  assert.match(ownerApp, /if \(!shouldRenderStaffScheduleLane\(availability, appointmentCount\)\) return \[\]/);
  assert.match(ownerApp, /unavailable: !availability\.isWorking/);
  assert.match(schedule, /disabled=\{unavailable\}/);
  assert.match(schedule, /aria-disabled=\{unavailable\}/);
  assert.match(schedule, /const scheduleSummary = unavailable/);
  assert.match(schedule, /`근무하지 않음 · 예약 \$\{laneAppointments\.length\}건`/);
});

test("three staff and three appointments map one-to-one without duplication", () => {
  const { assignAppointmentsToStaffLanes } = loadLaneContract();
  const mapped = assignAppointmentsToStaffLanes(
    ["staff-1", "staff-2", "staff-3"],
    [
      { id: "appointment-1", staff_id: "staff-1" },
      { id: "appointment-2", staff_id: "staff-2" },
      { id: "appointment-3", staff_id: "staff-3" },
    ],
  );
  assert.deepEqual([...mapped.values()].map((items) => items.length), [1, 1, 1]);
  assert.equal([...mapped.values()].flat().length, 3);
});

test("unassigned is rendered once only when its lane exists and stale staff fails closed", () => {
  const { assignAppointmentsToStaffLanes } = loadLaneContract();
  const mapped = assignAppointmentsToStaffLanes(
    ["staff-1", "unassigned", "staff-1"],
    [{ id: "unassigned", staff_id: null }, { id: "foreign", staff_id: "foreign-staff" }, { id: "missing" }],
  );
  assert.equal(mapped.get("unassigned").length, 1);
  assert.equal(mapped.get("staff-1").length, 0);
  assert.equal([...mapped.values()].flat().length, 1);
});

test("schedule fixes the time rail and scrolls staff headers with their boards", () => {
  assert.match(schedule, /data-testid="reservation-date-navigation" className="sticky top-\[env\(safe-area-inset-top\)\] z-40 border-b border-\[#e8edf3\] bg-white/);
  assert.match(schedule, /data-testid="time-header"/);
  assert.match(schedule, /data-testid="time-rail"/);
  assert.match(schedule, /sticky left-0 z-30/);
  assert.match(schedule, /data-testid="staff-lane-scroller"/);
  assert.match(schedule, /overflow-x-auto/);
  assert.match(schedule, /no-scrollbar/);
  assert.match(schedule, /\[touch-action:pan-y\]/);
  assert.match(schedule, /\[scroll-snap-type:none\]/);
  assert.doesNotMatch(schedule, /snap-x snap-proximity/);
  assert.match(schedule, /data-staff-id=\{staff\.id\}/);
  assert.match(schedule, /w-\[calc\(\(100vw-48px\)\*0\.88\)\]/);
  assert.match(schedule, /min-\[410px\]:w-\[calc\(\(100vw-52px\)\*0\.88\)\]/);
  assert.match(schedule, /grid-cols-\[48px_minmax\(0,1fr\)\]/);
  assert.match(schedule, /min-\[410px\]:grid-cols-\[52px_minmax\(0,1fr\)\]/);
  assert.match(schedule, /selected\.offsetLeft - viewport\.offsetLeft/);
  assert.match(schedule, /viewport\.scrollTo\(\{ left, behavior: "smooth" \}\)/);
  assert.doesNotMatch(schedule, /scrollIntoView/);
  assert.match(schedule, /onPointerDown=\{beginLaneDrag\}/);
  assert.match(schedule, /onPointerMove=\{moveLaneDrag\}/);
  assert.match(schedule, /onClickCapture=\{suppressLaneClickAfterDrag\}/);
  assert.match(schedule, /viewport\.scrollLeft = drag\.startScrollLeft - offsetX/);
  assert.match(schedule, /Math\.abs\(offsetX\) > Math\.abs\(offsetY\)/);
  assert.match(schedule, /drag\.pointerType === "mouse"/);
  assert.match(schedule, /drag\.verticalScrollContainer\.scrollTop = drag\.startScrollTop - offsetY/);
  assert.match(schedule, /viewport\.closest\("main"\)/);
  assert.match(schedule, /data-testid="staff-chip-color-bar"/);
  assert.match(schedule, /backgroundColor: staff\.color/);
  assert.match(schedule, /absolute bottom-0 left-1\/2 h-\[2px\] w-4\/5 -translate-x-1\/2/);
  assert.doesNotMatch(schedule, /border-b-\[#2563eb\]/);
  assert.match(schedule, /aria-pressed=\{!unavailable && selectedStaffId === staff\.id\}/);
  assert.doesNotMatch(schedule, /ring-1 ring-inset ring-\[#93b4e8\]/);
  assert.match(schedule, /data-testid="staff-lane-chip"/);
  assert.match(schedule, /border-b border-b-\[#e8edf3\] bg-white/);
  assert.doesNotMatch(schedule, /backgroundColor: selectedStaffId === staff\.id/);
  assert.doesNotMatch(schedule, /selectedStaffId === staff\.id \? "font-medium" : "font-normal"/);
  assert.match(schedule, /<section className="min-w-0 overflow-hidden bg-white text-\[#172033\]">/);
  assert.match(schedule, /data-testid="staff-lane-scroller"[^>]+bg-white/);
  assert.match(schedule, /data-testid="staff-lane-board" className="relative bg-white"/);
  assert.doesNotMatch(schedule, /data-testid="staff-lane-board" className="relative bg-\[#f8fafc\]"/);
  assert.match(schedule, /sticky left-0 z-30 border-r border-\[#e8edf3\] bg-white/);
  assert.match(schedule, /data-testid="time-header" aria-hidden="true" className="h-\[72px\] border-b border-\[#e8edf3\] bg-white"/);
  assert.match(schedule, /data-testid="time-rail" className="relative bg-white"/);
});

test("one saved staff owns the full available lane width without synthetic choices", () => {
  assert.match(ownerApp, /\.\.\.\(data\.staffMembers\.length > 1 \? \[\{ id: "all", label: "전체"/);
  assert.match(ownerApp, /if \(data\.staffMembers\.length > 1 && countFor\(null\) > 0\) options\.push/);
  assert.match(schedule, /const isSingleStaffLane = laneOptions\.length === 1/);
  assert.match(schedule, /data-staff-lane-layout=\{isSingleStaffLane \? "single" : "multiple"\}/);
  assert.match(schedule, /isSingleStaffLane \? "flex w-full min-w-full" : "flex w-max min-w-full"/);
  assert.match(schedule, /isSingleStaffLane \? "w-full min-w-0 max-w-none flex-1 shrink-0"/);
  assert.match(schedule, /: "w-\[calc\(\(100vw-48px\)\*0\.88\)\] min-w-\[260px\] max-w-\[332px\] shrink-0 snap-start/);
  assert.match(schedulePreview, /NODE_ENV === "production".*notFound\(\)/s);
  assert.match(schedulePreview, /staffMode === "single" && singleStaff/);
  assert.match(schedulePreview, /staffMembers: \[singleStaff\]/);
  assert.match(schedulePreview, /appointment\.staff_id === singleStaff\.id/);
  assert.match(schedulePreview, /<OwnerLandingEmbed data=\{data\} \/>/);
});

test("reservation chips keep booking information without rendering pet profile media", () => {
  assert.doesNotMatch(schedule, /RoundPhoto|petVisuals|petVisuals\[/);
  assert.match(schedule, /\{startLabel\}–\{endLabel\} · \{durationLabel\}/);
  assert.match(schedule, /aria-label=\{`\$\{startLabel\}부터 \$\{endLabel\}까지, \$\{durationLabel\}, \$\{petName\}, 보호자 \$\{guardianName\}, \$\{serviceName\}, \$\{status\.label\}`\}/);
  assert.match(schedule, /petNames\[appointment\.pet_id\] \?\? "반려동물"/);
  assert.match(schedule, /guardianNames\[appointment\.guardian_id\] \?\? "보호자"/);
  assert.match(schedule, /serviceNames\[appointment\.service_id\] \?\? "서비스"/);
});

test("date navigation renders a selectable seven-day strip with selected date and count", () => {
  const { getReservationDateDisplay } = loadReservationDateDisplayContract();
  const today = "2026-09-07";
  assert.deepEqual({ ...getReservationDateDisplay(today, today) }, { dateLabel: "9월 7일", weekdayLabel: null, relativeDateLabel: "오늘" });
  assert.deepEqual({ ...getReservationDateDisplay("2026-09-08", today) }, { dateLabel: "9월 8일", weekdayLabel: null, relativeDateLabel: "내일" });
  assert.deepEqual({ ...getReservationDateDisplay("2026-09-09", today) }, { dateLabel: "9월 9일", weekdayLabel: "수", relativeDateLabel: null });
  assert.deepEqual({ ...getReservationDateDisplay("2026-09-13", today) }, { dateLabel: "9월 13일", weekdayLabel: "일", relativeDateLabel: null });
  assert.match(schedule, /const selectedDayIndex = new Date\(`\$\{value\}T00:00:00`\)\.getDay\(\)/);
  assert.match(schedule, /Array\.from\(\{ length: 7 \}, \(_, index\) => addDate\(value, index - selectedDayIndex\)\)/);
  assert.match(schedule, /const weekDates = useMemo\(\(\) => weekDatesFor\(date\), \[date\]\)/);
  assert.match(schedule, /data-testid="schedule-week-strip"/);
  assert.match(schedule, /grid grid-cols-7/);
  assert.match(schedule, /aria-current=\{isSelected \? "date" : undefined\}/);
  assert.match(schedule, /onClick=\{\(\) => onSelectDate\(optionDate\)\}/);
  assert.match(schedule, /rounded-full bg-\[#2f5fb3\]/);
  assert.match(schedule, /data-testid="date-total"/);
  assert.match(schedule, /예약 \{visibleAppointments\.length\}건/);
  assert.match(schedule, /const isToday = date === today/);
  assert.match(schedule, /data-testid="date-primary"/);
  assert.match(schedule, /const selectedWeekdayLabel = weekdayLabel\(date\)/);
  assert.match(schedule, /data-testid="weekday-label"/);
  assert.match(schedule, /getReservationDateDisplay\(date, today\)/);
  assert.match(ownerApp, /onSelectDate=\{\(date\) => \{/);
  assert.match(ownerApp, /setVisitSelectionMode\("single"\)/);
  assert.match(ownerApp, /setVisitDateFilter\(date\)/);
  assert.doesNotMatch(schedule, /ChevronLeft|ChevronRight|onChangeDate/);
});

test("unchanged staff profile media keeps the rendered URL across refreshes", () => {
  const { keepStableStaffProfileUrls } = loadRefreshStabilityContract();
  const previous = {
    staffMembers: [{ id: "staff-1", profileImageUrl: "https://media.example/object/profile.jpg?token=old", profileImageAssetIds: ["asset-1"] }],
  };
  const renewed = {
    staffMembers: [{ id: "staff-1", profileImageUrl: "https://media.example/object/profile.jpg?token=renewed", profileImageAssetIds: ["asset-1"] }],
  };
  const replaced = {
    staffMembers: [{ id: "staff-1", profileImageUrl: "https://media.example/object/new-profile.jpg?token=new", profileImageAssetIds: ["asset-2"] }],
  };

  assert.equal(keepStableStaffProfileUrls(previous, renewed).staffMembers[0].profileImageUrl, previous.staffMembers[0].profileImageUrl);
  assert.equal(keepStableStaffProfileUrls(previous, replaced).staffMembers[0].profileImageUrl, replaced.staffMembers[0].profileImageUrl);
  assert.match(ownerApp, /keepStableStaffProfileUrls\(previous, authoritativeSnapshot\)/);
  assert.match(ownerApp, /keepStableStaffProfileUrls\(previous, initialData\)/);
  assert.match(ownerApp, /const refreshInFlightRef = useRef<Promise<void> \| null>\(null\)/);
  assert.match(ownerApp, /if \(refreshInFlightRef\.current\) return refreshInFlightRef\.current/);
  assert.match(ownerApp, /refreshInFlightRef\.current = request/);
  assert.match(refreshStabilitySource, /staffMember\.id/);
  assert.match(refreshStabilitySource, /profileImageAssetIds/);
});

test("appointment geometry and card hierarchy preserve canonical contracts", () => {
  assert.match(schedule, /const HOUR_HEIGHT = 72/);
  assert.match(schedule, /const BOARD_BOTTOM_CLEARANCE = 72/);
  assert.match(schedule, /BOARD_HEIGHT = BOARD_TOP_PADDING \+ \(END_HOUR - START_HOUR\) \* HOUR_HEIGHT \+ BOARD_BOTTOM_CLEARANCE/);
  assert.match(schedule, /data-appointment-id=\{appointment\.id\}/);
  assert.match(schedule, /minutes >= 75/);
  assert.match(schedule, /미용 완료/);
  assert.match(schedule, /noshow: \{ label: "노쇼"/);
  assert.match(schedule, /border-l-\[3px\]/);
  assert.match(schedule, /shadow-none/);
  assert.match(schedule, /function assignCollisionColumns/);
  assert.match(schedule, /minHeight: Math\.max\(height, 44\)/);
  assert.match(schedule, /assignAppointmentsToStaffLanes/);
  assert.doesNotMatch(schedule, /RoundPhoto|petVisuals|petVisuals\[/);
  assert.match(schedule, /src=\{staff\.profileImageUrl\}/);
  assert.match(schedule, /data-testid="staff-lane-chip"[\s\S]*?className="[^"]+bg-white/);
  assert.doesNotMatch(schedule, /data-testid="staff-identity-marker"/);
  assert.match(schedule, /backgroundColor: status\.tint/);
  assert.match(schedule, /text-\[12px\] font-medium leading-\[18px\][^\n]+font-variant-numeric:tabular-nums/);
  assert.match(schedule, /data-testid="date-total"/);
  assert.doesNotMatch(schedule, /CalendarCheck2/);
  assert.match(schedule, /const BOARD_TOP_PADDING = 0/);
  assert.match(schedule, /top: BOARD_TOP_PADDING \+ index \* HOUR_HEIGHT/);
  assert.match(schedule, /h-11 w-11/);
  assert.match(schedule, /currentMinutesInTimeZone\(\)/);
  assert.match(schedule, /data-testid="current-time-marker"/);
  assert.match(schedule, /data-testid="current-time-line"/);
  assert.match(schedule, /data-testid="current-time-label"/);
  assert.match(schedule, /aria-label=\{`현재 시간 \$\{formatMinutes\(nowMinutes\)\}`\}/);
  assert.match(schedule, /data-testid="time-header" aria-hidden="true" className="h-\[72px\]/);
  assert.match(schedule, /className="relative flex h-\[72px\] w-full/);
  assert.match(schedule, /items-center justify-start gap-2\.5/);
  assert.match(schedule, /data-testid="staff-lane-copy" className="min-w-0 flex-1 text-left"/);
  assert.match(schedule, /text-\[16px\] font-semibold leading-6/);
  assert.match(schedule, /const totalMinutes = laneAppointments\.reduce/);
  assert.match(schedule, /`\$\{laneAppointments\.length\}건 · \$\{formatDuration\(totalMinutes\)\}`/);
  assert.match(schedule, /backgroundColor: status\.tint/);
  assert.match(schedule, /pending: \{ label: "승인 대기", color: "#b98121", tint: "#f4f6f9" \}/);
  assert.match(schedule, /in_progress: \{ label: "진행 중", color: "#2563eb", tint: "#eaf2fd" \}/);
  assert.match(schedule, /completed: \{ label: "미용 완료", color: "#64748b", tint: "#f3f5f8" \}/);
  assert.doesNotMatch(schedule, /tint: "#f0faf4"|tint: "#fff8fa"/);
});

test("touching appointments keep their time geometry while their card surfaces receive a four-pixel visual gap", () => {
  const { getAdjacentScheduleCardEdgeInsets } = loadCardGapsContract();
  const adjacent = getAdjacentScheduleCardEdgeInsets([
    { id: "two-hour", startMinutes: 14 * 60, endMinutes: 16 * 60, column: 0 },
    { id: "next", startMinutes: 16 * 60, endMinutes: 17 * 60, column: 0 },
  ]);
  assert.deepEqual({ ...adjacent.get("two-hour") }, { top: 0, bottom: 2 });
  assert.deepEqual({ ...adjacent.get("next") }, { top: 2, bottom: 0 });
  const notAdjacent = getAdjacentScheduleCardEdgeInsets([
    { id: "first", startMinutes: 14 * 60, endMinutes: 15 * 60, column: 0 },
    { id: "separate-column", startMinutes: 15 * 60, endMinutes: 16 * 60, column: 1 },
  ]);
  assert.deepEqual({ ...notAdjacent.get("first") }, { top: 0, bottom: 0 });
  assert.match(schedule, /getAdjacentScheduleCardEdgeInsets/);
  assert.match(schedule, /data-testid="appointment-card-surface"/);
  assert.match(schedule, /style=\{\{\s*top,\s*left:/);
  assert.match(schedule, /top: edgeInsets\.top, bottom: edgeInsets\.bottom/);
});

test("today consumes the shared appointment-scoped display-photo projection for active and completed cards", () => {
  assert.match(domainSource, /export type PetDisplayPhotoProjection = \{/);
  assert.match(domainSource, /appointmentId: string/);
  assert.match(domainSource, /source: "appointment_grooming_after" \| "prior_grooming_after" \| "fallback"/);
  assert.match(domainSource, /sourceAppointmentId: string \| null/);
  assert.match(domainSource, /sourceGroomingRecordId: string \| null/);
  assert.match(domainSource, /petDisplayPhotos\?: PetDisplayPhotoProjection\[\]/);
  assert.match(ownerApp, /petDisplayPhotos=\{data\.petDisplayPhotos \?\? \[\]\}/);
  assert.match(ownerApp, /indexTodayPetDisplayPhotosByAppointmentId\(petDisplayPhotos\)/);
  assert.match(ownerApp, /resolveTodayAppointmentPetDisplayPhoto\(petDisplayPhotoByAppointmentId, appointment\)/);
  assert.equal(ownerApp.match(/petDisplayPhoto=\{resolvePetDisplayPhoto\(appointment\)\}/g)?.length, 3);
  assert.equal(ownerApp.match(/petDisplayPhoto=\{resolveTodayAppointmentPetDisplayPhoto\(petDisplayPhotoByAppointmentId, appointment\)\}/g)?.length, 2);
  assert.match(ownerApp, /showTodayPetDisplayPhoto/);
  assert.match(ownerApp, /function TodayPetPhoto\(\{ name, src \}/);
  assert.match(ownerApp, /data-testid="today-pet-display-photo" className="h-11 w-11/);
  assert.match(ownerApp, /if \(!src \|\| imageFailed\)/);
  assert.match(ownerApp, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.doesNotMatch(ownerApp, /petDisplayPhotoByPetId/);
  assert.doesNotMatch(domainSource, /pet_profile/);
  assert.doesNotMatch(ownerApp, /groomingRecords\.filter\(\(record\) => record\.pet_id === pet\.id\).*after/i);
});

test("owner app connects real staff and exact selected dates", () => {
  assert.match(ownerApp, /getStaffScheduleIdentityTone\(staffMember\.id, staffMember\.chipColorIndex\)/);
  assert.doesNotMatch(ownerApp, /staffIndex/);
  assert.match(ownerApp, /selectedStaffId=\{bookingStaffFilter\}/);
  assert.match(ownerApp, /onSelectStaff=\{setBookingStaffFilter\}/);
  assert.match(ownerApp, /onSelectDate=\{\(date\) => \{/);
  assert.match(ownerApp, /setVisitSelectionMode\("single"\)/);
  assert.match(ownerApp, /setVisitRange\(null\)/);
  assert.match(ownerApp, /setVisitDateFilter\(date\)/);
});

test("booking scrollport reserves the fixed bottom navigation", () => {
  assert.match(ownerApp, /activeTab === "book"\s*\? "h-dvh"/);
  assert.match(ownerApp, /activeTab === "book" \? "mb-\[calc\(env\(safe-area-inset-bottom\)\+60px\)\] min-h-0 overflow-y-auto overscroll-y-contain pb-0"/);
});
