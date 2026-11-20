import { NextRequest } from "next/server";
import { z } from "zod";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { requireAdminSession } from "@/server/admin-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { readCommunityResources, resourcePageSchema } from "@/server/community/resources";
const CORS = { methods: "GET, OPTIONS" };
export async function GET(request: NextRequest) {
  try {
    const shopId = z.string().min(1).max(100).parse(request.nextUrl.searchParams.get("shopId"));
    const page = resourcePageSchema.parse(request.nextUrl.searchParams.get("page") ?? undefined);
    const owner = await requireOwnerShop(request, shopId, undefined, { deferBillingMaintenance: true });
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
    const data = await readCommunityResources(owner.userId, owner.shopId, page);
    // Capability only: missing/inactive admin sessions never grant publishing.
    const canPublish = await requireAdminSession(request).then(() => true).catch(() => false);
    return ownerMobileCorsJson(request, { ...data, canPublish }, { headers: { "Cache-Control": "private, no-store" } }, CORS);
  } catch (error) {
    const status = error instanceof OwnerApiError ? error.status : error instanceof z.ZodError ? 400 : 503;
    return ownerMobileCorsJson(request, { message: error instanceof OwnerApiError ? error.message : "소식을 불러오지 못했습니다. 다시 시도해 주세요." }, { status, headers: { "Cache-Control": "private, no-store" } }, CORS);
  }
}
export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, CORS); }
