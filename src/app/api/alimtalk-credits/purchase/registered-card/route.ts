import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { type AlimtalkCreditProductId } from "@/lib/alimtalk-credit-products";
import { purchaseOwnerAlimtalkCreditsWithRegisteredCard } from "@/server/owner-alimtalk-credit-purchase";
import { OwnerBillingError } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

const productIds = ["credits_1000", "credits_3000", "credits_10000"] as const satisfies readonly AlimtalkCreditProductId[];

const bodySchema = z.object({
  productId: z.enum(productIds),
  requestId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const body = bodySchema.parse(await request.json());
    const result = await purchaseOwnerAlimtalkCreditsWithRegisteredCard(
      identity,
      shopId,
      body.productId,
      body.requestId,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "등록 카드 결제 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "등록 카드로 이용권을 결제하지 못했습니다." }, { status: 500 });
  }
}
