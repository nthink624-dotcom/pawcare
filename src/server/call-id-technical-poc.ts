import { z } from "zod";

export const CALL_ID_POC_SAFETY = Object.freeze({
  fixtureOnly: true,
  callProviderConnected: false,
  automaticAlimtalkSendEnabled: false,
  externalExecution: false,
  productionPersistenceEnabled: false,
});

export const callStateSchema = z.enum([
  "ringing",
  "answered",
  "ended",
  "missed",
  "failed",
  "unknown",
]);

const opaqueReferenceSchema = z
  .string()
  .min(12)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/, "opaque reference only");

export const callEventSchema = z
  .object({
    anonymousShopRef: opaqueReferenceSchema,
    callEventId: opaqueReferenceSchema,
    callState: callStateSchema,
    occurredAt: z.string().datetime({ offset: true }),
    providerEventId: opaqueReferenceSchema,
    source: z.literal("fixture"),
  })
  .strict();

export type CallEvent = z.infer<typeof callEventSchema>;

export type CallNotificationCandidate = {
  kind: "booking_link" | "booking_confirmed" | "booking_rescheduled_confirmed";
  recipientRef: string | null;
  linkedAppointmentRef: string | null;
  consentState: "allowed" | "denied" | "unknown";
  suppressionState: "clear" | "suppressed" | "unknown";
  templateState: "approved" | "pending" | "unavailable";
};

export type CallNotificationDecision = {
  eligible: boolean;
  reason:
    | "eligible_for_owner_review"
    | "call_not_finished"
    | "missing_recipient"
    | "missing_appointment"
    | "consent_not_allowed"
    | "suppressed"
    | "template_not_approved";
  automaticSend: false;
  externalExecution: false;
};

export function evaluateCallNotificationCandidate(
  event: CallEvent,
  candidate: CallNotificationCandidate,
): CallNotificationDecision {
  if (event.callState !== "ended" && event.callState !== "missed") {
    return failClosed("call_not_finished");
  }
  if (!candidate.recipientRef) return failClosed("missing_recipient");
  if (candidate.kind !== "booking_link" && !candidate.linkedAppointmentRef) {
    return failClosed("missing_appointment");
  }
  if (candidate.consentState !== "allowed") return failClosed("consent_not_allowed");
  if (candidate.suppressionState !== "clear") return failClosed("suppressed");
  if (candidate.templateState !== "approved") return failClosed("template_not_approved");
  return {
    eligible: true,
    reason: "eligible_for_owner_review",
    automaticSend: false,
    externalExecution: false,
  };
}

function failClosed(reason: Exclude<CallNotificationDecision["reason"], "eligible_for_owner_review">) {
  return { eligible: false, reason, automaticSend: false, externalExecution: false } as const;
}

export function buildCallEventDedupeKey(event: CallEvent) {
  return `${event.anonymousShopRef}:${event.providerEventId}:${event.callState}`;
}

export function projectCallEventForUi(event: CallEvent) {
  return {
    callEventId: event.callEventId,
    callState: event.callState,
    occurredAt: event.occurredAt,
    connectionStatus: "fixture_only" as const,
  };
}

export class InMemoryCallEventLedger {
  readonly #events = new Map<string, CallEvent>();

  ingest(input: unknown) {
    const event = callEventSchema.parse(input);
    const dedupeKey = buildCallEventDedupeKey(event);
    if (this.#events.has(dedupeKey)) return { accepted: false, duplicate: true } as const;
    this.#events.set(dedupeKey, event);
    return { accepted: true, duplicate: false } as const;
  }

  listForUi() {
    return [...this.#events.values()]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map(projectCallEventForUi);
  }
}
