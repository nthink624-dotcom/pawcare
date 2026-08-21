import { NextRequest, NextResponse } from "next/server";

import { computeAvailableSlots, computeRecommendedAvailableSlots } from "@/lib/availability";
import { validateCustomerBookingDate } from "@/lib/customer-booking-window";
import { getStaffBookingLoads } from "@/lib/staff-booking-load";
import { recommendAvailableSlotsWithAi } from "@/server/ai-slot-recommendations";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const date = searchParams.get("date") ?? "";
    const serviceId = searchParams.get("serviceId") ?? "";
    const staffId = searchParams.get("staffId") ?? "";
    const previewDurationMinutesRaw = searchParams.get("previewDurationMinutes") ?? "";
    const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;
    const summaryOnly = searchParams.get("summary") === "1";
    const previewDurationMinutes = previewDurationMinutesRaw ? Number(previewDurationMinutesRaw) : undefined;

    if (!shopId || !date || (!serviceId && !previewDurationMinutes)) {
      return NextResponse.json({ message: "예약 가능 시간을 조회할 정보가 부족합니다." }, { status: 400 });
    }
    const bookingDate = validateCustomerBookingDate(date);
    if (!bookingDate.ok) {
      return NextResponse.json({ message: bookingDate.message }, { status: 400 });
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
      staffId: staffId || null,
      staffMembers: bootstrap.staffMembers,
      staffScheduleOverrides: bootstrap.staffScheduleOverrides,
    });
    const baselineRecommendedSlots = computeRecommendedAvailableSlots({
      date,
      availableSlots: slots,
      appointments: bootstrap.appointments,
      services: bootstrap.services,
      excludeAppointmentId,
      staffId: staffId || null,
    });
    const customerVisibleSlots = slots;
    if (summaryOnly) {
      return NextResponse.json(
        {
          slots: customerVisibleSlots.slice(0, 1),
          recommendedSlots: [],
          recommendationSource: "rule",
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    const service = serviceId ? bootstrap.services.find((item) => item.id === serviceId) : null;
    const recommendation = await recommendAvailableSlotsWithAi({
      date,
      availableSlots: slots,
      baselineRecommendedSlots,
      serviceName: service?.name,
      durationMinutes: previewDurationMinutes ?? service?.duration_minutes,
      staffScoped: Boolean(staffId),
      recommendationMode: "continuity",
      customInstruction: "",
      staffLoads: getStaffBookingLoads({
        date,
        staffMembers: bootstrap.staffMembers,
        appointments: bootstrap.appointments,
        services: bootstrap.services,
      }),
      eligibleStaffBySlot: [],
    });

    return NextResponse.json(
      {
        // Keep the full deterministic slot set server-side. Customer booking is
        // intentionally AI-first: only the ranked candidates are exposed.
        slots: recommendation.recommendedSlots,
        recommendedSlots: recommendation.recommendedSlots,
        recommendationSource: recommendation.source,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "예약 가능 시간 조회 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
