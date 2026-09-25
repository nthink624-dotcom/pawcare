import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createMediaVariantUploadIntent } from "@/server/owner-media-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    const result = await createMediaVariantUploadIntent(
      { shopId: owner.shopId, userId: owner.userId },
      {
        mediaAssetId: body?.mediaAssetId,
        variantKey: body?.variantKey,
        contentType: body?.contentType,
        byteSize: Number(body?.byteSize ?? 0),
        width: body?.width ?? null,
        height: body?.height ?? null,
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 변형 업로드를 준비하지 못했습니다." }, { status: 500 });
  }
}
