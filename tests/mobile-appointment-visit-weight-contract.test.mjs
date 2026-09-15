import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/lib/owner-appointment-visit-weight.ts", import.meta.url), "utf8");
const ownerApp = await readFile(new URL("../src/components/owner/owner-app.tsx", import.meta.url), "utf8");
const customerDetailUi = await readFile(new URL("../src/components/owner/owner-customer-detail-ui.tsx", import.meta.url), "utf8");
const detailStart = ownerApp.indexOf("function AppointmentVisitWeightEditor");
const detailEnd = ownerApp.indexOf("function AppointmentDetailMediaHistory", detailStart);
const visitWeightEditor = ownerApp.slice(detailStart, detailEnd);
const mediaDetailStart = ownerApp.indexOf("function AppointmentDetailMediaHistory");
const mediaDetailEnd = ownerApp.indexOf("export function AppointmentDetail", mediaDetailStart);
const mediaDetail = ownerApp.slice(mediaDetailStart, mediaDetailEnd);
const appointmentDetail = ownerApp.slice(ownerApp.indexOf("function AppointmentDetail"), ownerApp.indexOf("function isBookableOwnerService"));

test("mobile visit-weight adapter uses the shared canonical appointment GET and PUT contract", () => {
  assert.match(adapter, /type VisitWeightMeasurement/);
  assert.match(adapter, /current: VisitWeightMeasurement \| null/);
  assert.match(adapter, /recent: VisitWeightMeasurement \| null/);
  assert.match(adapter, /\/api\/owner\/appointment-visit-weight\?\$\{query\.toString\(\)\}/);
  assert.match(adapter, /method: "GET", cache: "no-store"/);
  assert.match(adapter, /method: "PUT"/);
  assert.match(adapter, /shopId: string;[\s\S]*appointmentId: string;[\s\S]*weightKg: number;[\s\S]*idempotencyKey: string/);
  assert.match(adapter, /fetchApiJsonWithAuth/);
  assert.doesNotMatch(adapter, /localStorage|sessionStorage|pet\.weight|care_report/);
});

