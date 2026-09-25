import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { OWNER_PILOT_INITIAL_FREE_DAYS } from "@/lib/billing/owner-pilot-benefit";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import {
  getOwnerPilotBenefitStatus,
  grantOwnerPilotBenefit,
  OwnerPilotBenefitError,
} from "@/server/owner-pilot-benefits";

const identitySchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
});

const grantSchema = identitySchema.extend({
  kind: z.enum(["initial", "feedback_issue"]),
  days: z.number().int().min(3).max(60),
  reason: z.string().trim().min(3).max(300),
  idempotencyKey: z.string().uuid(),
});

function errorResponse(error: unknown) {
  if (error instanceof AdminApiError || error instanceof OwnerPilotBenefitError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ ok: false, message: "혜택 대상, 사유와 일수를 확인해 주세요." }, { status: 400 });
  }
  return NextResponse.json({ ok: false, message: "파일럿 혜택 처리 상태를 확인하지 못했습니다." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const identity = identitySchema.parse({
      userId: request.nextUrl.searchParams.get("userId"),
      shopId: request.nextUrl.searchParams.get("shopId"),
    });
    const benefit = await getOwnerPilotBenefitStatus(identity);
    return NextResponse.json({ ok: true, benefit });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = grantSchema.parse(await request.json());
    const benefit = await grantOwnerPilotBenefit({
      ...body,
      days: body.kind === "initial" ? OWNER_PILOT_INITIAL_FREE_DAYS : body.days,
      adminEmail: admin.email.trim().toLowerCase(),
    });
    return NextResponse.json({ ok: true, benefit });
  } catch (error) {
    return errorResponse(error);
  }
}
