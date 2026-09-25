import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAppointmentWriteErrorMessage } from "../../src/lib/appointment-write-errors.ts";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("grooming completion omits absent care report data so PostgreSQL receives SQL NULL", () => {
  const ownerMutations = read("src/server/owner-mutations.ts");
  const completionStart = ownerMutations.indexOf("type CompletionAtomicPayload");
  const completionEnd = ownerMutations.indexOf("export async function deleteService", completionStart);
  const completionContract = ownerMutations.slice(completionStart, completionEnd);
  const careReportMigration = read("../../supabase/migrations/20260818141708_ai_care_report_contract.sql");
  const atomicStatusMigration = read("../../supabase/migrations/20260903023147_pending_rejected_status_rpc_repair.sql");

  assert.ok(completionStart >= 0 && completionEnd > completionStart);
  assert.match(completionContract, /careReportData\?: Record<string, unknown>;/);
  assert.match(completionContract, /const careReportData = confirmedCareReport \?\? existingRecord\.data\?\.care_report_data \?\? null;/);
  assert.match(completionContract, /\.\.\.\(careReportData !== null \? \{ careReportData \} : \{\}\),/);
  assert.doesNotMatch(completionContract, /careReportData:\s*confirmedCareReport\s*\?\?/);
  assert.match(
    careReportMigration,
    /care_report_data is null or jsonb_typeof\(care_report_data\) = 'object'/,
  );
  assert.match(atomicStatusMigration, /v_completion -> 'careReportData'/);
});

test("care report data check violations become one recoverable Korean save error", () => {
  const message = getAppointmentWriteErrorMessage({
    code: "23514",
    message:
      'new row for relation "grooming_records" violates check constraint "grooming_records_care_report_data_check"',
  });

  assert.equal(
    message,
    "미용 완료 기록을 저장하지 못했습니다. 입력한 케어 내용은 유지되었어요. 다시 시도해 주세요.",
  );
  assert.doesNotMatch(message, /grooming_records|care_report_data|23514|constraint/i);
});

test("grooming completion opens care authoring before the final status mutation", () => {
  const calendar = read("src/components/owner-web/calendar-management-screen.tsx");
  const panel = read("src/components/owner-web/calendar-care-report-completion-panel.tsx");
  const choice = read("src/components/owner-web/calendar-care-report-choice-dialog.tsx");
  const closeStart = calendar.indexOf("async function handleSaveAndClose");
  const closeEnd = calendar.indexOf("async function handleReportSent", closeStart);
  const closeHandler = calendar.slice(closeStart, closeEnd);
  const draftSaveStart = panel.indexOf("async function saveReportDraft");
  const publishStart = panel.indexOf("async function publishReport", draftSaveStart);
  const draftSaveHandler = panel.slice(draftSaveStart, publishStart);

  assert.ok(closeStart >= 0 && closeEnd > closeStart);
  assert.ok(draftSaveStart >= 0 && publishStart > draftSaveStart);
  assert.match(
    calendar,
    /if \(targetBooking && nextStatus === "완료"\) \{\s+setPhotoStatusAction\(null\);\s+setBasicCareReportError\(""\);\s+setCareReportChoiceBooking\(targetBooking\);\s+return;/,
  );
  assert.doesNotMatch(closeHandler, /onComplete|applyBookingStatusChange/);
  assert.doesNotMatch(draftSaveHandler, /onBeforePublish/);
  assert.doesNotMatch(
    calendar,
    /if \(targetBooking && nextStatus === "완료"\) \{\s+void \(async \(\) => \{\s+const succeeded = await applyBookingStatusChange/,
  );
  assert.match(
    calendar,
    /async function handleCompletionBeforePublish\(\) \{[\s\S]{0,800}const draftSaved = await draft\.flushDraft\(\);[\s\S]{0,800}await onComplete\(mediaAssetIds, draft\.value\);[\s\S]{0,200}setCompletionPersisted\(true\);/,
  );
  assert.match(calendar, /onBeforePublish=\{handleCompletionBeforePublish\}/);
  assert.match(
    calendar,
    /if \(!statusAlreadyCompleted\) \{\s+const succeeded = await applyBookingStatusChange\(booking\.id, "완료"\);[\s\S]{0,200}\}\s+await fetchApiJsonWithAuth\("\/api\/owner\/care-reports"/,
  );
  assert.match(panel, /if \(previewMode \|\| !reportText\.trim\(\)[^\n]+\) return;[\s\S]{0,240}await onBeforePublish\?\.\(\);[\s\S]{0,160}fetchApiJsonWithAuth\("\/api\/owner\/care-reports"/);
  assert.match(choice, /미용 완료 기록을 남겨주세요/);
  assert.doesNotMatch(choice, /미용을 완료했어요/);
});

test("status RPC qualifies grooming_record_id and hides the former ambiguity", () => {
  const repairMigration = read(
    "../../supabase/migrations/20260904195032_repair_grooming_record_id_ambiguity.sql",
  );
  const message = getAppointmentWriteErrorMessage({
    code: "42702",
    message: 'column reference "grooming_record_id" is ambiguous',
    details: "It could refer to either a PL/pgSQL variable or a table column.",
  });

  assert.match(repairMigration, /create or replace function public\.update_appointment_status_atomic_v1/);
  assert.match(repairMigration, /returns table \(\s+appointment jsonb,\s+grooming_record_id uuid,/);
  assert.match(repairMigration, /security definer\s+set search_path = ''/);
  assert.match(repairMigration, /update public\.media_assets as media_asset/);
  assert.match(repairMigration, /and media_asset\.grooming_record_id is null;/);
  assert.doesNotMatch(repairMigration, /and grooming_record_id is null;/);
  assert.match(repairMigration, /grant execute on function public\.update_appointment_status_atomic_v1[\s\S]+to service_role;/);
  assert.equal(
    message,
    "미용 완료 기록을 저장하지 못했습니다. 입력한 케어 내용은 유지되었어요. 다시 시도해 주세요.",
  );
  assert.doesNotMatch(message, /grooming_record_id|ambiguous|42702|column reference/i);
});