test("today weight saves once with a stable retry key and only accepts canonical readback", () => {
  assert.match(visitWeightEditor, /idempotencyKeys\.current\.get\(normalized\) \?\? crypto\.randomUUID\(\)/);
  assert.match(visitWeightEditor, /transport\.put\(\{ shopId, appointmentId, weightKg, idempotencyKey \}\)/);
  assert.match(visitWeightEditor, /const readback = await transport\.fetch\(shopId, appointmentId\)/);
  assert.match(visitWeightEditor, /readback\.current\.appointmentId !== appointmentId/);
  assert.match(visitWeightEditor, /readback\.current\.weightKg !== weightKg/);
  assert.doesNotMatch(visitWeightEditor, /setResponse\(\{.*current/s);
});

test("today weight keeps only the compact field controls and reserves copy for real errors", () => {
  assert.match(visitWeightEditor, /오늘 몸무게<\/h2>/);
  assert.match(visitWeightEditor, /aria-hidden="true">kg<\/span>/);
  assert.match(visitWeightEditor, /\{saving \? "저장 중" : "저장"\}/);
  assert.doesNotMatch(visitWeightEditor, /이 예약에서 직접 측정한 값만 저장해요|방문 몸무게 저장 기능을 준비하고 있습니다|최근 \{formatVisitWeightReferenceDate|저장됨/);
  assert.match(visitWeightEditor, /오늘 몸무게를 불러오지 못했어요|오늘 몸무게를 저장하지 못했어요/);
});

test("today weight keeps the focused field stable inside the sheet while the keyboard resizes the viewport", () => {
  assert.match(visitWeightEditor, /const weightInputRef = useRef<HTMLInputElement \| null>\(null\)/);
  assert.match(visitWeightEditor, /window\.visualViewport/);
  assert.match(visitWeightEditor, /input\.closest<HTMLElement>\("\.overflow-y-auto"\)/);
  assert.match(visitWeightEditor, /viewport\.addEventListener\("resize", keepInputVisible\)/);
  assert.match(visitWeightEditor, /viewport\.removeEventListener\("resize", keepInputVisible\)/);
  assert.match(visitWeightEditor, /ref=\{weightInputRef\}/);
  assert.doesNotMatch(visitWeightEditor, /maximum-scale|user-scalable|setInterval/);
});

test("appointment detail keeps cancellation behind a short confirmation and keeps body density neutral", () => {
  assert.match(appointmentDetail, /<AppointmentVisitWeightEditor shopId=\{data\.shop\.id\} appointmentId=\{appointment\.id\} disabled=\{saving\} transport=\{visitWeightTransport\} \/>/);
  assert.match(appointmentDetail, /onClick=\{\(\) => setIsCancelConfirmOpen\(true\)\}/);
  assert.match(appointmentDetail, /role="alertdialog"/);
  assert.match(appointmentDetail, /onClick=\{\(\) => onUpdate\(\{ status: "cancelled" \}\)\}/);
  assert.doesNotMatch(appointmentDetail, /취소 후에는 취소·변경 내역에서 확인/);
  assert.match(appointmentDetail, /고객 요청 메모/);
  assert.match(appointmentDetail, /담당자 메모/);
  assert.match(appointmentDetail, /text-\[16px\] font-normal leading-6/);
});

test("appointment detail uses the approved readable mobile type roles without intermediate or heavy weights", () => {
  assert.match(appointmentDetail, /text-\[20px\] font-semibold leading-7/);
  assert.match(ownerApp, /grid min-w-0 grid-cols-\[76px_minmax\(0,1fr\)\] items-center gap-x-3 gap-y-1[\s\S]*?text-\[14px\] font-medium leading-5[\s\S]*?text-\[16px\] font-normal leading-6/);
  assert.match(visitWeightEditor, /text-\[16px\] font-medium leading-6/);
  assert.match(appointmentDetail, /text-\[16px\] font-medium leading-6/);
  assert.doesNotMatch(appointmentDetail, /text-\[(?:15|17|19)px\]|font-(?:bold|extrabold|black)|font-[789]00/);
});

test("appointment detail reflows at 200 percent without shrinking names, contact actions, or visit-weight controls", () => {
  assert.match(ownerApp, /grid min-w-0 grid-cols-\[76px_minmax\(0,1fr\)\][\s\S]*max-\[300px\]:grid-cols-1/);
  assert.match(visitWeightEditor, /grid min-w-0 grid-cols-\[minmax\(0,1fr\)_auto_84px\] gap-2 max-\[300px\]:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(appointmentDetail, /max-\[300px\]:flex-col max-\[300px\]:items-stretch/);
  assert.match(appointmentDetail, /max-\[300px\]:w-full/);
  assert.match(customerDetailUi, /grid grid-cols-2 gap-2 max-\[300px\]:grid-cols-1/);
  assert.doesNotMatch(visitWeightEditor, /onBlur=/);
});

test("appointment detail uses one surface for notification history while preserving history rows and timestamps", () => {
  assert.match(appointmentDetail, /<section className="pt-3" aria-labelledby=\{`appointment-notification-history-\$\{appointment\.id\}`\}>/);
  assert.match(appointmentDetail, /<h2 id=\{`appointment-notification-history-\$\{appointment\.id\}`\}[^>]*>알림톡 이력<\/h2>/);
  assert.match(appointmentDetail, /divide-y divide-\[#e8edf3\]/);
  assert.match(appointmentDetail, /<NotificationHistoryRow key=\{notification\.id\} notification=\{notification\} pet=\{pet\} \/>/);
  assert.doesNotMatch(appointmentDetail, /rounded-\[18px\] border border-\[var\(--border\)\] bg-white px-4 py-3\.5[\s\S]*?알림톡 이력/);
});

test("booking detail shares heading roles and keeps one divider at each requested boundary", () => {
  assert.match(ownerApp, /const APPOINTMENT_DETAIL_SECTION_HEADING_CLASS =\s*\n\s*"text-\[16px\] font-semibold leading-6 tracking-\[-0\.005em\] text-\[#101a31\]"/);
  assert.match(ownerApp, /const APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS =\s*\n\s*"text-\[16px\] font-semibold leading-6 text-\[var\(--text\)\]"/);
  assert.match(visitWeightEditor, /className=\{APPOINTMENT_DETAIL_SECTION_HEADING_CLASS\}>오늘 몸무게<\/h2>/);
  assert.match(appointmentDetail, /className=\{APPOINTMENT_DETAIL_SECTION_HEADING_CLASS\}>고객 요청 메모<\/h2>/);
  assert.match(appointmentDetail, /className=\{APPOINTMENT_DETAIL_SECTION_HEADING_CLASS\}>담당자 메모<\/h2>/);
  assert.match(mediaDetail, /className=\{APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS\}>사진 기록<\/h2>/);
  assert.match(appointmentDetail, /className=\{APPOINTMENT_DETAIL_HISTORY_HEADING_CLASS\}>알림톡 이력<\/h2>/);

  assert.match(appointmentDetail, /<section className="mt-3 pb-3">[\s\S]*?담당자 메모[\s\S]*?<\/section>[\s\S]*?<AppointmentVisitWeightEditor/);
  assert.doesNotMatch(appointmentDetail, /<section className="mt-3 border-b border-\[#e8edf3\] pb-3">/);
  assert.equal((visitWeightEditor.match(/border-t border-\[#e8edf3\]/g) ?? []).length, 1);
  assert.equal((mediaDetail.match(/border-b border-\[#e8edf3\]/g) ?? []).length, 1);
  assert.match(visitWeightEditor, /<section className="border-t border-\[#e8edf3\] px-1 py-3"/);
  assert.match(mediaDetail, /<section className="border-b border-\[#e8edf3\] px-1 py-3">/);
  assert.doesNotMatch(appointmentDetail, /appointment-notification-history-[\s\S]{0,160}border-t border-\[#e8edf3\]/);
});

test("photo history keeps empty and present items between its heading and single lower divider", () => {
  assert.match(mediaDetail, /\{items\.length === 0 \? \(/);
  assert.match(mediaDetail, /이 예약에 연결된 시작\/완료 사진이 아직 없어요/);
  assert.match(mediaDetail, /items\.map\(\(\{ item, signedUrl \}\) => (?:\(|\{)/);
  assert.match(mediaDetail, /<img[\s\S]*?src=\{signedUrl\}[\s\S]*?getAppointmentMediaKindLabel/);
  assert.doesNotMatch(mediaDetail, /rounded-\[18px\][\s\S]*?rounded-\[18px\]/);
});
