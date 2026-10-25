import type { CallInteractionStatus, MockCallEventType } from "@/types/call-id";

export const CALL_ID_FLAGS = { callDetectionEnabled: false, alimtalkSendEnabled: false, externalExecution: false } as const;
export function normalizePhone(value: string) { const digits = value.replace(/\D/g, ""); if (digits.startsWith("82")) return `0${digits.slice(2)}`; return digits; }
export function maskPhone(value: string) { const phone = normalizePhone(value); if (phone.length < 7) return "번호 확인 필요"; return `${phone.slice(0, 3)}-****-${phone.slice(-4)}`; }
export function transitionCallStatus(current: CallInteractionStatus | null, event: MockCallEventType): CallInteractionStatus { if (event === "inbound_ringing") return current ?? "ringing"; if (event === "answered") return current === "ended" || current === "missed" ? current : "answered"; if (event === "missed") return current === "answered" || current === "ended" ? current : "missed"; return "ended"; }
export function matchGuardianIds(guardians: Array<{ id: string; phone: string }>, phone: string) { const normalized = normalizePhone(phone); return guardians.filter((item) => normalizePhone(item.phone) === normalized).map((item) => item.id); }
