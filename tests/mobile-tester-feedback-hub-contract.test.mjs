import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const contextMenu = await readFile(new URL("../src/components/owner/owner-context-action-menu.tsx", import.meta.url), "utf8");
const feedbackSheet = await readFile(new URL("../src/components/owner/owner-tester-feedback-sheet.tsx", import.meta.url), "utf8");
const feedbackContract = await readFile(new URL("../src/lib/tester-feedback.ts", import.meta.url), "utf8");
const feedbackAdapter = await readFile(new URL("../src/lib/owner-feedback-adapter.ts", import.meta.url), "utf8");
const fixturePage = await readFile(new URL("../src/app/dev/owner-feedback-preview/page.tsx", import.meta.url), "utf8");
const fixture = await readFile(new URL("../src/components/owner/owner-feedback-dev-preview.tsx", import.meta.url), "utf8");
const domain = await readFile(new URL("../src/types/domain.ts", import.meta.url), "utf8");

test("tester access changes only amber emphasis while every authenticated owner receives the shared feedback adapter", () => {
  assert.match(domain, /pilotCohort\?: OwnerPilotCohortProjection/);
  assert.match(feedbackContract, /schemaReady: boolean/);
  assert.match(feedbackContract, /isPilotMember: boolean/);
  assert.match(feedbackContract, /status !== "excluded"/);
  assert.match(ownerApp, /isTesterFeedback = !isOwnerDemo && !isStaffApp && canUseTesterFeedback\(data\.pilotCohort\)/);
  assert.match(ownerApp, /setIsTesterFeedbackHubOpen\(true\)/);
  assert.match(ownerApp, /setModal\(\{ type: "new-appointment" \}\)/);
  assert.doesNotMatch(ownerApp, /data-tester-feedback-trigger|fixed bottom-\[calc\(env\(safe-area-inset-bottom\)\+72px\)\] left-4/);
  assert.doesNotMatch(ownerApp, /ReservationCreateFab/);
  assert.match(ownerApp, /!isStaffApp && !modal/);
  assert.match(ownerApp, /<OwnerContextActionMenu/);
  assert.match(ownerApp, /returnFocusRef=\{ownerFeedbackReturnFocusRef\}/);
  assert.match(ownerApp, /adapter=\{sharedOwnerFeedbackAdapter\}/);
  assert.match(contextMenu, /isTester \? "border-\[#d8c59c\] bg-\[#fff5d9\]" : "border-\[#cfd8e3\] bg-white"/);
});

test("movable owner menu contains exactly three contextual actions and preselects feedback intent", () => {
  assert.deepEqual([...contextMenu.matchAll(/role="menuitem"/g)].length, 3);
  assert.match(contextMenu, /role="menuitem"[\s\S]*?>\s*새 예약 추가\s*<\/button>[\s\S]*?role="menuitem"[\s\S]*?>\s*문의 남기기\s*<\/button>[\s\S]*?role="menuitem"[\s\S]*?>\s*함께 고쳐요\s*<\/button>/);
  assert.match(contextMenu, /runAction\(onAddReservation\)/);
  assert.match(contextMenu, /onOpenFeedback\("bug"\)/);
  assert.match(contextMenu, /onOpenFeedback\("inquiry"\)/);
  assert.doesNotMatch(feedbackSheet, /title="빠른 메뉴"|onAddReservation|quick-actions/);
});

