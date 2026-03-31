import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/repositories/app-repository";
import { getOwnerRouteAccess } from "@/server/owner-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";

    if (scope === "public") {
      const shopId = searchParams.get("shopId") || undefined;
      const data = await getBootstrap(shopId);
      return NextResponse.json({
        mode: data.mode,
        shop: data.shop,
        services: data.services.filter((item) => item.is_active),
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }

    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const data = await getBootstrap(access.context.shopId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
