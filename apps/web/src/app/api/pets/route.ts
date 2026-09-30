import { NextRequest } from "next/server";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { createPet, deletePet, updatePet } from "@/server/owner-mutations";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const PET_WRITE_CORS = { methods: "POST, PATCH, DELETE, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await createPet(body);
    return ownerMobileCorsJson(request, result, undefined, PET_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, PET_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "반려동물 저장에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, PET_WRITE_CORS);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await updatePet({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, PET_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, PET_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "반려동물 수정에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, PET_WRITE_CORS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await deletePet({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, PET_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, PET_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "반려동물 삭제에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, PET_WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, PET_WRITE_CORS);
}
