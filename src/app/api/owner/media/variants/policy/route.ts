import { NextRequest } from "next/server";

import { getOwnerMediaVariantPolicy } from "@/server/media-variant-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    await requireOwnerShop(request, searchParams.get("shopId") || undefined);
    return ownerMobileCorsJson(request, getOwnerMediaVariantPolicy());
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not load media variant policy.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
