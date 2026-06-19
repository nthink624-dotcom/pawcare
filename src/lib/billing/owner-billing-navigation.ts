import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";

const OWNER_BILLING_SUMMARY_CACHE_KEY = "owner-billing:summary-cache";
const DEFAULT_MAX_AGE_MS = 2 * 60 * 1000;

type OwnerBillingSummaryCache = {
  cachedAt: number;
  summary: OwnerSubscriptionSummary;
};

export function writeOwnerBillingSummaryCache(summary: OwnerSubscriptionSummary) {
  if (typeof window === "undefined") return;

  try {
    const payload: OwnerBillingSummaryCache = {
      cachedAt: Date.now(),
      summary,
    };
    window.sessionStorage.setItem(OWNER_BILLING_SUMMARY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Cache is only for faster navigation; ignore storage failures.
  }
}

export function readOwnerBillingSummaryCache(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(OWNER_BILLING_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OwnerBillingSummaryCache>;
    if (!parsed.summary || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > maxAgeMs) return null;
    return parsed.summary;
  } catch {
    return null;
  }
}
