import { NextRequest } from "next/server";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { createGuardian, softDeleteGuardians, updateGuardian } from "@/server/owner-mutations";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const GUARDIAN_WRITE_CORS = { methods: "POST, PATCH, DELETE, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await createGuardian(body);
    return ownerMobileCorsJson(request, result, undefined, GUARDIAN_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, GUARDIAN_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "고객 저장에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, GUARDIAN_WRITE_CORS);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await updateGuardian({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, GUARDIAN_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, GUARDIAN_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "고객 정보 수정에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, GUARDIAN_WRITE_CORS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await softDeleteGuardians({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, GUARDIAN_WRITE_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, GUARDIAN_WRITE_CORS);
    }

    const message = error instanceof Error ? error.message : "고객 삭제에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, GUARDIAN_WRITE_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, GUARDIAN_WRITE_CORS);
}
