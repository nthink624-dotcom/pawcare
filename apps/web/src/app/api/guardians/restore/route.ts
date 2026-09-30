import { NextRequest } from "next/server";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { restoreGuardians } from "@/server/owner-mutations";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const RESTORE_GUARDIANS_CORS = { methods: "POST, OPTIONS" };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await restoreGuardians({ ...body, shopId: owner.shopId });
    return ownerMobileCorsJson(request, result, undefined, RESTORE_GUARDIANS_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, RESTORE_GUARDIANS_CORS);
    }

    const message = error instanceof Error ? error.message : "고객 복구에 실패했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, RESTORE_GUARDIANS_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, RESTORE_GUARDIANS_CORS);
}
