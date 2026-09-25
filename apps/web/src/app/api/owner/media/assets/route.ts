import { NextRequest } from "next/server";

import { listOwnerMediaAssets } from "@/server/media-query-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") || undefined);
    const limit = searchParams.get("limit");
    const includeVariants = searchParams.get("includeVariants");
    const result = await listOwnerMediaAssets(owner, {
      guardianId: searchParams.get("guardianId"),
      petId: searchParams.get("petId"),
      appointmentId: searchParams.get("appointmentId"),
      groomingRecordId: searchParams.get("groomingRecordId"),
      mediaKind: searchParams.get("mediaKind"),
      beforeCreatedAt: searchParams.get("beforeCreatedAt"),
      limit: limit ? Number(limit) : null,
      includeVariants: includeVariants === null ? null : includeVariants !== "false",
    });

    return ownerMobileCorsJson(request, result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not list media assets.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
