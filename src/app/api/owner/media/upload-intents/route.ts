import { NextRequest } from "next/server";

import { createOwnerMediaUploadIntent } from "@/server/media-service";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    const result = await createOwnerMediaUploadIntent(owner, {
      originalFileName: typeof body.originalFileName === "string" ? body.originalFileName : null,
      contentType: typeof body.contentType === "string" ? body.contentType : "",
      byteSize: typeof body.byteSize === "number" ? body.byteSize : -1,
      sourceByteSize: typeof body.sourceByteSize === "number" ? body.sourceByteSize : null,
      width: typeof body.width === "number" ? body.width : null,
      height: typeof body.height === "number" ? body.height : null,
      checksumSha256: typeof body.checksumSha256 === "string" ? body.checksumSha256 : null,
      mediaKind: typeof body.mediaKind === "string" ? body.mediaKind : null,
      visibility: typeof body.visibility === "string" ? body.visibility : null,
      retentionPolicy: typeof body.retentionPolicy === "string" ? body.retentionPolicy : null,
      uploadedFrom: typeof body.uploadedFrom === "string" ? body.uploadedFrom : null,
      guardianId: typeof body.guardianId === "string" ? body.guardianId : null,
      petId: typeof body.petId === "string" ? body.petId : null,
      appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
      groomingRecordId: typeof body.groomingRecordId === "string" ? body.groomingRecordId : null,
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : null,
    });

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "Could not create media upload intent.";
    return ownerMobileCorsJson(request, { message }, { status: 500 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
