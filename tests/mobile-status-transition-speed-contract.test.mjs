import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const ownerApp = await readFile(ownerAppPath, "utf8");

function loadFunction(name) {
  const sourceFile = ts.createSourceFile("owner-app.tsx", ownerApp, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(declaration, `${name} declaration should exist`);
  const output = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(`${output}; return ${name};`)();
}

test("authoritative status rows replace only the matching appointment and preserve media collections", () => {
  const mergeAuthoritativeAppointment = loadFunction("mergeAuthoritativeAppointment");
  const mediaAssets = [{ id: "media-before" }];
  const groomingRecords = [{ id: "record-1", appointment_id: "appointment-1" }];
  const previous = {
    shop: { id: "shop-1" },
    appointments: [
      { id: "appointment-1", status: "confirmed", memo: "keep" },
      { id: "appointment-2", status: "pending" },
    ],
    mediaAssets,
    groomingRecords,
  };
  const authoritative = { id: "appointment-1", status: "in_progress", memo: "server", updated_at: "new" };

  const next = mergeAuthoritativeAppointment(previous, authoritative);

  assert.equal(next.appointments[0], authoritative);
  assert.equal(next.appointments[1], previous.appointments[1]);
  assert.equal(next.mediaAssets, mediaAssets);
  assert.equal(next.groomingRecords, groomingRecords);
});

test("refresh responses that started before a status mutation are rejected", () => {
  const isAppointmentRefreshCurrent = loadFunction("isAppointmentRefreshCurrent");
  assert.equal(isAppointmentRefreshCurrent(4, 4), true);
  assert.equal(isAppointmentRefreshCurrent(4, 5), false);
});

test("status PATCH applies its response before nonblocking bootstrap reconciliation", () => {
  const functionStart = ownerApp.indexOf("async function updateAppointment(");
  const functionEnd = ownerApp.indexOf("\n  function openMobilePhotoStatusAction", functionStart);
  const source = ownerApp.slice(functionStart, functionEnd);
  const responseIndex = source.indexOf("await fetchJson<Appointment>");
  const savedIndex = source.indexOf('markOwnerMediaStep("appointment-status-saved")');
  const mergeIndex = source.indexOf("mergeAuthoritativeAppointment(previous, authoritativeAppointment)");
  const reconcileIndex = source.indexOf("void reconcileAfterAppointmentMutation()");

  assert.ok(responseIndex >= 0);
  assert.ok(savedIndex > responseIndex);
  assert.ok(mergeIndex > responseIndex);
  assert.ok(reconcileIndex > mergeIndex);
  assert.ok(savedIndex < mergeIndex);
  assert.doesNotMatch(source.slice(responseIndex, mergeIndex), /await refresh\(/);
  assert.match(source, /authoritativeAppointment\.id !== appointmentId/);
  assert.match(source, /appointmentMutationVersionRef\.current \+= 1/);
  assert.ok(source.indexOf('markOwnerMediaStep("appointment-row-apply")') > mergeIndex);
});

test("photo selection renders pending preview before durable local staging finishes", () => {
  const functionStart = ownerApp.indexOf("async function stageMobilePhotoFile(");
  const functionEnd = ownerApp.indexOf("\n  async function discardStagedMobilePhoto", functionStart);
  const source = ownerApp.slice(functionStart, functionEnd);
  const previewIndex = source.indexOf("setMobilePhotoPreviewFile(file)");
  const stagingIndex = source.indexOf('traceOwnerMediaStep("stage-pending-local"');

  assert.ok(previewIndex >= 0 && previewIndex < stagingIndex);
  assert.match(source, /setMobilePhotoStaging\(true\)/);
  assert.match(source, /finally \{\s+mobilePhotoStageInFlightRef\.current = false;\s+setMobilePhotoStaging\(false\)/);
  assert.match(ownerApp, /busy=\{mobilePhotoUploading \|\| mobilePhotoPreparing \|\| mobilePhotoStaging \|\| saving\}/);
});

test("general edits keep awaited refresh while status transitions keep a synchronous duplicate lock", () => {
  const mutateStart = ownerApp.indexOf("async function mutate(");
  const mutateEnd = ownerApp.indexOf("\n  async function saveStaffMemberProfile", mutateStart);
  const mutateSource = ownerApp.slice(mutateStart, mutateEnd);
  assert.match(mutateSource, /await fetchJson\(url, init\);\s+await refresh\(\);/);

  assert.match(ownerApp, /const statusMutationInFlightRef = useRef\(false\)/);
  assert.match(ownerApp, /if \(statusMutationInFlightRef\.current\) return null/);
  assert.match(ownerApp, /statusMutationInFlightRef\.current = true/);
  assert.match(ownerApp, /finally \{\s+statusMutationInFlightRef\.current = false;\s+setSaving\(false\)/);
});

test("completion displays the saved row before care-report preparation and keeps photo ordering", () => {
  const completionStart = ownerApp.indexOf("async function completeMobileAppointment(");
  const completionEnd = ownerApp.indexOf("\n  function updateAppointmentWithMobilePhotoGuard", completionStart);
  const completionSource = ownerApp.slice(completionStart, completionEnd);
  assert.match(completionSource, /const updatedAppointment = await updateAppointment/);
  assert.match(completionSource, /void openCareReport\(appointmentId\)/);
  assert.doesNotMatch(completionSource, /await openCareReport/);

  const photoStart = ownerApp.indexOf("async function updateAppointmentStatusWithMobilePhoto(");
  const photoEnd = ownerApp.indexOf("\n  async function handleMobilePhotoStatusFile", photoStart);
  const photoSource = ownerApp.slice(photoStart, photoEnd);
  const uploadIndex = photoSource.indexOf("await createOwnerMediaAssetFromFile");
  const statusIndex = photoSource.indexOf("await updateAppointment");
  assert.ok(uploadIndex >= 0 && statusIndex > uploadIndex);
  assert.match(photoSource, /mediaAssetIds: \[uploaded\.mediaAsset\.id\]/);
  assert.match(photoSource, /if \(nextStatus === "completed"\) void openCareReport\(appointment\.id\)/);
  assert.doesNotMatch(photoSource, /await openCareReport/);
  assert.match(ownerApp, /"care-report-prepare"/);
  assert.match(ownerApp, /markOwnerMediaStep\("status-action-click"\)/);
  assert.match(photoSource, /markOwnerMediaStep\("pending-feedback"\)/);
});
