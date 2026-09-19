import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { initialSetupShopSettingsSchema } from "@/server/schemas";
import { updateInitialSetupShopSettings } from "@/server/owner-mutations";
import { temporaryClosedDateChangesSchema } from "@/lib/initial-setup-closed-dates";

// The first-time wizard may revisit hours after readiness becomes complete.
// Keep this write limited to hours; do not run full-settings normalization.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { temporaryClosedDateChanges, ...hoursInput } = body;
    const changes = temporaryClosedDateChanges === undefined ? undefined : temporaryClosedDateChangesSchema.parse(temporaryClosedDateChanges);
    const payload = initialSetupShopSettingsSchema.parse(hoursInput);
    const owner = await requireOwnerShop(request, payload.shopId);
    assertOwnerOrManager(owner);
    const result = await updateInitialSetupShopSettings({ ...payload, shopId: owner.shopId }, { preserveTemporaryClosedDates: true, temporaryClosedDateChanges: changes });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof z.ZodError ? "영업시간 입력 내용을 확인해 주세요." : "영업시간을 저장하지 못했어요. 다시 시도해 주세요." }, { status: 400 });
  }
}
