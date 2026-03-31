import { NextRequest, NextResponse } from "next/server";

import { upsertService } from "@/server/repositories/app-repository";
import { getOwnerRouteAccess } from "@/server/owner-auth";

export async function POST(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const result = await upsertService({ ...body, shopId: access.context.shopId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "서비스를 저장하지 못했습니다." }, { status: 400 });
  }
}
