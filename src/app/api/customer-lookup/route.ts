import { NextRequest, NextResponse } from "next/server";

import { lookupCustomerBookings } from "@/server/customer-bookings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const phone = searchParams.get("phone") ?? "";

    if (!shopId || !phone) {
      return NextResponse.json({ message: "조회에 필요한 연락처 정보를 입력해 주세요." }, { status: 400 });
    }

    const result = await lookupCustomerBookings(shopId, phone);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "예약 조회 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
