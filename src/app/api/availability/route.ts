import { NextRequest, NextResponse } from "next/server";

import { computeAvailableSlots, computeRecommendedAvailableSlots } from "@/lib/availability";
import { normalizeReservationPolicySettings } from "@/lib/reservation-policy-settings";
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
    const service = serviceId ? bootstrap.services.find((item) => item.id === serviceId) : null;
    const reservationPolicy = normalizeReservationPolicySettings(bootstrap.shop.reservation_policy_settings);
    const staffSlotSets = staffId || reservationPolicy.ai_booking_recommendation_mode !== "staff_balance"
      ? []
      : bootstrap.staffMembers.map((staffMember) => ({
          staffId: staffMember.id,
          slots: new Set(
            computeAvailableSlots({
              date,
              serviceId: serviceId || undefined,
              durationMinutesOverride: previewDurationMinutes,
              shop: bootstrap.shop,
              services: bootstrap.services,
              appointments: bootstrap.appointments,
              excludeAppointmentId,
              staffId: staffMember.id,
              staffMembers: bootstrap.staffMembers,
              staffScheduleOverrides: bootstrap.staffScheduleOverrides,
            }),
          ),
        }));
    const recommendation = await recommendAvailableSlotsWithAi({
      date,
      availableSlots: slots,
      baselineRecommendedSlots,
      serviceName: service?.name,
      durationMinutes: previewDurationMinutes ?? service?.duration_minutes,
      staffScoped: Boolean(staffId),
      recommendationMode: reservationPolicy.ai_booking_recommendation_mode ?? "continuity",
      customInstruction: reservationPolicy.ai_booking_custom_instruction ?? "",
      staffLoads: getStaffBookingLoads({
        date,
        staffMembers: bootstrap.staffMembers,
        appointments: bootstrap.appointments,
        services: bootstrap.services,
      }),
      eligibleStaffBySlot: slots.slice(0, 40).map((slot) => ({
        slot,
        staffIds: staffSlotSets.filter((staffSlotSet) => staffSlotSet.slots.has(slot)).map((staffSlotSet) => staffSlotSet.staffId),
      })),
    });

    return NextResponse.json(
      {
        slots,
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
