import { NextRequest } from "next/server";

import {
  resolveNotificationMediaDelivery,
  toAlimtalkMediaAttachments,
} from "@/server/media-delivery-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = await requireOwnerShop(request, searchParams.get("shopId") || undefined);
    const delivery = await resolveNotificationMediaDelivery(owner, {
      notificationId: searchParams.get("notificationId") || "",
    });

    return ownerMobileCorsJson(request, {
      ...delivery,
      providerPayload: {
        mediaAttachments: toAlimtalkMediaAttachments(delivery.items),
      },
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Could not prepare notification media delivery.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
