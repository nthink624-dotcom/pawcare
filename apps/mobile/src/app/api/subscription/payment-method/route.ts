import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getOwnerSubscriptionSummary, registerOwnerBillingMethod } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

const bodySchema = z.object({
  billingKey: z.string().min(1),
  issueId: z.string().optional().nullable(),
  paymentMethodLabel: z.string().optional().nullable(),
  planCode: z.enum(["monthly", "quarterly", "halfyearly", "yearly"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const payload = bodySchema.parse(await request.json());

    const summary = await registerOwnerBillingMethod(identity, shopId, {
      billingKey: payload.billingKey,
      issueId: payload.issueId,
      paymentMethodLabel: payload.paymentMethodLabel,
      autoRenewPlanCode: payload.planCode,
    });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "결제수단 등록 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "결제수단을 등록하지 못했습니다." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const summary = await getOwnerSubscriptionSummary(identity, shopId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "결제수단 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