test("context menu drag is thresholded, locally restored, clamped, and never dispatches an action", () => {
  assert.match(contextMenu, /DRAG_THRESHOLD_PX = 7/);
  assert.match(contextMenu, /Math\.hypot\(deltaX, deltaY\) < DRAG_THRESHOLD_PX/);
  assert.match(contextMenu, /pointer\.dragged = true/);
  assert.match(contextMenu, /suppressClickRef\.current = true/);
  assert.match(contextMenu, /localStorage\.setItem\(POSITION_STORAGE_KEY/);
  assert.match(contextMenu, /visualViewport/);
  assert.match(contextMenu, /visualWidth >= MIN_USABLE_VIEWPORT_WIDTH_PX/);
  assert.match(contextMenu, /visualHeight >= MIN_USABLE_VIEWPORT_HEIGHT_PX/);
  assert.match(contextMenu, /Math\.max\(window\.innerHeight, MIN_USABLE_VIEWPORT_HEIGHT_PX\)/);
  assert.match(contextMenu, /document\.querySelector<HTMLElement>\("\.pm-mobile-owner"\)\?\.getBoundingClientRect\(\)/);
  assert.match(contextMenu, /const left = shell \? Math\.max\(viewportLeft, shell\.left\) : viewportLeft;/);
  assert.match(contextMenu, /const top = shell \? Math\.max\(viewportTop, shell\.top\) : viewportTop;/);
  assert.match(contextMenu, /const right = shell \? Math\.min\(viewportRight, shell\.right\) : viewportRight;/);
  assert.match(contextMenu, /const bottom = shell \? Math\.min\(viewportBottom, shell\.bottom\) : viewportBottom;/);
  assert.match(contextMenu, /viewport\.left \+ EDGE_GAP_PX \+ half/);
  assert.match(contextMenu, /viewport\.left \+ viewport\.width - EDGE_GAP_PX - half/);
  assert.doesNotMatch(contextMenu, /clampAxis\(\s*position\.x,\s*EDGE_GAP_PX \+ half,\s*window\.innerWidth/s);
  assert.match(contextMenu, /maximum >= minimum \? Math\.min\(maximum, Math\.max\(minimum, value\)\) : center/);
  assert.match(contextMenu, /BOTTOM_NAV_CLEARANCE_PX/);
  assert.match(contextMenu, /orientationchange/);
  assert.match(contextMenu, /opensLeft/);
  assert.match(contextMenu, /opensUp/);
  assert.match(contextMenu, /touch-none/);
});

test("shared feedback transport keeps retry receipts private and POST payload allowlisted", () => {
  assert.match(feedbackSheet, /adapter\?: OwnerFeedbackAdapter/);
  assert.match(feedbackSheet, /await adapter\.submit\(\{/);
  assert.match(feedbackSheet, /shopId,\s*requestId,\s*category,\s*body: normalizedBody,\s*screenKey,\s*appVersion,\s*screenshot: receipt/);
  assert.match(feedbackAdapter, /sharedOwnerFeedbackAdapter/);
  assert.match(feedbackAdapter, /fetchApiJsonWithAuth<\{ feedback: Omit<OwnerFeedbackAcknowledgement, "replayed">; replayed: boolean \}>\("\/api\/owner\/tester-feedback"/);
  assert.match(feedbackAdapter, /createOwnerMediaAssetFromFile\(\s*\{ shopId \},\s*"feedback_screenshot"/);
  assert.match(feedbackAdapter, /createProviderReadyVariant: false/);
  assert.match(feedbackAdapter, /consent: true/);
  assert.doesNotMatch(feedbackSheet, /guardianId|petId|appointmentId|audio|deviceId|userAgent|location\.href/);
  assert.match(feedbackSheet, /lastAttemptFingerprintRef\.current !== fingerprint/);
  assert.match(feedbackSheet, /requestIdRef\.current = createTesterFeedbackRequestId\(\)/);
  assert.match(feedbackSheet, /setSubmitState\("error"\)/);
  assert.match(feedbackSheet, /setSubmitState\("error"\);\s*setErrorMessage\(/s);
  assert.match(feedbackSheet, /setScreenshotReceipt\(receipt\)/);
});

test("owner and tester forms keep explicit privacy, optional safe screenshots, and compact 44px controls", () => {
  assert.match(feedbackContract, /"inquiry"/);
  assert.match(feedbackContract, /bug: "문제 발견"/);
  assert.match(feedbackContract, /improvement: "개선 제안"/);
  assert.match(feedbackSheet, /고객 개인정보는 입력하지 마세요/);
  assert.match(feedbackSheet, /required/);
  assert.match(feedbackSheet, /aria-required="true"/);
  assert.match(feedbackSheet, /보내는 중/);
  assert.match(feedbackSheet, /피드백을 보냈어요/);
  assert.match(feedbackSheet, /dialogLabel="문의·의견 보내기"/);
  assert.match(feedbackSheet, /initialCategory: TesterFeedbackCategory/);
  assert.match(feedbackSheet, /feedback-draft\.v2/);
  assert.match(feedbackSheet, /legacyDraftKey/);
  assert.match(feedbackSheet, /min-h-11/);
  assert.match(feedbackSheet, /aria-pressed/);
  assert.match(feedbackSheet, /TESTER_FEEDBACK_BODY_MIN_LENGTH/);
  assert.match(feedbackSheet, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(feedbackSheet, /MAX_SCREENSHOT_BYTES/);
  assert.match(feedbackSheet, /sessionStorage/);
  assert.match(feedbackContract, /TESTER_FEEDBACK_BODY_MIN_LENGTH = 2/);
  assert.match(feedbackContract, /TESTER_FEEDBACK_BODY_MAX_LENGTH = 2000/);
});

test("tester feedback sheet has its own modal semantics, focus lifecycle, trap, and safe-area clearance", async () => {
  const sheet = await readFile(new URL("../src/components/owner/owner-app-ui.tsx", import.meta.url), "utf8");
  assert.match(feedbackSheet, /dialogLabel="문의·의견 보내기"/);
  assert.match(feedbackSheet, /initialFocusRef=\{categoryRef\}/);
  assert.match(feedbackSheet, /restoreFocusRef=\{returnFocusRef\}/);
  assert.match(sheet, /role=\{dialogLabel \? "dialog" : undefined\}/);
  assert.match(sheet, /aria-modal=\{dialogLabel \? true : undefined\}/);
  assert.match(sheet, /keepFocusInDialog/);
  assert.match(sheet, /restoreFocusRef\?\.current\?\.focus\(\)/);
  assert.match(sheet, /pb-\[calc\(env\(safe-area-inset-bottom\)\+20px\)\]/);
  assert.match(sheet, /event\.key !== "Escape"/);
  assert.match(sheet, /document\.addEventListener\("keydown", closeOnEscape\)/);
  assert.match(sheet, /document\.removeEventListener\("keydown", closeOnEscape\)/);
  assert.match(sheet, /event\.preventDefault\(\);\s*onClose\(\);/);
  assert.match(contextMenu, /aria-label="빠른 메뉴 열기 및 이동"/);
  assert.match(contextMenu, /aria-expanded=\{isOpen\}/);
  assert.match(contextMenu, /event\.key !== "Escape"/);
  assert.match(ownerApp, /if \(isOwnerContextMenuOpen\)/);
});

test("development fixture mounts four owner screens and both owner modes with an injected no-call adapter and production guard", () => {
  assert.match(fixturePage, /NODE_ENV === "production".*notFound\(\)/s);
  assert.match(fixture, /"home", label: "오늘"/);
  assert.match(fixture, /"schedule", label: "예약 조회"/);
  assert.match(fixture, /"customers", label: "고객 관리"/);
  assert.match(fixture, /"settings", label: "설정"/);
  assert.match(fixture, /<OwnerContextActionMenu/);
  assert.match(fixture, /isTester=\{isTester\}/);
  assert.match(fixture, /adapter=\{adapter\}/);
  assert.match(fixture, /async submit\(submission\)/);
  assert.doesNotMatch(fixture, /fetch\(|fetchApiJsonWithAuth|\/api\//);
});
