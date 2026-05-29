import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { upsertPetStaffNote } from "@/server/owner-mutations";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
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
