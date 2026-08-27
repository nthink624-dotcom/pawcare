import assert from "node:assert/strict";
import test from "node:test";

import {
  CALL_ID_POC_SAFETY,
  InMemoryCallEventLedger,
  callEventSchema,
  evaluateCallNotificationCandidate,
} from "../../src/server/call-id-technical-poc.ts";

const baseEvent = {
  anonymousShopRef: "shop_7Jk2mQ9vXp4L",
  callEventId: "call_L8p2Nz7Qw5Rt",
  callState: "missed",
  occurredAt: "2026-08-27T10:00:00+09:00",
  providerEventId: "provider_4Fm8Kq2Xs9Ua",
  source: "fixture",
};

test("accepts opaque fixture events and deduplicates provider retries", () => {
  const ledger = new InMemoryCallEventLedger();
  assert.deepEqual(ledger.ingest(baseEvent), { accepted: true, duplicate: false });
  assert.deepEqual(ledger.ingest(baseEvent), { accepted: false, duplicate: true });
  assert.equal(ledger.listForUi().length, 1);
});

test("rejects raw phone fields and does not project provider ids to UI", () => {
  assert.equal(callEventSchema.safeParse({ ...baseEvent, callerPhone: "01012345678" }).success, false);
  const ledger = new InMemoryCallEventLedger();
  ledger.ingest(baseEvent);
  const projection = ledger.listForUi()[0];
  assert.equal("providerEventId" in projection, false);
  assert.equal("anonymousShopRef" in projection, false);
  assert.equal(JSON.stringify(projection).includes("010"), false);
});

test("keeps alimtalk automatic sending fail-closed even when review eligibility passes", () => {
  const event = callEventSchema.parse(baseEvent);
  const eligible = evaluateCallNotificationCandidate(event, {
    kind: "booking_link",
    recipientRef: "recipient_6Yp3Ls8Va2Qm",
    linkedAppointmentRef: null,
    consentState: "allowed",
    suppressionState: "clear",
    templateState: "approved",
  });
  assert.deepEqual(eligible, {
    eligible: true,
    reason: "eligible_for_owner_review",
    automaticSend: false,
    externalExecution: false,
  });
  assert.equal(CALL_ID_POC_SAFETY.automaticAlimtalkSendEnabled, false);
  assert.equal(CALL_ID_POC_SAFETY.externalExecution, false);
  assert.equal(CALL_ID_POC_SAFETY.productionPersistenceEnabled, false);
});

test("blocks unfinished calls, missing appointment linkage, consent, suppression, and template gaps", () => {
  const candidate = {
    kind: "booking_confirmed",
    recipientRef: "recipient_6Yp3Ls8Va2Qm",
    linkedAppointmentRef: "appointment_3Wq8Jm5Nr1Tx",
    consentState: "allowed",
    suppressionState: "clear",
    templateState: "approved",
  };
  const cases = [
    [{ ...baseEvent, callState: "ringing" }, candidate, "call_not_finished"],
    [baseEvent, { ...candidate, linkedAppointmentRef: null }, "missing_appointment"],
    [baseEvent, { ...candidate, consentState: "unknown" }, "consent_not_allowed"],
    [baseEvent, { ...candidate, suppressionState: "suppressed" }, "suppressed"],
    [baseEvent, { ...candidate, templateState: "pending" }, "template_not_approved"],
  ];
  for (const [eventInput, candidateInput, reason] of cases) {
    const decision = evaluateCallNotificationCandidate(callEventSchema.parse(eventInput), candidateInput);
    assert.equal(decision.eligible, false);
    assert.equal(decision.reason, reason);
    assert.equal(decision.automaticSend, false);
    assert.equal(decision.externalExecution, false);
  }
});

test("sorts out-of-order fixture events by occurred_at", () => {
  const ledger = new InMemoryCallEventLedger();
  ledger.ingest({ ...baseEvent, callEventId: "call_Second8Qw5Rt", providerEventId: "provider_Second9Ua", callState: "ended", occurredAt: "2026-08-27T10:03:00+09:00" });
  ledger.ingest({ ...baseEvent, callEventId: "call_First7Qw5Rt", providerEventId: "provider_First8Kq", callState: "answered", occurredAt: "2026-08-27T10:01:00+09:00" });
  assert.deepEqual(ledger.listForUi().map((event) => event.callState), ["answered", "ended"]);
});
