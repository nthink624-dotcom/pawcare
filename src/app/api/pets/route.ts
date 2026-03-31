import { NextRequest, NextResponse } from "next/server";

import { createPet, updatePet } from "@/server/repositories/app-repository";
import { ensureEntityBelongsToOwnerShop, getOwnerRouteAccess } from "@/server/owner-auth";

export async function POST(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const result = await createPet({ ...body, shopId: access.context.shopId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "반려견을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "pet", body.petId);
    if (!allowed) {
      return NextResponse.json({ message: "다른 매장 반려견은 수정할 수 없습니다." }, { status: 403 });
    }

    const result = await updatePet(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "반려견 정보를 저장하지 못했습니다." }, { status: 400 });
  }
}
