import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("owner UI no longer presents Alimtalk counts, passes, or exhausted-state copy", async () => {
  const [shell, help, alerts, billing, picker, preview, flow, settings, credits] = await Promise.all([
    source("src/components/owner-web/owner-web-app-shell.tsx"),
    source("src/components/owner-web/owner-help-screen.tsx"),
    source("src/components/owner-web/settings-alerts-panel.tsx"),
    source("src/components/owner/owner-billing-screen.tsx"),
    source("src/components/owner/owner-billing-plan-picker.tsx"),
    source("src/components/owner/owner-billing-process-preview.tsx"),
    source("src/components/owner/owner-billing-flow-shared.tsx"),
    source("src/components/owner/owner-settings-panel.tsx"),
    source("src/app/owner/alimtalk-credits/page.tsx"),
  ]);
  assert.doesNotMatch(shell, /AlimtalkCreditMenu|알림톡 잔여|무료 잔여|추가 이용권|모두 소진/);
  assert.doesNotMatch([help, alerts, billing, picker, preview, flow, settings, credits].join("\n"), /잔여 건수|포함 알림톡|추가 발송 이용권|크레딧 리셋|초과 알림톡은 11원|alimtalkIncludedLabel|excessAlimtalkLabel/);
  assert.match(alerts, /알림톡 발송 설정과 발송 이력/);
});

