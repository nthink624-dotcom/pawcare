import { NextRequest, NextResponse } from "next/server";

import { quoteCustomerDiscount } from "@/server/customer-discount-quote";

export async function POST(request: NextRequest) {
  try {
    const result = await quoteCustomerDiscount(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "적용 가능한 혜택을 확인하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
