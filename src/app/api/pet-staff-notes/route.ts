import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { upsertPetStaffNote } from "@/server/owner-mutations";
import { getSupabaseAdmin } from "@/lib/supabase/server";

async function assertStaffCanWriteNote(owner: Awaited<ReturnType<typeof requireOwnerShop>>, body: Record<string, unknown>) {
  if (owner.role !== "staff") return;
  if (!owner.staffId) {
    throw new OwnerApiError("직원 계정과 직원 프로필이 연결되지 않았습니다.", 403);
  }

  const guardianId = typeof body.guardianId === "string" ? body.guardianId : "";
  const petId = typeof body.petId === "string" ? body.petId : null;
  if (!guardianId) {
    throw new OwnerApiError("고객 정보를 확인해 주세요.", 400);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new OwnerApiError("Supabase 설정을 확인해 주세요.", 503);
  }

  let query = supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", owner.shopId)
    .eq("staff_id", owner.staffId)
    .eq("guardian_id", guardianId);
  if (petId) {
    query = query.eq("pet_id", petId);
  }

  const result = await query;
  if (result.error) {
    throw new OwnerApiError(result.error.message, 500);
  }
  if ((result.count ?? 0) <= 0) {
    throw new OwnerApiError("직원 계정은 본인에게 배정된 고객 메모만 저장할 수 있습니다.", 403);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    await assertStaffCanWriteNote(owner, body);
    const result = await upsertPetStaffNote({
      ...body,
      shopId: owner.shopId,
      userId: owner.userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "직원 메모 저장 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
