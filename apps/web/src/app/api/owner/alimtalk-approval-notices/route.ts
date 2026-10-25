import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { readAlimtalkApprovalNotices } from "@/server/alimtalk-approval-notices";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
const cors = { methods: "GET, PATCH, OPTIONS" }, headers = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";
export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request, cors); }
export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, new URL(request.url).searchParams.get("shopId") || undefined); assertOwnerOrManager(owner);
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
    return ownerMobileCorsJson(request, { notices: await readAlimtalkApprovalNotices(owner.shopId, owner.userId) }, { headers }, cors);
  } catch (error) { return failure(request, error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const input = z.object({ shopId: z.string().min(1).max(100), noticeId: z.string().uuid() }).parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId); assertOwnerOrManager(owner);
    if (!owner.userId) throw new OwnerApiError("로그인이 필요합니다.", 401);
    const admin = getSupabaseAdmin(); if (!admin) throw new OwnerApiError("알림 저장소를 확인하지 못했습니다.", 503);
    const result = await admin.rpc("read_shop_alimtalk_approval", { p_shop: owner.shopId, p_user: owner.userId, p_notice: input.noticeId });
    if (result.error || !result.data) throw new OwnerApiError("알림을 찾지 못했습니다.", 404);
    return ownerMobileCorsJson(request, { acknowledged: true }, { headers }, cors);
  } catch (error) { return failure(request, error); }
}
function failure(request: NextRequest, error: unknown) { return ownerMobileCorsJson(request, { message: error instanceof OwnerApiError ? error.message : "승인 알림을 확인하지 못했습니다." }, { status: error instanceof OwnerApiError ? error.status : error instanceof z.ZodError ? 400 : 503, headers }, cors); }
