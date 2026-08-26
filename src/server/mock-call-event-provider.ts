import type { CallEventProvider } from "@/types/call-id";

export class MockCallEventProvider implements CallEventProvider {
  readonly kind = "mock" as const;
  async nextEvent(input: { eventId: string; type: "inbound_ringing" | "answered" | "ended" | "missed"; phone: string }) { return { ...input, occurredAt: new Date().toISOString() }; }
}
