import { NextRequest } from "next/server";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { OwnerBillingError, getOwnerSubscriptionSummary } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { getOwnerBootstrapSnapshot } from "@/server/owner-bootstrap-snapshot";
import { readOwnerShopSummaries } from "@/server/owner-shop-list";
import type { OwnerEntryPayload } from "@petmanager/shared/contracts/owner-entry";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const started = performance.now();
  const timings = new Map<string, number>();
  try {
    if (!hasSupabaseServerEnv()) throw new OwnerApiError("서버 설정을 확인해 주세요.", 503);
    const shopHint = request.nextUrl.searchParams.get("shopId") || undefined;
    const owner = await requireOwnerShop(request, shopHint, (phase, ms) => timings.set(phase, ms), { deferBillingMaintenance: true });
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
    const includeSubscription = request.nextUrl.searchParams.get("includeSubscription") === "1" && owner.role !== "staff";
    // This read keeps the existing, fresh billing identity and primary-owner checks.
    // No reconciliation/scheduling begins until the canonical bootstrap is valid.
    const billingRead = includeSubscription ? requireOwnerBillingSession(request, owner.shopId).then(
      value => ({ ok: true as const, value }),
      error => ({ ok: false as const, error }),
    ) : null;
    const [bootstrap, shops] = await Promise.all([
      getOwnerBootstrapSnapshot(owner, "launch", (phase, ms) => timings.set(phase, ms)),
      readOwnerShopSummaries(owner.userId),
    ]);
    if (!shops.some(shop => shop.id === owner.shopId)) throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
    let subscriptionSummary: Awaited<ReturnType<typeof getOwnerSubscriptionSummary>> | null = null;
    if (billingRead && bootstrap.ownerProfile && bootstrap.initialSetupReadiness?.completed) {
      const billing = await billingRead;
      if (!billing.ok) throw billing.error;
      const summaryStarted = performance.now();
      subscriptionSummary = await getOwnerSubscriptionSummary(billing.value.identity, billing.value.shopId);
      timings.set("subscription_summary", performance.now() - summaryStarted);
    }
    const payload: OwnerEntryPayload<typeof bootstrap, NonNullable<typeof subscriptionSummary>> = { version: 1, bootstrap, shops, subscriptionSummary };
    const response = ownerMobileCorsJson(request, payload);
    response.headers.set("Server-Timing", [...timings].map(([phase, ms]) => `${phase};dur=${ms.toFixed(1)}`).concat(`total;dur=${(performance.now() - started).toFixed(1)}`).join(", "));
    return response;
  } catch (error) {
    const status = error instanceof OwnerApiError || error instanceof OwnerBillingError ? error.status : 500;
    return ownerMobileCorsJson(request, { message: error instanceof Error ? error.message : "오너 화면을 준비하지 못했습니다." }, { status });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
