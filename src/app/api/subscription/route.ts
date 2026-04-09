import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getOwnerSubscriptionSummary,
  OwnerBillingError,
  updateOwnerSubscriptionPreferences,
} from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

const patchSchema = z.object({
  currentPlanCode: z.enum(["monthly", "quarterly", "halfyearly", "yearly"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const summary = await getOwnerSubscriptionSummary(identity, shopId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "구독 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const body = patchSchema.parse(await request.json());
    const summary = await updateOwnerSubscriptionPreferences(identity, shopId, body);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "구독 변경 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "구독 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}
