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
      items.slice(0, 50).map(async (item) => {
        const mediaAssetId = item?.mediaAssetId ?? "";
        const requestedVariant = item?.variant ?? "original";
        try {
          const result = await getMediaSignedUrl(
            { shopId: owner.shopId, userId: owner.userId },
            { mediaAssetId, variant: requestedVariant },
          );
          return { ...item, ...result };
        } catch {
          if (!mediaAssetId || requestedVariant === "original") return null;
          try {
            const original = await getMediaSignedUrl(
              { shopId: owner.shopId, userId: owner.userId },
              { mediaAssetId, variant: "original" },
            );
            return { ...item, ...original, variant: "original" as const };
          } catch {
            return null;
          }
        }
      }),
    );
    return NextResponse.json({ items: signedUrls.filter((item) => item !== null) });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "사진 주소를 만들지 못했습니다." }, { status: 500 });
  }
}
