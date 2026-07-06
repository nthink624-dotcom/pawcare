import { NextRequest, NextResponse } from "next/server";

import { getPublicShopMediaSignedUrls } from "@/server/media-service";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { MediaVariantKey } from "@/types/domain";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mediaAssetIds = Array.isArray(body.mediaAssetIds)
      ? body.mediaAssetIds.filter((item): item is string => typeof item === "string")
      : [];
    const result = await getPublicShopMediaSignedUrls({
      shopId: typeof body.shopId === "string" ? body.shopId : "",
      mediaAssetIds,
      variantKey: (typeof body.variant === "string" ? body.variant : null) as MediaVariantKey | "original" | null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "사진 주소를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
