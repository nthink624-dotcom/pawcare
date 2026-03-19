import { NextRequest, NextResponse } from "next/server";

import { createAppointment, createCustomerBookingLead, updateAppointmentStatus } from "@/server/repositories/app-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = body.guardianName
      ? await createCustomerBookingLead(body)
      : await createAppointment(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "예약을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateAppointmentStatus(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "예약 상태를 바꾸지 못했습니다." }, { status: 400 });
  }
}
