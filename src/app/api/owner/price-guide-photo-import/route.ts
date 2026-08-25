import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractPriceGuideFromImages } from "@/server/price-guide-photo-import";
import { getOwnerMediaSignedUrl } from "@/server/media-service";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  shopId: z.string().trim().min(1),
  mediaAssetIds: z.array(z.string().uuid()).min(1).max(5),
});

export async function POST(request: NextRequest) {
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
    const result = await extractPriceGuideFromImages(signed.map((item) => item.signedUrl));
    return NextResponse.json({
      ...result,
      sourceMediaAssetIds: input.mediaAssetIds,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ message: "요금표 사진 요청을 확인해 주세요." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "요금표 사진을 분석하지 못했습니다.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
    return NextResponse.json({ message }, { status });
  }
}
