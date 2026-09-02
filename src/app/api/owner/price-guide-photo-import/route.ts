import { NextRequest } from "next/server";
import { z } from "zod";

import {
  preparePriceGuideProviderImages,
  PRICE_GUIDE_PRIVACY_WARNING,
  PriceGuideImagePrivacyError,
  toPriceGuideProviderDataUrl,
  type PriceGuideProviderImage,
} from "@/server/price-guide-image-privacy";
import {
  extractPriceGuideFromImages,
  PriceGuidePhotoImportError,
} from "@/server/price-guide-photo-import";
import {
  decidePriceGuideSourceCleanupRecovery,
  type PriceGuideSourceCleanupProof,
  type PriceGuideSourceCleanupDecision,
} from "@/server/price-guide-photo-cleanup-decision";
import {
  getOwnerMediaSignedUrl,
  removeOwnerPriceGuideSourceMedia,
} from "@/server/media-service";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  shopId: z.string().trim().min(1),
  mediaAssetIds: z.array(z.string().uuid()).min(1).max(5),
  privacyConfirmed: z.literal(true),
});

const cleanupRequestSchema = requestSchema.pick({ shopId: true, mediaAssetIds: true }).extend({
  cleanupProofs: z.array(z.object({
    mediaAssetId: z.string().uuid(),
    proof: z.string().regex(/^[a-f0-9]{64}$/i),
  }).strict()).max(5).default([]),
});
const WRITE_CORS = { methods: "POST, DELETE, OPTIONS" };

const SOURCE_DOWNLOAD_TIMEOUT_MS = 15_000;
const SOURCE_DOWNLOAD_MAX_BYTES = 3 * 1024 * 1024;

async function findPriceGuideSourceCleanupRecovery(
  shopId: string,
  mediaAssetIds: string[],
  cleanupProofs: PriceGuideSourceCleanupProof[],
): Promise<PriceGuideSourceCleanupDecision> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return decidePriceGuideSourceCleanupRecovery(mediaAssetIds, { status: "unavailable" });
  }

  const result = await admin
    .from("media_assets")
    .select("id, media_kind, deleted_at")
    .eq("shop_id", shopId)
    .in("id", mediaAssetIds);
  if (result.error) {
    return decidePriceGuideSourceCleanupRecovery(mediaAssetIds, { status: "unavailable" });
  }

  return decidePriceGuideSourceCleanupRecovery(
    mediaAssetIds,
    { status: "ok", assets: result.data ?? [] },
    { shopId, secret: serverEnv.authFlowSecret, cleanupProofs },
  );
}

