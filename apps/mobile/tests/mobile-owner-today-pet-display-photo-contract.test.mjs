import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const helperPath = new URL("../src/lib/owner-today-pet-display-photo.ts", import.meta.url);
const ownerAppPath = new URL("../src/components/owner/owner-app.tsx", import.meta.url);
const domainPath = new URL("../src/types/domain.ts", import.meta.url);
const demoDataPath = new URL("../src/lib/owner-demo-data.ts", import.meta.url);
const [helperSource, ownerAppSource, domainSource, demoDataSource] = await Promise.all([
  readFile(helperPath, "utf8"),
  readFile(ownerAppPath, "utf8"),
  readFile(domainPath, "utf8"),
  readFile(demoDataPath, "utf8"),
]);

function loadHelper() {
  const output = ts.transpileModule(helperSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/require\([^)]*domain[^)]*\);/, "");
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports });
  return compiledModule.exports;
}

const {
  indexTodayPetDisplayPhotosByAppointmentId,
  resolveTodayAppointmentPetDisplayPhoto,
} = loadHelper();

test("active and completed appointments resolve their own exact photo even for the same pet", () => {
  const photos = indexTodayPetDisplayPhotosByAppointmentId([
    {
      appointmentId: "appointment-active",
      petId: "pet-a",
      url: "https://signed.example/active",
      source: "prior_grooming_after",
      sourceAppointmentId: "appointment-prior",
      sourceGroomingRecordId: "record-prior",
      latestCompletedAt: "2026-09-09T10:00:00Z",
    },
    {
      appointmentId: "appointment-completed",
      petId: "pet-a",
      url: "https://signed.example/completed",
      source: "appointment_grooming_after",
      sourceAppointmentId: "appointment-completed",
      sourceGroomingRecordId: "record-completed",
      latestCompletedAt: "2026-09-10T10:00:00Z",
    },
  ]);

  assert.equal(resolveTodayAppointmentPetDisplayPhoto(photos, { id: "appointment-active", pet_id: "pet-a" })?.url, "https://signed.example/active");
  assert.equal(resolveTodayAppointmentPetDisplayPhoto(photos, { id: "appointment-completed", pet_id: "pet-a" })?.url, "https://signed.example/completed");
});

test("missing projections and cross-pet projections fail closed to the initial fallback", () => {
  const photos = indexTodayPetDisplayPhotosByAppointmentId([
    {
      appointmentId: "appointment-a",
      petId: "pet-foreign",
      url: "https://signed.example/foreign",
      source: "appointment_grooming_after",
      sourceAppointmentId: "appointment-a",
      sourceGroomingRecordId: "record-foreign",
      latestCompletedAt: "2026-09-10T10:00:00Z",
    },
    {
      appointmentId: "appointment-null",
      petId: "pet-b",
      url: null,
      source: "fallback",
      sourceAppointmentId: null,
      sourceGroomingRecordId: null,
      latestCompletedAt: null,
    },
  ]);

  assert.equal(resolveTodayAppointmentPetDisplayPhoto(photos, { id: "appointment-a", pet_id: "pet-a" }), undefined);
  assert.equal(resolveTodayAppointmentPetDisplayPhoto(photos, { id: "appointment-missing", pet_id: "pet-a" }), undefined);
  assert.equal(resolveTodayAppointmentPetDisplayPhoto(photos, { id: "appointment-null", pet_id: "pet-b" })?.url, null);
});

test("the mobile consumer preserves shared provenance, has image-error initials, and adds no media request", () => {
  const todayContentStart = ownerAppSource.indexOf("function TodayConfirmedContent(");
  const todayContentEnd = ownerAppSource.indexOf("function CompletedReservationsContent(");
  const todayContentSource = ownerAppSource.slice(todayContentStart, todayContentEnd);

  assert.match(domainSource, /source: "appointment_grooming_after" \| "prior_grooming_after" \| "fallback"/);
  assert.match(domainSource, /sourceAppointmentId: string \| null/);
  assert.match(domainSource, /sourceGroomingRecordId: string \| null/);
  assert.match(ownerAppSource, /if \(!src \|\| imageFailed\)/);
  assert.match(ownerAppSource, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.equal(ownerAppSource.match(/petDisplayPhoto=\{resolvePetDisplayPhoto\(appointment\)\}/g)?.length, 3);
  assert.equal(ownerAppSource.match(/petDisplayPhoto=\{resolveTodayAppointmentPetDisplayPhoto\(petDisplayPhotoByAppointmentId, appointment\)\}/g)?.length, 2);
  assert.ok(todayContentStart >= 0 && todayContentEnd > todayContentStart);
  assert.doesNotMatch(todayContentSource, /fetch|media\/assets|grooming_after/i);
  assert.doesNotMatch(ownerAppSource, /console\.(?:log|info|debug)[^\n]*(petDisplayPhoto|signed|url)/i);
});

test("the local preview carries exact-photo and null-initial fixtures without a network projection", () => {
  assert.match(demoDataSource, /appointmentId: "demo-a-4"[\s\S]*petId: "p-bori"[\s\S]*source: "prior_grooming_after"/);
  assert.match(demoDataSource, /appointmentId: "demo-a-6"[\s\S]*petId: "p-uyu"[\s\S]*source: "appointment_grooming_after"/);
  assert.match(demoDataSource, /appointmentId: "demo-a-5"[\s\S]*petId: "p-mong"[\s\S]*url: null[\s\S]*source: "fallback"/);
});
