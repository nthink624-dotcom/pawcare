import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const todayPath = new URL("../src/lib/owner-mobile-today.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const navigatorPath = new URL("../src/components/owner/owner-home-date-navigator.tsx", import.meta.url);
const pickerPath = new URL("../src/components/owner/owner-booking-date-picker.tsx", import.meta.url);
const contextMenuPath = new URL("../src/components/owner/owner-context-action-menu.tsx", import.meta.url);
const [todaySource, ownerAppSource, navigatorSource, pickerSource, contextMenuSource] = await Promise.all([
  readFile(todayPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(navigatorPath, "utf8"),
  readFile(pickerPath, "utf8"),
  readFile(contextMenuPath, "utf8"),
]);

function loadTodayContract() {
  const output = ts.transpileModule(todaySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

test("today shortcuts and relative labels use the app date without local timezone drift", () => {
  const { getOwnerTodayQuickDates, getOwnerTodayRelativeLabel, getOwnerTodaySlideDirection } = loadTodayContract();
  assert.equal(JSON.stringify(getOwnerTodayQuickDates("2026-09-06")), JSON.stringify([
    { key: "2026-09-06", label: "오늘" },
    { key: "2026-09-07", label: "내일" },
    { key: "2026-09-08", label: "모레" },
  ]));
  assert.equal(getOwnerTodaySlideDirection("2026-09-07", "2026-09-06"), "prev");
  assert.equal(getOwnerTodaySlideDirection("2026-09-06", "2026-09-08"), "next");
  assert.equal(getOwnerTodayRelativeLabel("2026-09-06", "2026-09-06"), "오늘");
  assert.equal(getOwnerTodayRelativeLabel("2026-09-07", "2026-09-06"), "내일");
  assert.equal(getOwnerTodayRelativeLabel("2026-09-09", "2026-09-06"), "수");
});

test("newer canonical appointment snapshots replace the same id without duplicate cards", () => {
  const { dedupeAuthoritativeAppointments, shouldApplyOwnerMobileRefresh } = loadTodayContract();
  const refreshed = dedupeAuthoritativeAppointments([
    { id: "appointment-1", status: "confirmed" },
    { id: "appointment-1", status: "in_progress" },
    { id: "appointment-1", status: "completed" },
  ]);
  assert.equal(JSON.stringify(refreshed), JSON.stringify([{ id: "appointment-1", status: "completed" }]));
  assert.equal(shouldApplyOwnerMobileRefresh(3, 2), true);
  assert.equal(shouldApplyOwnerMobileRefresh(2, 3), false);
});

test("owner today filters by the selected date and applies only the latest no-store bootstrap", () => {
  assert.match(ownerAppSource, /const homeWorkDateKey = homeReservationDate;/);
  assert.match(ownerAppSource, /homeWorkDateKey === todayDate \? "오늘 할 일" : "선택한 날"/);
  assert.match(ownerAppSource, /isToday \? ownerHomeCopy\.currentSectionEmpty : "선택한 날짜에 처리할 예약이 없어요"/);
  assert.match(ownerAppSource, /cache: "no-store"/);
  assert.match(ownerAppSource, /dedupeAuthoritativeAppointments\(next\.appointments\)/);
  assert.match(ownerAppSource, /shouldApplyOwnerMobileRefresh\(requestId, lastAppliedRefreshRequestIdRef\.current\)/);
  assert.match(ownerAppSource, /window\.addEventListener\("focus", syncIfIdle\)/);
  assert.match(ownerAppSource, /document\.addEventListener\("visibilitychange", syncIfIdle\)/);
  assert.match(ownerAppSource, /<OwnerHomeDateNavigator/);
  assert.match(ownerAppSource, /open=\{isHomeDatePickerOpen\}/);
  assert.match(ownerAppSource, /void refreshSilently\(\);/);
});

test("today date controls share the task-tab row with inline relative label, without a visible refresh control", () => {
  assert.match(navigatorSource, /aria-label="이전 날짜"/);
  assert.match(navigatorSource, /aria-label="다음 날짜"/);
  assert.match(navigatorSource, /h-11 w-11/);
  assert.match(navigatorSource, /w-\[92px\]/);
  assert.match(navigatorSource, /text-\[16px\] font-medium/);
  assert.match(navigatorSource, /text-\[13px\] font-medium/);
  assert.match(navigatorSource, /tabular-nums/);
  assert.match(navigatorSource, /timeZone: "Asia\/Seoul"/);
  assert.doesNotMatch(navigatorSource, /RefreshCw|예약 새로고침/);
  assert.match(ownerAppSource, /<HomeScheduleTabs[\s\S]*trailing=\{/);
  assert.match(ownerAppSource, /quickDates=\{getOwnerTodayQuickDates\(todayDate\)\}/);
  assert.match(pickerSource, /aria-label="빠른 날짜 선택"/);
  assert.match(pickerSource, /min-h-11/);
  assert.match(pickerSource, /aria-label="이전 달" className="inline-flex h-11 w-11/);
  assert.match(pickerSource, /className="flex h-11 items-center justify-center/);
});

test("today task tabs keep Korean labels on one line while the date control uses only its required width", () => {
  assert.match(ownerAppSource, /flex min-w-0 flex-1 items-center gap-2/);
  assert.match(ownerAppSource, /flex min-h-11 shrink-0 items-center gap-\[5px\]/);
  assert.match(ownerAppSource, /<span className="whitespace-nowrap text-center">\{tab\.label\}<\/span>/);
  assert.match(navigatorSource, /flex shrink-0 items-center gap-1/);
  assert.match(navigatorSource, /h-11 w-\[92px\]/);
});

test("today reservation chips emphasize only the core time, pet, and service roles", () => {
  const cardStart = ownerAppSource.indexOf("function HomeConfirmedCard(");
  const cardEnd = ownerAppSource.indexOf("function AppointmentListTrailing", cardStart);
  const cardSource = ownerAppSource.slice(cardStart, cardEnd === -1 ? undefined : cardEnd);

  assert.match(cardSource, /w-\[48px\] shrink-0 whitespace-nowrap text-\[16px\] font-medium leading-6 tabular-nums/);
  assert.match(cardSource, /text-\[16px\] font-semibold leading-6[\s\S]*?\{pet\.name\}/);
  assert.match(cardSource, /text-\[14px\] font-medium leading-5[\s\S]*?\{service\.name\}/);
  assert.doesNotMatch(cardSource, /font-bold|font-black|font-\[7\d\d\]/);
});

test("home staff selection uses stable staff photos for all, individual, and list states", () => {
  assert.match(ownerAppSource, /profileImageUrl: staffMember\.profileImageUrl/);
  assert.match(ownerAppSource, /profileImageFallbackKey: staffMember\.profileImageFallbackKey/);
  assert.match(ownerAppSource, /const staffOptions = options\.filter/);
  assert.match(ownerAppSource, /const visibleStaffPhotos = staffOptions\.slice\(0, 3\)/);
  assert.match(ownerAppSource, /<StaffProfilePhoto[\s\S]*src=\{staffOption\.profileImageUrl\}/);
  assert.match(ownerAppSource, /\+\{staffOptions\.length - visibleStaffPhotos\.length\}/);
  assert.match(ownerAppSource, /src=\{selectedOption\.profileImageUrl\}/);
  assert.match(ownerAppSource, /src=\{option\.profileImageUrl\}/);
  assert.match(ownerAppSource, /min-h-11 w-full items-center justify-between/);
});

test("all owner tabs share one contextual menu that opens the canonical reservation-create flow", () => {
  assert.doesNotMatch(ownerAppSource, /ReservationCreateFab/);
  assert.match(ownerAppSource, /<OwnerContextActionMenu/);
  assert.match(contextMenuSource, /data-testid="owner-context-action-trigger"/);
  assert.match(contextMenuSource, /aria-label="빠른 메뉴 열기 및 이동"/);
  assert.match(contextMenuSource, />\s*새 예약 추가\s*</);
  assert.match(contextMenuSource, /h-12 w-12/);
  assert.match(contextMenuSource, /document\.querySelector<HTMLElement>\("\.pm-mobile-owner"\)\?\.getBoundingClientRect\(\)/);
  assert.match(contextMenuSource, /const left = shell \? Math\.max\(viewportLeft, shell\.left\) : viewportLeft;/);
  assert.match(contextMenuSource, /const right = shell \? Math\.min\(viewportRight, shell\.right\) : viewportRight;/);
  assert.match(contextMenuSource, /viewport\.left \+ viewport\.width - EDGE_GAP_PX - half/);
  assert.doesNotMatch(contextMenuSource, /clampAxis\(\s*position\.x,\s*EDGE_GAP_PX \+ half,\s*window\.innerWidth/s);
  assert.match(ownerAppSource, /setModal\(\{ type: "new-appointment" \}\)/);
  assert.match(ownerAppSource, /modal\.type === "new-appointment"[\s\S]*onSave=\{\(payload\) => mutate\("\/api\/appointments"/);
  assert.match(ownerAppSource, /pb-\[calc\(env\(safe-area-inset-bottom\)\+128px\)\]/);
});
