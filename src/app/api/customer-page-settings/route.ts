import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { updateCustomerPageSettings } from "@/server/owner-mutations";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    const result = await updateCustomerPageSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "고객 노출 정보 저장 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
