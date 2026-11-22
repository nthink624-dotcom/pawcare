import type { BookingPolicy } from "@petmanager/shared/contracts/booking-preparation";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { readOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";

type PolicyResponse = { policy: BookingPolicy; version: number };
// Normal reads are always fresh. A navigation intent may hand its request to the
// screen once, for at most five seconds, scoped to the same shop and login.
const pending = new Map<string, { token: string | null; request: Promise<PolicyResponse> }>();
const prepared = new Map<string, { token: string; expires: number; request: Promise<PolicyResponse> }>();

export function prefetchOwnerBookingPolicy(shopId: string) {
  const token = readOwnerAuthTokenCache();
  if (!token) return;
  for (const [key, entry] of prepared) {
    if (entry.token !== token || entry.expires <= Date.now()) prepared.delete(key);
  }
  if (prepared.has(shopId)) return;
  const request = loadOwnerBookingPolicy(shopId);
  const entry = { token, expires: Date.now() + 5_000, request };
  prepared.set(shopId, entry);
  while (prepared.size > 4) prepared.delete(prepared.keys().next().value!);
  void request.catch(() => { if (prepared.get(shopId) === entry) prepared.delete(shopId); });
}

export function loadOwnerBookingPolicy(shopId: string, fromNavigation = false): Promise<PolicyResponse> {
  const existing = pending.get(shopId);
  const token = readOwnerAuthTokenCache();
  const navigation = prepared.get(shopId);
  prepared.delete(shopId);
  if (existing && existing.token === token) return existing.request;
  const request = fromNavigation && token && navigation?.token === token && navigation.expires > Date.now()
    ? navigation.request
    : fetchApiJsonWithAuth<PolicyResponse>(`/api/owner/booking-policy?shopId=${encodeURIComponent(shopId)}`, {
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const entry = { token, request };
  pending.set(shopId, entry);
  const release = () => { if (pending.get(shopId) === entry) pending.delete(shopId); };
  void request.then(release, release);
  return request;
}
