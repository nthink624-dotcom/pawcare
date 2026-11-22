import { NextRequest } from "next/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { loadRevenueAnalytics, parseRevenueQuery, RevenueAnalyticsError } from "@/server/revenue-analytics";
import { buildDemoRevenueAnalytics } from "@/server/revenue-analytics-demo";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("version") !== "2") return ownerMobileCorsJson(request, { message: "매출 화면이 업데이트되었습니다. 새로고침 후 다시 확인해 주세요." }, { status: 426, headers: { "Cache-Control": "private, no-store" } });
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    const query = parseRevenueQuery(request.nextUrl.searchParams);
    if (shopId === "demo-shop" || shopId === "owner-demo") return ownerMobileCorsJson(request, buildDemoRevenueAnalytics(query), { headers: { "Cache-Control": "no-store" } });
    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);
    return ownerMobileCorsJson(request, await loadRevenueAnalytics(owner.shopId, query), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof OwnerApiError || error instanceof RevenueAnalyticsError;
    return ownerMobileCorsJson(request, { message: known ? error.message : "매출 정보를 불러오지 못했습니다." }, { status: known ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
export async function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request); }
