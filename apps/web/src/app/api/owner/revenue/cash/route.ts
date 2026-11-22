import { NextRequest } from "next/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { recordRevenueCash, RevenueAnalyticsError } from "@/server/revenue-analytics";

const cors = { methods: "POST,OPTIONS" };
export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RevenueAnalyticsError("JSON 형식으로 요청해 주세요.", 415);
    if (!request.headers.has("authorization") && request.headers.get("origin") !== request.nextUrl.origin) throw new RevenueAnalyticsError("허용되지 않은 저장 요청입니다.", 403);
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    if (!shopId || ["demo-shop", "owner-demo"].includes(shopId)) throw new RevenueAnalyticsError("데모 매장에서는 실제 수금·환불을 저장할 수 없습니다.", 403);
    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) throw new RevenueAnalyticsError("저장 요청이 너무 큽니다.", 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new RevenueAnalyticsError("저장 내용을 읽을 수 없습니다."); }
    return ownerMobileCorsJson(request, await recordRevenueCash(owner, body), { headers: { "Cache-Control": "private, no-store" } }, cors);
  } catch (error) {
    const known = error instanceof OwnerApiError || error instanceof RevenueAnalyticsError;
    return ownerMobileCorsJson(request, { message: known ? error.message : "수금·환불을 저장하지 못했습니다." }, { status: known ? error.status : 500 }, cors);
  }
}
export async function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
