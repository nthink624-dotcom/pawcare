import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";

    if (scope === "public") {
      const shopId = searchParams.get("shopId") || "demo-shop";
      const data = await getBootstrap(shopId);
      return NextResponse.json({
        mode: data.mode,
        shop: data.shop,
        services: data.services,
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }

    const owner = await requireOwnerShop(request);
    const data = await getBootstrap(owner.shopId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "데이터를 불러오는 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
