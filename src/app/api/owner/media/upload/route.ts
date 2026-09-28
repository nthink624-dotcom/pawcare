import { NextRequest } from "next/server";

import { uploadOwnerMediaFile } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const shopId = typeof form.get("shopId") === "string" ? form.get("shopId") as string : undefined;
    const mediaAssetId = typeof form.get("mediaAssetId") === "string" ? form.get("mediaAssetId") as string : "";
    const file = form.get("file");
    if (!(file instanceof File)) throw new OwnerApiError("Media file is required.", 400);
    const owner = await requireOwnerShop(request, shopId);
    const result = await uploadOwnerMediaFile(owner, { mediaAssetId, file });
    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload media.";
    const status = error instanceof OwnerApiError ? error.status : 500;
    return ownerMobileCorsJson(request, { message }, { status }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
