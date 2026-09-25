import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getBootstrapOwnerInitialSetupReadiness } from "@/lib/owner-initial-setup-readiness";
import { getBootstrap } from "@/server/bootstrap";
import {
  evaluateBoundOwnerDay7Activation,
  recordBoundOwnerOperationalActivity,
  recordBoundShopAcquisitionMilestone,
} from "@/server/marketing-acquisition";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

const bodySchema = z.object({
  shopId: z.string().trim().min(1),
  step: z.enum(["hours", "staff", "pricing"]),
}).strict();

const acquisitionStepKey = {
  hours: "operating_hours",
  staff: "staff_hours",
  pricing: "services",
} as const;

function buildCanonicalActivityEvidence(
  step: z.infer<typeof bodySchema>["step"],
  canonical: Awaited<ReturnType<typeof getBootstrap>>,
) {
  if (step === "hours") {
    return JSON.stringify(canonical.shop.business_hours ?? {});
  }
  if (step === "staff") {
    return JSON.stringify(
      canonical.staffMembers
        .map((staff) => ({
          id: staff.id,
          role: staff.role,
          defaultDays: staff.defaultDays,
          startTime: staff.startTime,
          endTime: staff.endTime,
          regularOff: staff.regularOff,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  }
  return JSON.stringify(
    canonical.services
      .map((service) => ({
        id: service.id,
        price: service.price,
        durationMinutes: service.duration_minutes,
        active: service.is_active,
        updatedAt: service.updated_at,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    if (!owner.userId) {
      return NextResponse.json({ status: "schema_missing" });
    }

    const canonical = await getBootstrap(owner.shopId, {
      allowMock: false,
      includeLanding: false,
      includeNotifications: false,
      includeGroomingRecords: false,
      includeOwnerExtras: false,
      includeStaffProfileImages: false,
      includePilotCohort: false,
    });
    const readiness = getBootstrapOwnerInitialSetupReadiness(canonical);
    if (!readiness.steps[body.step]) {
      return NextResponse.json(
        { message: "저장된 초기 설정을 아직 확인하지 못했습니다." },
        { status: 409 },
      );
    }

    const stepKey = acquisitionStepKey[body.step];
    const [milestone] = await Promise.allSettled([
      recordBoundShopAcquisitionMilestone({
        ownerUserId: owner.userId,
        shopId: owner.shopId,
        eventName: "setup_step_completed",
        authoritativeEventId: `${owner.shopId}:${stepKey}`,
        stepKey,
      }),
      recordBoundOwnerOperationalActivity({
        ownerUserId: owner.userId,
        shopId: owner.shopId,
        source: stepKey,
        authoritativeEvidence: buildCanonicalActivityEvidence(body.step, canonical),
      }),
    ]);
    await Promise.allSettled([
      evaluateBoundOwnerDay7Activation({ ownerUserId: owner.userId, shopId: owner.shopId }),
    ]);
    const status = milestone.status === "fulfilled" ? milestone.value : "rejected";

    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "초기 설정 확인 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "초기 설정 완료 상태를 확인하지 못했습니다." }, { status: 500 });
  }
}
