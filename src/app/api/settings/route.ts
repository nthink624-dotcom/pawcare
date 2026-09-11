import { NextRequest, NextResponse } from "next/server";

import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { getBootstrapOwnerInitialSetupReadiness } from "@/lib/owner-initial-setup-readiness";
import {
  assertInitialSetupSettingsPayload,
  loadOwnerInitialSetupBootstrap,
} from "@/server/owner-initial-setup-guard";
import { updateInitialSetupShopSettings, updateShopSettings } from "@/server/owner-mutations";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request, body?.shopId);
    assertOwnerOrManager(owner);
    const bootstrap = await loadOwnerInitialSetupBootstrap(owner.shopId);
    const readiness = getBootstrapOwnerInitialSetupReadiness(bootstrap);
    if (!readiness.completed) assertInitialSetupSettingsPayload(body);
    const result = readiness.completed
      ? await updateShopSettings(body, {
          ownerUserId: owner.userId,
          changedByUserId: owner.userId,
        })
      : await updateInitialSetupShopSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "설정 저장 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
