import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const helperPath = new URL("../src/lib/owner-today-care-report-followup.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const draftPath = new URL("../src/lib/care-report/owner-care-report-local-draft.ts", import.meta.url);
const sheetPath = new URL("../src/components/owner/owner-ai-care-report-sheet.tsx", import.meta.url);
const [helperSource, ownerAppSource, draftSource, sheetSource] = await Promise.all([
  readFile(helperPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(draftPath, "utf8"),
  readFile(sheetPath, "utf8"),
]);

function loadHelper() {
  const output = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

function loadDraftContract(storage) {
  const output = ts.transpileModule(draftSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, window: { localStorage: storage } });
  return compiledModule.exports;
}

const baseAppointment = {
  id: "appointment-a",
  shop_id: "shop-a",
  guardian_id: "guardian-a",
  pet_id: "pet-a",
  service_id: "service-a",
  appointment_date: "2026-09-14",
  appointment_time: "10:00",
  status: "completed",
};

const baseRecord = {
  id: "record-a",
  shop_id: "shop-a",
  guardian_id: "guardian-a",
  pet_id: "pet-a",
  service_id: "service-a",
  appointment_id: "appointment-a",
  care_report_data: null,
  care_report_owner_confirmed_at: null,
};

function select(appointments, groomingRecords, hiddenFollowupKeys) {
  const { selectOwnerTodayCareReportFollowups } = loadHelper();
  return selectOwnerTodayCareReportFollowups({
    appointments,
    groomingRecords,
    shopId: "shop-a",
    dateKey: "2026-09-14",
    hiddenFollowupKeys,
  });
}

test("completed and unpublished work renders once regardless of draft presence or duplicate snapshots", () => {
  assert.equal(select([baseAppointment], [baseRecord]).length, 1);
  assert.equal(select([baseAppointment, { ...baseAppointment }], [baseRecord, { ...baseRecord }]).length, 1);
  assert.equal(select([{ ...baseAppointment, status: "in_progress" }], []).length, 0);
});

test("published work and an immediately published id do not render a follow-up", () => {
  const { ownerTodayCareReportFollowupKey } = loadHelper();
  assert.equal(select([baseAppointment], [{ ...baseRecord, care_report_data: { reportText: "발송된 내용" } }]).length, 0);
  assert.equal(select([baseAppointment], [{ ...baseRecord, care_report_owner_confirmed_at: "2026-09-14T10:30:00Z" }]).length, 0);
  assert.equal(select([baseAppointment], [baseRecord], new Set([ownerTodayCareReportFollowupKey(baseAppointment)])).length, 0);
  assert.equal(select([{ ...baseAppointment, pet_id: "pet-b" }], [], new Set([ownerTodayCareReportFollowupKey(baseAppointment)])).length, 1);
});

test("foreign date, shop, appointment, guardian, or pet records cannot hide or create another task", () => {
  assert.equal(select([{ ...baseAppointment, appointment_date: "2026-09-13" }], [baseRecord]).length, 0);
  assert.equal(select([{ ...baseAppointment, shop_id: "shop-b" }], [baseRecord]).length, 0);
  for (const mismatch of [
    { appointment_id: "appointment-b" },
    { shop_id: "shop-b" },
    { guardian_id: "guardian-b" },
    { pet_id: "pet-b" },
  ]) {
    assert.equal(select([baseAppointment], [{ ...baseRecord, ...mismatch, care_report_data: { reportText: "다른 리포트" } }]).length, 1);
  }
});

test("today uses the canonical sheet path, exact CTA, no draft visibility gate, and immediate publish removal", () => {
  assert.match(ownerAppSource, /selectOwnerTodayCareReportFollowups\(\{/);
  assert.match(ownerAppSource, /\}케어리포트 이어서 작성<\/button>/);
  assert.match(ownerAppSource, /onResumeCareReport=\{\(\) => onResumeCareReport\(appointment\.id\)\}/);
  assert.match(ownerAppSource, /onResumeCareReport=\{\(appointmentId\) => void openCareReport\(appointmentId\)\}/);
  assert.match(ownerAppSource, /createOwnerCareReportImmediateData\(\{[\s\S]*appointmentId,[\s\S]*publishedCareReport,[\s\S]*\}\)/);
  assert.match(ownerAppSource, /setPublishedCareReportFollowupKeys\(\(previous\) => new Set\(previous\)\.add\(ownerTodayCareReportFollowupKey\(appointment\)\)\)/);
  assert.match(ownerAppSource, /void refresh\(\)/);
  const ctaStart = ownerAppSource.indexOf('<button type="button" onClick={onResumeCareReport}');
  const ctaEnd = ownerAppSource.indexOf("</button>", ctaStart);
  const ctaSource = ownerAppSource.slice(ctaStart, ctaEnd);
  assert.match(ctaSource, /min-h-11/);
  assert.match(ctaSource, /border-\[var\(--border\)\] bg-\[var\(--surface\)\]/);
  assert.match(ctaSource, /text-\[var\(--text\)\]/);
  assert.match(ctaSource, /hover:bg-\[var\(--background\)\] active:bg-\[var\(--border\)\]\/35/);
  assert.match(ctaSource, /focus-visible:ring-\[var\(--accent\)\]\/30/);
  assert.match(ctaSource, /disabled:border-\[var\(--border\)\] disabled:bg-\[var\(--background\)\] disabled:text-\[var\(--muted\)\]/);
  assert.doesNotMatch(ctaSource, /\b(?:text|bg|border)-(?:danger|coral|rose|red)(?:-\d|\[|\b)/i);
  assert.doesNotMatch(helperSource, /grooming-record-drafts|readOwnerCareReportLocalDraft/);
});

test("the existing local recovery contract remains one reportText keyed by shop and appointment", () => {
  assert.match(draftSource, /reportText: string \| null/);
  assert.match(draftSource, /storageKey\(shopId, appointmentId\)/);
  assert.doesNotMatch(draftSource, /oneLineSummary:|treatmentSummary:|conditionSummary:/);
  assert.match(sheetSource, /readOwnerCareReportLocalDraft\(shopId, appointmentId\)/);
  assert.match(sheetSource, /recoveredDraft\?\.reportText \?\? draft\.draft\?\.reportText/);
  assert.match(sheetSource, /shopId, appointmentId: appointment\.id/);
});

test("a single reportText survives a fresh module load only for its exact shop and appointment key", () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const first = loadDraftContract(storage);
  first.writeOwnerCareReportLocalDraft("shop-a", "appointment-a", {
    sourceText: "",
    revisionText: "",
    reportText: "정확히 복원할 단일 내용",
    photoConsent: true,
    weight: "",
    nextDate: null,
    selectedIds: {},
  });
  const reloaded = loadDraftContract(storage);
  assert.equal(reloaded.readOwnerCareReportLocalDraft("shop-a", "appointment-a").reportText, "정확히 복원할 단일 내용");
  assert.equal(reloaded.readOwnerCareReportLocalDraft("shop-a", "appointment-b"), null);
  assert.equal(reloaded.readOwnerCareReportLocalDraft("shop-b", "appointment-a"), null);
});
