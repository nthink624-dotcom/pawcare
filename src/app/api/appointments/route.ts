import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createAppointment, updateAppointmentDetails, updateAppointmentStatus } from "@/server/owner-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    const result = await createAppointment(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 등록 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const owner = await requireOwnerShop(request);
    const bootstrap = await getBootstrap(owner.shopId);
    const appointment = bootstrap.appointments.find((item) => item.id === body?.appointmentId);

    if (!appointment) {
      return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
    }

    const result =
      typeof body?.status === "string"
        ? await updateAppointmentStatus(body)
        : await updateAppointmentDetails({ ...body, shopId: owner.shopId });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 상태 변경 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
