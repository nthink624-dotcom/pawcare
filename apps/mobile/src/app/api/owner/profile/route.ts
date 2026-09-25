import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") ?? undefined);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);

    const result = await supabase
      .from("owner_profiles")
      .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
      .eq("shop_id", owner.shopId)
      .maybeSingle();
    if (result.error) throw new OwnerApiError(result.error.message, 500);
    return NextResponse.json({ ownerProfile: result.data ?? null });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "오너 프로필을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);

    const values = {
      ...(typeof body?.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body?.phoneNumber === "string" ? { phone_number: body.phoneNumber.trim() } : {}),
      updated_at: nowIso(),
    };
    const result = await supabase
      .from("owner_profiles")
      .update(values)
      .eq("shop_id", owner.shopId)
      .select("user_id,shop_id,login_id,name,birth_date,phone_number,identity_verified_at,agreements,created_at,updated_at")
      .maybeSingle();
    if (result.error) throw new OwnerApiError(result.error.message, 500);
    return NextResponse.json({ ownerProfile: result.data ?? null });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "오너 프로필을 저장하지 못했습니다." }, { status: 500 });
  }
}
