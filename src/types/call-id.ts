export type MockCallEventType = "inbound_ringing" | "answered" | "ended" | "missed";
export type CallInteractionStatus = "ringing" | "answered" | "ended" | "missed";
export type CallbackTaskStatus = "pending" | "scheduled" | "completed";

export type CallInteraction = { id: string; eventIds: string[]; maskedPhone: string; status: CallInteractionStatus; matchedGuardianIds: string[]; selectedGuardianId: string | null; createdAt: string; updatedAt: string };
export type CallbackTask = { id: string; callId: string; assigneeLabel: string; nextContactAt: string | null; status: CallbackTaskStatus; result: string | null; bookingDraftId: string | null };
export type CallBookingDraft = { id: string; callId: string; guardianId: string; petId: string; serviceId: string | null; staffId: string | null; startAt: string | null; memo: string; status: "draft" | "ready_for_booking"; appointmentCreated: false };
export type CallIdFlags = { callDetectionEnabled: false; alimtalkSendEnabled: false; externalExecution: false };

export interface CallEventProvider { readonly kind: "mock"; nextEvent(input: { eventId: string; type: MockCallEventType; phone: string }): Promise<{ eventId: string; type: MockCallEventType; phone: string; occurredAt: string }>; }
