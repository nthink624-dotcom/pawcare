import { NextRequest, NextResponse } from "next/server";

import { computeAvailableSlots } from "@/lib/availability";
import { getBootstrap } from "@/server/bootstrap";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const date = searchParams.get("date") ?? "";
    const serviceId = searchParams.get("serviceId") ?? "";
    const previewDurationMinutesRaw = searchParams.get("previewDurationMinutes") ?? "";
    const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;
    const previewDurationMinutes = previewDurationMinutesRaw ? Number(previewDurationMinutesRaw) : undefined;

    if (!shopId || !date || (!serviceId && !previewDurationMinutes)) {
      return NextResponse.json({ message: "예약 가능 시간을 조회할 정보가 부족합니다." }, { status: 400 });
    }

    const bootstrap = await getBootstrap(shopId);
    const slots = computeAvailableSlots({
      date,
      serviceId: serviceId || undefined,
      durationMinutesOverride: previewDurationMinutes,
      shop: bootstrap.shop,
      services: bootstrap.services,
      appointments: bootstrap.appointments,
      excludeAppointmentId,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "예약 가능 시간 조회 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
