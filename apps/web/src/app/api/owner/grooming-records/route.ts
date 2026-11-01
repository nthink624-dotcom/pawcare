import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireOwnerShop, OwnerApiError } from "@/server/owner-api-auth";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const petId = z.string().uuid().parse(params.get("petId"));
    const owner = await requireOwnerShop(request, params.get("shopId") || undefined, undefined, { deferBillingMaintenance: true });
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("미용 기록 저장소에 연결하지 못했습니다.", 503);
    const pet = await admin.from("pets").select("id").eq("shop_id", owner.shopId).eq("id", petId).maybeSingle();
    if (pet.error) throw new OwnerApiError("반려동물 정보를 확인하지 못했습니다.", 503);
    if (!pet.data) throw new OwnerApiError("이 매장에 연결된 반려동물을 찾지 못했습니다.", 404);
    const result = await admin.from("grooming_records").select("*", { count: "exact" })
      .eq("shop_id", owner.shopId).eq("pet_id", petId).order("groomed_at", { ascending: false }).order("id", { ascending: false }).limit(20);
    if (result.error) throw new OwnerApiError("미용 기록을 불러오지 못했습니다.", 503);
    return NextResponse.json({ records: result.data ?? [], total: result.count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof OwnerApiError ? error.message : "미용 기록의 연결 정보를 확인해 주세요." }, { status: error instanceof OwnerApiError ? error.status : error instanceof z.ZodError ? 400 : 503 });
  }
}
