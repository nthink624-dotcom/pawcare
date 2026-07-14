import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { getMediaSignedUrl } from "@/server/owner-media-service";
import type { MediaVariantKey } from "@/types/domain";

function normalizeVariant(value: string | null): MediaVariantKey | "original" | null {
  if (value === "thumbnail" || value === "preview" || value === "optimized" || value === "provider_ready" || value === "original") {
    return value;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") ?? undefined);
    const result = await getMediaSignedUrl(
      { shopId: owner.shopId, userId: owner.userId },
      {
        mediaAssetId: searchParams.get("mediaAssetId") ?? "",
        variant: normalizeVariant(searchParams.get("variant")),
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 주소를 만들지 못했습니다." }, { status: 500 });
  }
}
