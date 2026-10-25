import type { PriceGuideSessionState } from "@/components/auth/mobile-ai-price-guide-fixture";
import type { BootstrapPayload } from "@/types/domain";

export function ownerPriceGuideSessionKey(bootstrap: Pick<BootstrapPayload, "shop">) {
  return `petmanager:owner-price-guide-session:v1:${encodeURIComponent(bootstrap.shop.owner_user_id ?? "owner")}:${encodeURIComponent(bootstrap.shop.id)}`;
}

function isSessionState(value: unknown): value is PriceGuideSessionState {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return Array.isArray(draft.rows)
    && Boolean(draft.document) && typeof draft.document === "object"
    && (typeof draft.serviceId === "string" || draft.serviceId === null)
    && (draft.resumeMode === "manual" || draft.resumeMode === "review");
}

export function readOwnerPriceGuideSessionDraft(key: string): PriceGuideSessionState | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const draft: unknown = JSON.parse(raw);
    if (isSessionState(draft)) return draft;
    window.sessionStorage.removeItem(key);
  } catch { /* Temporary browser state is optional. */ }
  return null;
}

export function writeOwnerPriceGuideSessionDraft(key: string, draft: PriceGuideSessionState | null) {
  try {
    if (!draft) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(draft));
  } catch { /* Keep editing even when browser storage is unavailable. */ }
}
