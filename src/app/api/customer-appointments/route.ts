import { NextRequest, NextResponse } from "next/server";

import { updateCustomerBooking } from "@/server/customer-bookings";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateCustomerBooking(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "예약 변경 처리 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
