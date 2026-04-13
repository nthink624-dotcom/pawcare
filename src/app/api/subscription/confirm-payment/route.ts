import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { OwnerBillingError, syncOwnerSubscriptionFromPayment } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

const bodySchema = z.object({
  paymentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { identity } = await requireOwnerBillingSession(request);
    const body = bodySchema.parse(await request.json());
    const summary = await syncOwnerSubscriptionFromPayment(body.paymentId);

    if (!summary) {
      return NextResponse.json({ message: "결제 정보를 아직 확인하지 못했습니다." }, { status: 400 });
    }

    if (summary.userId !== identity.id) {
      return NextResponse.json({ message: "다른 계정의 결제 정보입니다." }, { status: 403 });
    }

    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "결제 확인 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "결제 확인을 완료하지 못했습니다." }, { status: 500 });
  }
}
