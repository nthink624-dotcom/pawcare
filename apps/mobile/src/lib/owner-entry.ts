import type { OwnerEntryPayload, OwnerEntryShop } from "@petmanager/shared/contracts/owner-entry";
import { ApiRequestError, fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import type { BootstrapPayload } from "@/types/domain";

type Entry = OwnerEntryPayload<BootstrapPayload, OwnerSubscriptionSummary>;
type Read = typeof fetchApiJsonWithAuth;

// A stale shop hint and an older API deployment can use the established entry
// flow. Authentication, subscription and server failures must still fail closed.
export async function loadOwnerEntry(
  shopHint: string | null,
  includeSubscription: boolean,
  read: Read = fetchApiJsonWithAuth,
): Promise<Entry> {
  const query = new URLSearchParams({ includeSubscription: includeSubscription ? "1" : "0" });
  if (shopHint) query.set("shopId", shopHint);
  try {
    const entry = await read<Entry>(`/api/owner/entry?${query}`, { cache: "no-store" });
    if (entry.version !== 1 || !Array.isArray(entry.shops) || !entry.bootstrap) {
      throw new Error("매장 시작 정보를 확인하지 못했습니다.");
    }
    return entry;
  } catch (error) {
    const olderApi = error instanceof ApiRequestError && error.status === 404
      || error instanceof Error && error.message === "요청한 화면을 찾을 수 없습니다. 경로를 다시 확인해 주세요.";
    const staleHint = Boolean(shopHint) && error instanceof ApiRequestError && error.status === 403;
    if (!olderApi && !staleHint) throw error;
  }

  const bootstrapRead = read<BootstrapPayload>(
    `/api/bootstrap?phase=launch${shopHint ? `&shopId=${encodeURIComponent(shopHint)}` : ""}`,
    { cache: "no-store" },
  ).then(payload => ({ ok: true as const, payload }), error => ({ ok: false as const, error }));
  const [shops, initial] = await Promise.all([read<OwnerEntryShop[]>("/api/owner/shops"), bootstrapRead]);
  const shopId = (shopHint && shops.some(shop => shop.id === shopHint) ? shopHint : shops[0]?.id) ?? null;
  if (!shopId) throw new Error("접근할 수 있는 매장이 없습니다.");
  const bootstrap = initial.ok && initial.payload.shop?.id === shopId ? initial.payload
    : await read<BootstrapPayload>(`/api/bootstrap?shopId=${encodeURIComponent(shopId)}&phase=launch`, { cache: "no-store" });
  // The caller validates canonical actor/readiness before reading billing in the
  // fallback, just as it did before the combined endpoint existed.
  return { version: 1, bootstrap, shops, subscriptionSummary: null };
}
