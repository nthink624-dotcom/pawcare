import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { updateCustomerPageSettings } from "@/server/owner-mutations";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await updateCustomerPageSettings(body, {
      ownerUserId: owner.userId,
      changedByUserId: owner.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "고객 예약 페이지 설정을 다시 확인해 주세요." }, { status: 400 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객 예약 페이지 설정을 저장하지 못했습니다." }, { status: 500 });
  }
}
