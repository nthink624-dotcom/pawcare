import { NextRequest, NextResponse } from "next/server";

import { lookupCustomerBookings } from "@/server/customer-bookings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const phone = searchParams.get("phone") ?? "";
    const guardianName = searchParams.get("guardianName") ?? "";

    if (!shopId || !phone || !guardianName) {
      return NextResponse.json(
        { message: "??? ??? ???? ??? ??? ??? ???." },
        { status: 400 },
      );
    }

    const result = await lookupCustomerBookings(shopId, phone, guardianName);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "?? ?? ? ??? ??????.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
