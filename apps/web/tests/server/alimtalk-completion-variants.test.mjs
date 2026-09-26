import assert from "node:assert/strict";
import test from "node:test";

for (const key of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALIMTALK_PROVIDER",
  "ALIMTALK_RELAY_URL",
  "ALIMTALK_RELAY_SECRET",
]) {
  delete process.env[key];
}
process.env.BOOKING_ACCESS_SECRET = "completion-variants-test-secret";

const { dispatchNotification } = await import("../../src/server/notification-dispatch.ts");
const { getMockStore, resetMockStore, setMockStore } = await import("../../src/server/mock-store.ts");

async function dispatchCompletion(hasReport) {
  resetMockStore();
  const store = getMockStore();
  const appointment = store.appointments[0];
  assert.ok(appointment, "appointment fixture is required");
  const groomingRecord = store.groomingRecords.find((item) => item.appointment_id === appointment.id);
  assert.ok(groomingRecord, "grooming record fixture is required");
  groomingRecord.care_report_data = hasReport ? { reportText: "오늘의 미용 내용을 정리했어요." } : null;
  groomingRecord.care_report_owner_confirmed_at = hasReport ? "2026-09-25T10:00:00+09:00" : null;
  setMockStore(store);

  return dispatchNotification({
    shopId: "demo-shop",
    type: "grooming_completed",
    appointmentId: appointment.id,
    guardianId: appointment.guardian_id,
    petId: appointment.pet_id,
    channel: "mock",
    force: true,
  });
}

test("미용 완료 알림은 최종 발행된 케어리포트 유무로 템플릿을 고른다", async () => {
  const withReport = await dispatchCompletion(true);
  assert.equal(withReport.notification.template_key, "grooming_completed");
  assert.match(withReport.notification.message, /예뻐진 모습과/);

  const withoutReport = await dispatchCompletion(false);
  assert.equal(withoutReport.notification.template_key, "grooming_completed_without_report");
  assert.doesNotMatch(withoutReport.notification.message, /케어리포트/);
});
