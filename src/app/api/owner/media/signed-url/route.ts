import { NextRequest } from "next/server";

import { getOwnerMediaSignedUrl } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { MediaVariantKey } from "@/types/domain";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") || undefined);
    const result = await getOwnerMediaSignedUrl(owner, {
      mediaAssetId: searchParams.get("mediaAssetId") || "",
      variantKey: (searchParams.get("variant") || null) as MediaVariantKey | "original" | null,
    });

    return ownerMobileCorsJson(request, result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not create media signed URL.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
