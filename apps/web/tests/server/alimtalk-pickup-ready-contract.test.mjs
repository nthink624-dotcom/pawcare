import assert from "node:assert/strict";
import test from "node:test";

for (const key of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete process.env[key];
}
process.env.BOOKING_ACCESS_SECRET = "pickup-ready-contract-test-secret";

const { buildNotificationTemplateValues } = await import(
  "../../src/server/notification-dispatch.ts"
);

function buildParams(appointment = null) {
  return {
    appointment,
    bookingAccessToken: "token",
    bookingEntryUrl: "https://example.com/book",
    bookingManageUrl: "https://example.com/manage",
    directionsUrl: "https://maps.example.com",
    petName: "초코",
    recipientName: "홍길동",
    serviceName: "전체 미용",
    shopAddress: "서울",
    shopName: "펫매니저",
  };
}

test("픽업 준비 알림은 예약의 예상 시간을 사용하고 없으면 5분을 사용한다", () => {
  const configured = buildNotificationTemplateValues(
    buildParams({
      appointment_date: "2026-10-01",
      appointment_time: "10:00",
      pickup_ready_eta_minutes: 7,
    }),
  );
  assert.equal(configured["픽업예상시간"], "7");
  assert.equal(configured["픽업예상분"], "7");

  const fallback = buildNotificationTemplateValues(buildParams());
  assert.equal(fallback["픽업예상시간"], "5");
  assert.equal(fallback["픽업예상분"], "5");
});
