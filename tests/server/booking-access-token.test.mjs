import assert from "node:assert/strict";
import test from "node:test";

process.env.BOOKING_ACCESS_SECRET ||= "petmanager-rebooking-test-secret";

const {
  REBOOKING_ACCESS_TOKEN_HOURS,
  createBookingAccessToken,
  exchangeBookingAccessTokenForRebooking,
  verifyBookingAccessToken,
} = await import("../../src/server/booking-access-token.ts");

test("a customer result link exchanges to a short-lived personalized rebooking token", () => {
  const sourceToken = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    appointmentId: "appointment-1",
    action: "result",
    expiresInHours: 24 * 365,
  });

  const rebookingToken = exchangeBookingAccessTokenForRebooking("shop-1", sourceToken);
  const payload = verifyBookingAccessToken(rebookingToken);

  assert.equal(payload.shopId, "shop-1");
  assert.equal(payload.guardianId, "guardian-1");
  assert.equal(payload.petId, "pet-1");
  assert.equal(payload.action, "rebook");
  assert.equal(payload.appointmentId, undefined);
  assert.ok(payload.expiresAt > Date.now());
  assert.ok(payload.expiresAt - payload.issuedAt <= REBOOKING_ACCESS_TOKEN_HOURS * 60 * 60 * 1000);
});

test("management and already-exchanged tokens cannot be recycled into new rebooking links", () => {
  const rescheduleToken = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    appointmentId: "appointment-1",
    action: "reschedule",
  });
  const rebookingToken = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    action: "rebook",
  });

  assert.throws(() => exchangeBookingAccessTokenForRebooking("shop-1", rescheduleToken), /유효하지 않은 재예약 링크/);
  assert.throws(() => exchangeBookingAccessTokenForRebooking("shop-1", rebookingToken), /유효하지 않은 재예약 링크/);
});

test("a reservation management token is appointment-scoped", () => {
  const token = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    appointmentId: "appointment-1",
    action: "manage",
  });

  const payload = verifyBookingAccessToken(token);
  assert.equal(payload.action, "manage");
  assert.equal(payload.appointmentId, "appointment-1");
  assert.equal(payload.guardianId, "guardian-1");
  assert.equal(payload.petId, "pet-1");
});

test("a reservation management token cannot be created without an appointment", () => {
  const token = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    action: "manage",
  });

  assert.throws(() => verifyBookingAccessToken(token), /Invalid booking access link/);
});

test("a long-lived revisit notice can also exchange to the same short-lived rebooking token", () => {
  const sourceToken = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    action: "rebook_source",
    expiresInHours: 24 * 365,
  });

  const payload = verifyBookingAccessToken(exchangeBookingAccessTokenForRebooking("shop-1", sourceToken));
  assert.equal(payload.action, "rebook");
  assert.equal(payload.guardianId, "guardian-1");
  assert.equal(payload.petId, "pet-1");
});

test("a result link cannot be exchanged for a different shop", () => {
  const sourceToken = createBookingAccessToken({
    shopId: "shop-1",
    guardianId: "guardian-1",
    petId: "pet-1",
    appointmentId: "appointment-1",
    action: "result",
  });

  assert.throws(() => exchangeBookingAccessTokenForRebooking("shop-2", sourceToken), /유효하지 않은 재예약 링크/);
});
