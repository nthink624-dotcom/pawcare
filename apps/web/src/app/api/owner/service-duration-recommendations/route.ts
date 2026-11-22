import { NextRequest } from "next/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { loadProfitabilityPayload } from "@/server/profitability-analytics";

export const dynamic = "force-dynamic";

/** Service duration uses completed work, independently of the cash analytics contract. */
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined);
    assertOwnerOrManager(owner);
    const payload = await loadProfitabilityPayload(owner.shopId, "365d");
    return ownerMobileCorsJson(request, { durationRecommendations: payload.durationRecommendations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return ownerMobileCorsJson(request, { message: error instanceof OwnerApiError ? error.message : "서비스 시간 추천을 불러오지 못했습니다." }, { status: error instanceof OwnerApiError ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request); }
