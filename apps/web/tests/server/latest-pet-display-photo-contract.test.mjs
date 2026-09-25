import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { projectLatestCompletedPetDisplayPhotos } = await import(
  "../../src/server/latest-pet-display-photo.ts"
);

const pets = [
  { id: "pet-a", shop_id: "shop-a" },
  { id: "pet-b", shop_id: "shop-a" },
];

function appointment(id, petId, startAt, shopId = "shop-a") {
  return { id, shop_id: shopId, pet_id: petId, start_at: startAt };
}

function record(id, petId, completedAt, appointmentId = null, shopId = "shop-a") {
  return { id, shop_id: shopId, pet_id: petId, appointment_id: appointmentId, groomed_at: completedAt };
}

function afterMedia(id, recordId, petId, appointmentId = null, overrides = {}) {
  return {
    id,
    shop_id: "shop-a",
    pet_id: petId,
    appointment_id: appointmentId,
    grooming_record_id: recordId,
    media_kind: "grooming_after",
    status: "ready",
    created_at: "2026-09-08T12:00:00Z",
    ...overrides,
  };
}

test("exact same-appointment ready grooming_after wins for active and completed appointments", () => {
  const projected = projectLatestCompletedPetDisplayPhotos({
    shopId: "shop-a",
    pets,
    appointments: [
      appointment("appointment-active", "pet-a", "2026-09-09T10:00:00Z"),
      appointment("appointment-completed", "pet-b", "2026-09-09T11:00:00Z"),
    ],
    records: [
      record("record-active", "pet-a", "2026-09-09T10:30:00Z", "appointment-active"),
      record("record-completed", "pet-b", "2026-09-09T11:30:00Z", "appointment-completed"),
    ],
    afterMedia: [
      afterMedia("media-active", "record-active", "pet-a", "appointment-active"),
      afterMedia("media-completed", "record-completed", "pet-b", "appointment-completed"),
    ],
    signedUrlByMediaAssetId: new Map([
      ["media-active", "https://signed.example/active"],
      ["media-completed", "https://signed.example/completed"],
    ]),
  });

  assert.deepEqual(projected, [{
    appointmentId: "appointment-active",
    petId: "pet-a",
    url: "https://signed.example/active",
    source: "appointment_grooming_after",
    sourceAppointmentId: "appointment-active",
    sourceGroomingRecordId: "record-active",
    latestCompletedAt: "2026-09-09T10:30:00Z",
  }, {
    appointmentId: "appointment-completed",
    petId: "pet-b",
    url: "https://signed.example/completed",
    source: "appointment_grooming_after",
    sourceAppointmentId: "appointment-completed",
    sourceGroomingRecordId: "record-completed",
    latestCompletedAt: "2026-09-09T11:30:00Z",
  }]);
});

test("a prior ready after is used only before the appointment, otherwise projection is null", () => {
  const records = [
    record("record-prior", "pet-a", "2026-09-08T11:00:00Z", "appointment-prior"),
    record("record-future", "pet-a", "2026-09-10T11:00:00Z", "appointment-future"),
  ];
  const invalid = [
    afterMedia("before", "record-prior", "pet-a", "appointment-prior", { media_kind: "grooming_before" }),
    afterMedia("processing", "record-prior", "pet-a", "appointment-prior", { status: "processing" }),
    afterMedia("other-pet", "record-prior", "pet-b", "appointment-prior"),
    afterMedia("other-shop", "record-prior", "pet-a", "appointment-prior", { shop_id: "shop-b" }),
    afterMedia("future", "record-future", "pet-a", "appointment-future"),
  ];
  const projected = projectLatestCompletedPetDisplayPhotos({
    shopId: "shop-a",
    pets,
    appointments: [
      appointment("appointment-today", "pet-a", "2026-09-09T10:00:00Z"),
      appointment("appointment-empty", "pet-b", "2026-09-09T10:00:00Z"),
    ],
    records,
    afterMedia: [...invalid, afterMedia("valid", "record-prior", "pet-a", "appointment-prior")],
    signedUrlByMediaAssetId: new Map([
      ...invalid.map((media) => [media.id, `https://signed.example/${media.id}`]),
      ["valid", "https://signed.example/valid"],
    ]),
  });

  assert.deepEqual(projected[0], {
    appointmentId: "appointment-today",
    petId: "pet-a",
    url: "https://signed.example/valid",
    source: "prior_grooming_after",
    sourceAppointmentId: "appointment-prior",
    sourceGroomingRecordId: "record-prior",
    latestCompletedAt: "2026-09-08T11:00:00Z",
  });
  assert.deepEqual(projected[1], {
    appointmentId: "appointment-empty",
    petId: "pet-b",
    url: null,
    source: "fallback",
    sourceAppointmentId: null,
    sourceGroomingRecordId: null,
    latestCompletedAt: null,
  });
  assert.equal(JSON.stringify(projected).match(/media-|storage_path|bucket|cleanupProof/g), null);
});

test("missing media schema remains an explicit fallback and authenticated staff scope removes other pets", () => {
  const helperSource = readFileSync(
    new URL("../../src/server/latest-pet-display-photo.ts", import.meta.url),
    "utf8",
  );
  const routeSource = readFileSync(new URL("../../src/app/api/bootstrap/route.ts", import.meta.url), "utf8");
  const privacySource = readFileSync(new URL("../../src/server/staff-privacy.ts", import.meta.url), "utf8");

  assert.match(helperSource, /catch \{[\s\S]*return fallback;/);
  assert.match(helperSource, /\.in\("pet_id", shopPets\.map\(\(pet\) => pet\.id\)\)/);
  assert.doesNotMatch(helperSource, /Promise\.all\(/);
  assert.doesNotMatch(helperSource, /profile_image_url|pet_profile/);
  assert.match(routeSource, /includePetDisplayPhotos: phase === "full"/);
  assert.match(routeSource, /scopeBootstrapForStaff\(data, owner\)/);
  assert.match(privacySource, /petDisplayPhotos: \(data\.petDisplayPhotos \?\? \[\]\)\.filter\(\(photo\) => assignedPetIds\.has\(photo\.petId\)\)/);
  assert.doesNotMatch(routeSource, /petDisplayPhotos[\s\S]*scope === "public"/);
});
