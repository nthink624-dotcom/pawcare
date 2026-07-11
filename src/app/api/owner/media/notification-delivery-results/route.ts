import { NextRequest } from "next/server";

import { markNotificationMediaDeliveryResult } from "@/server/media-delivery-service";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import type { MediaSendStatus } from "@/types/domain";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const providerMedia = Array.isArray(body.providerMedia) ? body.providerMedia : [];
    const owner = await requireOwnerShop(request, requestedShopId);
    assertOwnerOrManager(owner);
    const result = await markNotificationMediaDeliveryResult(owner, {
      notificationId: typeof body.notificationId === "string" ? body.notificationId : "",
      status: (typeof body.status === "string" ? body.status : "sent") as MediaSendStatus,
      channel: typeof body.channel === "string" ? body.channel : null,
      provider: typeof body.provider === "string" ? body.provider : null,
      providerMessageId: typeof body.providerMessageId === "string" ? body.providerMessageId : null,
      recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
      failReason: typeof body.failReason === "string" ? body.failReason : null,
      sentAt: typeof body.sentAt === "string" ? body.sentAt : null,
      providerMedia: providerMedia.map((item) => {
        const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          notificationMediaAttachmentId:
            typeof record.notificationMediaAttachmentId === "string"
              ? record.notificationMediaAttachmentId
              : "",
          providerMediaId: typeof record.providerMediaId === "string" ? record.providerMediaId : null,
          providerMediaUrl: typeof record.providerMediaUrl === "string" ? record.providerMediaUrl : null,
          metadata:
            record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
              ? (record.metadata as Record<string, unknown>)
              : null,
        };
      }),
    });

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not record notification media delivery result.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
