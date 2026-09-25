import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { completeMediaUpload } from "@/server/owner-media-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    const result = await completeMediaUpload(
      { shopId: owner.shopId, userId: owner.userId },
      {
        mediaAssetId: body?.mediaAssetId,
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
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 업로드를 완료하지 못했습니다." }, { status: 500 });
  }
}
