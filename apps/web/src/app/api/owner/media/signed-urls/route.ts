import { NextRequest } from "next/server";

import { getOwnerMediaSignedUrls } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { MediaVariantKey } from "@/types/domain";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const owner = await requireOwnerShop(request, typeof body.shopId === "string" ? body.shopId : undefined);
    const mediaAssetIds = Array.isArray(body.mediaAssetIds)
      ? body.mediaAssetIds.filter((item): item is string => typeof item === "string")
      : [];
    const result = await getOwnerMediaSignedUrls(owner, {
      mediaAssetIds,
      variantKey: (typeof body.variant === "string" ? body.variant : null) as MediaVariantKey | "original" | null,
    });

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not create media signed URLs.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
