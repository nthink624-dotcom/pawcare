import { NextRequest, NextResponse } from "next/server";

import { computeAvailableSlots } from "@/lib/availability";
import { getBootstrap } from "@/server/repositories/app-repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") || undefined;
    const date = searchParams.get("date");
    const serviceId = searchParams.get("serviceId");
    const excludeAppointmentId = searchParams.get("excludeAppointmentId") || undefined;

    if (!date || !serviceId) {
      return NextResponse.json({ message: "날짜와 서비스를 함께 보내주세요." }, { status: 400 });
    }

    const data = await getBootstrap(shopId);
    const slots = computeAvailableSlots({
      date,
      serviceId,
      shop: data.shop,
      services: data.services,
      appointments: data.appointments,
      excludeAppointmentId,
    });

    return NextResponse.json({ date, serviceId, slots });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "예약 가능 시간을 불러오지 못했습니다." }, { status: 400 });
  }
}
