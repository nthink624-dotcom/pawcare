import { NextRequest, NextResponse } from "next/server";

import { cancelOwnerSubscriptionRenewal, OwnerBillingError } from "@/server/owner-billing";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const summary = await cancelOwnerSubscriptionRenewal(identity, shopId);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof OwnerBillingError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "정기결제 취소를 처리하지 못했습니다." }, { status: 500 });
  }
}
