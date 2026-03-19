import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/repositories/app-repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") || undefined;
    const scope = searchParams.get("scope") || "owner";
    const data = await getBootstrap(shopId);
    if (scope === "public") {
      return NextResponse.json({
        mode: data.mode,
        shop: data.shop,
        services: data.services.filter((item) => item.is_active),
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