test("schedule selection and reservation cards keep the approved calm visual contract", async () => {
  const [header, grid, timeRail] = await Promise.all([
    source("src/components/owner-web/calendar-staff-lane-header.tsx"),
    source("src/components/owner-web/calendar-daily-schedule-grid.tsx"),
    source("src/components/owner-web/calendar-time-rail.tsx"),
  ]);
  assert.match(header, /backgroundColor: selected \? identityTone\.selectedBackground : identityTone\.background/);
  assert.match(header, /--schedule-staff-identity-color.*identityTone\.color/);
  assert.match(grid, /selectedLane && "bg-\[#f1f3f5\]"/);
  assert.match(grid, /bg-\[#f8fbff\]/);
  assert.match(grid, /border-\[#dfe8f2\]/);
  assert.match(grid, /backgroundColor: "#2563eb"/);
  assert.match(timeRail, /background: "#f8fbff"/);
  assert.match(timeRail, /current: "#2563eb"/);
  assert.match(timeRail, /backgroundColor: "#ffffff"/);
  assert.match(grid, /bg-\[#fffdf8\]/);
  assert.equal([...grid.matchAll(/backgroundColor: selected \? "#f4f8ff" : "#fffdf8"/g)].length, 2);
  assert.match(grid, /border-l-\[3px\]/);
  for (const color of ["#1f9d55", "#2563eb", "#7c3aed", "#64748b", "#b98121", "#a04455"]) {
    assert.ok(grid.includes(color), color);
  }
});

test("customer management uses the extracted responsive 14px table without region exposure", async () => {
  const [screen, table] = await Promise.all([
    source("src/components/owner-web/customer-management-screen.tsx"),
    source("src/components/owner-web/customer-management-table.tsx"),
  ]);
  assert.match(screen, /CustomerManagementTable/);
  assert.doesNotMatch(screen, /function CustomerListRow/);
  for (const label of ["등록일", "고객명", "고객 ID", "등급", "매장명", "연락처", "성별", "나이", "연락·메모", "관련 이력"]) {
    assert.ok(table.includes(label), label);
  }
  assert.doesNotMatch(table, /지역/);
  assert.match(table, /min-w-\[1480px\]/);
  assert.match(table, /table-fixed border-collapse text-\[14px\] leading-5/);
  assert.match(table, /grid min-w-0 grid-cols-2[^"]*text-\[14px\] leading-5/);
  assert.match(table, /block truncate text-\[14px\] leading-5/);
  assert.match(table, /lg:block/);
  assert.match(table, /lg:hidden/);
  assert.match(table, /미등록/);
  assert.match(table, /row\.customerGradeOverride/);
  assert.doesNotMatch(table, /회원 유형|customerMemberType/);
});

test("initial setup portal is mounted before document.body is used as its render target", async () => {
  const [guide, preview] = await Promise.all([
    source("src/components/owner-web/owner-initial-setup-guide.tsx"),
    source("src/app/dev/initial-setup-guide-preview/initial-setup-guide-preview-client.tsx"),
  ]);
  assert.match(guide, /const \[portalTarget, setPortalTarget\] = useState<HTMLElement \| null>\(null\)/);
  assert.match(guide, /setPortalTarget\(document\.body\)/);
  assert.match(guide, /if \(!open \|\| !portalTarget\) return null/);
  assert.match(guide, /portalTarget,\s*\n\s*\)/);
  assert.doesNotMatch(guide, /createPortal\([\s\S]*,\s*document\.body,\s*\n\s*\)/);
  assert.match(guide, /pointer-events-none fixed inset-0 z-\[90\]/);
  assert.match(guide, /pointer-events-auto absolute inset-0 bg-\[#0f172a\]\/35[\s\S]*data-testid="owner-initial-setup-backdrop"[\s\S]*onPointerDown=\{closeGuide\}/);
  assert.match(guide, /pointer-events-none absolute inset-0 flex items-center justify-center/);
  assert.match(guide, /pointer-events-auto relative z-10 flex max-h-/);
  assert.match(preview, /<OwnerInitialSetupGuide[\s\S]*<InitialSetupFixtureForm[\s\S]*activeScreen=\{activeScreen\}[\s\S]*onStepSaved=\{handleStepSaved\}[\s\S]*onStaffNext=[\s\S]*\/>[\s\S]*<\/OwnerInitialSetupGuide>/);
});

test("DB-free fixtures open the canonical V2 matrix in one click and expose two staff accents", async () => {
  const [fixture, detail, mockData, staffPanel] = await Promise.all([
    source("src/app/dev/initial-setup-guide-preview/initial-setup-fixture-form.tsx"),
    source("src/components/owner-web/price-guide-v2-service-detail.tsx"),
    source("src/lib/mock-data.ts"),
    source("src/components/owner-web/initial-setup-staff-management-panel.tsx"),
  ]);
  assert.match(fixture, /PriceGuidePhotoOnboarding/);
  assert.match(fixture, /onSaveActionReady=\{registerSaveAction\}/);
  assert.match(fixture, /<OwnerInitialSetupSaveNextActions onSave=\{\(\) => saveAction\?\.\(\)\} onNext=\{onNext\} saveDisabled=\{!saveAction\} \/>/);
  assert.match(fixture, /name: "대표자"/);
  assert.match(fixture, /role: "대표"/);
  assert.match(fixture, /InitialSetupStaffManagementPanel/);
  assert.doesNotMatch(fixture, /useState\("원장"\)/);
  assert.match(staffPanel, /연락처 \(선택\)/);
  assert.match(detail, /data-price-guide-detail-matrix="true"/);
  assert.match(detail, /상세 요금표 저장/);
  assert.match(mockData, /id: "svc-full"[\s\S]*price_guide: \{[\s\S]*schemaVersion: 2[\s\S]*priceMinKrw: 80000[\s\S]*durationMinutes: 120/);
  assert.match(mockData, /id: "demo-shop-staff-owner"[\s\S]*chipColorIndex: 0/);
  assert.match(mockData, /id: "demo-shop-staff-designer"[\s\S]*chipColorIndex: 1/);
});

test("named owner controls keep at least 44px pointer targets", async () => {
  const [shell, actionStyles, excelTools, customers, shopInfo, alerts] = await Promise.all([
    source("src/components/owner-web/owner-web-app-shell.tsx"),
    source("src/components/owner-web/owner-web-action-button-styles.ts"),
    source("src/components/owner-web/customer-excel-tools.tsx"),
    source("src/components/owner-web/customer-management-screen.tsx"),
    source("src/components/owner-web/settings-shop-info-panel.tsx"),
    source("src/components/owner-web/settings-alerts-panel.tsx"),
  ]);
  assert.match(shell, /OWNER_HEADER_UTILITY_BUTTON_CLASS =[\s\S]*inline-flex h-11/);
  assert.match(shell, /relative flex h-11 w-full items-center/);
  assert.equal([...shell.matchAll(/inline-flex h-11 w-11 items-center justify-center rounded-\[9px\]/g)].length, 2);
  assert.match(shell, /buttonClassName="h-11"/);
  assert.match(actionStyles, /OWNER_WEB_ACTION_BUTTON_BASE_CLASS =[\s\S]*inline-flex h-11/);
  assert.match(excelTools, /className=\{OWNER_WEB_SECONDARY_ACTION_BUTTON_CLASS\}/);
  assert.match(customers, /flex h-11 min-w-\[320px\]/);
  assert.match(customers, /inline-flex h-11 w-11 items-center justify-center rounded-\[8px\] border transition/);
  assert.match(customers, /onClick=\{toggleDisplayedCustomerSelection\} className="h-11/);
  assert.match(customers, /onClick=\{moveSelectedCustomersToDeleted\} className="h-11/);
  assert.match(shopInfo, /flex h-\[52px\][\s\S]*inline-flex h-11 shrink-0 items-center rounded-full/);
  assert.match(alerts, /aria-label=\{`\$\{label\} 도움말`\}[\s\S]*inline-flex h-11 w-11/);
  assert.match(alerts, /"h-11 rounded-\[8px\] border px-4 text-\[16px\] transition"/);
  assert.match(alerts, /<label className="flex h-11 items-center overflow-hidden/);
  assert.match(alerts, /inline-flex min-h-11 min-w-0 items-center text-left/);
});

test("staff setup and customer preview preserve their accepted handoff details", async () => {
  const [staff, staffPanel, entry, phone] = await Promise.all([
    source("src/components/owner-web/staff-management-screen.tsx"),
    source("src/components/owner-web/initial-setup-staff-management-panel.tsx"),
    source("src/components/customer/customer-booking-entry-page.tsx"),
    source("src/components/owner-web/customer-page-phone-preview.tsx"),
  ]);
  assert.match(staff, /InitialSetupStaffManagementPanel/);
  assert.match(staffPanel, /\{name\} \/ \{staffRole\(staffMember, ownerStaffId\)\}/);
  assert.match(staffPanel, /근무 \{staffMember\.startTime\}–\{staffMember\.endTime\}/);
  assert.match(entry, /CustomerBookingPreviewSelection/);
  assert.match(entry, /serviceOptionId/);
  assert.match(phone, /<CustomerBookingPage/);
  assert.match(phone, /initialServiceId=\{selection\.serviceId\}/);
  assert.match(phone, /initialServiceOptionId=\{selection\.serviceOptionId\}/);
  assert.match(phone, /previewOnly/);
  assert.doesNotMatch(phone, /function CustomerPreviewBookingFlowScreen/);
});
