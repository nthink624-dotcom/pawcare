import { NextRequest, NextResponse } from "next/server";

import { lookupCustomerBookingsByToken } from "@/server/customer-bookings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const token = searchParams.get("t") ?? searchParams.get("token") ?? "";

    if (!shopId) {
      return NextResponse.json({ message: "Missing required shop information." }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ message: "예약 관리 링크를 다시 열어주세요." }, { status: 401 });
    }

    const result = await lookupCustomerBookingsByToken(shopId, token);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking information.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
