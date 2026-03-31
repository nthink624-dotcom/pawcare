import { NextRequest, NextResponse } from "next/server";

import { updateRecord } from "@/server/repositories/app-repository";
import { ensureEntityBelongsToOwnerShop, getOwnerRouteAccess } from "@/server/owner-auth";

export async function PATCH(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "record", body.recordId);
    if (!allowed) {
      return NextResponse.json({ message: "다른 매장 기록은 수정할 수 없습니다." }, { status: 403 });
    }

    const result = await updateRecord(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "미용 기록을 저장하지 못했습니다." }, { status: 400 });
  }
}
