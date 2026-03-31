import { NextRequest, NextResponse } from "next/server";

import { createGuardian, updateGuardianNotificationSettings } from "@/server/repositories/app-repository";
import { ensureEntityBelongsToOwnerShop, getOwnerRouteAccess } from "@/server/owner-auth";

export async function POST(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const result = await createGuardian({ ...body, shopId: access.context.shopId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "guardian", body.guardianId);
    if (!allowed) {
      return NextResponse.json({ message: "다른 매장 고객은 수정할 수 없습니다." }, { status: 403 });
    }

    const result = await updateGuardianNotificationSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "고객 알림 설정을 저장하지 못했습니다." }, { status: 400 });
  }
}
