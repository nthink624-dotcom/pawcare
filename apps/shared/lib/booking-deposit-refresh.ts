/** Invalidation only; no money or customer data is cached. */
export function notifyDepositChanged(shopId: string, accountId?: string) {
  const detail = { shopId, accountId };
  window.dispatchEvent(new CustomEvent("pm:deposit-changed", { detail }));
  if (typeof BroadcastChannel !== "undefined") { const c = new BroadcastChannel("pm:deposit-changed"); c.postMessage(detail); c.close(); }
}
export function subscribeDepositChanges(shopId: string, refresh: () => void) {
  const receive = (detail: { shopId?: string }) => { if (detail?.shopId === shopId) refresh(); };
  const local = (e: Event) => receive((e as CustomEvent).detail);
  window.addEventListener("pm:deposit-changed", local);
  const c = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("pm:deposit-changed") : null;
  if (c) c.onmessage = e => receive(e.data);
  return () => { window.removeEventListener("pm:deposit-changed", local); c?.close(); };
}
