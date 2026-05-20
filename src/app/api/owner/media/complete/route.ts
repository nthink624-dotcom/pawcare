import { NextRequest } from "next/server";

import { completeOwnerMediaUpload } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    const mediaAsset = await completeOwnerMediaUpload(owner, {
      mediaAssetId: typeof body.mediaAssetId === "string" ? body.mediaAssetId : "",
      byteSize: typeof body.byteSize === "number" ? body.byteSize : null,
      width: typeof body.width === "number" ? body.width : null,
      height: typeof body.height === "number" ? body.height : null,
      checksumSha256: typeof body.checksumSha256 === "string" ? body.checksumSha256 : null,
    });

    return ownerMobileCorsJson(request, { mediaAsset }, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not complete media upload.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
