import assert from "node:assert/strict";
import test from "node:test";
import { estimatePetServiceDuration } from "../../../shared/lib/pet-duration-estimate.ts";

function fixture(minutes = [74]) {
  const appointments = minutes.map((duration, i) => ({ id: `a${i}`, shop_id: "shop", pet_id: "pet", service_id: "bath", status: "completed", actual_started_at: "2026-10-06T01:00:00Z", actual_completed_at: new Date(Date.parse("2026-10-06T01:00:00Z") + duration * 60000).toISOString() }));
  return { appointments, groomingRecords: appointments.map((a, i) => ({ id: `r${i}`, shop_id: a.shop_id, appointment_id: a.id, pet_id: a.pet_id, service_id: a.service_id, actual_duration_minutes: minutes[i], expected_duration_minutes: 90, pet_weight_snapshot: 2 })), service: { id: "bath", shop_id: "shop", duration_minutes: 90 }, pet: { id: "pet", shop_id: "shop", weight: 2 } };
}
test("first 74 minute bath informs next estimate without changing booked 90 minutes", () => {
  const context = fixture(); const before = JSON.stringify(context);
  const estimate = estimatePetServiceDuration(context);
  assert.equal(estimate.minutes, 75); assert.equal(estimate.source, "pet");
  assert.equal(estimate.stats.sampleCount, 1); assert.equal(estimate.stats.averageMinutes, 74);
  assert.equal(JSON.stringify(context), before);
});
test("median protects against a single long visit", () => {
  const result = estimatePetServiceDuration(fixture([74, 76, 300]));
  assert.equal(result.minutes, 80); assert.equal(result.stats.sampleCount, 3);
});
test("invalid, unfinished, mismatched and duplicate histories never influence estimates", () => {
  for (const mutate of [c => c.appointments[0].status = "cancelled", c => c.appointments[0].actual_started_at = null, c => c.groomingRecords[0].actual_duration_minutes = 90, c => c.groomingRecords[0].pet_id = "other", c => c.groomingRecords[0].shop_id = "other", c => c.appointments[0].service_id = "cut", c => c.groomingRecords.push({...c.groomingRecords[0], id:"duplicate"})]) {
    const context = fixture(); mutate(context);
    assert.equal(estimatePetServiceDuration(context).source, "baseline");
  }
});
test("new pet uses matching shop service and weight only after three samples", () => {
  const context = fixture([74, 76, 75]); context.pet.id = "new";
  assert.equal(estimatePetServiceDuration(context).source, "service_weight");
  context.groomingRecords.pop(); assert.equal(estimatePetServiceDuration(context).minutes, 90);
});