async function downloadPriceGuideSource(signedUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(signedUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new OwnerApiError("요금표 원본 사진을 불러오지 못했습니다.", 502);
    }
    const declaredBytes = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > SOURCE_DOWNLOAD_MAX_BYTES) {
      throw new PriceGuideImagePrivacyError(
        "IMAGE_SOURCE_TOO_LARGE",
        "요금표 사진을 안전한 크기로 줄이지 못했습니다. 더 작은 사진으로 다시 시도해 주세요.",
        413,
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > SOURCE_DOWNLOAD_MAX_BYTES) {
      buffer.fill(0);
      throw new PriceGuideImagePrivacyError(
        "IMAGE_SOURCE_TOO_LARGE",
        "요금표 사진을 안전한 크기로 줄이지 못했습니다. 더 작은 사진으로 다시 시도해 주세요.",
        413,
      );
    }
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

function noStoreJson(request: NextRequest, body: unknown, init?: { status?: number; retryAfterSeconds?: number }) {
  const response = ownerMobileCorsJson(request, body, {
    status: init?.status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  }, WRITE_CORS);
  if (init?.retryAfterSeconds) response.headers.set("Retry-After", String(init.retryAfterSeconds));
  return response;
}

export async function POST(request: NextRequest) {
  let sourceBuffers: Buffer[] = [];
  let providerImages: PriceGuideProviderImage[] = [];
  try {
    const input = requestSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    assertOwnerOrManager(owner);
    const signed = await Promise.all(input.mediaAssetIds.map((mediaAssetId) =>
      getOwnerMediaSignedUrl(owner, { mediaAssetId, variantKey: "original" }),
    ));
    if (signed.some((item) => item.mediaAsset.media_kind !== "price_guide_source")) {
      throw new OwnerApiError("요금표 원본으로 등록한 사진만 분석할 수 있습니다.", 400);
    }
    if (signed.some((item) => item.mediaAsset.visibility !== "private")) {
      throw new OwnerApiError("비공개 요금표 원본 사진만 분석할 수 있습니다.", 400);
    }

    try {
      const downloads = await Promise.allSettled(
        signed.map((item) => downloadPriceGuideSource(item.signedUrl)),
      );
      sourceBuffers = downloads.flatMap((download) => download.status === "fulfilled" ? [download.value] : []);
      const failedDownload = downloads.find((download) => download.status === "rejected");
      if (failedDownload?.status === "rejected") throw failedDownload.reason;
      providerImages = await preparePriceGuideProviderImages(sourceBuffers);
    } finally {
      sourceBuffers.forEach((buffer) => buffer.fill(0));
      sourceBuffers = [];
      await removeOwnerPriceGuideSourceMedia(owner, { mediaAssetIds: input.mediaAssetIds });
    }

    const result = await extractPriceGuideFromImages(providerImages.map(toPriceGuideProviderDataUrl));
    return noStoreJson(request, {
      ...result,
      issues: [{
        path: "원본 전체",
        message: PRICE_GUIDE_PRIVACY_WARNING,
        confidence: "medium" as const,
      }, ...result.issues],
      sourceMediaAssetIds: input.mediaAssetIds,
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return noStoreJson(request, {
        code: error.status >= 500 ? "MEDIA_PREPARATION_FAILED" : "MEDIA_REQUEST_INVALID",
        message: error.status >= 500
          ? "요금표 사진을 안전하게 준비하지 못했습니다. 사진 없이 직접 입력해 주세요."
          : error.message,
      }, { status: error.status });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return noStoreJson(request, { code: "REQUEST_INVALID", message: "요금표 사진 요청과 개인정보 확인 항목을 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof PriceGuideImagePrivacyError) {
      return noStoreJson(request, { code: error.code, message: error.message }, { status: error.status });
    }
    if (error instanceof PriceGuidePhotoImportError) {
      return noStoreJson(request,
        { code: error.code, message: error.message },
        { status: error.status, retryAfterSeconds: error.retryAfterSeconds },
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      return noStoreJson(request, {
        code: "MEDIA_DOWNLOAD_TIMEOUT",
        message: "요금표 사진을 불러오는 시간이 초과됐습니다. 다시 시도하거나 사진 없이 직접 입력해 주세요.",
      }, { status: 504 });
    }
    return noStoreJson(request, {
      code: "VISION_FAILED",
      message: "요금표 사진을 분석하지 못했습니다. 사진 없이 직접 입력해 주세요.",
    }, { status: 502 });
  } finally {
    sourceBuffers.forEach((buffer) => buffer.fill(0));
    providerImages.forEach((image) => image.buffer.fill(0));
  }
}

export async function DELETE(request: NextRequest) {
  let owner: Awaited<ReturnType<typeof requireOwnerShop>> | null = null;
  let mediaAssetIds: string[] = [];
  let cleanupProofs: PriceGuideSourceCleanupProof[] = [];
  try {
    const input = cleanupRequestSchema.parse(await request.json());
    owner = await requireOwnerShop(request, input.shopId);
    assertOwnerOrManager(owner);
    mediaAssetIds = input.mediaAssetIds;
    cleanupProofs = input.cleanupProofs;
    await removeOwnerPriceGuideSourceMedia(owner, { mediaAssetIds, cleanupProofs });
    return noStoreJson(request, { deleted: true, hardPurged: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return noStoreJson(request, { code: "REQUEST_INVALID", message: "정리할 요금표 사진을 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof OwnerApiError && error.status === 400 && owner) {
      let cleanupRecovery: PriceGuideSourceCleanupDecision;
      try {
        cleanupRecovery = await findPriceGuideSourceCleanupRecovery(owner.shopId, mediaAssetIds, cleanupProofs);
      } catch {
        return noStoreJson(request, {
          code: "MEDIA_CLEANUP_FAILED",
          message: "요금표 원본 사진을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        }, { status: 503 });
      }
      if (cleanupRecovery.kind === "already_deleted") {
        return noStoreJson(request, { deleted: true, hardPurged: true });
      }
      if (cleanupRecovery.kind === "unavailable") {
        return noStoreJson(request, {
          code: cleanupRecovery.code,
          message: "요금표 원본 사진을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        }, { status: cleanupRecovery.status });
      }
    }
    if (error instanceof OwnerApiError && error.status < 500) {
      return noStoreJson(request, { code: "MEDIA_REQUEST_INVALID", message: error.message }, { status: error.status });
    }
    return noStoreJson(request, {
      code: "MEDIA_CLEANUP_FAILED",
      message: "요금표 원본 사진을 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    }, { status: 503 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
