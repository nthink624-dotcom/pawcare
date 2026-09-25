import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { listMediaAssets } from "@/server/owner-media-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") ?? undefined);
    const result = await listMediaAssets(
      { shopId: owner.shopId, userId: owner.userId },
      {
        appointmentId: searchParams.get("appointmentId"),
        guardianId: searchParams.get("guardianId"),
        petId: searchParams.get("petId"),
        includeVariants: searchParams.get("includeVariants") === "true",
        limit: Number(searchParams.get("limit") ?? 20),
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
