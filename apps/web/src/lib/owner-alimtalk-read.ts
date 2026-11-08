import { fetchApiJsonWithAuth } from "@/lib/api";
import { readOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";

type Resource = "templates" | "selection";
type Entry = { token: string; expires: number; pending: boolean; value?: unknown; request: Promise<unknown> };
const entries = new Map<string, Entry>();
const keyFor = (shopId: string, resource: Resource) => JSON.stringify([shopId, resource]);

export function peekOwnerAlimtalkRead<T>(shopId: string, resource: Resource): T | undefined {
  const token = readOwnerAuthTokenCache();
  const entry = entries.get(keyFor(shopId, resource));
  return token && entry?.token === token && entry.expires > Date.now() ? entry.value as T | undefined : undefined;
}

export function invalidateOwnerAlimtalkReads(shopId: string) {
  entries.delete(keyFor(shopId, "templates"));
  entries.delete(keyFor(shopId, "selection"));
}

export function readOwnerAlimtalkResource<T>(shopId: string, resource: Resource, preferCached = false): Promise<T> {
  const token = readOwnerAuthTokenCache();
  const key = keyFor(shopId, resource);
  const previous = entries.get(key);
  if (token && previous?.token === token && (previous.pending || preferCached && previous.expires > Date.now())) {
    return previous.request as Promise<T>;
  }
  const path = resource === "templates" ? "alimtalk-templates" : "alimtalk-template-selection";
  const fetchResource = () => fetchApiJsonWithAuth<T>(`/api/owner/${path}?shopId=${encodeURIComponent(shopId)}`, {
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const request = fetchResource().catch(error => {
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    if (error instanceof TypeError || error instanceof Error && error.name === "TimeoutError" || [502, 503, 504].includes(status as number)) {
      return fetchResource(); // One retry of this read only; never a save, review, or send.
    }
    throw error;
  });
  // No persisted bodies, and no reuse without a known authenticated session.
  if (!token) return request;
  const entry: Entry = { token, expires: 0, pending: true, request };
  entries.set(key, entry);
  while (entries.size > 8) entries.delete(entries.keys().next().value!);
  void request.then(value => {
    if (entries.get(key) === entry && readOwnerAuthTokenCache() === token) {
      entry.value = value; entry.pending = false; entry.expires = Date.now() + 15_000;
    } else if (entries.get(key) === entry) entries.delete(key);
  }, () => { if (entries.get(key) === entry) entries.delete(key); });
  return request;
}

export function prefetchOwnerAlimtalk(shopId: string) {
  if (!readOwnerAuthTokenCache()) return;
  void Promise.allSettled([
    readOwnerAlimtalkResource(shopId, "templates", true),
    readOwnerAlimtalkResource(shopId, "selection", true),
  ]);
}
