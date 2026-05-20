import { NextRequest } from "next/server";

import { createOwnerMediaVariantUploadIntent } from "@/server/media-variant-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    const result = await createOwnerMediaVariantUploadIntent(owner, {
      mediaAssetId: typeof body.mediaAssetId === "string" ? body.mediaAssetId : "",
      variantKey: typeof body.variantKey === "string" ? body.variantKey : "",
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      byteSize: typeof body.byteSize === "number" ? body.byteSize : -1,
      width: typeof body.width === "number" ? body.width : null,
      height: typeof body.height === "number" ? body.height : null,
    });

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not create media variant upload intent.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
