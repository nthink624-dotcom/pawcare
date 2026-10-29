import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { assertBootstrapOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { getOwnerBootstrapSnapshot } from "@/server/owner-bootstrap-snapshot";
import {
  getPriceGuideCoreContract,
  projectCanonicalPriceGuidesForRead,
} from "@/lib/price-guide-core";

export async function GET(request: NextRequest) {
  const requestStartedAt = performance.now();
  let authorizationDurationMs = 0;
  let bootstrapDurationMs = 0;
  const authorizationPhaseDurations = new Map<string, number>();
  const bootstrapPhaseDurations = new Map<string, number>();
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";
    const requestedShopId = searchParams.get("shopId") || undefined;
    const requestedPhase = searchParams.get("phase");
    const phase = requestedPhase === "essential" || requestedPhase === "launch" ? requestedPhase : "full";

    if (scope === "public") {
      const shopId = requestedShopId || "demo-shop";
      const data = await getBootstrap(shopId, {
        includeLanding: false,
        includeNotifications: false,
        includeGroomingRecords: false,
        includePilotCohort: false,
      });
      assertBootstrapOwnerInitialSetupComplete(data);
      return ownerMobileCorsJson(request, {
        mode: data.mode,
        shop: data.shop,
        services: projectCanonicalPriceGuidesForRead(data.services),
        priceGuideCore: getPriceGuideCoreContract(),
      });
    }

    const authorizationStartedAt = performance.now();
    const owner = await requireOwnerShop(request, requestedShopId, (phase, durationMs) => {
      authorizationPhaseDurations.set(phase, durationMs);
    }, { deferBillingMaintenance: true });
    authorizationDurationMs = performance.now() - authorizationStartedAt;
    const bootstrapStartedAt = performance.now();
    const data = await getOwnerBootstrapSnapshot(owner, phase, (phase, durationMs) => bootstrapPhaseDurations.set(phase, durationMs));
    bootstrapDurationMs = performance.now() - bootstrapStartedAt;
    const response = ownerMobileCorsJson(request, data);
    const internalAuthorizationTimings = [
      "subscription_read",
      "subscription_reconcile",
      "subscription_schedule",
      "subscription_summary",
    ]
      .filter((phase) => authorizationPhaseDurations.has(phase))
      .map((phase) => `${phase};dur=${(authorizationPhaseDurations.get(phase) ?? 0).toFixed(1)}`);
    const internalBootstrapTimings = ["data_bundle", "data_bundle_fallback", "deposit_expiry", "data_queries"]
      .filter((phase) => bootstrapPhaseDurations.has(phase))
      .map((phase) => `${phase};dur=${(bootstrapPhaseDurations.get(phase) ?? 0).toFixed(1)}`);
    response.headers.set(
      "Server-Timing",
      `auth_user;dur=${(authorizationPhaseDurations.get("auth_user") ?? 0).toFixed(1)}, shop_access;dur=${(authorizationPhaseDurations.get("shop_access") ?? 0).toFixed(1)}, ${internalAuthorizationTimings.join(", ")}, authorization;dur=${authorizationDurationMs.toFixed(1)}, ${internalBootstrapTimings.join(", ")}, bootstrap;dur=${bootstrapDurationMs.toFixed(1)}, total;dur=${(performance.now() - requestStartedAt).toFixed(1)}`,
    );
    return response;
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "데이터를 불러오는 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
