import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createAppointment, updateAppointmentDetails, updateAppointmentStatus } from "@/server/owner-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await requireOwnerShop(request, body?.shopId);
    console.log("[appointments-api] POST received", {
      shopId: body?.shopId ?? null,
      guardianId: body?.guardianId ?? null,
      petId: body?.petId ?? null,
      serviceId: body?.serviceId ?? null,
      appointmentDate: body?.appointmentDate ?? null,
      appointmentTime: body?.appointmentTime ?? null,
      source: body?.source ?? null,
    });
    const result = await createAppointment(body);
    console.log("[appointments-api] POST created", {
      appointmentId: result?.id ?? null,
      status: result?.status ?? null,
      source: result?.source ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.log("[appointments-api] POST failed", {
      message: error instanceof Error ? error.message : String(error),
    });
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
    const nextStatus = typeof body?.status === "string" ? body.status : null;
    const action =
      typeof body?.eventType === "string" ? body.eventType : typeof body?.action === "string" ? body.action : null;

    console.log("[appointments-api] PATCH received", {
      appointmentId: body?.appointmentId ?? null,
      action,
      nextStatus,
      storeId: owner.shopId,
    });

    if (!appointment) {
      return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
    }

    const result =
      typeof body?.status === "string"
        ? await updateAppointmentStatus(body)
        : await updateAppointmentDetails({ ...body, shopId: owner.shopId });

    if (typeof body?.status === "string") {
      console.log("[appointments-api] appointment updated", {
        appointmentId: appointment.id,
        previousStatus: appointment.status,
        nextStatus: result?.status ?? body.status,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 상태 변경 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
