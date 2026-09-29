import { createHash } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_EXPORTS_PER_WINDOW = 3;
const MAX_RATE_LIMIT_KEYS = 4096;

type RateLimitStore = Map<string, number[]>;

declare global {
  // eslint-disable-next-line no-var
  var __petmanagerOwnerDataExportRateLimits: RateLimitStore | undefined;
}

function getStore() {
  globalThis.__petmanagerOwnerDataExportRateLimits ??= new Map();
  return globalThis.__petmanagerOwnerDataExportRateLimits;
}

function hashUserId(userId: string) {
  return createHash("sha256").update(userId, "utf8").digest("hex");
}

export function claimOwnerDataExportRateLimit(userId: string, now = Date.now()) {
  const key = hashUserId(userId);
  const store = getStore();
  const recent = (store.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_EXPORTS_PER_WINDOW) {
    store.set(key, recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  store.set(key, recent);

  // This limiter is deliberately only a local fallback until a shared
  // production primitive is read back. Bound its memory if attackers rotate
  // through many owner identifiers on one instance.
  if (store.size > MAX_RATE_LIMIT_KEYS) {
    for (const [candidateKey, timestamps] of store) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] >= WINDOW_MS) {
        store.delete(candidateKey);
      }
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
