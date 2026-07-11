import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { OwnerBillingError } from "@/server/owner-billing";
import { confirmOwnerAlimtalkCreditPurchase } from "@/server/owner-alimtalk-credit-purchase";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

const bodySchema = z.object({
  paymentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const body = bodySchema.parse(await request.json());
    const result = await confirmOwnerAlimtalkCreditPurchase(body.paymentId, { identity, shopId });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "결제 확인 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "알림톡 충전을 완료하지 못했습니다." }, { status: 500 });
  }
}
