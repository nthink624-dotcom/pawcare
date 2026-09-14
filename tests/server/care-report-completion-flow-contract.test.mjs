import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("PC generation, direct edit, revision, draft save, and publish use reportText only", async () => {
  const [panel, route] = await Promise.all([
    source("src/components/owner-web/calendar-care-report-completion-panel.tsx"),
    source("src/app/api/owner/care-reports/route.ts"),
  ]);
  assert.match(panel, /sourceText: isRevision \? "" : sourceText/);
  assert.match(panel, /currentReportText: isRevision \? reportText/);
  assert.match(panel, /revisionRequest: isRevision \? revisionRequest/);
  assert.match(panel, /setReportText\(response\.reportText\)/);
  assert.match(panel, /JSON\.stringify\(\{ shopId, appointmentId, reportText, photoConsent: hasRegisteredPhotos, action: "save_draft" \}\)/);
  assert.match(panel, /action: "publish"/);
  assert.doesNotMatch(panel, /oneLineSummary|treatmentSummary|conditionSummary|groomingResponse|homeCareTips|nextVisitGuide|sourceFacts|sourceFactCitations|category/);
  assert.match(route, /care_report_ai_draft: \{ reportText \}/);
  assert.match(route, /p_care_report: \{ reportText \}/);
  assert.match(route, /\{ reportText: generated\.reportText \}/);
  assert.doesNotMatch(route, /generationId|schemaVersion|estimatedCostUsd: generated|usage: generated/);
  assert.doesNotMatch(route, /careReportObservations|careReportSourceText|sourceFacts|sourceFactCitations/);
});

test("new writes clear legacy auxiliary payloads and canonical readback returns reportText", async () => {
  const [route, drafts] = await Promise.all([
    source("src/app/api/owner/care-reports/route.ts"),
    source("src/app/api/owner/grooming-record-drafts/route.ts"),
  ]);
  assert.match(route, /care_report_observations: \{\}/);
  assert.match(route, /care_report_voice_transcript: ""/);
  assert.match(drafts, /reportText: normalizeStoredCareReport\(row\.care_report_ai_draft\)\?\.reportText \?\? null/);
  const serialized = drafts.slice(drafts.indexOf("function serializeDraft"), drafts.indexOf("async function requireAppointmentScope"));
  assert.doesNotMatch(serialized, /careReportObservations|careReportVoiceTranscript|sourceFacts/);
});

test("PC result UI renders one editable report textarea without section boxes or labels", async () => {
  const panel = await source("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  assert.equal((panel.match(/data-care-report-editor/g) ?? []).length, 1);
  assert.match(panel, /aria-label="고객에게 보낼 케어리포트"/);
  assert.match(panel, /min-h-\[180px\].*text-\[16px\].*leading-6/);
  assert.doesNotMatch(panel, /디자이너 한마디|오늘 진행한 미용|오늘 확인한 상태|미용 중 반응|홈케어|다음 방문/);
  assert.doesNotMatch(panel, /data-care-report-editor-empty/);
});

test("customer and owner history surfaces display only the same reportText body", async () => {
  const [customer, history, customerProjection, bootstrap] = await Promise.all([
    source("src/components/customer/customer-grooming-result-card.tsx"),
    source("src/components/owner-web/customer-care-report-history-card.tsx"),
    source("src/server/customer-bookings.ts"),
    source("src/server/bootstrap.ts"),
  ]);
  assert.match(customer, /confirmedCareReport\?\.reportText/);
  assert.match(history, /\{report\.reportText\}/);
  assert.doesNotMatch(`${customer}\n${history}`, /report\.(?:oneLineSummary|treatmentSummary|conditionSummary|groomingResponse|homeCareTips|nextVisitGuide)/);
  assert.match(customerProjection, /normalizeStoredCareReport\(record\.care_report_data\)/);
  assert.match(bootstrap, /care_report_data: normalizeStoredCareReport\(record\.care_report_data\)/);
});

test("route keeps authentication, CORS, no-store reads, idempotent draft acknowledgement, and atomic publish", async () => {
  const route = await source("src/app/api/owner/care-reports/route.ts");
  assert.match(route, /requireOwnerShop/);
  assert.match(route, /ownerMobileCorsPreflight\(request, CARE_REPORTS_CORS\)/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(route, /idempotent: true/);
  assert.match(route, /admin\.rpc\("publish_ai_care_report"/);
  assert.match(route, /미용 완료 기록이 만들어진 뒤 케어리포트를 보낼 수 있습니다/);
});

test("preview is inert and errors remain separate and recoverable", async () => {
  const panel = await source("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  assert.match(panel, /inert=\{previewMode \? true : undefined\}/);
  assert.match(panel, /미리보기에서는 AI 생성·저장·전송을 사용할 수 없습니다/);
  assert.equal((panel.match(/aria-live="assertive"/g) ?? []).length, 3);
  assert.match(panel, /data-care-report-generation-error/);
  assert.match(panel, /data-care-report-save-error/);
  assert.match(panel, /data-care-report-send-error/);
  assert.ok((panel.match(/(?:h-11|min-h-11)/g) ?? []).length >= 5);
});
