import { NextRequest, NextResponse } from "next/server";

import { computeAvailableSlots, computeRecommendedAvailableSlots } from "@/lib/availability";
import { validateCustomerBookingDate } from "@/lib/customer-booking-window";
import { getStaffBookingLoads } from "@/lib/staff-booking-load";
import { recommendAvailableSlotsWithAi } from "@/server/ai-slot-recommendations";
import { OwnerApiError } from "@/server/owner-api-auth";
import { requireOwnerInitialSetupCompleteBootstrap } from "@/server/owner-initial-setup-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId") ?? "";
    const date = searchParams.get("date") ?? "";
    const dates = (searchParams.get("dates") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const serviceId = searchParams.get("serviceId") ?? "";
    const staffId = searchParams.get("staffId") ?? "";
    const previewDurationMinutesRaw = searchParams.get("previewDurationMinutes") ?? "";
    const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;
    const summaryOnly = searchParams.get("summary") === "1";
    const fullSlots = searchParams.get("full") === "1";
    const includeStaffAvailability = searchParams.get("includeStaff") === "1";
    const previewDurationMinutes = previewDurationMinutesRaw ? Number(previewDurationMinutesRaw) : undefined;

    const requestedDates = dates.length > 0 ? Array.from(new Set(dates)) : date ? [date] : [];
    if (!shopId || requestedDates.length === 0 || requestedDates.length > 60 || (!serviceId && !previewDurationMinutes)) {
      return NextResponse.json({ message: "예약 가능 시간을 조회할 정보가 부족합니다." }, { status: 400 });
    }
    for (const requestedDate of requestedDates) {
      const bookingDate = validateCustomerBookingDate(requestedDate);
      if (!bookingDate.ok) {
        return NextResponse.json({ message: bookingDate.message }, { status: 400 });
      }
    }

    const bootstrap = await requireOwnerInitialSetupCompleteBootstrap(shopId);
    const slotsForDate = (requestedDate: string, requestedStaffId: string | null = staffId || null) => computeAvailableSlots({
      date: requestedDate,
      serviceId: serviceId || undefined,
      durationMinutesOverride: previewDurationMinutes,
      shop: bootstrap.shop,
      services: bootstrap.services,
      appointments: bootstrap.appointments,
      excludeAppointmentId,
      staffId: requestedStaffId,
      staffMembers: bootstrap.staffMembers,
      staffScheduleOverrides: bootstrap.staffScheduleOverrides,
    });
    const availabilityByDate = requestedDates.length > 1
      ? Object.fromEntries(requestedDates.map((requestedDate) => [requestedDate, slotsForDate(requestedDate, null).length > 0]))
      : undefined;
    if (availabilityByDate) {
      return NextResponse.json(
        { slots: [], recommendedSlots: [], recommendationSource: "rule", availabilityByDate },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const slots = Array.from(new Set(slotsForDate(date)));
    const baselineRecommendedSlots = computeRecommendedAvailableSlots({
      date,
      availableSlots: slots,
      appointments: bootstrap.appointments,
      services: bootstrap.services,
      excludeAppointmentId,
      staffId: staffId || null,
    });
    const customerVisibleSlots = slots;
    const staffAvailability = includeStaffAvailability
      ? Object.fromEntries(
          bootstrap.staffMembers.map((staffMember) => [staffMember.id, slotsForDate(date, staffMember.id).length > 0]),
        )
      : undefined;
    if (summaryOnly) {
      return NextResponse.json(
        {
          slots: customerVisibleSlots.slice(0, 1),
          recommendedSlots: [],
          recommendationSource: "rule",
          staffAvailability,
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    if (fullSlots) {
      return NextResponse.json(
        {
          slots: customerVisibleSlots,
          recommendedSlots: baselineRecommendedSlots,
          recommendationSource: "rule",
          staffAvailability,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
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
        staffAvailability,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "예약 가능 시간 조회 중 문제가 발생했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
