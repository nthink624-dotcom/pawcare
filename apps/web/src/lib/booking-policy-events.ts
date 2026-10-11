export const BOOKING_POLICY_CHANGED = "petmanager:booking-policy-changed";
const storageKey = "petmanager:booking-policy-revision";
export function publishBookingPolicyChange(shopId: string) {
  window.dispatchEvent(new CustomEvent(BOOKING_POLICY_CHANGED, { detail: { shopId } }));
  try { window.localStorage.setItem(storageKey, JSON.stringify({ shopId, revision: `${Date.now()}-${Math.random()}` })); } catch { /* Storage is optional. */ }
}
export function subscribeBookingPolicyChange(shopId: string, refresh: () => void) {
  const local = (event: Event) => { if ((event as CustomEvent).detail?.shopId === shopId) refresh(); };
  const remote = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return;
    try { if (JSON.parse(event.newValue).shopId === shopId) refresh(); } catch { /* Ignore invalid storage events. */ }
  };
  window.addEventListener(BOOKING_POLICY_CHANGED, local);
  window.addEventListener("storage", remote);
  window.addEventListener("focus", refresh);
  return () => { window.removeEventListener(BOOKING_POLICY_CHANGED, local); window.removeEventListener("storage", remote); window.removeEventListener("focus", refresh); };
}
