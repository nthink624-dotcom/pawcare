import { NextRequest } from "next/server";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { updateCustomerPageSettings } from "@/server/owner-mutations";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const CUSTOMER_PAGE_SETTINGS_CORS = { methods: "PATCH, OPTIONS" };

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const result = await updateCustomerPageSettings(body, {
      ownerUserId: owner.userId,
      changedByUserId: owner.userId,
    });
    return ownerMobileCorsJson(request, result, undefined, CUSTOMER_PAGE_SETTINGS_CORS);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status }, CUSTOMER_PAGE_SETTINGS_CORS);
    }

    const message = error instanceof Error ? error.message : "고객 노출 정보 저장 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 400 }, CUSTOMER_PAGE_SETTINGS_CORS);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, CUSTOMER_PAGE_SETTINGS_CORS);
}
