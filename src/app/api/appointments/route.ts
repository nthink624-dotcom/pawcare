import { NextRequest, NextResponse } from "next/server";

import { createAppointment, createCustomerBookingLead, updateAppointmentStatus } from "@/server/repositories/app-repository";
import { ensureEntityBelongsToOwnerShop, getOwnerRouteAccess } from "@/server/owner-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.guardianName || body.source !== "owner") {
      const result = body.guardianName ? await createCustomerBookingLead(body) : await createAppointment(body);
      return NextResponse.json(result);
    }

    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const result = await createAppointment({
      ...body,
      shopId: access.context.shopId,
      source: "owner",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "예약을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await getOwnerRouteAccess();
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const allowed = await ensureEntityBelongsToOwnerShop(access.context.shopId, "appointment", body.appointmentId);
    if (!allowed) {
      return NextResponse.json({ message: "다른 매장 예약은 수정할 수 없습니다." }, { status: 403 });
    }

    const result = await updateAppointmentStatus(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "예약 상태를 바꾸지 못했습니다." }, { status: 400 });
  }
}
