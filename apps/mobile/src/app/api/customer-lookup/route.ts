import { NextRequest, NextResponse } from "next/server";

import { lookupCustomerBookings, lookupCustomerBookingsByToken } from "@/server/customer-bookings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const token = searchParams.get("t") ?? searchParams.get("token") ?? "";
    const phone = searchParams.get("phone") ?? "";
    const guardianName = searchParams.get("guardianName") ?? "";
    const petName = searchParams.get("petName") ?? "";

    if (!shopId) {
      return NextResponse.json({ message: "Missing required shop information." }, { status: 400 });
    }

    const result = token
      ? await lookupCustomerBookingsByToken(shopId, token)
      : await lookupCustomerBookings(shopId, phone, guardianName, petName);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load booking information.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
