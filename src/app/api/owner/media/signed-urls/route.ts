import { NextRequest, NextResponse } from "next/server";

import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { getMediaSignedUrl } from "@/server/owner-media-service";
import type { MediaVariantKey } from "@/types/domain";

type SignedUrlRequestItem = {
  mediaAssetId?: string;
  variant?: MediaVariantKey | "original";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    const items: SignedUrlRequestItem[] = Array.isArray(body?.items) ? body.items : [];
    const signedUrls = await Promise.all(
      items.map((item) =>
        getMediaSignedUrl(
          { shopId: owner.shopId, userId: owner.userId },
          {
            mediaAssetId: item?.mediaAssetId ?? "",
            variant: item?.variant ?? "original",
          },
        ).then((result) => ({ ...item, ...result })),
      ),
    );
    return NextResponse.json({ items: signedUrls });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "사진 주소를 만들지 못했습니다." }, { status: 500 });
  }
}
