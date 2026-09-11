import { NextRequest } from "next/server";

import {
  logSafeMediaUploadIntentDiagnostic,
  MEDIA_UPLOAD_INTENT_GENERIC_FAILURE,
  toSafeMediaUploadIntentStageHttpResponse,
} from "@/server/media-upload-intent-errors";
import { createOwnerMediaUploadIntent } from "@/server/media-service";
import { createPriceGuidePhotoSupportCode } from "@/lib/media/price-guide-upload-correlation";
import { reportPriceGuidePhotoLifecycle } from "@/lib/media/price-guide-photo-lifecycle";
import { createPriceGuideRequestCorrelationFingerprintForServer } from "@/server/price-guide-photo-cleanup-decision";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupAllowsMediaKind } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const WRITE_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  let requestCorrelationFingerprint: string | null = null;
  const startedAt = performance.now();
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const requestedShopId = typeof body.shopId === "string" ? body.shopId : undefined;
    const owner = await requireOwnerShop(request, requestedShopId);
    await assertOwnerInitialSetupAllowsMediaKind(
      owner.shopId,
      typeof body.mediaKind === "string" ? body.mediaKind : null,
    );
    const clientCorrelationId = typeof body.clientCorrelationId === "string" ? body.clientCorrelationId : null;
    const suppliedRequestFingerprint = typeof body.requestCorrelationFingerprint === "string"
      ? body.requestCorrelationFingerprint
      : null;
    if (body.mediaKind === "price_guide_source" && clientCorrelationId && suppliedRequestFingerprint) {
      const expected = createPriceGuideRequestCorrelationFingerprintForServer(clientCorrelationId);
      if (expected !== suppliedRequestFingerprint) {
        throw new OwnerApiError("요금표 사진 요청을 확인하지 못했습니다.", 400);
      }
      requestCorrelationFingerprint = expected;
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload_intent",
        status: "started",
        elapsedMs: 0,
        counts: { uploadIntentCount: 1, uploadCount: 0, providerRequestCount: 0, cleanupCount: 0 },
      });
    }
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
      clientCorrelationId,
      requestCorrelationFingerprint:
        typeof body.requestCorrelationFingerprint === "string" ? body.requestCorrelationFingerprint : null,
      metadata:
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : null,
    });

    if (requestCorrelationFingerprint) {
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload_intent",
        status: "succeeded",
        elapsedMs: performance.now() - startedAt,
        counts: { uploadIntentCount: 1, uploadCount: 0, providerRequestCount: 0, cleanupCount: 0 },
      });
    }

    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    const withSupportCode = <T extends { message: string }>(body: T) => {
      if (!requestCorrelationFingerprint) return body;
      const supportCode = createPriceGuidePhotoSupportCode(requestCorrelationFingerprint);
      return { ...body, message: `${body.message} 문의 코드: ${supportCode}`, supportCode };
    };
    if (requestCorrelationFingerprint) {
      reportPriceGuidePhotoLifecycle({
        requestCorrelationFingerprint,
        stage: "upload_intent",
        status: "failed",
        elapsedMs: performance.now() - startedAt,
        counts: { uploadIntentCount: 1, uploadCount: 0, providerRequestCount: 0, cleanupCount: 0 },
        failureClass: "upload_intent",
      });
    }
    const diagnostic = toSafeMediaUploadIntentStageHttpResponse(error);
    if (diagnostic) {
      logSafeMediaUploadIntentDiagnostic(error);
      return ownerMobileCorsJson(request, withSupportCode(diagnostic.body), { status: diagnostic.status }, WRITE_CORS);
    }

    if (error instanceof OwnerApiError && error.status < 500) {
      return ownerMobileCorsJson(request, withSupportCode({ message: error.message }), { status: error.status }, WRITE_CORS);
    }

    return ownerMobileCorsJson(
      request,
      withSupportCode(MEDIA_UPLOAD_INTENT_GENERIC_FAILURE.body),
      { status: MEDIA_UPLOAD_INTENT_GENERIC_FAILURE.status },
      WRITE_CORS,
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
