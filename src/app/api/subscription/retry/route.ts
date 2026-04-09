import { NextRequest, NextResponse } from "next/server";

import { retryOwnerSubscriptionCharge } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const summary = await retryOwnerSubscriptionCharge(identity, shopId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "재결제를 처리하지 못했습니다." }, { status: 500 });
  }
}
