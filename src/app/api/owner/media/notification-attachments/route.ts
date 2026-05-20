import { NextRequest } from "next/server";

import { attachMediaToNotification } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const media = Array.isArray(body.media) ? body.media : [];
    const owner = await requireOwnerShop(request, requestedShopId);
    const result = await attachMediaToNotification(owner, {
      notificationId: typeof body.notificationId === "string" ? body.notificationId : "",
      channel: typeof body.channel === "string" ? body.channel : null,
      media: media.map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          mediaAssetId: typeof record.mediaAssetId === "string" ? record.mediaAssetId : "",
          attachmentRole: typeof record.attachmentRole === "string" ? record.attachmentRole : null,
          sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : null,
        };
      }),
    });

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not attach media to notification.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
