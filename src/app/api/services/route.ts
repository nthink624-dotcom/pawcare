import { NextRequest } from "next/server";
import { z } from "zod";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { deleteService, upsertService } from "@/server/owner-mutations";
import { redactPriceGuideRawTextForStorage } from "@/server/price-guide-photo-import";

const WRITE_CORS = { methods: "POST, DELETE, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    const result = await upsertService({
      ...body,
      shopId: owner.shopId,
      priceGuide: redactPriceGuideRawTextForStorage(body?.priceGuide),
    });
    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }
    if (error instanceof z.ZodError) {
      return ownerMobileCorsJson(request, { message: "서비스 저장 내용을 다시 확인해 주세요." }, { status: 400 }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "서비스 저장 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, WRITE_CORS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    const result = await deleteService({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "서비스 삭제 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, WRITE_CORS);
}
