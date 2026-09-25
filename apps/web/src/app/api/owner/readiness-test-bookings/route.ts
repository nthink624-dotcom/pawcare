import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  evaluateBoundOwnerDay7Activation,
  recordBoundOwnerOperationalActivity,
  recordBoundShopAcquisitionMilestone,
} from "@/server/marketing-acquisition";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { createAppointment } from "@/server/owner-mutations";

const bodySchema = z.object({
  shopId: z.string().trim().min(1),
  requestId: z.string().uuid(),
  guardianId: z.string().uuid(),
  petId: z.string().uuid(),
  serviceId: z.string().trim().min(1),
  staffId: z.string().trim().min(1).nullable().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointmentTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(24 * 60).optional(),
}).strict();

type ReadinessAppointmentRow = {
  id: string;
  shop_id: string;
  purpose: "owner_readiness_test";
  created_by_owner_user_id: string;
  owner_request_id: string;
};

async function findExactReadinessAppointment(input: {
  shopId: string;
  ownerUserId: string;
  requestId: string;
  appointmentId?: string;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("테스트 예약 저장 구성을 확인해 주세요.", 503);

  let query = admin
    .from("appointments")
    .select("id,shop_id,purpose,created_by_owner_user_id,owner_request_id")
    .eq("shop_id", input.shopId)
    .eq("purpose", "owner_readiness_test")
    .eq("created_by_owner_user_id", input.ownerUserId)
    .eq("owner_request_id", input.requestId);
  if (input.appointmentId) query = query.eq("id", input.appointmentId);
  const result = await query.maybeSingle();
  if (result.error) throw new OwnerApiError("테스트 예약 저장 상태를 확인하지 못했습니다.", 503);
  return (result.data as ReadinessAppointmentRow | null) ?? null;
}

async function recordBestEffortAttribution(row: ReadinessAppointmentRow) {
  await Promise.allSettled([
    recordBoundOwnerOperationalActivity({
      ownerUserId: row.created_by_owner_user_id,
      shopId: row.shop_id,
      source: "test_booking",
      authoritativeEvidence: row.id,
    }),
    recordBoundShopAcquisitionMilestone({
      ownerUserId: row.created_by_owner_user_id,
      shopId: row.shop_id,
      eventName: "test_booking_created",
      authoritativeEventId: row.id,
      bookingSource: "owner",
    }),
  ]);
  await Promise.allSettled([
    evaluateBoundOwnerDay7Activation({
      ownerUserId: row.created_by_owner_user_id,
      shopId: row.shop_id,
    }),
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    if (owner.role !== "owner") throw new OwnerApiError("대표 계정만 테스트 예약을 만들 수 있습니다.", 403);
    if (!owner.userId) throw new OwnerApiError("테스트 예약은 로그인된 개발 환경에서 확인해 주세요.", 503);
    await assertOwnerInitialSetupComplete(owner.shopId);

    let replayed = true;
    let row = await findExactReadinessAppointment({
      shopId: owner.shopId,
      ownerUserId: owner.userId,
      requestId: body.requestId,
    });

    if (!row) {
      replayed = false;
      try {
        const appointment = await createAppointment(
          {
            shopId: owner.shopId,
            guardianId: body.guardianId,
            petId: body.petId,
            serviceId: body.serviceId,
            staffId: body.staffId ?? null,
            appointmentDate: body.appointmentDate,
            appointmentTime: body.appointmentTime,
            durationMinutes: body.durationMinutes,
            memo: "초기 설정 테스트 예약",
            source: "owner",
          },
          { ownerReadinessTest: { createdByOwnerUserId: owner.userId, requestId: body.requestId } },
        );
        row = await findExactReadinessAppointment({
          shopId: owner.shopId,
          ownerUserId: owner.userId,
          requestId: body.requestId,
          appointmentId: appointment.id,
        });
      } catch (error) {
        row = await findExactReadinessAppointment({
          shopId: owner.shopId,
          ownerUserId: owner.userId,
          requestId: body.requestId,
        });
        if (!row) throw error;
        replayed = true;
      }
    }

    if (!row) throw new OwnerApiError("테스트 예약 저장 결과를 확인하지 못했습니다.", 503);
    await recordBestEffortAttribution(row);
    return NextResponse.json({ appointmentId: row.id, replayed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "테스트 예약 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "테스트 예약을 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
