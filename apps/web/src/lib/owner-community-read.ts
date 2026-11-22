import type { CommunityApi } from "@petmanager/shared/contracts/community";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { readOwnerAuthTokenCache } from "@/lib/auth/owner-auth-handoff";

// Normal reads are always fresh. A navigation intent (hover/focus on the lounge menu)
// may start the first feed and saved-list reads; reads of those exact pages within
// five seconds, for the same login, share that request (React may run the opening
// effect twice). Any write discards prepared reads so later reads see the change.
const PREPARED_MS = 5_000;
const prepared = new Map<string, { token: string; expires: number; request: Promise<unknown> }>();

export function prefetchOwnerCommunity(shopId: string) {
  const token = readOwnerAuthTokenCache();
  if (!token) return;
  const now = Date.now();
  for (const [path, entry] of prepared) {
    if (entry.token !== token || entry.expires <= now) prepared.delete(path);
  }
  const base = `/api/owner/community?shopId=${encodeURIComponent(shopId)}`;
  // Must match the first-page paths requested by CommunityBoard and CommunitySavedPosts.
  for (const path of [`${base}&page=0`, `${base}&savedOnly=true&page=0`]) {
    if (prepared.has(path)) continue;
    const request = fetchApiJsonWithAuth<unknown>(path, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const entry = { token, expires: now + PREPARED_MS, request };
    prepared.set(path, entry);
    request.catch(() => { if (prepared.get(path) === entry) prepared.delete(path); });
  }
  while (prepared.size > 4) prepared.delete(prepared.keys().next().value!);
}

export const ownerCommunityApi: CommunityApi = <T,>(path: string, init?: RequestInit) => {
  if (init?.method && init.method !== "GET") {
    prepared.clear();
    return fetchApiJsonWithAuth<T>(path, init);
  }
  const entry = prepared.get(path);
  if (entry && entry.token === readOwnerAuthTokenCache() && entry.expires > Date.now()) return entry.request as Promise<T>;
  if (entry) prepared.delete(path);
  return fetchApiJsonWithAuth<T>(path, init);
};
