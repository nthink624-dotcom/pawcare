import type { BookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { readOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";

type PolicyResponse = { policy: BookingPolicy; version: number };
// Only concurrent reads are shared. Settled results are never cached, so opening
// another shop or revisiting the screen always reads authoritative settings.
const pending = new Map<string, { token: string | null; request: Promise<PolicyResponse> }>();

export function loadOwnerBookingPolicy(shopId: string): Promise<PolicyResponse> {
  const existing = pending.get(shopId);
  const token = readOwnerAuthTokenCache();
  if (existing && existing.token === token) return existing.request;
  const request = fetchApiJsonWithAuth<PolicyResponse>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`, {
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const entry = { token, request };
  pending.set(shopId, entry);
  const release = () => { if (pending.get(shopId) === entry) pending.delete(shopId); };
  void request.then(release, release);
  return request;
}
