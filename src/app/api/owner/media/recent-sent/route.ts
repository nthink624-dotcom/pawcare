import { NextRequest } from "next/server";

import { listRecentSentMedia } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") || undefined);
    const items = await listRecentSentMedia(owner, {
      guardianId: searchParams.get("guardianId"),
      petId: searchParams.get("petId"),
      appointmentId: searchParams.get("appointmentId"),
      limit: Number(searchParams.get("limit") || 30),
    });

    return ownerMobileCorsJson(request, { items });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not load recent sent media.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
